import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { NextRequest } from "next/server";
import { getPublication } from "./publications";
import type { AccessInput } from "./publication-validation";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.PUBLICATION_ACCESS_TABLE;
const bucketName = process.env.PUBLICATION_ASSET_BUCKET;
const emailFrom = process.env.PUBLICATION_EMAIL_FROM;
const hashSalt = process.env.PUBLICATION_HASH_SALT;
const hashSaltSecretArn = process.env.PUBLICATION_HASH_SALT_SECRET_ARN;
const publicUrl = process.env.PUBLIC_SITE_URL ?? "https://health.sozorockfoundation.org";
const configuredHosts = (process.env.PUBLICATION_ALLOWED_HOSTS ?? "").split(";").map((host) => host.trim()).filter(Boolean);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
const ses = new SESv2Client({ region });
const s3 = new S3Client({ region });
const secrets = new SecretsManagerClient({ region });
let resolvedSalt: Promise<string> | undefined;

const REQUEST_RETENTION_SECONDS = 180 * 24 * 60 * 60;
const VERIFY_SECONDS = 30 * 60;
const SESSION_SECONDS = 12 * 60 * 60;
const MAX_REQUESTS_PER_HOUR = 4;

export type AccessEvent = "publication_viewed" | "access_started" | "access_form_completed" | "verification_sent" | "email_verified" | "publication_opened" | "publication_downloaded" | "access_failed";

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? request.nextUrl.host;
  try { return new Set([host, ...configuredHosts]).has(new URL(origin).host); } catch { return false; }
}

async function getHashSalt() {
  if (hashSalt) return hashSalt;
  if (!hashSaltSecretArn) throw new Error("Publication hash salt is not configured");
  resolvedSalt ??= secrets.send(new GetSecretValueCommand({ SecretId: hashSaltSecretArn })).then((result) => {
    if (!result.SecretString) throw new Error("Publication hash salt is empty");
    return result.SecretString;
  });
  return resolvedSalt;
}

async function hash(value: string) {
  const salt = await getHashSalt();
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

function requireConfig() {
  if (!tableName || !bucketName || !emailFrom || (!hashSalt && !hashSaltSecretArn)) throw new Error("Publication access is not configured");
  return { tableName, bucketName, emailFrom };
}

export async function recordEvent(event: AccessEvent, slug: string, requestId?: string, details?: Record<string, string | number | boolean>) {
  if (!tableName) return;
  const now = new Date();
  await dynamo.send(new PutCommand({ TableName: tableName, Item: {
    pk: `EVENT#${now.toISOString().slice(0, 10)}`, sk: `${now.toISOString()}#${randomUUID()}`,
    recordType: "publication-event", event, publicationSlug: slug, requestId, details,
    createdAt: now.toISOString(), expiresAt: Math.floor(now.getTime() / 1000) + REQUEST_RETENTION_SECONDS,
  } }));
}

export async function enforceRateLimit(request: NextRequest, email: string) {
  const { tableName } = requireConfig();
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = await hash(`${ip}:${email}:${bucket}`);
  await dynamo.send(new UpdateCommand({
    TableName: tableName, Key: { pk: `RATE#${key}`, sk: "HOUR" },
    UpdateExpression: "ADD requestCount :one SET expiresAt = :expiry, recordType = :type",
    ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
    ExpressionAttributeValues: { ":one": 1, ":maximum": MAX_REQUESTS_PER_HOUR, ":expiry": epoch + 7200, ":type": "rate-limit" },
  }));
}

export async function enforceEventRateLimit(request: NextRequest) {
  const { tableName } = requireConfig();
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = await hash(`event:${ip}:${bucket}`);
  await dynamo.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: `EVENT_RATE#${key}`, sk: "HOUR" },
    UpdateExpression: "ADD requestCount :one SET expiresAt = :expiry, recordType = :type",
    ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
    ExpressionAttributeValues: { ":one": 1, ":maximum": 60, ":expiry": epoch + 7200, ":type": "event-rate-limit" },
  }));
}

export async function createAccessRequest(slug: string, input: AccessInput) {
  const publication = getPublication(slug);
  if (!publication?.assetKey) throw new Error("Publication is not available for access");
  const { tableName, emailFrom } = requireConfig();
  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000);
  const requestId = randomUUID();
  const emailHash = await hash(input.email);
  const verifyToken = randomBytes(32).toString("base64url");
  const verifyHash = await hash(verifyToken);
  const requestKey = await hash(`${input.email}:${slug}`);
  await Promise.all([
    dynamo.send(new PutCommand({ TableName: tableName, Item: {
      pk: `REQUEST#${requestKey}`, sk: "META", recordType: "publication-request", requestId, publicationSlug: slug,
      firstName: input.firstName, lastName: input.lastName, email: input.email, emailHash, organization: input.organization,
      sector: input.sector, cityOrRegion: input.cityOrRegion, state: input.state, country: input.country, reason: input.reason,
      deliveryConsent: true, deliveryConsentedAt: now.toISOString(), updatesConsent: input.updatesConsent,
      updatesConsentedAt: input.updatesConsent ? now.toISOString() : undefined, status: "pending-verification",
      createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: epoch + REQUEST_RETENTION_SECONDS,
    } })),
    dynamo.send(new PutCommand({ TableName: tableName, Item: {
      pk: `VERIFY#${verifyHash}`, sk: "TOKEN", recordType: "verification-token", requestId, requestKey,
      publicationSlug: slug, emailHash, createdAt: now.toISOString(), expiresAt: epoch + VERIFY_SECONDS,
    }, ConditionExpression: "attribute_not_exists(pk)" })),
  ]);
  const verifyUrl = `${publicUrl}/publications/verify?token=${encodeURIComponent(verifyToken)}`;
  await ses.send(new SendEmailCommand({ FromEmailAddress: emailFrom, Destination: { ToAddresses: [input.email] }, Content: { Simple: {
    Subject: { Data: `Confirm access to ${publication.shortTitle}` },
    Body: {
      Text: { Data: `Hello ${input.firstName},\n\nConfirm your email to access ${publication.title}:\n${verifyUrl}\n\nThis link expires in 30 minutes. You did not subscribe to updates unless you selected that separate option.\n\nSozoRock Health\nAn initiative of The SozoRock Foundation Inc.` },
      Html: { Data: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Confirm your email to access <strong>${escapeHtml(publication.title)}</strong>.</p><p><a href="${verifyUrl}">Confirm email and access publication</a></p><p>This link expires in 30 minutes. You did not subscribe to updates unless you selected that separate option.</p><p>SozoRock Health<br>An initiative of The SozoRock Foundation Inc.</p>` },
    },
  } } }));
  await Promise.all([recordEvent("access_form_completed", slug, requestId), recordEvent("verification_sent", slug, requestId)]);
  return requestId;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function verifyAccessToken(token: string) {
  const { tableName } = requireConfig();
  const tokenKey = { pk: `VERIFY#${await hash(token)}`, sk: "TOKEN" };
  const result = await dynamo.send(new GetCommand({ TableName: tableName, Key: tokenKey, ConsistentRead: true }));
  const item = result.Item;
  const epoch = Math.floor(Date.now() / 1000);
  if (!item || Number(item.expiresAt) < epoch || item.consumedAt) return null;
  const sessionToken = randomBytes(32).toString("base64url");
  const sessionHash = await hash(sessionToken);
  const now = new Date().toISOString();
  await dynamo.send(new UpdateCommand({ TableName: tableName, Key: tokenKey, UpdateExpression: "SET consumedAt = :now", ConditionExpression: "attribute_not_exists(consumedAt) AND expiresAt >= :epoch", ExpressionAttributeValues: { ":now": now, ":epoch": epoch } }));
  await Promise.all([
    dynamo.send(new UpdateCommand({ TableName: tableName, Key: { pk: `REQUEST#${item.requestKey}`, sk: "META" }, UpdateExpression: "SET #status = :verified, emailVerifiedAt = :now, updatedAt = :now", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":verified": "verified", ":now": now } })),
    dynamo.send(new PutCommand({ TableName: tableName, Item: { pk: `SESSION#${sessionHash}`, sk: `ACCESS#${item.publicationSlug}`, recordType: "publication-session", requestId: item.requestId, publicationSlug: item.publicationSlug, emailHash: item.emailHash, createdAt: now, expiresAt: epoch + SESSION_SECONDS } })),
  ]);
  await recordEvent("email_verified", String(item.publicationSlug), String(item.requestId));
  return { sessionToken, slug: String(item.publicationSlug) };
}

export async function createDownloadUrl(sessionToken: string, slug: string) {
  const publication = getPublication(slug);
  if (!publication?.assetKey) return null;
  const { tableName, bucketName } = requireConfig();
  const session = await dynamo.send(new GetCommand({ TableName: tableName, Key: { pk: `SESSION#${await hash(sessionToken)}`, sk: `ACCESS#${slug}` }, ConsistentRead: true }));
  if (!session.Item || Number(session.Item.expiresAt) < Math.floor(Date.now() / 1000)) return null;
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucketName, Key: publication.assetKey, ResponseContentDisposition: `attachment; filename="${publication.assetKey}"`, ResponseContentType: "application/pdf" }), { expiresIn: 300 });
  await recordEvent("publication_downloaded", slug, String(session.Item.requestId));
  return url;
}

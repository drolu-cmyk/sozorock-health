import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import type { NextRequest } from "next/server";
import {
  assessPublicationAccessQuality,
  classifyPublicationUserAgent,
  scoreAfterEmailVerification,
  type PublicationAttribution,
  type PublicationRequestTechnicalContext,
} from "./publication-intelligence";
import { getPublicationCountry } from "./publication-locations";
import { getPublication } from "./publications";
import type { AccessInput } from "./publication-validation";
import type { AccessEvent } from "./publication-events";
import { clientNetworkAddress, isTrustedSameOrigin, publicSiteUrl } from "./request-security";

export type { AccessEvent } from "./publication-events";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.PUBLICATION_ACCESS_TABLE;
const bucketName = process.env.PUBLICATION_ASSET_BUCKET;
const emailFrom = process.env.PUBLICATION_EMAIL_FROM;
const hashSalt = process.env.PUBLICATION_HASH_SALT;
const hashSaltSecretArn = process.env.PUBLICATION_HASH_SALT_SECRET_ARN;
const configuredHosts = (process.env.PUBLICATION_ALLOWED_HOSTS ?? "").split(";").map((host) => host.trim()).filter(Boolean);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
const ses = new SESv2Client({ region });
const s3 = new S3Client({ region });
const secrets = new SecretsManagerClient({ region });
let resolvedSalt: Promise<string> | undefined;

const REQUEST_RETENTION_SECONDS = 180 * 24 * 60 * 60;
export const VERIFY_SECONDS = 30 * 60;
export const SESSION_SECONDS = 12 * 60 * 60;
const MAX_REQUESTS_PER_HOUR = 4;
const MAX_NETWORK_REQUESTS_PER_HOUR = 20;
const MAX_RECIPIENT_REQUESTS_PER_HOUR = 8;
const MAX_NETWORK_REQUESTS_PER_DAY = 80;
const MAX_RECIPIENT_REQUESTS_PER_DAY = 12;
const MAX_VISITOR_REQUESTS_PER_DAY = 12;
const MAX_VERIFICATION_ATTEMPTS_PER_HOUR = 60;
const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function sameOrigin(request: NextRequest) {
  return isTrustedSameOrigin(request, configuredHosts);
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

function requireHashingConfig() {
  if (!tableName || (!hashSalt && !hashSaltSecretArn)) throw new Error("Publication access is not configured");
  return { tableName };
}

function requireRequestConfig() {
  const config = requireHashingConfig();
  if (!emailFrom) throw new Error("Publication access is not configured");
  return { ...config, emailFrom };
}

function requireDownloadConfig() {
  const config = requireHashingConfig();
  if (!bucketName) throw new Error("Publication access is not configured");
  return { ...config, bucketName };
}

export function publicationTechnicalContext(request: NextRequest): PublicationRequestTechnicalContext {
  const agent = classifyPublicationUserAgent(request.headers.get("user-agent") ?? "");
  return {
    ...agent,
    networkCountry: (request.headers.get("cloudfront-viewer-country") ?? "").trim().slice(0, 8),
    networkRegion: (request.headers.get("cloudfront-viewer-country-region") ?? "").trim().slice(0, 24),
  };
}

export async function recordEvent(event: AccessEvent, slug: string, requestId?: string, details?: Record<string, string | number | boolean>) {
  if (!tableName) return;
  const now = new Date();
  const eventId = randomUUID();
  await dynamo.send(new PutCommand({ TableName: tableName, Item: {
    pk: `EVENT#${now.toISOString().slice(0, 10)}`, sk: `${now.toISOString()}#${eventId}`,
    gsi1pk: `EVENTS#${slug}`, gsi1sk: `${now.toISOString()}#${eventId}`,
    recordType: "publication-event", event, publicationSlug: slug, requestId, details,
    createdAt: now.toISOString(), expiresAt: Math.floor(now.getTime() / 1000) + REQUEST_RETENTION_SECONDS,
  } }));
}

export async function recordAttributedEvent(
  event: AccessEvent,
  slug: string,
  request: NextRequest,
  attribution: PublicationAttribution,
  requestId?: string,
) {
  const technical = publicationTechnicalContext(request);
  const visitorHash = attribution.visitorId ? (await hash(`visitor:${attribution.visitorId}`)).slice(0, 32) : "";
  return recordEvent(event, slug, requestId, {
    visitorHash,
    source: attribution.utmSource,
    medium: attribution.utmMedium,
    campaign: attribution.utmCampaign,
    referrerHost: attribution.referrerHost,
    landingPath: attribution.landingPath,
    timezone: attribution.timezone,
    language: attribution.language,
    deviceClass: technical.deviceClass,
    osFamily: technical.osFamily,
    browserFamily: technical.browserFamily,
    networkCountry: technical.networkCountry,
    networkRegion: technical.networkRegion,
  });
}

async function incrementRateLimit(
  tableName: string,
  key: string,
  epoch: number,
  maximum: number,
  recordType: string,
  ttlSeconds = 7200,
) {
  await dynamo.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: key, sk: "WINDOW" },
    UpdateExpression: "ADD requestCount :one SET expiresAt = :expiry, recordType = :type",
    ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
    ExpressionAttributeValues: {
      ":one": 1,
      ":maximum": maximum,
      ":expiry": epoch + ttlSeconds,
      ":type": recordType,
    },
  }));
}

export async function enforceRateLimit(request: NextRequest, email: string, visitorId = "") {
  const { tableName } = requireHashingConfig();
  const epoch = Math.floor(Date.now() / 1000);
  const hour = Math.floor(epoch / 3600);
  const day = Math.floor(epoch / 86400);
  const ip = clientNetworkAddress(request.headers);
  const [emailKey, networkKey, recipientKey, networkDayKey, recipientDayKey, visitorDayKey] = await Promise.all([
    hash(`${ip}:${email}:${hour}`),
    hash(`network:${ip}:${hour}`),
    hash(`recipient:${email}:${hour}`),
    hash(`network-day:${ip}:${day}`),
    hash(`recipient-day:${email}:${day}`),
    visitorId ? hash(`visitor-day:${visitorId}:${day}`) : Promise.resolve(""),
  ]);
  const checks = [
    incrementRateLimit(tableName, `RATE#${emailKey}`, epoch, MAX_REQUESTS_PER_HOUR, "rate-limit"),
    incrementRateLimit(tableName, `NETWORK_RATE#${networkKey}`, epoch, MAX_NETWORK_REQUESTS_PER_HOUR, "network-rate-limit"),
    incrementRateLimit(tableName, `RECIPIENT_RATE#${recipientKey}`, epoch, MAX_RECIPIENT_REQUESTS_PER_HOUR, "recipient-rate-limit"),
    incrementRateLimit(tableName, `NETWORK_DAY_RATE#${networkDayKey}`, epoch, MAX_NETWORK_REQUESTS_PER_DAY, "network-day-rate-limit", 172800),
    incrementRateLimit(tableName, `RECIPIENT_DAY_RATE#${recipientDayKey}`, epoch, MAX_RECIPIENT_REQUESTS_PER_DAY, "recipient-day-rate-limit", 172800),
  ];
  if (visitorDayKey) checks.push(incrementRateLimit(tableName, `VISITOR_DAY_RATE#${visitorDayKey}`, epoch, MAX_VISITOR_REQUESTS_PER_DAY, "visitor-day-rate-limit", 172800));
  await Promise.all(checks);
}

export async function enforceVerificationRateLimit(request: NextRequest) {
  const { tableName } = requireHashingConfig();
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const ip = clientNetworkAddress(request.headers);
  const key = await hash(`verification:${ip}:${bucket}`);
  await incrementRateLimit(tableName, `VERIFY_RATE#${key}`, epoch, MAX_VERIFICATION_ATTEMPTS_PER_HOUR, "verification-rate-limit");
}

export async function enforceEventRateLimit(request: NextRequest) {
  const { tableName } = requireHashingConfig();
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const ip = clientNetworkAddress(request.headers);
  const key = await hash(`event:${ip}:${bucket}`);
  await incrementRateLimit(tableName, `EVENT_RATE#${key}`, epoch, 60, "event-rate-limit");
}

export async function createAccessRequest(
  slug: string,
  input: AccessInput,
  request: NextRequest,
  attribution: PublicationAttribution,
) {
  const publication = getPublication(slug);
  if (!publication?.assetKey) throw new Error("Publication is not available for access");
  const canonicalSlug = publication.slug;
  const { tableName, emailFrom } = requireRequestConfig();
  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000);
  const requestId = randomUUID();
  const emailHash = await hash(input.email);
  const verifyToken = randomBytes(32).toString("base64url");
  const verifyHash = await hash(verifyToken);
  const requestKey = await hash(`${input.email}:${canonicalSlug}:${requestId}`);
  const networkIdentifier = (await hash(`network:${clientNetworkAddress(request.headers)}`)).slice(0, 32);
  const visitorIdentifier = attribution.visitorId ? (await hash(`visitor:${attribution.visitorId}`)).slice(0, 32) : "";
  const technical = publicationTechnicalContext(request);
  const quality = assessPublicationAccessQuality(input, attribution, technical);
  const country = getPublicationCountry(input.country);
  const emailDomain = input.email.split("@").at(-1) ?? "";

  await dynamo.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: tableName,
          Item: {
            pk: `REQUEST#${requestKey}`, sk: "META", gsi1pk: `REQUESTS#${canonicalSlug}`, gsi1sk: `${now.toISOString()}#${requestId}`,
            recordType: "publication-request", requestId, publicationSlug: canonicalSlug,
            firstName: input.firstName, lastName: input.lastName, email: input.email, emailHash, emailDomain,
            organization: input.organization, sector: input.sector, cityOrRegion: input.cityOrRegion, state: input.state,
            country: input.country, countryCode: country?.code ?? "", reason: input.reason,
            visitorIdentifier, networkIdentifier,
            source: attribution.utmSource, medium: attribution.utmMedium, campaign: attribution.utmCampaign,
            campaignContent: attribution.utmContent, campaignTerm: attribution.utmTerm,
            referrerHost: attribution.referrerHost, landingPath: attribution.landingPath,
            timezone: attribution.timezone, language: attribution.language,
            deviceClass: technical.deviceClass, osFamily: technical.osFamily, browserFamily: technical.browserFamily,
            networkCountry: technical.networkCountry, networkRegion: technical.networkRegion,
            qualityScore: quality.score, qualityBand: quality.band, qualityFlags: quality.flags,
            emailDomainCategory: quality.emailDomainCategory,
            deliveryConsent: true, deliveryConsentedAt: now.toISOString(), updatesConsent: input.updatesConsent,
            updatesConsentedAt: input.updatesConsent ? now.toISOString() : undefined, status: "pending-verification",
            createdAt: now.toISOString(), updatedAt: now.toISOString(),
            expiresAt: epoch + REQUEST_RETENTION_SECONDS,
          },
        },
      },
      {
        Put: {
          TableName: tableName,
          Item: {
            pk: `VERIFY#${verifyHash}`, sk: "TOKEN", recordType: "verification-token", requestId, requestKey,
            publicationSlug: canonicalSlug, emailHash, createdAt: now.toISOString(), expiresAt: epoch + VERIFY_SECONDS,
          },
          ConditionExpression: "attribute_not_exists(pk)",
        },
      },
    ],
  }));

  const verifyUrl = publicSiteUrl(`/api/publications/verify?token=${encodeURIComponent(verifyToken)}`).toString();
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: emailFrom,
      Destination: { ToAddresses: [input.email] },
      Content: {
        Simple: {
          Subject: { Data: `Confirm access to ${publication.shortTitle}`, Charset: "UTF-8" },
          Body: {
            Text: {
              Data: `Hello ${input.firstName},\n\nConfirm your email to access ${publication.title}:\n${verifyUrl}\n\nThis link expires in 30 minutes. You did not subscribe to updates unless you selected that separate option.\n\nSozoRock Health\nAn initiative of The SozoRock Foundation, Inc.`,
              Charset: "UTF-8",
            },
            Html: {
              Data: `<p>Hello ${escapeHtml(input.firstName)},</p><p>Confirm your email to access <strong>${escapeHtml(publication.title)}</strong>.</p><p><a href="${escapeHtml(verifyUrl)}">Confirm email and access publication</a></p><p>This link expires in 30 minutes. You did not subscribe to updates unless you selected that separate option.</p><p>SozoRock Health<br>An initiative of The SozoRock Foundation, Inc.</p>`,
              Charset: "UTF-8",
            },
          },
        },
      },
    }));
  } catch (error) {
    const reason = (error as { name?: string }).name ?? "UnknownError";
    console.error("publication-verification-email-failed", { name: reason, slug: canonicalSlug, fromConfigured: true });
    await recordEvent("verification_delivery_failed", canonicalSlug, requestId, { reason }).catch(() => undefined);
    throw error;
  }

  await Promise.all([
    recordEvent("access_form_completed", canonicalSlug, requestId, {
      qualityBand: quality.band, qualityScore: quality.score, source: attribution.utmSource,
      medium: attribution.utmMedium, deviceClass: technical.deviceClass, countryCode: country?.code ?? "",
    }).catch(() => undefined),
    recordEvent("verification_sent", canonicalSlug, requestId).catch(() => undefined),
  ]);
  return { requestId, verificationSent: true, qualityBand: quality.band };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export async function verifyAccessToken(token: string) {
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) return null;
  const { tableName } = requireHashingConfig();
  const tokenKey = { pk: `VERIFY#${await hash(token)}`, sk: "TOKEN" };
  const result = await dynamo.send(new GetCommand({ TableName: tableName, Key: tokenKey, ConsistentRead: true }));
  const item = result.Item;
  const epoch = Math.floor(Date.now() / 1000);
  if (!item || Number(item.expiresAt) < epoch || item.consumedAt) return null;

  const requestKey = { pk: `REQUEST#${String(item.requestKey)}`, sk: "META" };
  const requestResult = await dynamo.send(new GetCommand({ TableName: tableName, Key: requestKey, ConsistentRead: true }));
  const requestItem = requestResult.Item;
  if (!requestItem || String(requestItem.requestId) !== String(item.requestId) || String(requestItem.publicationSlug) !== String(item.publicationSlug) || String(requestItem.emailHash) !== String(item.emailHash)) return null;

  const sessionToken = randomBytes(32).toString("base64url");
  const sessionHash = await hash(sessionToken);
  const now = new Date().toISOString();
  const publicationSlug = getPublication(String(item.publicationSlug))?.slug ?? String(item.publicationSlug);
  const verifiedQuality = scoreAfterEmailVerification(
    Number(requestItem.qualityScore ?? 50),
    Array.isArray(requestItem.qualityFlags) ? requestItem.qualityFlags.map(String) : [],
  );

  try {
    await dynamo.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName,
            Key: tokenKey,
            UpdateExpression: "SET consumedAt = :now",
            ConditionExpression: "attribute_not_exists(consumedAt) AND expiresAt >= :epoch",
            ExpressionAttributeValues: { ":now": now, ":epoch": epoch },
          },
        },
        {
          Update: {
            TableName: tableName,
            Key: requestKey,
            UpdateExpression: "SET #status = :verified, emailVerifiedAt = :now, updatedAt = :now, qualityScore = :qualityScore, qualityBand = :qualityBand, qualityFlags = :qualityFlags",
            ConditionExpression: "requestId = :requestId AND publicationSlug = :slug AND emailHash = :emailHash",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":verified": "verified", ":now": now, ":requestId": item.requestId, ":slug": item.publicationSlug,
              ":emailHash": item.emailHash, ":qualityScore": verifiedQuality.score, ":qualityBand": verifiedQuality.band,
              ":qualityFlags": verifiedQuality.flags,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              pk: `SESSION#${sessionHash}`, sk: `ACCESS#${publicationSlug}`, recordType: "publication-session",
              requestId: item.requestId, publicationSlug, emailHash: item.emailHash, createdAt: now,
              expiresAt: epoch + SESSION_SECONDS,
            },
            ConditionExpression: "attribute_not_exists(pk)",
          },
        },
      ],
    }));
  } catch (error) {
    if ((error as { name?: string }).name === "TransactionCanceledException") {
      const latest = await dynamo.send(new GetCommand({ TableName: tableName, Key: tokenKey, ConsistentRead: true }));
      if (!latest.Item || latest.Item.consumedAt || Number(latest.Item.expiresAt) < Math.floor(Date.now() / 1000)) return null;
    }
    throw error;
  }

  await recordEvent("email_verified", publicationSlug, String(item.requestId), { qualityBand: verifiedQuality.band, qualityScore: verifiedQuality.score }).catch(() => undefined);
  return { sessionToken, slug: publicationSlug };
}

export async function validatePublicationSession(sessionToken: string, slug: string) {
  const publication = getPublication(slug);
  if (!publication?.assetKey || !sessionToken) return null;
  const { tableName } = requireHashingConfig();
  const canonicalSlug = publication.slug;
  const sessionHash = await hash(sessionToken);
  const acceptedSlugs = [canonicalSlug, slug, ...(publication.legacySlugs ?? [])].filter((value, index, values) => values.indexOf(value) === index);
  const sessions = await Promise.all(acceptedSlugs.map((acceptedSlug) => dynamo.send(new GetCommand({ TableName: tableName, Key: { pk: `SESSION#${sessionHash}`, sk: `ACCESS#${acceptedSlug}` }, ConsistentRead: true }))));
  const session = sessions.find((candidate) => candidate.Item)?.Item;
  if (!session || Number(session.expiresAt) < Math.floor(Date.now() / 1000)) return null;
  return { requestId: String(session.requestId), slug: canonicalSlug };
}

export async function createDownloadUrl(sessionToken: string, slug: string) {
  const publication = getPublication(slug);
  if (!publication?.assetKey) return null;
  const { bucketName } = requireDownloadConfig();
  const session = await validatePublicationSession(sessionToken, publication.slug);
  if (!session) return null;

  await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: publication.assetKey }));
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucketName,
    Key: publication.assetKey,
    ResponseContentDisposition: `attachment; filename="${publication.assetKey}"`,
    ResponseContentType: "application/pdf",
  }), { expiresIn: 300 });
  await recordEvent("download_link_issued", publication.slug, session.requestId).catch(() => undefined);
  return url;
}

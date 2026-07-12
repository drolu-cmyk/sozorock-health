import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import {
  clientNetworkAddress,
  isTrustedSameOrigin,
  readBoundedText,
} from "../../lib/request-security";

export const runtime = "nodejs";

const tableName = process.env.CONTACT_SUBMISSIONS_TABLE;
const topicArn = process.env.CONTACT_NOTIFICATION_TOPIC_ARN;
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
const sns = new SNSClient({ region });
const secrets = new SecretsManagerClient({ region });
const MAX_REQUESTS_PER_HOUR = 5;
const RETENTION_SECONDS = 365 * 24 * 60 * 60;
const configuredContactHosts = (process.env.CONTACT_ALLOWED_HOSTS ?? "").split(";").map((host) => host.trim()).filter(Boolean);
const rateLimitSalt = process.env.CONTACT_RATE_LIMIT_SALT;
const rateLimitSaltSecretArn = process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN;
let resolvedRateLimitSalt: Promise<string> | undefined;

async function getRateLimitSalt() {
  if (rateLimitSalt) return rateLimitSalt;
  if (!rateLimitSaltSecretArn) throw new Error("Contact rate-limit salt is not configured");
  resolvedRateLimitSalt ??= secrets.send(new GetSecretValueCommand({ SecretId: rateLimitSaltSecretArn })).then((result) => {
    if (!result.SecretString) throw new Error("Contact rate-limit salt is empty");
    return result.SecretString;
  });
  return resolvedRateLimitSalt;
}

function value(body: Record<string, unknown>, name: string, max = 180) {
  return typeof body[name] === "string" ? body[name].trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";
}

function sameOrigin(request: NextRequest) {
  return isTrustedSameOrigin(request, configuredContactHosts);
}

export async function POST(request: NextRequest) {
  if (!tableName || !topicArn || (!rateLimitSalt && !rateLimitSaltSecretArn)) {
    console.error("contact-intake-config-missing", { hasTable: Boolean(tableName), hasTopic: Boolean(topicArn) });
    return NextResponse.json({ error: "Contact intake is temporarily unavailable." }, { status: 503 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const rawBody = await readBoundedText(request, 12_000, ["application/json"]);
  if (!rawBody.ok) {
    if (rawBody.error === "unsupported-media-type")
      return NextResponse.json({ error: "Send this request as JSON." }, { status: 415 });
    if (rawBody.error === "too-large")
      return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(rawBody.text || "null") as unknown;
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  if (value(body, "website", 120)) return NextResponse.json({ accepted: true }, { status: 202 });

  const name = value(body, "name");
  const email = value(body, "email").toLowerCase();
  const role = value(body, "role");
  const stateOrCounty = value(body, "stateOrCounty");
  const inquiryType = value(body, "inquiryType");
  const message = value(body, "message", 2000);
  if (!name || !email || !role || !stateOrCounty || !message || body.consent !== true) return NextResponse.json({ error: "Complete the required fields and acknowledge the privacy notice." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const ip = clientNetworkAddress(request.headers);
  let ipHash: string;
  try {
    ipHash = createHash("sha256").update(`${await getRateLimitSalt()}:${ip}`).digest("hex");
  } catch {
    return NextResponse.json({ error: "Contact intake is temporarily unavailable." }, { status: 503 });
  }

  try {
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `rate#${ipHash}#${bucket}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: { ":one": 1, ":maximum": MAX_REQUESTS_PER_HOUR, ":expiresAt": epoch + 7200, ":recordType": "rate-limit" },
    }));
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") return NextResponse.json({ error: "Please wait before sending another inquiry." }, { status: 429 });
    console.error("contact-rate-limit-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "Contact intake is temporarily unavailable." }, { status: 503 });
  }

  const submissionId = `contact#${now.toISOString()}#${randomUUID()}`;
  await dynamo.send(new PutCommand({
    TableName: tableName,
    Item: { submissionId, recordType: "contact", name, email, role, stateOrCounty, inquiryType, message, consent: true, consentedAt: now.toISOString(), createdAt: now.toISOString(), expiresAt: epoch + RETENTION_SECONDS },
    ConditionExpression: "attribute_not_exists(submissionId)",
  }));

  const safe = (text: string) => text.replace(/[\r\n]+/g, " ");
  try {
    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: "New SozoRock Health partner inquiry",
      Message: [`Submission: ${submissionId}`, `Name: ${safe(name)}`, `Email: ${safe(email)}`, `Interest: ${safe(role)}`, `Location: ${safe(stateOrCounty)}`, "The complete consented message is retained in the encrypted contact-intake table."].join("\n"),
    }));
  } catch { /* The inquiry is safely stored even if notification delivery is delayed. */ }

  return NextResponse.json({ accepted: true, message: "Thank you. A SozoRock Health team member will respond using the contact information you provided." }, { status: 202 });
}

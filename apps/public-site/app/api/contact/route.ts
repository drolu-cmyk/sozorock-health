import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const tableName = process.env.CONTACT_SUBMISSIONS_TABLE;
const topicArn = process.env.CONTACT_NOTIFICATION_TOPIC_ARN;
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } });
const sns = new SNSClient({ region });
const MAX_REQUESTS_PER_HOUR = 5;
const RETENTION_SECONDS = 365 * 24 * 60 * 60;

function value(body: Record<string, unknown>, name: string, max = 180) {
  return typeof body[name] === "string" ? body[name].trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, max) : "";
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const publicHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? request.nextUrl.host;
  try { return new URL(origin).host === publicHost; } catch { return false; }
}

export async function POST(request: NextRequest) {
  if (!tableName || !topicArn) {
    console.error("contact-intake-config-missing", { hasTable: Boolean(tableName), hasTopic: Boolean(topicArn) });
    return NextResponse.json({ error: "Contact intake is temporarily unavailable." }, { status: 503 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 12_000) return NextResponse.json({ error: "The request is too large." }, { status: 413 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
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
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(`${process.env.CONTACT_RATE_LIMIT_SALT ?? "sozorock-health"}:${ip}`).digest("hex");

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

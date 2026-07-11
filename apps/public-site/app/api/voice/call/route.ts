import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.CONTACT_SUBMISSIONS_TABLE;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const secrets = new SecretsManagerClient({ region });
let cachedApiKey: string | null = null;
const allowedHosts = (process.env.CONTACT_ALLOWED_HOSTS ?? "").split(";").map((value) => value.trim()).filter(Boolean);

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? request.headers.get("host") ?? request.nextUrl.host;
  try { const parsed=new URL(origin); return (parsed.protocol === "https:" || parsed.hostname === "localhost") && new Set([host, ...allowedHosts]).has(parsed.host); } catch { return false; }
}

async function withinRateLimit(request: NextRequest) {
  if (!tableName || !process.env.CONTACT_RATE_LIMIT_SALT) return false;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 3600);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const fingerprint = createHash("sha256").update(`${process.env.CONTACT_RATE_LIMIT_SALT}:${ip}`).digest("hex");
  try {
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `voice-rate#${fingerprint}#${bucket}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: { ":one": 1, ":maximum": 3, ":expiresAt": now + 7200, ":recordType": "voice-rate-limit" },
    }));
    return true;
  } catch { return false; }
}

async function getOpenAIKey() {
  if (cachedApiKey) return cachedApiKey;
  if (!process.env.OPENAI_SECRET_ARN) return null;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.OPENAI_SECRET_ARN }));
  cachedApiKey = result.SecretString?.trim() || null;
  return cachedApiKey;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const apiKey = await getOpenAIKey().catch(() => null);
  if (!apiKey || !(await withinRateLimit(request))) return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });
  const offer = await request.text();
  if (!offer.startsWith("v=") || offer.length > 120_000) return NextResponse.json({ error: "The voice session request was not valid." }, { status: 400 });

  const session = {
    type: "realtime",
    model: "gpt-realtime-1.5",
    output_modalities: ["audio"],
    instructions: "You are Voice Access for SozoRock Health. Sound savvy, relaxed, warm, and concise. Help residents understand where to start, find non-clinical support, prepare for virtual visits, improve digital readiness, locate Health Equity Hubs, and understand Health Access Day or provider-led pathways. Never diagnose, triage symptoms, assess urgency, recommend treatment, prescribe medication, or provide medical advice. If someone describes an emergency or immediate danger, tell them to call 911 or local emergency services. Make the boundary clear without sounding cold. Ask one question at a time and keep each spoken response under 35 words.",
    audio: { output: { voice: "marin", speed: 1.02 }, input: { turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true } } },
    max_output_tokens: 180,
  };
  const form = new FormData();
  form.set("sdp", new Blob([offer], { type: "application/sdp" }), "offer.sdp");
  form.set("session", new Blob([JSON.stringify(session)], { type: "application/json" }), "session.json");
  const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, cache: "no-store" });
  if (!response.ok) {
    console.error("voice-session-failed", { status: response.status });
    return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });
  }
  return new NextResponse(await response.text(), { status: 201, headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" } });
}

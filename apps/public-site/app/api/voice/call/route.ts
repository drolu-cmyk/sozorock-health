import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { isRealtimeVoiceEnabled, resolveVoiceRuntime } from "../../../lib/voice-runtime";
import {
  clientNetworkAddress,
  isTrustedSameOrigin,
  readBoundedText,
} from "../../../lib/request-security";

export const runtime = "nodejs";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.CONTACT_SUBMISSIONS_TABLE;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const secrets = new SecretsManagerClient({ region });
let cachedApiKey: string | null = null;
const allowedHosts = (process.env.CONTACT_ALLOWED_HOSTS ?? "").split(";").map((value) => value.trim()).filter(Boolean);
const rateLimitSalt = process.env.CONTACT_RATE_LIMIT_SALT;
const rateLimitSaltSecretArn = process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN;
let resolvedRateLimitSalt: Promise<string> | undefined;
const MAX_VOICE_SESSIONS_PER_NETWORK_PER_HOUR = 24;

async function getRateLimitSalt() {
  if (rateLimitSalt) return rateLimitSalt;
  if (!rateLimitSaltSecretArn) throw new Error("Voice rate-limit salt is not configured");
  resolvedRateLimitSalt ??= secrets
    .send(new GetSecretValueCommand({ SecretId: rateLimitSaltSecretArn }))
    .then((result) => {
      if (!result.SecretString) throw new Error("Voice rate-limit salt is empty");
      return result.SecretString;
    });
  return resolvedRateLimitSalt;
}

const voiceInstructions = `You are Voice Access for SozoRock Health, a nonprofit and strictly non-clinical service.

Conversation style:
- Sound warm, savvy, relaxed, and concise. Use plain language.
- Listen actively. Allow the resident time to pause or think without filling every silence.
- If the resident interrupts, stop speaking, listen fully, and respond to the latest request.
- Use brief acknowledgements such as "mm-hmm" or "got it" sparingly and only when natural. Never talk over the resident.
- Ask one question at a time. Keep most spoken responses under 35 words.
- Reflect the resident's request back in plain language before using it to identify a pathway. Ask for confirmation before moving forward.
- Let the resident correct, pause, repeat, switch language, or use tap and text at any time.

Permitted help:
- Explain where to start and identify approved non-clinical support pathways.
- Support digital readiness, virtual-visit preparation, Health Equity Hub discovery, Health Access Day readiness, and provider-led pathway preparation.

Hard boundaries:
- Never diagnose, triage symptoms, assess urgency, interpret medical information, recommend treatment, prescribe medication, or provide medical advice.
- Never claim to be a clinician, health navigator, healthcare provider, clinic, or telehealth service.
- Do not request medical records, protected health information, or unnecessary personal details.
- Licensed care and clinical decisions always remain with licensed professionals.
- If the resident describes an emergency or immediate danger, calmly tell them to call 911 or local emergency services. Do not continue a clinical assessment.`;

function sameOrigin(request: NextRequest) {
  return isTrustedSameOrigin(request, allowedHosts);
}

async function checkRateLimit(request: NextRequest): Promise<"allowed" | "limited" | "unavailable"> {
  if (!tableName || (!rateLimitSalt && !rateLimitSaltSecretArn)) return "unavailable";
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / 3600);
  const ip = clientNetworkAddress(request.headers);
  let fingerprint: string;
  try {
    fingerprint = createHash("sha256").update(`${await getRateLimitSalt()}:${ip}`).digest("hex");
  } catch {
    return "unavailable";
  }
  try {
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `voice-rate#${fingerprint}#${bucket}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: { ":one": 1, ":maximum": MAX_VOICE_SESSIONS_PER_NETWORK_PER_HOUR, ":expiresAt": now + 7200, ":recordType": "voice-rate-limit" },
    }));
    return "allowed";
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") return "limited";
    console.error("voice-rate-limit-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return "unavailable";
  }
}

async function getOpenAIKey() {
  if (cachedApiKey) return cachedApiKey;
  if (!process.env.OPENAI_SECRET_ARN) return null;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.OPENAI_SECRET_ARN }));
  cachedApiKey = result.SecretString?.trim() || null;
  return cachedApiKey;
}

async function createRealtimeCall(offer: string, session: object, apiKey: string) {
  const form = new FormData();
  form.set("sdp", new Blob([offer], { type: "application/sdp" }), "offer.sdp");
  form.set("session", new Blob([JSON.stringify(session)], { type: "application/json" }), "session.json");
  return fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  if (!isRealtimeVoiceEnabled()) return NextResponse.json({ error: "Live voice is temporarily unavailable. Use tap or text instead." }, { status: 503 });
  const offerBody = await readBoundedText(request, 120_000, ["application/sdp"]);
  if (!offerBody.ok) {
    if (offerBody.error === "unsupported-media-type")
      return NextResponse.json({ error: "Send the voice session request as SDP." }, { status: 415 });
    return NextResponse.json(
      { error: "The voice session request was not valid." },
      { status: offerBody.error === "too-large" ? 413 : 400 },
    );
  }
  const offer = offerBody.text;
  if (!offer.startsWith("v=")) return NextResponse.json({ error: "The voice session request was not valid." }, { status: 400 });
  const apiKey = await getOpenAIKey().catch(() => null);
  if (!apiKey) return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });
  const rateLimitStatus = await checkRateLimit(request);
  if (rateLimitStatus === "limited") {
    return NextResponse.json(
      { error: "Too many voice sessions have started from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  if (rateLimitStatus === "unavailable") return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });

  const voiceRuntime = resolveVoiceRuntime();
  const session = {
    type: "realtime",
    model: voiceRuntime.model,
    output_modalities: ["audio"],
    instructions: voiceInstructions,
    audio: { output: { voice: "marin", speed: 1.02 }, input: { turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true } } },
    max_output_tokens: 180,
  };
  let response: Response;
  try {
    response = await createRealtimeCall(offer, session, apiKey);
    if (response.status === 401 || response.status === 403) {
      cachedApiKey = null;
      const refreshedApiKey = await getOpenAIKey();
      if (refreshedApiKey && refreshedApiKey !== apiKey) response = await createRealtimeCall(offer, session, refreshedApiKey);
    }
  } catch (error) {
    console.error("voice-session-unavailable", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });
  }
  if (!response.ok) {
    console.error("voice-session-failed", { status: response.status });
    return NextResponse.json({ error: "Live voice is temporarily unavailable." }, { status: 503 });
  }
  return new NextResponse(await response.text(), {
    status: 201,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "no-store",
      "X-SozoRock-Voice-Capability": voiceRuntime.activeAlias,
      "X-SozoRock-Voice-Fallback": String(voiceRuntime.usedFallback),
    },
  });
}

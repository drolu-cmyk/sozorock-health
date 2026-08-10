import { NextRequest, NextResponse } from "next/server";
import { enforceVoiceTranscriptionRateLimit } from "../../../../../lib/evidence-rate-limit";
import {
  requireEvidenceAuthority,
  requireEvidenceGeographyId,
  sha256,
  writeExecutionAudit,
} from "../../../../../lib/evidence-runtime-authority";
import { getOpenAIApiKey, placeAgentRuntimeVersions } from "../../../../../lib/place-agent-openai";
import { isTrustedSameOrigin, readBoundedBytes } from "../../../../../lib/request-security";

export const runtime = "nodejs";
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const ALLOWED_AUDIO = new Set([
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav",
]);

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) {
      return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    }
    const bounded = await readBoundedBytes(request, MAX_AUDIO_BYTES + 64_000, ["multipart/form-data"]);
    if (!bounded.ok) {
      return NextResponse.json(
        { error: bounded.error === "unsupported-media-type" ? "Send a multipart audio upload." : "The audio clip is too large." },
        { status: bounded.error === "unsupported-media-type" ? 415 : 413 },
      );
    }
    const formRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: bounded.bytes,
    });
    const form = await formRequest.formData();
    const geoid = String(form.get("geoid") ?? "").trim();
    const audio = form.get("audio");
    if (!/^\d{5}$/.test(geoid) || !(audio instanceof File) || audio.size < 1 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Provide a selected county and a short audio clip." }, { status: 400 });
    }
    const mime = audio.type.split(";")[0].toLowerCase();
    if (!ALLOWED_AUDIO.has(mime)) {
      return NextResponse.json({ error: "This audio format is not supported." }, { status: 415 });
    }
    const authority = await requireEvidenceAuthority(placeAgentRuntimeVersions.snapshotContentHash);
    if (!authority.openAiEnabled || !authority.narrativeEnabled) {
      return NextResponse.json({ error: "Voice Access is not currently enabled." }, { status: 503 });
    }
    const key = await getOpenAIApiKey();
    const outbound = new FormData();
    outbound.set("file", audio, audio.name || "planning-question.webm");
    outbound.set("model", process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-transcribe");
    outbound.set("response_format", "json");
    outbound.set("prompt", "Transcribe the speaker's non-clinical county planning question exactly. Preserve place names and natural wording.");
    const rate = await enforceVoiceTranscriptionRateLimit(request);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Please wait before using Voice Access again." }, { status: rate.retryAfter ? 429 : 503 });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
        body: outbound,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`Transcription request failed with ${response.status}.`);
    const payload = await response.json() as { text?: string };
    const transcript = payload.text?.trim() ?? "";
    if (transcript.length < 3 || transcript.length > 1_500) {
      return NextResponse.json({ error: "No usable planning question was detected. You can type the question instead." }, { status: 422 });
    }
    const transcriptHash = sha256({ geoid, transcript });
    await writeExecutionAudit({
      executionType: "internal_agent",
      contractVersion: "explore.voice-transcript.v1",
      policyVersion: placeAgentRuntimeVersions.policyVersion,
      snapshotUuid: authority.snapshotUuid,
      geographyUuid: await requireEvidenceGeographyId(geoid),
      requestHash: sha256({ geoid, audioHash: sha256(Buffer.from(await audio.arrayBuffer())) }),
      responseHash: transcriptHash,
      outcome: "succeeded",
      reason: "Voice transcript prepared for explicit user confirmation; raw audio was not retained.",
      metadata: {
        geoid,
        model: process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-transcribe",
        retainedRawAudio: false,
      },
    });
    return NextResponse.json({
      contractVersion: "explore.voice-transcript.v1",
      transcript,
      transcriptHash,
      retainedRawAudio: false,
      next: "Review or edit the transcript, then send it through Place Intelligence.",
    }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("explore-voice-transcription-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.json({ error: "Voice Access could not transcribe this clip. You can type the question instead." }, { status: 503 });
  }
}

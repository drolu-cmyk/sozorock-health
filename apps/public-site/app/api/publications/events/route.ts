import { NextRequest, NextResponse } from "next/server";
import {
  enforceEventRateLimit,
  recordAttributedEvent,
  sameOrigin,
  type AccessEvent,
} from "../../../lib/publication-access";
import { parsePublicationAttribution } from "../../../lib/publication-intelligence";
import { getPublication } from "../../../lib/publications";
import { readBoundedText } from "../../../lib/request-security";

export const runtime = "nodejs";

const allowed = new Set<AccessEvent>(["publication_viewed", "access_started", "publication_opened"]);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ accepted: false }, { status: 403 });
  const rawBody = await readBoundedText(request, 4_096, ["application/json"]);
  if (!rawBody.ok) {
    return NextResponse.json(
      { accepted: false },
      { status: rawBody.error === "unsupported-media-type" ? 415 : rawBody.error === "too-large" ? 413 : 400 },
    );
  }
  try {
    await enforceEventRateLimit(request);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return NextResponse.json(
        { accepted: false },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    console.error("publication-event-rate-limit-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
      message: String((error as { message?: string }).message ?? "").slice(0, 240),
    });
    return NextResponse.json({ accepted: false }, { status: 503 });
  }
  let body: (Record<string, unknown> & { event?: AccessEvent; slug?: string }) | null = null;
  try {
    const parsed = JSON.parse(rawBody.text || "null") as unknown;
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown> & { event?: AccessEvent; slug?: string }
      : null;
  } catch {
    body = null;
  }
  if (!body?.event || !allowed.has(body.event) || !body.slug || !getPublication(body.slug)) {
    return NextResponse.json({ accepted: false }, { status: 400 });
  }
  const attribution = parsePublicationAttribution(body);
  await recordAttributedEvent(body.event, body.slug, request, attribution).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}

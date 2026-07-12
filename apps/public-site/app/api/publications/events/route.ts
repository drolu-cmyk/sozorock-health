import { NextRequest, NextResponse } from "next/server";
import { enforceEventRateLimit, recordEvent, sameOrigin, type AccessEvent } from "../../../lib/publication-access";
import { getPublication } from "../../../lib/publications";
import { readBoundedText } from "../../../lib/request-security";

const allowed = new Set<AccessEvent>(["publication_viewed", "access_started", "publication_opened"]);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ accepted: false }, { status: 403 });
  const rawBody = await readBoundedText(request, 2_048, ["application/json"]);
  if (!rawBody.ok) {
    return NextResponse.json(
      { accepted: false },
      { status: rawBody.error === "unsupported-media-type" ? 415 : rawBody.error === "too-large" ? 413 : 400 },
    );
  }
  try { await enforceEventRateLimit(request); } catch { return NextResponse.json({ accepted: false }, { status: 429 }); }
  let body: { event?: AccessEvent; slug?: string } | null = null;
  try {
    const parsed = JSON.parse(rawBody.text || "null") as unknown;
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as { event?: AccessEvent; slug?: string }
      : null;
  } catch {
    body = null;
  }
  if (!body?.event || !allowed.has(body.event) || !body.slug || !getPublication(body.slug)) return NextResponse.json({ accepted: false }, { status: 400 });
  await recordEvent(body.event, body.slug).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}

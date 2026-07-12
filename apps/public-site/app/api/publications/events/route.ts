import { NextRequest, NextResponse } from "next/server";
import { enforceEventRateLimit, recordEvent, sameOrigin, type AccessEvent } from "../../../lib/publication-access";
import { getPublication } from "../../../lib/publications";

const allowed = new Set<AccessEvent>(["publication_viewed", "access_started", "publication_opened"]);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ accepted: false }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2_048) return NextResponse.json({ accepted: false }, { status: 413 });
  try { await enforceEventRateLimit(request); } catch { return NextResponse.json({ accepted: false }, { status: 429 }); }
  const body = await request.json().catch(() => null) as { event?: AccessEvent; slug?: string } | null;
  if (!body?.event || !allowed.has(body.event) || !body.slug || !getPublication(body.slug)) return NextResponse.json({ accepted: false }, { status: 400 });
  await recordEvent(body.event, body.slug).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from "next/server";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  SESSION_SECONDS,
  createAccessRequest,
  enforceRateLimit,
  recordEvent,
  sameOrigin,
} from "../../../../lib/publication-access";
import { parseAccessInput, validateAccessInput } from "../../../../lib/publication-validation";
import { getPublication } from "../../../../lib/publications";
import { readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";

function productionCookies() {
  return process.env.NODE_ENV === "production";
}

function accessCookieName() {
  return productionCookies()
    ? "__Host-srh_publication_access"
    : "srh_publication_access";
}

function protectResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const publication = getPublication(slug);
  if (!publication?.assetKey) return NextResponse.json({ error: "This publication is not available for access." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const rawBody = await readBoundedText(request, 16_000, ["application/json"]);
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
  if (!body) return NextResponse.json({ error: "Enter the required information." }, { status: 400 });
  const input = parseAccessInput(body);
  if (input.website) return NextResponse.json({ accepted: true, message: "Request accepted." }, { status: 202 });
  const validationError = validateAccessInput(input);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  try {
    await enforceRateLimit(request, input.email);
    const access = await createAccessRequest(publication.slug, input);
    const response = NextResponse.json({
      accepted: true,
      accessGranted: true,
      verificationSent: access.verificationSent,
      downloadUrl: `/api/publications/download/${publication.slug}`,
      message: access.verificationSent
        ? "Your publication is ready to download. We also sent an optional email verification link; it expires in 30 minutes."
        : "Your publication is ready to download. Email verification is unavailable right now, but it does not block your access.",
    }, { status: 202 });
    response.cookies.set(accessCookieName(), access.sessionToken, {
      httpOnly: true,
      secure: productionCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return protectResponse(response);
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === "ConditionalCheckFailedException") return NextResponse.json({ error: "Please wait before requesting another link." }, { status: 429 });
    console.error("publication-access-failed", { name: (error as { name?: string }).name ?? "UnknownError", message: String((error as { message?: string }).message ?? "").slice(0, 240), slug: publication.slug });
    await recordEvent("access_failed", publication.slug, undefined, { stage: "request" }).catch(() => undefined);
    return NextResponse.json({ error: "Publication access is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}

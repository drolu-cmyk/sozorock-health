import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, verifyAccessToken } from "../../../lib/publication-access";
import { publicationRedirects } from "../../../lib/publication-redirects";
import { readBoundedText } from "../../../lib/request-security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.slice(0, 160) ?? "";
  const target = publicationRedirects.beginVerification(token);
  return NextResponse.redirect(target.location, target.status);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
  const body = await readBoundedText(request, 2_048, ["application/x-www-form-urlencoded"]);
  if (!body.ok) {
    if (body.error === "unsupported-media-type")
      return NextResponse.json({ error: "Send this request as a form." }, { status: 415 });
    if (body.error === "too-large")
      return NextResponse.json({ error: "The request is too large." }, { status: 413 });
    return NextResponse.json({ error: "The verification request was not valid." }, { status: 400 });
  }
  const token = new URLSearchParams(body.text).get("token")?.slice(0, 160) ?? "";
  if (!token) {
    const target = publicationRedirects.missingVerification();
    return NextResponse.redirect(target.location, target.status);
  }
  try {
    const verified = await verifyAccessToken(token);
    if (!verified) {
      const target = publicationRedirects.expiredVerification();
      return NextResponse.redirect(target.location, target.status);
    }
    const target = publicationRedirects.completedVerification(verified.slug);
    const response = NextResponse.redirect(target.location, target.status);
    const production = process.env.NODE_ENV === "production";
    response.cookies.set(production ? "__Host-srh_publication_access" : "srh_publication_access", verified.sessionToken, { httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("publication-verification-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    const target = publicationRedirects.failedVerification();
    return NextResponse.redirect(target.location, target.status);
  }
}

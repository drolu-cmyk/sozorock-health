import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "../../../lib/publication-access";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.slice(0, 160) ?? "";
  const target = token ? `/publications/verify?token=${encodeURIComponent(token)}` : "/publications?verification=missing";
  return NextResponse.redirect(new URL(target, request.url));
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const token = typeof form?.get("token") === "string" ? String(form.get("token")).slice(0, 160) : "";
  if (!token) return NextResponse.redirect(new URL("/publications?verification=missing", request.url), 303);
  try {
    const verified = await verifyAccessToken(token);
    if (!verified) return NextResponse.redirect(new URL("/publications?verification=expired", request.url), 303);
    const response = NextResponse.redirect(new URL(`/publications/${verified.slug}/verified`, request.url), 303);
    const production = process.env.NODE_ENV === "production";
    response.cookies.set(production ? "__Host-srh_publication_access" : "srh_publication_access", verified.sessionToken, { httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("publication-verification-failed", { name: (error as { name?: string }).name ?? "UnknownError" });
    return NextResponse.redirect(new URL("/publications?verification=failed", request.url), 303);
  }
}

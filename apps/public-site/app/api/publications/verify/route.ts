import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_SECONDS,
  VERIFY_SECONDS,
  enforceVerificationRateLimit,
  sameOrigin,
  verifyAccessToken,
} from "../../../lib/publication-access";
import { publicationRedirects } from "../../../lib/publication-redirects";

export const runtime = "nodejs";

const VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function productionCookies() {
  return process.env.NODE_ENV === "production";
}

function verificationCookieName() {
  return productionCookies()
    ? "__Host-srh_publication_verify"
    : "srh_publication_verify";
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

function clearVerificationCookie(response: NextResponse) {
  response.cookies.set(verificationCookieName(), "", {
    httpOnly: true,
    secure: productionCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.slice(0, 160) ?? "";
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    const target = publicationRedirects.missingVerification();
    return protectResponse(NextResponse.redirect(target.location, target.status));
  }

  const target = publicationRedirects.beginVerification();
  const response = NextResponse.redirect(target.location, target.status);
  response.cookies.set(verificationCookieName(), token, {
    httpOnly: true,
    secure: productionCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: VERIFY_SECONDS,
  });
  return protectResponse(response);
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return protectResponse(
      NextResponse.json(
        { error: "Request origin was not accepted." },
        { status: 403 },
      ),
    );
  }

  const token = request.cookies.get(verificationCookieName())?.value ?? "";
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    const target = publicationRedirects.missingVerification();
    return protectResponse(
      clearVerificationCookie(
        NextResponse.redirect(target.location, target.status),
      ),
    );
  }

  try {
    await enforceVerificationRateLimit(request);
    const verified = await verifyAccessToken(token);
    if (!verified) {
      const target = publicationRedirects.expiredVerification();
      return protectResponse(
        clearVerificationCookie(
          NextResponse.redirect(target.location, target.status),
        ),
      );
    }

    const target = publicationRedirects.completedVerification(verified.slug);
    const response = clearVerificationCookie(
      NextResponse.redirect(target.location, target.status),
    );
    response.cookies.set(accessCookieName(), verified.sessionToken, {
      httpOnly: true,
      secure: productionCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_SECONDS,
    });
    return protectResponse(response);
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      const response = NextResponse.json(
        { error: "Too many verification attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
      return protectResponse(response);
    }
    console.error("publication-verification-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    const target = publicationRedirects.failedVerification();
    return protectResponse(NextResponse.redirect(target.location, target.status));
  }
}

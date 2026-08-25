import { NextRequest, NextResponse } from "next/server";
import {
  beginFoundationAdminMfaEnrollment,
  requireFoundationIdentity,
  verifyFoundationAdminMfaEnrollment,
} from "../../../lib/foundation-admin-auth";
import { isTrustedSameOrigin, readBoundedText } from "../../../lib/request-security";

export const runtime = "nodejs";

function protectedJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) return protectedJson({ error: "Request origin was not accepted." }, 403);
  const raw = await readBoundedText(request, 2_000, ["application/json"]);
  if (!raw.ok) {
    return protectedJson({ error: raw.error === "too-large" ? "The request is too large." : "Send this request as JSON." }, raw.error === "too-large" ? 413 : 415);
  }
  let body: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(raw.text || "null") as unknown;
    body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    body = null;
  }
  if (!body) return protectedJson({ error: "Invalid authenticator request." }, 400);

  try {
    const { actor, accessToken } = await requireFoundationIdentity(request);
    if (actor.mfaEnabled) return protectedJson({ enrolled: true });
    const action = text(body.action, 16);
    if (action === "start") {
      const secretCode = await beginFoundationAdminMfaEnrollment(accessToken);
      const label = encodeURIComponent(`SozoRock Foundation Operations:${actor.username}`);
      const issuer = encodeURIComponent("SozoRock Foundation");
      return protectedJson({
        enrolled: false,
        secretCode,
        otpauthUri: `otpauth://totp/${label}?secret=${encodeURIComponent(secretCode)}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      });
    }
    if (action === "verify") {
      const code = text(body.code, 12);
      if (!/^\d{6}$/.test(code)) return protectedJson({ error: "Enter the six-digit authenticator code." }, 400);
      await verifyFoundationAdminMfaEnrollment(accessToken, code);
      return protectedJson({ enrolled: true });
    }
    return protectedJson({ error: "Invalid authenticator action." }, 400);
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message : "";
    if (/administration session|reviewer access/i.test(message)) {
      return protectedJson({ error: "A valid Foundation reviewer session is required." }, 401);
    }
    if (/CodeMismatch|EnableSoftwareTokenMFA|SoftwareTokenMFANotFound/i.test(name)) {
      return protectedJson({ error: "The authenticator code was not accepted." }, 400);
    }
    if (/TooManyRequests|LimitExceeded/i.test(name)) {
      return protectedJson({ error: "Too many authenticator attempts. Try again later." }, 429);
    }
    console.error("foundation-admin-mfa-failed", { name });
    return protectedJson({ error: "Authenticator setup is temporarily unavailable." }, 503);
  }
}

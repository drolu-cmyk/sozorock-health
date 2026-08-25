import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
import {
  FOUNDATION_ADMIN_CHALLENGE_COOKIE,
  FOUNDATION_ADMIN_CHALLENGE_SECONDS,
  FOUNDATION_ADMIN_COOKIE,
  FOUNDATION_ADMIN_SESSION_SECONDS,
  completeFoundationAdminMfaChallenge,
  completeFoundationAdminPasswordChallenge,
  requireFoundationIdentity,
  signOutFoundationAdmin,
  startFoundationAdminLogin,
  type FoundationAdminLoginResult,
} from "../../../lib/foundation-admin-auth";
import { isTrustedSameOrigin, readBoundedText } from "../../../lib/request-security";

export const runtime = "nodejs";

type ChallengeKind = "NEW_PASSWORD_REQUIRED" | "SOFTWARE_TOKEN_MFA";

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

function secureCookie(response: NextResponse, name: string, value: string, maxAge: number) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set({
    name,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

function encodeChallenge(kind: ChallengeKind, username: string, session: string) {
  return Buffer.from(JSON.stringify({ kind, username, session }), "utf8").toString("base64url");
}

function decodeChallenge(value: string | undefined) {
  if (!value || value.length > 5_000) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    if (
      (record.kind !== "NEW_PASSWORD_REQUIRED" && record.kind !== "SOFTWARE_TOKEN_MFA") ||
      typeof record.username !== "string" ||
      typeof record.session !== "string"
    ) return null;
    if (!record.username.trim() || !record.session.trim()) return null;
    return {
      kind: record.kind,
      username: record.username.trim(),
      session: record.session.trim(),
    } as const;
  } catch {
    return null;
  }
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function finishLoginResult(result: FoundationAdminLoginResult) {
  if (result.status === "authenticated") {
    const response = protectedJson({ authenticated: true });
    secureCookie(response, FOUNDATION_ADMIN_COOKIE, result.accessToken, FOUNDATION_ADMIN_SESSION_SECONDS);
    clearCookie(response, FOUNDATION_ADMIN_CHALLENGE_COOKIE);
    return response;
  }
  const challenge = result.status === "new_password_required" ? "NEW_PASSWORD_REQUIRED" : "SOFTWARE_TOKEN_MFA";
  const response = protectedJson({ authenticated: false, challenge }, 409);
  secureCookie(
    response,
    FOUNDATION_ADMIN_CHALLENGE_COOKIE,
    encodeChallenge(challenge, result.username, result.session),
    FOUNDATION_ADMIN_CHALLENGE_SECONDS,
  );
  clearCookie(response, FOUNDATION_ADMIN_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const { actor } = await requireFoundationIdentity(request);
    return protectedJson({ authenticated: true, actor });
  } catch {
    return protectedJson({ authenticated: false }, 401);
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) return protectedJson({ error: "Request origin was not accepted." }, 403);
  const raw = await readBoundedText(request, 6_000, ["application/json"]);
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
  if (!body) return protectedJson({ error: "Enter the required sign-in information." }, 400);

  try {
    const mfaCode = text(body.mfaCode, 12);
    if (mfaCode) {
      if (!/^\d{6}$/.test(mfaCode)) return protectedJson({ error: "Enter the six-digit authenticator code." }, 400);
      const challenge = decodeChallenge(request.cookies.get(FOUNDATION_ADMIN_CHALLENGE_COOKIE)?.value);
      if (!challenge || challenge.kind !== "SOFTWARE_TOKEN_MFA") {
        return protectedJson({ error: "The authenticator challenge expired. Sign in again." }, 401);
      }
      const accessToken = await completeFoundationAdminMfaChallenge(
        challenge.username,
        challenge.session,
        mfaCode,
      );
      return finishLoginResult({ status: "authenticated", accessToken });
    }

    const newPassword = text(body.newPassword, 256);
    if (newPassword) {
      if (newPassword.length < 14) return protectedJson({ error: "Use a password with at least 14 characters." }, 400);
      const challenge = decodeChallenge(request.cookies.get(FOUNDATION_ADMIN_CHALLENGE_COOKIE)?.value);
      if (!challenge || challenge.kind !== "NEW_PASSWORD_REQUIRED") {
        return protectedJson({ error: "The password setup session expired. Sign in again." }, 401);
      }
      const result = await completeFoundationAdminPasswordChallenge(
        challenge.username,
        challenge.session,
        newPassword,
      );
      return finishLoginResult(result);
    }

    const username = text(body.username, 254).toLowerCase();
    const password = text(body.password, 256);
    if (!username || !password) return protectedJson({ error: "Enter your email and password." }, 400);
    const result = await startFoundationAdminLogin(username, password);
    return finishLoginResult(result);
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    if (/NotAuthorized|UserNotFound|PasswordResetRequired|UserNotConfirmed|CodeMismatch|ExpiredCode/i.test(name)) {
      return protectedJson({ error: "The sign-in information was not accepted." }, 401);
    }
    if (/TooManyRequests|LimitExceeded/i.test(name)) {
      return protectedJson({ error: "Too many sign-in attempts. Try again later." }, 429);
    }
    console.error("foundation-admin-session-failed", { name });
    return protectedJson({ error: "Foundation administration is temporarily unavailable." }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) return protectedJson({ error: "Request origin was not accepted." }, 403);
  try {
    const { accessToken } = await requireFoundationIdentity(request);
    await signOutFoundationAdmin(accessToken);
  } catch {
    // Clearing the local cookie remains safe when the upstream session is already invalid.
  }
  const response = protectedJson({ authenticated: false });
  clearCookie(response, FOUNDATION_ADMIN_COOKIE);
  clearCookie(response, FOUNDATION_ADMIN_CHALLENGE_COOKIE);
  return response;
}

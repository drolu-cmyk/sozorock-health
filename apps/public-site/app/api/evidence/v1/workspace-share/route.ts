import { NextRequest, NextResponse } from "next/server";
import { getSharedWorkspacePlan } from "../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";

const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHARE_SESSION_SECONDS = 60 * 60;
const PRODUCTION_COOKIE = "__Host-srh_workspace_share";
const DEVELOPMENT_COOKIE = "srh_workspace_share";

function cookieName() {
  return process.env.NODE_ENV === "production" ? PRODUCTION_COOKIE : DEVELOPMENT_COOKIE;
}

function privateHeaders() {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: privateHeaders() });
}

function clearShareCookie(response: NextResponse) {
  response.cookies.set(cookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedSameOrigin(request)) {
    return privateJson({ error: "Request origin was not accepted." }, 403);
  }
  const bounded = await readBoundedText(request, 4_000, ["application/json"]);
  if (!bounded.ok) return privateJson({ error: "The request was not accepted." }, 400);

  let token = "";
  try {
    const body = JSON.parse(bounded.text) as { token?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
  } catch {
    return privateJson({ error: "The request was not accepted." }, 400);
  }
  if (!SHARE_TOKEN_PATTERN.test(token)) {
    return privateJson({ error: "This share link is invalid, expired, or revoked." }, 404);
  }

  try {
    const shared = await getSharedWorkspacePlan({ token });
    const remainingSeconds = Math.max(1, Math.floor((Date.parse(shared.share.expiresAt) - Date.now()) / 1000));
    const response = privateJson({ contractVersion: "explore.workspace-share-claim.v1", claimed: true });
    response.cookies.set(cookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(SHARE_SESSION_SECONDS, remainingSeconds),
    });
    return response;
  } catch {
    return clearShareCookie(privateJson({ error: "This share link is invalid, expired, or revoked." }, 404));
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(cookieName())?.value.trim() ?? "";
  if (!SHARE_TOKEN_PATTERN.test(token)) {
    return clearShareCookie(privateJson({ error: "This share session is invalid or expired." }, 404));
  }
  try {
    const shared = await getSharedWorkspacePlan({ token });
    return privateJson({ contractVersion: "explore.workspace-share-read.v1", ...shared });
  } catch {
    return clearShareCookie(privateJson({ error: "This share session is invalid or expired." }, 404));
  }
}

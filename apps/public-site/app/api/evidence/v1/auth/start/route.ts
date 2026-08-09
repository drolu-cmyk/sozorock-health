import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { EXPLORE_AUTH_STATE_COOKIE, exploreCognitoConfig, newPkceVerifier, pkceChallenge, signExploreAuthState } from "../../../../../lib/explore-workspace-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const config = exploreCognitoConfig();
    const requested = request.nextUrl.searchParams.get("returnTo") ?? "/explore/workspaces";
    const returnTo = requested.startsWith("/explore/") && !requested.startsWith("//") ? requested : "/explore/workspaces";
    const state = randomBytes(24).toString("base64url");
    const verifier = newPkceVerifier();
    const signed = await signExploreAuthState({ state, verifier, returnTo, expiresAt: Date.now() + 10 * 60_000 });
    const authorize = new URL(`${config.domain}/oauth2/authorize`);
    authorize.searchParams.set("client_id", config.clientId);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("scope", "openid email profile");
    authorize.searchParams.set("redirect_uri", config.callbackUrl);
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("code_challenge", pkceChallenge(verifier));
    const response = NextResponse.redirect(authorize);
    response.cookies.set(EXPLORE_AUTH_STATE_COOKIE, signed, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/evidence/v1/auth", maxAge: 600 });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/explore/workspaces?auth=unavailable", request.url));
  }
}

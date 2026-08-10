import { NextRequest, NextResponse } from "next/server";
import { EXPLORE_AUTH_COOKIE, EXPLORE_AUTH_STATE_COOKIE, exploreCognitoConfig, readExploreAuthState } from "../../../../../lib/explore-workspace-auth";
import { publicSiteUrl } from "../../../../../lib/request-security";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code") ?? "";
    const state = request.nextUrl.searchParams.get("state") ?? "";
    const signed = request.cookies.get(EXPLORE_AUTH_STATE_COOKIE)?.value ?? "";
    const saved = await readExploreAuthState(signed);
    if (!code || state !== saved.state || typeof saved.verifier !== "string") throw new Error("Authentication response is invalid.");
    const config = exploreCognitoConfig();
    const form = new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId, code, redirect_uri: config.callbackUrl, code_verifier: saved.verifier });
    const tokenResponse = await fetch(`${config.domain}/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form, cache: "no-store" });
    if (!tokenResponse.ok) throw new Error("Authentication token exchange failed.");
    const tokens = await tokenResponse.json() as { access_token?: string; expires_in?: number };
    if (!tokens.access_token) throw new Error("Authentication token is unavailable.");
    const returnTo = typeof saved.returnTo === "string" && saved.returnTo.startsWith("/explore/") ? saved.returnTo : "/explore/workspaces";
    const response = NextResponse.redirect(publicSiteUrl(returnTo));
    response.cookies.set(EXPLORE_AUTH_COOKIE, tokens.access_token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: Math.min(Math.max(tokens.expires_in ?? 3600, 300), 3600) });
    response.cookies.delete(EXPLORE_AUTH_STATE_COOKIE);
    return response;
  } catch {
    const response = NextResponse.redirect(publicSiteUrl("/explore/workspaces?auth=failed"));
    response.cookies.delete(EXPLORE_AUTH_STATE_COOKIE);
    return response;
  }
}

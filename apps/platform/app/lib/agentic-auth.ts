import type { AgenticRuntimeConfig } from "./agentic-runtime";

const PKCE_SESSION_KEY = "cbcap.oauth.pkce";

type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

type PkceState = {
  state: string;
  verifier: string;
  createdAt: number;
};

let inMemoryTokens: TokenSet | null = null;
let refreshInFlight: Promise<void> | null = null;
let callbackInFlight: Promise<boolean> | null = null;

function randomBase64Url(bytes = 32) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...values)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function requireAuthConfig(config: AgenticRuntimeConfig) {
  if (!config.enabled || !config.cognitoDomain || !config.clientId) {
    throw new Error("Institutional sign-in is not configured.");
  }
  return {
    domain: new URL(config.cognitoDomain),
    clientId: config.clientId,
    redirectUri: config.redirectUri,
  };
}

export async function beginCognitoSignIn(config: AgenticRuntimeConfig) {
  const auth = requireAuthConfig(config);
  const verifier = randomBase64Url(64);
  const state = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);
  const pkce: PkceState = { state, verifier, createdAt: Date.now() };
  sessionStorage.setItem(PKCE_SESSION_KEY, JSON.stringify(pkce));
  const url = new URL("/oauth2/authorize", auth.domain);
  url.search = new URLSearchParams({
    client_id: auth.clientId,
    response_type: "code",
    redirect_uri: auth.redirectUri,
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  window.location.assign(url.toString());
}

function cleanOAuthCallbackUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function parseTokenResponse(value: unknown, previousRefreshToken: string | null = null): TokenSet {
  if (!value || typeof value !== "object") throw new Error("The identity provider returned an invalid token response.");
  const body = value as Record<string, unknown>;
  const accessToken = typeof body.access_token === "string" ? body.access_token.trim() : "";
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token.trim() : previousRefreshToken;
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : Number(body.expires_in);
  if (!accessToken || !Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error("The identity provider returned an incomplete session.");
  return { accessToken, refreshToken: refreshToken || null, expiresAt: Date.now() + expiresIn * 1_000 };
}

async function exchange(config: AgenticRuntimeConfig, parameters: URLSearchParams, previousRefreshToken: string | null = null) {
  const auth = requireAuthConfig(config);
  parameters.set("client_id", auth.clientId);
  const response = await fetch(new URL("/oauth2/token", auth.domain), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: parameters,
    credentials: "omit",
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error("Institutional sign-in could not be completed.");
  inMemoryTokens = parseTokenResponse(body, previousRefreshToken);
}

async function exchangeCognitoCallback(config: AgenticRuntimeConfig) {
  const query = new URLSearchParams(window.location.search);
  const code = query.get("code");
  const returnedState = query.get("state");
  const providerError = query.get("error");
  if (!code && !providerError) return false;
  cleanOAuthCallbackUrl();
  if (providerError) throw new Error("Institutional sign-in was not completed.");
  const rawPkce = sessionStorage.getItem(PKCE_SESSION_KEY);
  sessionStorage.removeItem(PKCE_SESSION_KEY);
  let pkce: PkceState | null = null;
  try { pkce = rawPkce ? JSON.parse(rawPkce) as PkceState : null; } catch { pkce = null; }
  if (!pkce || pkce.state !== returnedState || Date.now() - pkce.createdAt > 10 * 60_000) {
    throw new Error("Institutional sign-in state could not be verified.");
  }
  const auth = requireAuthConfig(config);
  await exchange(config, new URLSearchParams({
    grant_type: "authorization_code",
    code: code || "",
    redirect_uri: auth.redirectUri,
    code_verifier: pkce.verifier,
  }));
  return true;
}

export function completeCognitoCallback(config: AgenticRuntimeConfig) {
  if (callbackInFlight) return callbackInFlight;
  callbackInFlight = exchangeCognitoCallback(config).finally(() => { callbackInFlight = null; });
  return callbackInFlight;
}

export async function getInMemoryAccessToken(config: AgenticRuntimeConfig) {
  if (!inMemoryTokens) throw new Error("Sign in to use the institutional workspace.");
  if (Date.now() < inMemoryTokens.expiresAt - 60_000) return inMemoryTokens.accessToken;
  if (!inMemoryTokens.refreshToken) {
    inMemoryTokens = null;
    throw new Error("The institutional session expired. Sign in again.");
  }
  const refreshToken = inMemoryTokens.refreshToken;
  refreshInFlight ??= exchange(
    config,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    refreshToken,
  ).finally(() => { refreshInFlight = null; });
  await refreshInFlight;
  return inMemoryTokens!.accessToken;
}

export function hasInMemorySession() {
  return Boolean(inMemoryTokens);
}

export function endCognitoSession(config: AgenticRuntimeConfig) {
  inMemoryTokens = null;
  refreshInFlight = null;
  callbackInFlight = null;
  sessionStorage.removeItem(PKCE_SESSION_KEY);
  const auth = requireAuthConfig(config);
  const url = new URL("/logout", auth.domain);
  url.search = new URLSearchParams({ client_id: auth.clientId, logout_uri: config.logoutUri }).toString();
  window.location.assign(url.toString());
}

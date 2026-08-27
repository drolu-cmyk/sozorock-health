export const CBCAP_AGENTIC_API_ORIGIN = "https://api.cbcap.sozorockfoundation.org";
export const CBCAP_COGNITO_CALLBACK_URI = "https://cbcap.sozorockfoundation.org/auth/callback";
export const CBCAP_COGNITO_LOGOUT_URI = "https://cbcap.sozorockfoundation.org/";

export type AgenticRuntimeConfig = {
  enabled: boolean;
  apiOrigin: typeof CBCAP_AGENTIC_API_ORIGIN;
  cognitoDomain: string | null;
  clientId: string | null;
  redirectUri: typeof CBCAP_COGNITO_CALLBACK_URI;
  logoutUri: typeof CBCAP_COGNITO_LOGOUT_URI;
};

function exactHttpsUrl(value: string | undefined, originOnly = false) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    if (originOnly && url.pathname !== "/") return null;
    return originOnly ? url.origin : url.toString();
  } catch {
    return null;
  }
}

export function agenticRuntimeConfig(): AgenticRuntimeConfig {
  const configuredApiOrigin = (process.env.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE || CBCAP_AGENTIC_API_ORIGIN).replace(/\/$/, "");
  const cognitoDomain = exactHttpsUrl(process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN, true);
  const configuredRedirectUri = exactHttpsUrl(process.env.NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI || CBCAP_COGNITO_CALLBACK_URI);
  const candidateClientId = process.env.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID?.trim() || "";
  const clientId = /^[A-Za-z0-9]{1,128}$/.test(candidateClientId) ? candidateClientId : null;
  const apiOrigin = configuredApiOrigin === CBCAP_AGENTIC_API_ORIGIN
    ? CBCAP_AGENTIC_API_ORIGIN
    : CBCAP_AGENTIC_API_ORIGIN;
  const enabled = configuredApiOrigin === CBCAP_AGENTIC_API_ORIGIN
    && configuredRedirectUri === CBCAP_COGNITO_CALLBACK_URI
    && Boolean(cognitoDomain && clientId);
  return {
    enabled,
    apiOrigin,
    cognitoDomain,
    clientId,
    redirectUri: CBCAP_COGNITO_CALLBACK_URI,
    logoutUri: CBCAP_COGNITO_LOGOUT_URI,
  };
}

export function agenticApiUrl(path: string) {
  if (!path.startsWith("/api/") || path.startsWith("//")) throw new Error("CB-CAP API path is invalid.");
  return new URL(path, `${CBCAP_AGENTIC_API_ORIGIN}/`).toString();
}

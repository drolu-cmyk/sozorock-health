import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  WorkspaceAccess,
  WorkspaceActor,
  WorkspaceRole,
} from "@sozorock/evidence-core";
import type { NextRequest } from "next/server";

const cognito = new CognitoIdentityProviderClient({});
const secrets = new SecretsManagerClient({});
export const EXPLORE_AUTH_COOKIE = "sozorock_explore_access";
export const EXPLORE_AUTH_STATE_COOKIE = "sozorock_explore_oauth";
const ROLES = new Set<WorkspaceRole>([
  "foundation_reviewer",
  "county_planner",
  "community_partner",
  "research_funder_viewer",
  "evidence_agent",
]);
const ACCESS = new Set<WorkspaceAccess>(["owner", "contributor", "viewer"]);

function bearer(request: NextRequest) {
  const header = request.headers.get("authorization")?.trim() ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  const cookieToken = request.cookies.get(EXPLORE_AUTH_COOKIE)?.value?.trim();
  if (cookieToken) return cookieToken;
  throw new Error("A valid authenticated workspace session is required.");
}

async function cookieSecret() {
  const arn = process.env.EXPLORE_AUTH_COOKIE_SECRET_ARN?.trim();
  if (!arn) throw new Error("Explore authentication secret is not configured.");
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const raw = response.SecretString?.trim();
  if (!raw || raw.length < 32) throw new Error("Explore authentication secret is invalid.");
  return raw;
}

export async function signExploreAuthState(value: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", await cookieSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function readExploreAuthState(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("Authentication state is invalid.");
  const expected = createHmac("sha256", await cookieSecret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Authentication state is invalid.");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) throw new Error("Authentication state expired.");
  return parsed;
}

export function exploreCognitoConfig() {
  const domain = process.env.EXPLORE_COGNITO_DOMAIN?.trim()?.replace(/\/$/, "");
  const clientId = process.env.EXPLORE_COGNITO_CLIENT_ID?.trim();
  const publicUrl = process.env.PUBLIC_SITE_URL?.trim()?.replace(/\/$/, "") || "https://health.sozorockfoundation.org";
  if (!domain || !clientId) throw new Error("Explore authentication is not configured.");
  return { domain, clientId, callbackUrl: `${publicUrl}/api/evidence/v1/auth/callback` };
}

export function newPkceVerifier() {
  return randomBytes(48).toString("base64url");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function requireWorkspaceActor(request: NextRequest): Promise<WorkspaceActor & {
  tenantId: string;
}> {
  const response = await cognito.send(new GetUserCommand({ AccessToken: bearer(request) }));
  const attributes = new Map(
    (response.UserAttributes ?? []).map((attribute) => [attribute.Name ?? "", attribute.Value ?? ""]),
  );
  const tenantId = attributes.get("custom:tenant_id")?.trim();
  const role = attributes.get("custom:workspace_role")?.trim() as WorkspaceRole | undefined;
  const access = attributes.get("custom:workspace_access")?.trim() as WorkspaceAccess | undefined;
  const principalId = response.Username?.trim();
  const displayName = attributes.get("name")?.trim() || attributes.get("email")?.trim() || principalId;
  if (!tenantId || !principalId || !role || !ROLES.has(role) || !access || !ACCESS.has(access)) {
    throw new Error("The authenticated account does not have a complete county-workspace assignment.");
  }
  return {
    tenantId,
    principalId,
    actorType: role === "evidence_agent" ? "agent" : "human",
    role,
    access,
    displayName: displayName ?? principalId,
  };
}

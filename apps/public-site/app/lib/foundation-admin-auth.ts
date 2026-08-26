import {
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  GetUserCommand,
  GlobalSignOutCommand,
  SetUserMFAPreferenceCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type { NextRequest } from "next/server";

export const FOUNDATION_ADMIN_COOKIE = "__Host-srh_foundation_admin";
export const FOUNDATION_ADMIN_CHALLENGE_COOKIE = "__Host-srh_foundation_admin_challenge";
export const FOUNDATION_ADMIN_SESSION_SECONDS = 14 * 60;
export const FOUNDATION_ADMIN_CHALLENGE_SECONDS = 5 * 60;

const cognito = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

function configuration() {
  const clientId = process.env.FOUNDATION_ADMIN_COGNITO_CLIENT_ID?.trim();
  const userPoolId = process.env.FOUNDATION_ADMIN_COGNITO_USER_POOL_ID?.trim();
  const tenantId = process.env.FOUNDATION_ADMIN_TENANT_ID?.trim();
  if (!clientId || !userPoolId || !tenantId) throw new Error("Foundation administration is not configured");
  return { clientId, userPoolId, tenantId };
}

function attributes(values: Array<{ Name?: string; Value?: string }> | undefined) {
  return new Map((values ?? []).map((entry) => [entry.Name ?? "", entry.Value ?? ""]));
}

export type FoundationAdminActor = {
  username: string;
  displayName: string;
  tenantId: string;
  access: "owner" | "contributor";
  mfaEnabled: boolean;
};

export type FoundationAdminLoginResult =
  | { status: "authenticated"; accessToken: string }
  | { status: "new_password_required"; username: string; session: string }
  | { status: "software_token_mfa"; username: string; session: string };

function tokenFromRequest(request: NextRequest) {
  const cookie = request.cookies.get(FOUNDATION_ADMIN_COOKIE)?.value?.trim();
  if (cookie) return cookie;
  const header = request.headers.get("authorization")?.trim() ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function foundationIdentity(request: NextRequest) {
  const { tenantId: expectedTenantId } = configuration();
  const accessToken = tokenFromRequest(request);
  if (!accessToken) throw new Error("A valid Foundation administration session is required.");
  const response = await cognito.send(new GetUserCommand({ AccessToken: accessToken }));
  const values = attributes(response.UserAttributes);
  const role = values.get("custom:workspace_role")?.trim();
  const access = values.get("custom:workspace_access")?.trim();
  const tenantId = values.get("custom:tenant_id")?.trim();
  const username = response.Username?.trim();
  if (
    role !== "foundation_reviewer" ||
    (access !== "owner" && access !== "contributor") ||
    tenantId !== expectedTenantId ||
    !username
  ) {
    throw new Error("Foundation reviewer access is required.");
  }
  const mfaEnabled =
    response.PreferredMfaSetting === "SOFTWARE_TOKEN_MFA" ||
    (response.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA");
  return {
    actor: {
      username,
      displayName: values.get("name")?.trim() || values.get("email")?.trim() || username,
      tenantId,
      access,
      mfaEnabled,
    } satisfies FoundationAdminActor,
    accessToken,
  };
}

export async function requireFoundationIdentity(request: NextRequest) {
  return foundationIdentity(request);
}

export async function requireFoundationReviewer(request: NextRequest) {
  const identity = await foundationIdentity(request);
  if (!identity.actor.mfaEnabled) throw new Error("Foundation reviewer MFA is required.");
  return identity;
}

export async function startFoundationAdminLogin(username: string, password: string): Promise<FoundationAdminLoginResult> {
  const { clientId, userPoolId } = configuration();
  const response = await cognito.send(new AdminInitiateAuthCommand({
    UserPoolId: userPoolId,
    ClientId: clientId,
    AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  }));
  const accessToken = response.AuthenticationResult?.AccessToken;
  if (accessToken) return { status: "authenticated", accessToken };
  if (response.ChallengeName === "NEW_PASSWORD_REQUIRED" && response.Session) {
    return { status: "new_password_required", username, session: response.Session };
  }
  if (response.ChallengeName === "SOFTWARE_TOKEN_MFA" && response.Session) {
    return { status: "software_token_mfa", username, session: response.Session };
  }
  throw new Error("The account could not be authenticated.");
}

export async function completeFoundationAdminPasswordChallenge(
  username: string,
  session: string,
  newPassword: string,
): Promise<FoundationAdminLoginResult> {
  const { clientId, userPoolId } = configuration();
  const response = await cognito.send(new AdminRespondToAuthChallengeCommand({
    UserPoolId: userPoolId,
    ClientId: clientId,
    ChallengeName: "NEW_PASSWORD_REQUIRED",
    Session: session,
    ChallengeResponses: {
      USERNAME: username,
      NEW_PASSWORD: newPassword,
    },
  }));
  const accessToken = response.AuthenticationResult?.AccessToken;
  if (accessToken) return { status: "authenticated", accessToken };
  if (response.ChallengeName === "SOFTWARE_TOKEN_MFA" && response.Session) {
    return { status: "software_token_mfa", username, session: response.Session };
  }
  throw new Error("The password change did not create an administration session.");
}

export async function completeFoundationAdminMfaChallenge(
  username: string,
  session: string,
  code: string,
) {
  const { clientId, userPoolId } = configuration();
  const response = await cognito.send(new AdminRespondToAuthChallengeCommand({
    UserPoolId: userPoolId,
    ClientId: clientId,
    ChallengeName: "SOFTWARE_TOKEN_MFA",
    Session: session,
    ChallengeResponses: {
      USERNAME: username,
      SOFTWARE_TOKEN_MFA_CODE: code,
    },
  }));
  const accessToken = response.AuthenticationResult?.AccessToken;
  if (!accessToken) throw new Error("The authenticator code did not create an administration session.");
  return accessToken;
}

export async function beginFoundationAdminMfaEnrollment(accessToken: string) {
  const response = await cognito.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
  const secretCode = response.SecretCode?.trim();
  if (!secretCode) throw new Error("The authenticator setup key could not be created.");
  return secretCode;
}

export async function verifyFoundationAdminMfaEnrollment(accessToken: string, code: string) {
  const verified = await cognito.send(new VerifySoftwareTokenCommand({
    AccessToken: accessToken,
    UserCode: code,
    FriendlyDeviceName: "SozoRock Foundation Operations",
  }));
  if (verified.Status !== "SUCCESS") throw new Error("The authenticator code was not accepted.");
  await cognito.send(new SetUserMFAPreferenceCommand({
    AccessToken: accessToken,
    SoftwareTokenMfaSettings: {
      Enabled: true,
      PreferredMfa: true,
    },
  }));
}

export async function signOutFoundationAdmin(accessToken: string) {
  if (!accessToken) return;
  try {
    await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
  } catch {
    // The local session is still cleared if the upstream token is already expired or revoked.
  }
}

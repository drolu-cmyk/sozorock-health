import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import type {
  WorkspaceAccess,
  WorkspaceActor,
  WorkspaceRole,
} from "@sozorock/evidence-core";
import type { NextRequest } from "next/server";

const cognito = new CognitoIdentityProviderClient({});
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
  if (!header.startsWith("Bearer ")) throw new Error("A valid authenticated workspace session is required.");
  return header.slice(7).trim();
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

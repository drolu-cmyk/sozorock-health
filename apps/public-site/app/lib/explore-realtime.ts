import { createHash, randomBytes } from "node:crypto";
import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  ApiGatewayManagementApiClient,
  GoneException,
  PostToConnectionCommand,
} from "@aws-sdk/client-apigatewaymanagementapi";
import type { WorkspaceActor } from "@sozorock/evidence-core";

const dynamodb = new DynamoDBClient({});

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function config() {
  const sessionTable = process.env.EXPLORE_REALTIME_SESSION_TABLE?.trim();
  const connectionTable = process.env.EXPLORE_REALTIME_CONNECTION_TABLE?.trim();
  const endpoint = process.env.EXPLORE_REALTIME_MANAGEMENT_ENDPOINT?.trim();
  const publicEndpoint = process.env.EXPLORE_REALTIME_PUBLIC_ENDPOINT?.trim();
  if (!sessionTable || !connectionTable || !endpoint || !publicEndpoint) {
    throw new Error("Explore real-time service is not configured.");
  }
  return { sessionTable, connectionTable, endpoint, publicEndpoint };
}

export async function mintRealtimeSession(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  const { sessionTable, publicEndpoint } = config();
  const token = randomBytes(32).toString("base64url");
  const sessionId = randomBytes(16).toString("hex");
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  await dynamodb.send(new PutItemCommand({
    TableName: sessionTable,
    Item: {
      token_hash: { S: tokenHash(token) },
      kind: { S: "session" },
      session_id: { S: sessionId },
      workspace_id: { S: input.workspaceId },
      tenant_id: { S: input.tenantId },
      principal_id: { S: input.actor.principalId },
      display_name: { S: input.actor.displayName },
      access: { S: input.actor.access },
      expires_at: { N: String(expiresAt) },
    },
    ConditionExpression: "attribute_not_exists(token_hash)",
  }));
  return {
    endpoint: publicEndpoint,
    protocol: `sozorock-session.${token}`,
    sessionId,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

/**
 * Creates a one-time transfer token for a live workspace session. The token
 * carries no authority on its own: acceptance still requires an authenticated
 * workspace participant and a fresh session minted for that participant.
 */
export async function mintRealtimeHandoff(input: {
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
  sessionId: string;
}) {
  const { sessionTable } = config();
  if (!/^[a-f0-9]{32}$/i.test(input.sessionId)) throw new Error("Live session identifier is invalid.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await dynamodb.send(new PutItemCommand({
    TableName: sessionTable,
    Item: {
      token_hash: { S: tokenHash(token) },
      kind: { S: "handoff" },
      session_id: { S: input.sessionId },
      workspace_id: { S: input.workspaceId },
      tenant_id: { S: input.tenantId },
      source_principal_id: { S: input.actor.principalId },
      expires_at: { N: String(expiresAt) },
      used: { BOOL: false },
    },
    ConditionExpression: "attribute_not_exists(token_hash)",
  }));
  return { token, expiresAt: new Date(expiresAt * 1000).toISOString(), sessionId: input.sessionId };
}

export async function acceptRealtimeHandoff(input: {
  token: string;
  workspaceId: string;
  tenantId: string;
  actor: WorkspaceActor;
}) {
  const { sessionTable } = config();
  const tokenHashValue = tokenHash(input.token);
  const found = await dynamodb.send(new GetItemCommand({
    TableName: sessionTable,
    Key: { token_hash: { S: tokenHashValue } },
    ConsistentRead: true,
  }));
  const item = found.Item;
  if (item?.kind?.S !== "handoff" || item.workspace_id?.S !== input.workspaceId || item.tenant_id?.S !== input.tenantId) {
    throw new Error("This live-session handoff is invalid or outside the workspace.");
  }
  if (item.used?.BOOL || Number(item.expires_at?.N ?? 0) <= Math.floor(Date.now() / 1000)) {
    throw new Error("This live-session handoff has expired or was already used.");
  }
  const marked = await dynamodb.send(new UpdateItemCommand({
    TableName: sessionTable,
    Key: { token_hash: { S: tokenHashValue } },
    UpdateExpression: "SET used = :used, accepted_by = :acceptedBy, accepted_at = :acceptedAt",
    ConditionExpression: "attribute_not_exists(used) OR used = :notUsed",
    ExpressionAttributeValues: {
      ":used": { BOOL: true },
      ":notUsed": { BOOL: false },
      ":acceptedBy": { S: input.actor.principalId },
      ":acceptedAt": { N: String(Math.floor(Date.now() / 1000)) },
    },
    ReturnValues: "ALL_NEW",
  }));
  if (!marked.Attributes?.session_id?.S) throw new Error("The live-session handoff could not be claimed.");
  return mintRealtimeSession({ workspaceId: input.workspaceId, tenantId: input.tenantId, actor: input.actor });
}

export async function broadcastWorkspaceEvent(
  workspaceId: string,
  event: Record<string, unknown>,
) {
  const { connectionTable, endpoint } = config();
  const connections = await dynamodb.send(new QueryCommand({
    TableName: connectionTable,
    IndexName: "workspace_id-index",
    KeyConditionExpression: "workspace_id = :workspace",
    ExpressionAttributeValues: { ":workspace": { S: workspaceId } },
    ProjectionExpression: "connection_id",
  }));
  const management = new ApiGatewayManagementApiClient({ endpoint });
  const data = new TextEncoder().encode(JSON.stringify({
    contractVersion: "explore.workspace-realtime.v1",
    event,
  }));
  await Promise.all((connections.Items ?? []).map(async (item) => {
    const connectionId = item.connection_id?.S;
    if (!connectionId) return;
    try {
      await management.send(new PostToConnectionCommand({ ConnectionId: connectionId, Data: data }));
    } catch (error) {
      if (error instanceof GoneException || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 410) {
        await dynamodb.send(new DeleteItemCommand({
          TableName: connectionTable,
          Key: { connection_id: { S: connectionId } },
        }));
        return;
      }
      throw error;
    }
  }));
}

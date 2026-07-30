import { createHash, randomBytes } from "node:crypto";
import {
  DeleteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
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
  const publicEndpoint = process.env.NEXT_PUBLIC_EXPLORE_REALTIME_ENDPOINT?.trim();
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
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  await dynamodb.send(new PutItemCommand({
    TableName: sessionTable,
    Item: {
      token_hash: { S: tokenHash(token) },
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
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
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

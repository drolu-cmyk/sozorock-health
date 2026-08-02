import { createHash } from "node:crypto";
import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import type {
  APIGatewayProxyResultV2,
  APIGatewayProxyWebsocketEventV2,
} from "aws-lambda";

const dynamodb = new DynamoDBClient({});

function config() {
  const sessions = process.env.SESSION_TABLE;
  const connections = process.env.CONNECTION_TABLE;
  if (!sessions || !connections) throw new Error("Real-time table configuration is incomplete.");
  return { sessions, connections };
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function protocol(event: APIGatewayProxyWebsocketEventV2) {
  const headers = (event as APIGatewayProxyWebsocketEventV2 & {
    headers?: Record<string, string | undefined>;
  }).headers ?? {};
  const raw = headers["sec-websocket-protocol"] ?? headers["Sec-WebSocket-Protocol"] ?? "";
  return raw.split(",").map((value: string) => value.trim()).find((value: string) => value.startsWith("sozorock-session.")) ?? "";
}

async function connect(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const { sessions, connections } = config();
  const selectedProtocol = protocol(event);
  const token = selectedProtocol.slice("sozorock-session.".length);
  if (!token) return { statusCode: 401, body: "Unauthorized" };
  const session = await dynamodb.send(new GetItemCommand({
    TableName: sessions,
    Key: { token_hash: { S: hash(token) } },
    ConsistentRead: true,
  }));
  const item = session.Item;
  const now = Math.floor(Date.now() / 1000);
  if (!item || item.kind?.S !== "session" || Number(item.expires_at?.N ?? "0") <= now) {
    return { statusCode: 401, body: "Unauthorized" };
  }
  // Consume the session token atomically before registering the connection.
  // Two concurrent $connect requests therefore cannot both become active
  // sessions, even if they read the same item before either request deletes it.
  try {
    await dynamodb.send(new DeleteItemCommand({
      TableName: sessions,
      Key: { token_hash: { S: hash(token) } },
      ConditionExpression: "kind = :kind AND expires_at > :now",
      ExpressionAttributeValues: {
        ":kind": { S: "session" },
        ":now": { N: String(now) },
      },
    }));
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === "ConditionalCheckFailedException") {
      return { statusCode: 401, body: "Unauthorized" };
    }
    throw error;
  }
  const connectionId = event.requestContext.connectionId;
  await dynamodb.send(new PutItemCommand({
    TableName: connections,
    Item: {
      connection_id: { S: connectionId },
      workspace_id: { S: item.workspace_id!.S! },
      tenant_id: { S: item.tenant_id!.S! },
      principal_id: { S: item.principal_id!.S! },
      display_name: { S: item.display_name!.S! },
      access: { S: item.access!.S! },
      expires_at: { N: String(now + 900) },
    },
    ConditionExpression: "attribute_not_exists(connection_id)",
  }));
  return {
    statusCode: 200,
    body: "Connected",
    headers: { "Sec-WebSocket-Protocol": selectedProtocol },
  };
}

async function disconnect(event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> {
  const { connections } = config();
  await dynamodb.send(new DeleteItemCommand({
    TableName: connections,
    Key: { connection_id: { S: event.requestContext.connectionId } },
  }));
  return { statusCode: 200, body: "Disconnected" };
}

export async function handler(
  event: APIGatewayProxyWebsocketEventV2,
): Promise<APIGatewayProxyResultV2> {
  const route = event.requestContext.routeKey;
  if (route === "$connect") return connect(event);
  if (route === "$disconnect") return disconnect(event);
  return {
    statusCode: 403,
    body: "Workspace writes use the authenticated HTTPS API.",
  };
}

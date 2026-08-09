import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { NextRequest } from "next/server";
import { agentRateLimitNamespace } from "./agent-rate-limit-policy";
import { clientNetworkAddress } from "./request-security";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.EVIDENCE_RATE_LIMIT_TABLE
  ?? process.env.CONTACT_RATE_LIMIT_TABLE
  ?? process.env.CONTACT_SUBMISSIONS_TABLE;
const directSalt = process.env.EVIDENCE_RATE_LIMIT_SALT ?? process.env.CONTACT_RATE_LIMIT_SALT;
const secretArn = process.env.EVIDENCE_RATE_LIMIT_SALT_SECRET_ARN
  ?? process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN;
const maximum = 120;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const secrets = new SecretsManagerClient({ region });
let resolvedSalt: Promise<string> | undefined;

async function salt() {
  if (directSalt) return directSalt;
  if (!secretArn) throw new Error("Evidence rate-limit salt is not configured.");
  resolvedSalt ??= secrets.send(new GetSecretValueCommand({ SecretId: secretArn })).then((result) => {
    if (!result.SecretString) throw new Error("Evidence rate-limit salt is empty.");
    return result.SecretString;
  });
  return resolvedSalt;
}

export async function enforceEvidenceRateLimit(request: NextRequest) {
  if (process.env.RUNTIME_ENV?.trim().toLowerCase() === "test" && !tableName) {
    return { allowed: true as const, retryAfter: null };
  }
  if (!tableName) return { allowed: false as const, retryAfter: null };
  const epoch = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(epoch / 300);
  const clientHash = createHash("sha256")
    .update(`${await salt()}:evidence:${clientNetworkAddress(request.headers)}`)
    .digest("hex");
  try {
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `evidence-rate#${clientHash}#${bucket}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: {
        ":one": 1,
        ":maximum": maximum,
        ":expiresAt": epoch + 600,
        ":recordType": "evidence-rate-limit",
      },
    }));
    return { allowed: true as const, retryAfter: null };
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return { allowed: false as const, retryAfter: 300 };
    }
    throw error;
  }
}

export async function enforceAgentRateLimit(request: NextRequest) {
  if (process.env.RUNTIME_ENV?.trim().toLowerCase() === "test" && !tableName) {
    return { allowed: true as const, retryAfter: null };
  }
  if (!tableName) return { allowed: false as const, retryAfter: null };
  const epoch = Math.floor(Date.now() / 1000);
  const hour = Math.floor(epoch / 3600);
  const day = Math.floor(epoch / 86400);
  const namespace = agentRateLimitNamespace();
  const clientHash = createHash("sha256")
    .update(`${await salt()}:place-agent:${clientNetworkAddress(request.headers)}`)
    .digest("hex");
  const perNetworkPerHour = Number(process.env.PLACE_AGENT_MAX_PER_NETWORK_HOUR || "2");
  const globalPerDay = Number(process.env.PLACE_AGENT_MAX_GLOBAL_DAY || "10");
  if (!Number.isInteger(perNetworkPerHour) || perNetworkPerHour < 1
    || !Number.isInteger(globalPerDay) || globalPerDay < 1) {
    return { allowed: false as const, retryAfter: null };
  }
  try {
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `place-agent-global#${namespace}#${day}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: {
        ":one": 1,
        ":maximum": globalPerDay,
        ":expiresAt": epoch + 172800,
        ":recordType": "place-agent-global-cost-limit",
      },
    }));
    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { submissionId: `place-agent-rate#${namespace}#${clientHash}#${hour}` },
      UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues: {
        ":one": 1,
        ":maximum": perNetworkPerHour,
        ":expiresAt": epoch + 7200,
        ":recordType": "place-agent-rate-limit",
      },
    }));
    return { allowed: true as const, retryAfter: null };
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return { allowed: false as const, retryAfter: 3600 };
    }
    throw error;
  }
}

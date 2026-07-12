import { createHash, randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  hasUnsupportedAccessRequestFields,
  isAllowedAccessOrigin,
  parseAccessRequestInput,
  validateAccessRequestInput,
} from "../../lib/access-request-validation.ts";
import { clientNetworkAddress } from "../../lib/request-security.ts";

export const runtime = "nodejs";

const region = process.env.AWS_REGION ?? "us-east-1";
const tableName = process.env.ACCESS_REQUESTS_TABLE;
const topicArn = process.env.ACCESS_NOTIFICATION_TOPIC_ARN;
const salt = process.env.ACCESS_RATE_LIMIT_SALT;
const saltSecretArn = process.env.ACCESS_RATE_LIMIT_SALT_SECRET_ARN;
const configuredOrigins = (
  process.env.ACCESS_ALLOWED_ORIGINS ??
  process.env.PUBLIC_SITE_URL ??
  "https://health.sozorockfoundation.org"
)
  .split(";")
  .map((origin) => origin.trim())
  .filter(Boolean);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const sns = new SNSClient({ region });
const secrets = new SecretsManagerClient({ region });
const MAX_REQUEST_BYTES = 4_096;
const MAX_REQUESTS_PER_HOUR = 10;
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
let resolvedSalt: Promise<string> | undefined;

async function getSalt() {
  if (salt) return salt;
  if (!saltSecretArn) throw new Error("Access request rate-limit salt is not configured");
  resolvedSalt ??= secrets.send(new GetSecretValueCommand({ SecretId: saltSecretArn })).then((result) => {
    if (!result.SecretString) throw new Error("Access request rate-limit salt is empty");
    return result.SecretString;
  });
  return resolvedSalt;
}

function responseHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    vary: "Origin",
  };
  if (isAllowedAccessOrigin(origin, configuredOrigins)) {
    headers["access-control-allow-origin"] = origin as string;
  }
  return headers;
}

function json(
  request: Request,
  body: Record<string, unknown>,
  status: number,
  additionalHeaders: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: {
      ...responseHeaders(request.headers.get("origin")),
      ...additionalHeaders,
    },
  });
}

function trustedClient(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) return isAllowedAccessOrigin(origin, configuredOrigins);
  // A public native client cannot safely hold a shared secret. This identifier is an
  // abuse signal only; durable rate limiting remains the enforcement control.
  return request.headers.get("x-sozorock-client") === "mobile-v1";
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedAccessOrigin(origin, configuredOrigins)) {
    return json(request, { error: "Request origin was not accepted." }, 403);
  }
  return new Response(null, {
    status: 204,
    headers: {
      ...responseHeaders(origin),
      "access-control-allow-headers": "Content-Type, X-SozoRock-Client",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-max-age": "600",
    },
  });
}

export async function POST(request: Request) {
  if (!tableName || !topicArn || (!salt && !saltSecretArn)) {
    console.error("access-request-config-missing", {
      hasTable: Boolean(tableName),
      hasTopic: Boolean(topicArn),
      hasSalt: Boolean(salt || saltSecretArn),
    });
    return json(request, { error: "Access requests are temporarily unavailable." }, 503);
  }
  if (!trustedClient(request)) {
    return json(request, { error: "Request origin was not accepted." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(request, { error: "Send this request as JSON." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(request, { error: "The request is too large." }, 413);
  }
  const rawBody = await request.text().catch(() => "");
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return json(request, { error: "The request is too large." }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json(request, { error: "Enter the required information." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(request, { error: "Enter the required information." }, 400);
  }
  const record = body as Record<string, unknown>;
  if (hasUnsupportedAccessRequestFields(record)) {
    return json(request, { error: "The request contains unsupported information." }, 400);
  }
  const input = parseAccessRequestInput(record);
  if (input.website) return json(request, { accepted: true, pathways: [] }, 202);
  const validationError = validateAccessRequestInput(input);
  if (validationError) return json(request, { error: validationError }, 400);

  const now = new Date();
  const epoch = Math.floor(now.getTime() / 1000);
  const bucket = Math.floor(epoch / 3600);
  const networkAddress = clientNetworkAddress(request.headers);
  let networkHash: string;
  try {
    networkHash = createHash("sha256")
      .update(`${await getSalt()}:${networkAddress}`)
      .digest("hex");
  } catch {
    return json(request, { error: "Access requests are temporarily unavailable." }, 503);
  }

  try {
    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { requestId: `rate#${networkHash}#${bucket}` },
        UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
        ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
        ExpressionAttributeValues: {
          ":one": 1,
          ":maximum": MAX_REQUESTS_PER_HOUR,
          ":expiresAt": epoch + 7200,
          ":recordType": "rate-limit",
        },
      }),
    );
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
      return json(
        request,
        { error: "Please wait before checking another pathway." },
        429,
        { "retry-after": "3600" },
      );
    }
    console.error("access-request-rate-limit-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    return json(request, { error: "Access requests are temporarily unavailable." }, 503);
  }

  const requestId = `access#${now.toISOString()}#${randomUUID()}`;
  try {
    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          requestId,
          recordType: "non-clinical-access-request",
          journey: input.journey,
          location: input.location || undefined,
          selection: input.selection || undefined,
          locale: input.locale,
          source: input.source,
          consent: true,
          consentVersion: input.consentVersion,
          consentedAt: now.toISOString(),
          status: "received",
          createdAt: now.toISOString(),
          expiresAt: epoch + RETENTION_SECONDS,
        },
        ConditionExpression: "attribute_not_exists(requestId)",
      }),
    );
  } catch (error) {
    console.error("access-request-storage-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
    });
    return json(request, { error: "Access requests are temporarily unavailable." }, 503);
  }

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: "New SozoRock Health non-clinical access request",
        Message: [
          `Request: ${requestId}`,
          `Journey: ${input.journey}`,
          `Interface language: ${input.locale}`,
          "Review the encrypted access-request table for the consented request. No clinical or contact information was collected.",
        ].join("\n"),
      }),
    );
  } catch {
    // The request is safely stored even if an operational notification is delayed.
  }

  return json(
    request,
    {
      accepted: true,
      requestId,
      status: "received",
      pathways: [],
      message:
        "Your selections were received. No participating pathway is being returned at this time, and no provider connection has been created.",
    },
    202,
  );
}

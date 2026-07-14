import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const maximumWarmInstanceBuckets = 4_096;

export function checkPublicRateLimit(
  headers: Headers,
  scope: string,
  limit: number,
  windowMs = 60_000,
) {
  const now = Date.now();
  // CloudFront appends the viewer address to the chain. Reading the last value
  // prevents a caller-supplied leading entry from becoming the bucket key.
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const clientHint = forwarded || headers.get("x-real-ip") || headers.get("user-agent") || "unknown";
  const key = createHash("sha256").update(`${scope}:${clientHint}`).digest("hex");
  const current = buckets.get(key);
  if (!current && buckets.size >= maximumWarmInstanceBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (oldestKey) buckets.delete(oldestKey);
  }
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
  };
}

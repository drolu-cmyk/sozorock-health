export function agentRateLimitNamespace(
  value = process.env.PLACE_AGENT_RATE_LIMIT_NAMESPACE,
) {
  const normalized = value?.trim().toLowerCase();
  return normalized && /^[a-z0-9][a-z0-9-]{0,31}$/.test(normalized)
    ? normalized
    : "production";
}

export type BoundedBodyError =
  | "unsupported-media-type"
  | "too-large"
  | "read-failed";

export type BoundedBodyResult =
  | { ok: true; text: string }
  | { ok: false; error: BoundedBodyError };

const DEFAULT_PUBLIC_ORIGIN = "https://health.sozorockfoundation.org";

function values(header: string | null) {
  return (header ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * CloudFront appends its trusted viewer value to caller-provided forwarding
 * headers. Use the final value so a caller cannot rotate a durable abuse key
 * or substitute the public host with a leading value.
 */
export function lastForwardedValue(headers: Headers, name: string) {
  return values(headers.get(name)).at(-1);
}

export function clientNetworkAddress(headers: Headers) {
  return lastForwardedValue(headers, "x-forwarded-for") ?? "unknown";
}

function normalizedConfiguredHost(value: string) {
  const candidate = value.trim().toLowerCase();
  if (!candidate) return null;
  try {
    return new URL(candidate).host.toLowerCase();
  } catch {
    return /^[a-z0-9.-]+(?::\d{1,5})?$/.test(candidate) ? candidate : null;
  }
}

function publicRequestHost(request: Request) {
  const forwarded = lastForwardedValue(request.headers, "x-forwarded-host");
  const direct = request.headers.get("host")?.trim();
  if (forwarded || direct) return (forwarded ?? direct ?? "").toLowerCase();
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return "";
  }
}

function localDevelopmentOrigin(origin: URL) {
  return (
    (origin.hostname === "localhost" ||
      origin.hostname === "127.0.0.1" ||
      origin.hostname === "[::1]") &&
    (origin.protocol === "http:" || origin.protocol === "https:")
  );
}

function configuredPublicOrigin(
  value: string | undefined,
  production: boolean,
) {
  if (!value?.trim()) return DEFAULT_PUBLIC_ORIGIN;
  try {
    const candidate = new URL(value.trim());
    const localOrigin = localDevelopmentOrigin(candidate);
    const localDevelopment = !production && localOrigin;
    if (
      (candidate.protocol !== "https:" && !localDevelopment) ||
      (production && localOrigin) ||
      candidate.username ||
      candidate.password
    ) {
      return DEFAULT_PUBLIC_ORIGIN;
    }
    return candidate.origin;
  } catch {
    return DEFAULT_PUBLIC_ORIGIN;
  }
}

/**
 * Build a same-site public URL without trusting an internal compute request URL.
 * Amplify SSR may expose localhost as request.url even for a public request.
 */
export function publicSiteUrl(
  path: string,
  configuredOrigin = process.env.PUBLIC_SITE_URL,
  production = process.env.NODE_ENV === "production",
) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    /[\u0000-\u001F\u007F\\]/.test(path)
  ) {
    throw new Error("Public redirect paths must be root-relative");
  }
  return new URL(
    path,
    `${configuredPublicOrigin(configuredOrigin, production)}/`,
  );
}

/** Require an exact HTTPS host match, with HTTP permitted only for localhost. */
export function isTrustedSameOrigin(
  request: Request,
  configuredHosts: readonly string[] = [],
) {
  const originValue = request.headers.get("origin");
  if (!originValue) return false;
  try {
    const origin = new URL(originValue);
    if (origin.protocol !== "https:" && !localDevelopmentOrigin(origin)) {
      return false;
    }
    const allowed = new Set(
      [publicRequestHost(request), ...configuredHosts.map(normalizedConfiguredHost)]
        .filter((host): host is string => Boolean(host))
        .map((host) => host.toLowerCase()),
    );
    return allowed.has(origin.host.toLowerCase());
  } catch {
    return false;
  }
}

function mediaType(contentType: string | null) {
  return contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

/**
 * Read at most maxBytes from the request stream. This enforces the actual body
 * size even when Content-Length is absent or inaccurate, before JSON or form
 * parsing can allocate an unbounded payload.
 */
export async function readBoundedText(
  request: Request,
  maxBytes: number,
  allowedMediaTypes: readonly string[],
): Promise<BoundedBodyResult> {
  if (!allowedMediaTypes.includes(mediaType(request.headers.get("content-type")))) {
    return { ok: false, error: "unsupported-media-type" };
  }

  const declared = request.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    return { ok: false, error: "too-large" };
  }

  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, error: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "read-failed" };
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(body) };
}

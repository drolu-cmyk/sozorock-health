import path from "node:path";
import type {NextConfig} from "next";

const agenticApiOrigin = "https://api.cbcap.sozorockfoundation.org";
const connectSources = ["'self'", agenticApiOrigin];
try {
  const cognitoOrigin = new URL(process.env.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN || "");
  if (cognitoOrigin.protocol === "https:" && !cognitoOrigin.username && !cognitoOrigin.password) {
    connectSources.push(cognitoOrigin.origin);
  }
} catch {
  // Auth remains feature-gated when the Cognito domain is absent or invalid.
}

const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src ${connectSources.join(" ")}; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};

export default config;

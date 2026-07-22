import type { NextConfig } from "next";
import path from "node:path";

const scriptPolicy = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const contentSecurityPolicy = `default-src 'self'; ${scriptPolicy}; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // Amplify SSR does not forward app environment variables to the compute
  // runtime. These values are referenced only by server routes and are
  // compiled into the trusted server bundle during the release build.
  env: {
    CONTACT_SUBMISSIONS_TABLE: process.env.CONTACT_SUBMISSIONS_TABLE,
    CONTACT_NOTIFICATION_TOPIC_ARN: process.env.CONTACT_NOTIFICATION_TOPIC_ARN,
    CONTACT_RATE_LIMIT_SALT_SECRET_ARN: process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN,
    CONTACT_ALLOWED_HOSTS: process.env.CONTACT_ALLOWED_HOSTS,
    ACCESS_REQUESTS_TABLE: process.env.ACCESS_REQUESTS_TABLE,
    ACCESS_NOTIFICATION_TOPIC_ARN: process.env.ACCESS_NOTIFICATION_TOPIC_ARN,
    ACCESS_RATE_LIMIT_SALT_SECRET_ARN:
      process.env.ACCESS_RATE_LIMIT_SALT_SECRET_ARN,
    ACCESS_ALLOWED_ORIGINS: process.env.ACCESS_ALLOWED_ORIGINS,
    OPENAI_SECRET_ARN: process.env.OPENAI_SECRET_ARN,
    VOICE_PROVIDER_ALIAS: process.env.VOICE_PROVIDER_ALIAS,
    OPENAI_REALTIME_MODEL: process.env.OPENAI_REALTIME_MODEL,
    OPENAI_REALTIME_ENABLED: process.env.OPENAI_REALTIME_ENABLED,
    OPENAI_GPT_LIVE_MODEL: process.env.OPENAI_GPT_LIVE_MODEL,
    PUBLICATION_ACCESS_TABLE: process.env.PUBLICATION_ACCESS_TABLE,
    PUBLICATION_ASSET_BUCKET: process.env.PUBLICATION_ASSET_BUCKET,
    PUBLICATION_EMAIL_FROM: process.env.PUBLICATION_EMAIL_FROM,
    PUBLICATION_HASH_SALT_SECRET_ARN: process.env.PUBLICATION_HASH_SALT_SECRET_ARN,
    PUBLICATION_ALLOWED_HOSTS: process.env.PUBLICATION_ALLOWED_HOSTS,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.health.sozorockfoundation.org" }],
        destination: "https://health.sozorockfoundation.org/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/es",
        headers: [{ key: "Content-Language", value: "es-US" }],
      },
      { source: "/(.*)", headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
        { key: "X-Frame-Options", value: "DENY" },
      ] },
    ];
  },
};

export default nextConfig;

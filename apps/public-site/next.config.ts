import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // Amplify SSR does not forward app environment variables to the compute
  // runtime. These values are referenced only by the server contact route and
  // are compiled into that server bundle during the trusted release build.
  env: {
    CONTACT_SUBMISSIONS_TABLE: process.env.CONTACT_SUBMISSIONS_TABLE,
    CONTACT_NOTIFICATION_TOPIC_ARN: process.env.CONTACT_NOTIFICATION_TOPIC_ARN,
    CONTACT_RATE_LIMIT_SALT: process.env.CONTACT_RATE_LIMIT_SALT,
    CONTACT_RATE_LIMIT_SALT_SECRET_ARN: process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN,
    CONTACT_ALLOWED_HOSTS: process.env.CONTACT_ALLOWED_HOSTS,
    OPENAI_SECRET_ARN: process.env.OPENAI_SECRET_ARN,
    PUBLICATION_ACCESS_TABLE: process.env.PUBLICATION_ACCESS_TABLE,
    PUBLICATION_ASSET_BUCKET: process.env.PUBLICATION_ASSET_BUCKET,
    PUBLICATION_EMAIL_FROM: process.env.PUBLICATION_EMAIL_FROM,
    PUBLICATION_HASH_SALT_SECRET_ARN: process.env.PUBLICATION_HASH_SALT_SECRET_ARN,
    PUBLICATION_ALLOWED_HOSTS: process.env.PUBLICATION_ALLOWED_HOSTS,
    PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};

export default nextConfig;

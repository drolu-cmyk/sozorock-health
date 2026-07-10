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
  },
};

export default nextConfig;

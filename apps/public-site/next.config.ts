import type { NextConfig } from "next";
import path from "node:path";

const scriptPolicy = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const contentSecurityPolicy = `default-src 'self'; ${scriptPolicy}; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Public images are trusted static assets. Amplify serves them directly,
    // so the production runtime does not need Next's optional Sharp/libvips
    // image optimizer or the /_next/image transformation route.
    unoptimized: true,
  },
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // Server routes read configuration from process.env. The Amplify build
  // writes a server-only .env.production file; values are deliberately not
  // mapped through nextConfig.env, which would expose them to browser code.
  outputFileTracingIncludes: {
    "/review/partner-evidence/download/*": [
      "../../output/pdf/milestone-6/*.pdf",
    ],
  },
  async redirects() {
    return [
      {
        source: "/publications/health-systems-assurance",
        destination: "/publications/health-systems-assurance-volume-1",
        permanent: true,
      },
      {
        source: "/publications/health-systems-assurance/:path*",
        destination: "/publications/health-systems-assurance-volume-1/:path*",
        permanent: true,
      },
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
      {
        source: "/api/publications/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        source: "/api/evidence/v1/workspace-share",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;

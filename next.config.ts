import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clerkCspHosts } from "./lib/auth/clerk";

const isProduction = process.env.NODE_ENV === "production";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    ...clerkCspHosts.scripts,
  ].join(" "),
  [
    "style-src 'self' 'unsafe-inline'",
    ...clerkCspHosts.styles,
  ].join(" "),
  [
    "img-src 'self' data: blob: https://cdn.simpleicons.org https://images.unsplash.com https://*.supabase.co",
    ...clerkCspHosts.images,
  ].join(" "),
  ["font-src 'self' data:", ...clerkCspHosts.fonts].join(" "),
  [
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    ...clerkCspHosts.connect,
  ].join(" "),
  ["frame-src 'self'", ...clerkCspHosts.frames].join(" "),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

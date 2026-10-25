import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Isolated acceptance runs can coexist with the developer's current server.
  distDir: process.env.MIRAFLORES_DIST_DIR || ".next",
  // Standard Node output. No Sites, Workers, D1 or R2 deployment adapter is active.
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./data/packet.json", "./drizzle/*.sql"] },
};

export default nextConfig;

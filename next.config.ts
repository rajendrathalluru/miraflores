import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standard Node output. No Sites, Workers, D1 or R2 deployment adapter is active.
  output: "standalone",
  outputFileTracingIncludes: { "/*": ["./data/packet.json", "./drizzle/*.sql"] },
};

export default nextConfig;

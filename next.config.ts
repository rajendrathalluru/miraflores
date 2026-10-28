import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: { '/api/*': ['./data/seed-packet.json'] },
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  distDir: process.env.MIRAFLORES_DIST_DIR || '.next',
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
};
export default config;

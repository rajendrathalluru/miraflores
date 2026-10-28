import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  distDir: process.env.MIRAFLORES_DIST_DIR || '.next',
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
};
export default config;

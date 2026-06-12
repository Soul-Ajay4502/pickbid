import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these packages — Sequelize's dialect loader
  // uses dynamic require() internally which webpack cannot resolve at build time.
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-pool'],
};

export default nextConfig;

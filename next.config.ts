import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these packages — Sequelize's dialect loader
  // uses dynamic require() internally which webpack cannot resolve at build time.
  serverExternalPackages: ['sequelize', 'pg', 'pg-hstore', 'pg-pool'],
  images: {
    remotePatterns: [
      // Player photos uploaded via Cloudinary
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Google account avatars shown in the nav
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;

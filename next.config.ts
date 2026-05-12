import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Allow images from external sources if any
  images: {
    remotePatterns: [],
  },

  // Next.js 16 uses Turbopack by default; explicit config silences the
  // "webpack config present but no turbopack config" build error.
  turbopack: {},
};

export default nextConfig;

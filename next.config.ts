import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@imgly/background-removal-node', 'sharp'],
  // Required for Next.js 16 - silence Turbopack/webpack coexistence error
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/data/**', '**/node_modules/**'],
      };
    }
    return config;
  },
};

export default nextConfig;

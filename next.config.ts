import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack(config) {
    // Vercel does not provide Cloudflare's runtime module. Keep the source shared
    // with Vinext while mapping its env export to process.env on Next.js.
    config.resolve.alias["@runtime-env"] = path.resolve(
      process.cwd(),
      "lib/vercel-cloudflare-env.ts",
    );
    return config;
  },
};

export default nextConfig;

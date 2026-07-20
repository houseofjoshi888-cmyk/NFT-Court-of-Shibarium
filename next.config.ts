import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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

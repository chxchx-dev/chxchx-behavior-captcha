import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The library validates FormData after parsing; cap request allocation in Next.js first.
    serverActions: { bodySizeLimit: "128kb" },
  },
  webpack(config) {
    // Source uses `.js` specifiers for Node ESM; resolve those to TypeScript in this demo app.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the self-hosted console image; Vercel deployments are unaffected.
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Suppress hydration warnings in development
  reactStrictMode: false,
};

export default nextConfig;

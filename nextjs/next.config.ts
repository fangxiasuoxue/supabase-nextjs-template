import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Suppress hydration warnings in development
  reactStrictMode: false,
};

export default nextConfig;

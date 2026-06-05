import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    useWasmBinary: true
  }
};

export default nextConfig;

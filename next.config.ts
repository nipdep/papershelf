import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["sql.js"],
  experimental: {
    useWasmBinary: true
  }
};

export default nextConfig;

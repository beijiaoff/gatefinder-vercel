import type { NextConfig } from "next";
import path from "node:path";

const repositoryRoot = path.join(process.cwd(), "..");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.137.15"],
  poweredByHeader: false,
  outputFileTracingRoot: repositoryRoot,
  turbopack: { root: repositoryRoot },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

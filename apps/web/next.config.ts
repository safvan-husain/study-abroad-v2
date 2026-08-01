import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:3101"}/:path*` }]; },
};

export default nextConfig;

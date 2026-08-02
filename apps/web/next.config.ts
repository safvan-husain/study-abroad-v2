import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@study-abroad/contracts", "@study-abroad/spacetimedb-bindings"],
};

export default nextConfig;

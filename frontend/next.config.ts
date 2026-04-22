import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this app dir. Without this, Next 16
  // detects the parent directory's package-lock.json and treats that as root.
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const API_PROXY_TARGET = process.env.PRIMER_PROXY_TARGET || "http://localhost:8000";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this app dir. Without this, Next 16 detects
  // the parent directory's package-lock.json and treats that as root.
  turbopack: {
    root: path.resolve("."),
  },
  // Proxy backend requests through the Next dev server so the browser sees
  // same-origin traffic — avoids CORS preflight, keeps SSE streaming intact.
  async rewrites() {
    return [
      { source: "/api/accounts", destination: `${API_PROXY_TARGET}/api/accounts` },
      { source: "/briefing/:id", destination: `${API_PROXY_TARGET}/briefing/:id` },
    ];
  },
};

export default nextConfig;

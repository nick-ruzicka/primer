import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this app dir. Without this, Next 16
  // detects the parent directory's package-lock.json and treats that as root.
  turbopack: {
    root: path.resolve("."),
  },
  async rewrites() {
    // Dev only: proxy /api/* to the local backend so the Next.js dev server
    // looks like the prod nginx layout. In production nginx handles /api/*
    // directly; including this rewrite there would tie every SSR fetch to a
    // hardcoded localhost:8000 and silently break if deployed elsewhere.
    if (process.env.NODE_ENV !== "development") {
      return { beforeFiles: [] };
    }
    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: "http://localhost:8000/api/:path*",
        },
      ],
    };
  },
};

export default nextConfig;

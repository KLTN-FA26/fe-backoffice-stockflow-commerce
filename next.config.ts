import type { NextConfig } from "next";

// Backend base URL — server-only (no NEXT_PUBLIC_ prefix), never inlined into
// the client bundle. Browser always calls same-origin "/api/*"; Next.js
// rewrites forward the request to the real backend from the server.
const API_URL = process.env.API_URL ?? "http://localhost:8080/api";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;

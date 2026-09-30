import type { NextConfig } from "next";

// Backend base URL — server-only (no NEXT_PUBLIC_ prefix), never inlined into
// the client bundle. Browser always calls same-origin "/api/*"; Next.js
// rewrites forward the request to the real backend from the server.
//
// Convention (whole project): API_URL already ends in the BE version prefix `/api/v1`,
// so paths in `features/*/api.ts` never contain `/v1` — "/purchase-orders" →
// `${API_URL}/purchase-orders` = BE `/api/v1/purchase-orders`.
const API_URL = process.env.API_URL ?? "http://localhost:8080/api/v1";

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

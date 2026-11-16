import type { NextConfig } from "next";

import { MAX_UPLOAD_REQUEST_BYTES } from "./src/constants/upload-limits";

// Authenticated traffic goes through Route Handlers; no direct backend rewrite.
const nextConfig: NextConfig = {
  devIndicators: false,
  experimental: {
    // `src/proxy.ts` runs on /api/*: Next buffers the request body for it and cuts it at this size (10 MiB by
    // default), so a 10 MiB upload plus its envelope would reach the BFF route truncated. The BFF's own per-route
    // limit (`lib/auth/server/body-limit.ts`) stays the guard; this only lets the largest allowed body through whole.
    proxyClientMaxBodySize: MAX_UPLOAD_REQUEST_BYTES,
  },
  async redirects() {
    return [
      {
        // BE notification links still use the older Sales prefix.
        source: "/admin/sales/quotes/:id",
        destination: "/admin/quotes/:id",
        permanent: false,
      },
    ];
  },
};
export default nextConfig;

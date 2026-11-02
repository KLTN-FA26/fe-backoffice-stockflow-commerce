import type { NextConfig } from "next";

// Authenticated traffic goes through Route Handlers; no direct backend rewrite.
const nextConfig: NextConfig = {
  devIndicators: false,
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

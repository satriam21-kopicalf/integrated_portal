import type { NextConfig } from "next";

// All data comes from the Python backend (integrated_portal_be).
// The browser keeps calling same-origin `/api/*`, which Next.js proxies to the
// backend server-side, so there is no CORS or HTTPS -> HTTP mixed-content issue.
const BACKEND_URL = (process.env.BACKEND_URL || "http://187.52.114.14:8002").replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    // Logos/icons live in the Supabase Storage bucket `portal-assets` (see src/lib/assets.ts)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "awcoxytlmjiyfmpzinam.supabase.co",
        pathname: "/storage/v1/object/public/portal-assets/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

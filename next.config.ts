import type { NextConfig } from "next";

// All data comes from the Python backend (integrated_portal_be).
// The browser keeps calling same-origin `/api/*`, which Next.js proxies to the
// backend server-side, so there is no CORS or HTTPS -> HTTP mixed-content issue.
const BACKEND_URL = (process.env.BACKEND_URL || "http://187.52.114.14:8002").replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    // Logos/icons are small files already served by the Supabase Storage CDN
    // (bucket `portal-assets`, see src/lib/assets.ts), so they are loaded as-is
    // instead of going through the Next.js image optimizer.
    unoptimized: true,
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

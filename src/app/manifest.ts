import type { MetadataRoute } from "next";

// Web app manifest: the portal installs as a standalone app (Android / desktop Chrome via the install prompt, iOS via
// Share → Add to Home Screen, which reads the apple-* metadata of the layout). Icons are rendered from src/app/icon.svg.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Operations - Kopi Calf",
    short_name: "Kopi Calf",
    description: "Kopi Calf sales dashboard, stock opname and cost control",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "id",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

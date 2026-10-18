import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./theme-colors.css";
import "./globals.css";
import Providers from "./providers";
import { THEME_SCRIPT } from "@/lib/theme";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Operations - Kopi Calf",
  description: "Kopi Calf sales dashboard",
  applicationName: "Kopi Calf",
  // iOS: "Add to Home Screen" opens the portal as a standalone app with this name and icon
  appleWebApp: { capable: true, title: "Kopi Calf", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // older iOS (before 17) only opens Home Screen apps full screen with the legacy tag
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* the saved theme before the first paint (no flash of the light theme) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

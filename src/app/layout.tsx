import type { Metadata } from "next";
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
  title: "Integrated Portal - Kopi Calf",
  description: "Kopi Calf sales dashboard",
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

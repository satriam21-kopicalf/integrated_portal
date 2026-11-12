"use client";

// The look of Calf On The Road in the portal (2026-11-13): while a COTR page (or the COTR tab of the Dashboard) is shown,
// html.brand-cotr turns the primary colour (brand / blue) into the blue of the COTR logo (#141EDE) and the accent
// (maroon) into its red (#E41C24) — app/theme-colors.css, scripts/gen-theme.mjs. The brand class of the company switch
// (Wasgee Tea) is set aside meanwhile and put back when leaving.

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

const OTHER = ["brand-wasgee"];

export function useCotrTheme(on = true): void {
  useEffect(() => {
    if (!on) return;
    const el = document.documentElement;
    const had = OTHER.filter((c) => el.classList.contains(c));
    had.forEach((c) => el.classList.remove(c));
    el.classList.add("brand-cotr");
    return () => {
      el.classList.remove("brand-cotr");
      had.forEach((c) => el.classList.add(c));
    };
  }, [on]);
}

/** A COTR page, or an account of the COTR line: the COTR logo in the sidebar and the app bar. */
export function useCotrLook(): boolean {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  return pathname === "/cotr" || pathname.startsWith("/cotr/") || user?.businessLine === "cotr" || user?.role === "cotr_admin";
}

/** The theme on a COTR page (a component, for layouts that are server components). */
export function CotrTheme({ children }: { children: React.ReactNode }) {
  useCotrTheme(true);
  return children;
}

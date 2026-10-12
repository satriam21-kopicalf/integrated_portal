"use client";

// Loads the count type names set by Cost Control before the stock-opname screens render, so every screen shows the
// adjusted names (countTypeLabel). Falls back to the built-in labels when the list cannot be loaded.

import { ReactNode, useEffect, useState } from "react";
import { api } from "@/so/lib/api";
import { setCountTypeNames } from "@/so/lib/counts";

let loaded = false;

export function reloadCountTypeNames(): Promise<void> {
  return api<{ code: string; name: string }[]>("/api/so/count-settings/types")
    .then(setCountTypeNames)
    .catch(() => {})
    .finally(() => { loaded = true; });
}

export default function CountTypeNames({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => setReady(true), 3000); // never block the page for long
    void reloadCountTypeNames().then(() => setReady(true));
    return () => clearTimeout(timer);
  }, []);
  return ready ? <>{children}</> : null;
}

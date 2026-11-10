"use client";

import { usePathname } from "next/navigation";
import CostControlBrand from "@/components/CostControlBrand";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { brandPage } from "@/lib/company";

/** Monitoring screens inside the portal shell, with the brand on top (Kopi Calf / Wasgee, never mixed; 2026-11-10). */
export default function Layout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return <DashboardLayout>{brandPage(path) ? <CostControlBrand>{children}</CostControlBrand> : children}</DashboardLayout>;
}

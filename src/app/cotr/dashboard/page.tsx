"use client";

// Monitoring COTR → Dashboard (page cotr.check-in). 2026-11-23, the user: "kosongkan terlebih dahulu tampilan dashboard,
// kita akan implementasi jika seluruh menu sudah sesuai dan system bisa digunakan" — the dashboard waits until the daily
// menus are settled; until then it shows where the daily work is. The former dashboard (period overview, pools of the
// day, what waits, drivers) is in git history (src/app/cotr/dashboard/page.tsx before 2026-11-23) with its backend
// /api/cotr/dashboard kept.

import Link from "next/link";
import { Boxes, ChevronRight, ClipboardList, LayoutDashboard, MapPinCheck, Warehouse } from "lucide-react";
import { Page, Panel } from "@/components/kc/compat";
import { tr } from "@/lib/i18n";

const LINKS = [
  { href: "/cotr/storage", icon: <Warehouse size={18} />, title: () => tr("Storage & Assignment"), sub: () => tr("Morning assignment, reloads, night closing") },
  { href: "/cotr/check-in", icon: <MapPinCheck size={18} />, title: () => tr("Monitoring Armada - Driver"), sub: () => tr("Shifts, sales, stock, cupping & waste of every driver") },
  { href: "/cotr/requests", icon: <ClipboardList size={18} />, title: () => tr("Requests & Maintenance"), sub: () => tr("Driver cost requests and fleet maintenance") },
  { href: "/cotr/production", icon: <Boxes size={18} />, title: () => tr("Pool Stock"), sub: () => tr("Every night: leftover, batch codes, waste") },
];

export default function CotrDashboardPage() {
  return (
    <Page eyebrow="Calf On The Road" media={<LayoutDashboard size={19} />} title={tr("Dashboard")} subtitle={tr("Being prepared")}>
      <Panel title={tr("The dashboard is being prepared")} description={tr("It will be shown once every menu of Calf On The Road is settled and in use. Meanwhile the daily work is here:")}>
        <ul className="grid gap-2 p-4 sm:grid-cols-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 transition-colors hover:border-brand-200 hover:bg-neutral-50">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{l.icon}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-neutral-900">{l.title()}</span>
                  <span className="block truncate text-xs text-neutral-500">{l.sub()}</span></span>
                <ChevronRight size={15} className="text-neutral-300" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}

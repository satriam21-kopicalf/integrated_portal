"use client";

// Monitoring COTR → Master (2026-11-08): the masters of Calf On The Road on one page, a tab each — Employees (the former
// Master Driver), Area (the selling / standby places, migration 080), Pool / HUB, Fleet & Accessories, Schedule, Menu and Pengajuan (the request kinds, migration 083).
// The tab is kept in the address (?tab=) so a link opens it; a tab shows only with the page it belongs to.

import { Bike, Building2, CalendarDays, Coffee, MapPinned, Truck, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Page, EmbeddedPage } from "@/components/kc/compat";
import { Tabs } from "@/components/kc";
import { useAuth } from "@/lib/auth";
import type { PageKey } from "@/lib/pages";
import { tr } from "@/lib/i18n";
import DriversPage from "../drivers/page";
import PoolsPage from "../pools/page";
import FleetPage from "../fleet/page";
import SchedulePage from "../schedule/page";
import MenuPage from "../menu/page";
import AreasTab from "@/cotr/Areas";
import RequestKindsTab from "@/cotr/RequestKinds";

type Tab = { key: string; page: PageKey; label: () => string; icon: ReactNode; body: ReactNode };
const TABS: Tab[] = [
  // in the order of the setup (2026-11-12): pools first, then their areas, the menus, the fleet, the people, their
  // schedule and the kinds of request
  { key: "pools", page: "cotr.pools", label: () => tr("Pool / HUB"), icon: <Building2 size={15} />, body: <PoolsPage /> },
  { key: "areas", page: "cotr.areas", label: () => tr("Area"), icon: <MapPinned size={15} />, body: <AreasTab /> },
  { key: "menu", page: "cotr.menu", label: () => tr("Menu"), icon: <Coffee size={15} />, body: <MenuPage /> },
  { key: "fleet", page: "cotr.fleet", label: () => tr("Fleet & Accessories"), icon: <Truck size={15} />, body: <FleetPage /> },
  { key: "employees", page: "cotr.drivers", label: () => tr("Employees"), icon: <Bike size={15} />, body: <DriversPage /> },
  { key: "schedule", page: "cotr.schedule", label: () => tr("Schedule"), icon: <CalendarDays size={15} />, body: <SchedulePage /> },
  // migration 083: the kinds of a driver's request, with the requests they are decided in
  { key: "requests", page: "cotr.requests", label: () => tr("Requests"), icon: <Wallet size={15} />, body: <RequestKindsTab /> },
];

function Master() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  // every tab its own page (2026-11-20, migration 126): User Accounts → Calf On The Road → Master · <tab>
  const tabs = TABS.filter((t) => user && (user.role === "superadmin" || (user.pages ?? []).includes(t.page)));
  const tab = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0];
  return (
    <Page title={tr("Master")} subtitle={tr("The master data of Calf On The Road: employees, areas, pools, fleet & accessories, schedule, menus and request kinds")}>
      <Tabs label={tr("Master")} value={tab?.key ?? ""} onChange={(k) => router.replace(`/cotr/master?tab=${k}`, { scroll: false })}
        tabs={tabs.map((t, i) => ({ key: t.key, label: <><span className="text-[11px] font-bold tabular-nums text-neutral-400">{i + 1}</span>{t.icon}{t.label()}</> }))} />
      <EmbeddedPage.Provider value>{tab?.body}</EmbeddedPage.Provider>
    </Page>
  );
}

export default function CotrMasterPage() {
  return <Suspense><Master /></Suspense>;
}

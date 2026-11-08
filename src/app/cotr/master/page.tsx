"use client";

// Monitoring COTR → Master (2026-11-08): the masters of Calf On The Road on one page, a tab each — Employees (the former
// Master Driver), Area (the selling / standby places, migration 080), Pool / HUB, Fleet & Accessories, Schedule and Menu.
// The tab is kept in the address (?tab=) so a link opens it; a tab shows only with the page it belongs to.

import { Bike, Building2, CalendarDays, Coffee, MapPinned, Truck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Page, EmbeddedPage } from "@/components/kc/compat";
import { Tabs } from "@/components/kc";
import { canAccess, useAuth } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import DriversPage from "../drivers/page";
import PoolsPage from "../pools/page";
import FleetPage from "../fleet/page";
import SchedulePage from "../schedule/page";
import MenuPage from "../menu/page";
import AreasTab from "@/cotr/Areas";

type Tab = { key: string; href: string; label: () => string; icon: ReactNode; body: ReactNode };
const TABS: Tab[] = [
  { key: "employees", href: "/cotr/drivers", label: () => tr("Employees"), icon: <Bike size={15} />, body: <DriversPage /> },
  { key: "areas", href: "/cotr/pools", label: () => tr("Area"), icon: <MapPinned size={15} />, body: <AreasTab /> },
  { key: "pools", href: "/cotr/pools", label: () => tr("Pool / HUB"), icon: <Building2 size={15} />, body: <PoolsPage /> },
  { key: "fleet", href: "/cotr/fleet", label: () => tr("Fleet & Accessories"), icon: <Truck size={15} />, body: <FleetPage /> },
  { key: "schedule", href: "/cotr/schedule", label: () => tr("Schedule"), icon: <CalendarDays size={15} />, body: <SchedulePage /> },
  { key: "menu", href: "/cotr/menu", label: () => tr("Menu"), icon: <Coffee size={15} />, body: <MenuPage /> },
];

function Master() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const tabs = TABS.filter((t) => user && canAccess(user, t.href));
  const tab = tabs.find((t) => t.key === params.get("tab")) ?? tabs[0];
  return (
    <Page title={tr("Master")} subtitle={tr("The master data of Calf On The Road: employees, areas, pools, fleet & accessories, schedule and menus")}>
      <Tabs label={tr("Master")} value={tab?.key ?? ""} onChange={(k) => router.replace(`/cotr/master?tab=${k}`, { scroll: false })}
        tabs={tabs.map((t) => ({ key: t.key, label: <>{t.icon}{t.label()}</> }))} />
      <EmbeddedPage.Provider value>{tab?.body}</EmbeddedPage.Provider>
    </Page>
  );
}

export default function CotrMasterPage() {
  return <Suspense><Master /></Suspense>;
}

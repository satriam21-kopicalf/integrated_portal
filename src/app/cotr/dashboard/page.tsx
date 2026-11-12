"use client";

// Monitoring COTR → Dashboard (recommendation #7, 2026-11-12; redesigned 2026-11-13 as the Dashboard of Kopi Calf /
// Wasgee): the period first — cups, sales, pools, menus, cash against QRIS, the best drivers (CotrOverview, the same as
// the COTR tab of the Dashboard) — then one day for the COTR team: what waits, every pool / HUB with its leftover against
// the calculation, and the drivers. One Filters button: the period, and the day (the latest day with figures by default:
// the workbooks come late).

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CalendarRange, ChevronRight, CupSoda, GitCompareArrows, LayoutDashboard, MapPinned,
  PackagePlus, Scale, Trash2, UserRoundSearch, Wallet, Wrench } from "lucide-react";
import { Badge, ErrorState, usePaged } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, ValueSkeleton, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { COTR_PAGE, CotrPager, rupiah } from "@/cotr/ui";
import { Freshness } from "@/cotr/Freshness";
import { CotrFilters } from "@/cotr/FilterBar";
import CotrOverview from "@/cotr/CotrOverview";
import { locale, tr } from "@/lib/i18n";

type Source = "sheet" | "esb" | "app";
type PoolDay = { pool: string; name: string; source: Source | null; series: { day: string; sold: number }[]; sold?: number; arrived?: number; transfer?: number;
  waste?: number; cupping?: number; actual?: number | null; balance?: number | null; expired?: number; revenue?: number };
type DriverDay = { code: string | null; name: string; pool: string; poolName: string; cups: number; total: number; source: "sheet" | "app"; tied: boolean };
type Dash = { day: string; latest: string; today: string;
  summary: { sold: number; revenue: number; drivers: number; pools: number; waste: number; cupping: number; balance: number; sameDayLastWeek: number | null };
  trend: { day: string; sold: number | null }[]; pools: PoolDay[]; drivers: DriverDay[];
  todo: { reloads: number; requests: number; areaRequests: number; issues: number; unmatchedNames: number; reconcileDiff: number } };

const SOURCE: Record<Source, { label: () => string; tone: "amber" | "blue" | "green" }> = {
  sheet: { label: () => tr("Workbook"), tone: "amber" }, esb: { label: () => "ESB", tone: "blue" }, app: { label: () => tr("App"), tone: "green" },
};
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString(locale()));

export default function CotrDashboardPage() {
  const [day, setDay] = useState("");  // "" = the latest day with figures
  const [from, setFrom] = useState(wibDay(-6));
  const [to, setTo] = useState(wibDay(0));
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Dash>(`/api/cotr/dashboard${day ? `?day=${day}` : ""}`).then((r) => { if (alive) setData(r); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [day, tick]);
  const s = data?.summary;
  const change = s && s.sameDayLastWeek ? (s.sold - s.sameDayLastWeek) / s.sameDayLastWeek : null;
  const todo = data?.todo;
  const tasks = todo ? [
    { n: todo.reloads, label: tr("Reloads to decide"), href: "/cotr/check-in", icon: <PackagePlus size={16} /> },
    { n: todo.requests, label: tr("Driver requests to decide"), href: "/cotr/check-in", icon: <Wallet size={16} /> },
    { n: todo.areaRequests, label: tr("Area requests"), href: "/cotr/schedule", icon: <MapPinned size={16} /> },
    { n: todo.issues, label: tr("Open fleet issues"), href: "/cotr/fleet", icon: <Wrench size={16} /> },
    { n: todo.unmatchedNames, label: tr("Workbook names without a driver"), href: "/cotr/production?tab=names", icon: <UserRoundSearch size={16} /> },
    { n: todo.reconcileDiff, label: tr("Pool-days workbook ≠ ESB (7 days)"), href: "/cotr/production?tab=reconcile", icon: <GitCompareArrows size={16} /> },
  ] : [];
  const open = tasks.filter((t) => t.n > 0);
  return (
    <Page eyebrow="Calf On The Road" media={<LayoutDashboard size={19} />} title={tr("Dashboard")} subtitle={tr("The period of every pool / HUB, then one day: what waits, the leftover and the drivers")}
      stats={<CotrFilters value={{ from, to, day }} onRefresh={() => setTick((t) => t + 1)} refreshing={!data && !error}
        onApply={(v) => { setFrom(v.from); setTo(v.to); setDay(v.day); }}
        fields={[
          { key: "period", kind: "period", label: tr("Period"), icon: <CalendarRange />, def: wibDay(-6), defTo: wibDay(0), max: wibDay(0) },
          { key: "day", kind: "day", label: tr("Day"), icon: <CalendarDays />, def: "", allLabel: tr("Latest day with figures"), max: data?.today },
        ]} />}>
      {/* the period, as the Dashboard of Kopi Calf / Wasgee */}
      <CotrOverview key={tick} from={from} to={to} bare />

      <div className="flex flex-wrap items-end justify-between gap-2 border-t border-neutral-200 pt-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{data ? tr("The day · {0}", dmyOf(data.day)) : tr("The day")}</h2>
          <p className="text-xs text-neutral-500">{tr("What waits for the COTR team, every pool / HUB and the drivers of the day")}</p>
        </div>
        {data && day && day !== data.latest && <button type="button" onClick={() => setDay("")} className="text-xs font-medium text-brand-700 hover:underline">{tr("Latest day")}</button>}
      </div>
      {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : (
        <>
          <StatGrid label={data ? tr("Calf On The Road · {0}", dmyOf(data.day)) : tr("Summary")} cols={4}>
            <StatCard label={tr("Cups sold")} tone="brand" icon={<CupSoda />} value={s ? n(s.sold) : <ValueSkeleton />}
              sub={change === null ? (s ? tr("{0} pools", s.pools) : undefined) : (
                <span className={`inline-flex items-center gap-0.5 ${change >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(change * 100).toFixed(1)}% {tr("vs same day last week")}</span>)} />
            <StatCard label={tr("Sales value")} icon={<Wallet />} value={s ? (s.revenue >= 1e6 ? `Rp ${(s.revenue / 1e6).toLocaleString(locale(), { maximumFractionDigits: 1 })} ${tr("mn")}` : rupiah(s.revenue)) : <ValueSkeleton />}
              sub={s ? `${rupiah(s.revenue)} · ${tr("cups × menu price")}` : undefined} />
            <StatCard label={tr("Waste & cupping")} icon={<Trash2 />} value={s ? n(s.waste + s.cupping) : <ValueSkeleton />} sub={s && tr("{0} waste · {1} cupping", n(s.waste), n(s.cupping))} />
            <StatCard label={tr("Leftover balance")} icon={<Scale />} tone={s && s.balance !== 0 ? "warn" : "default"} value={s ? (s.balance > 0 ? `+${n(s.balance)}` : n(s.balance)) : <ValueSkeleton />}
              sub={tr("Counted − calculated, every pool")} />
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2" title={tr("Pools / HUBs")} description={tr("The figures of the day per pool, as Pool Product Stock: the workbook first, else ESB, else the app")}>
              {!data ? <SkeletonTable cols={8} /> : (
                <table className="m-cards w-full text-sm">
                  <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Pool / HUB")}</th><th className="px-3 py-2.5 text-right">{tr("Sold")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Arrived")}</th><th className="px-3 py-2.5 text-right">{tr("Waste")}</th><th className="px-3 py-2.5 text-right">{tr("Cupping")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Leftover")}</th><th className="px-3 py-2.5 text-right">{tr("Balance")}</th><th className="px-4 py-2.5">{tr("14 days")}</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.pools.map((p) => (
                      <tr key={p.pool} className="hover:bg-neutral-50">
                        <td className="px-4 py-2.5"><span className="font-medium text-neutral-900">{p.name}</span>{" "}
                          {p.source ? <Badge tone={SOURCE[p.source].tone}>{SOURCE[p.source].label()}</Badge> : <Badge tone="slate">{tr("No figures")}</Badge>}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{n(p.sold)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(p.arrived)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(p.waste)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(p.cupping)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(p.actual)}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${p.balance ? "text-red-700" : "text-neutral-400"}`}>{p.balance ? (p.balance > 0 ? `+${p.balance}` : p.balance) : p.balance === 0 ? "0" : "—"}</td>
                        <td className="px-4 py-2.5"><Spark rows={p.series} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
            <Panel title={tr("Waiting for the COTR team")} description={open.length ? tr("{0} things to look at", open.length) : tr("Nothing waits")}>
              {!data ? <SkeletonTable cols={1} /> : (
                <ul className="-mx-1 space-y-1">
                  {tasks.map((t) => (
                    <li key={t.label}>
                      <Link href={t.href} className={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-50 ${t.n ? "" : "opacity-50"}`}>
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${t.n ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-400"}`}>{t.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-neutral-700">{t.label}</span>
                        <span className={`font-semibold tabular-nums ${t.n ? "text-neutral-900" : "text-neutral-400"}`}>{t.n}</span>
                        <ChevronRight size={14} className="text-neutral-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title={tr("Drivers of the day")} description={data ? tr("{0} drivers with sales; from the app shifts, else the Report Armada of the workbooks", data.drivers.length) : undefined}>
            {!data ? <SkeletonTable cols={4} /> : data.drivers.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-4 text-sm text-neutral-500"><AlertTriangle size={15} className="text-amber-500" />{tr("No driver figures for this day yet: the Report Armada of the workbooks may not be imported yet.")}</p>
            ) : <Drivers rows={data.drivers} />}
          </Panel>

          <Freshness />
        </>
      )}
    </Page>
  );
}

/** The cups sold of a pool over the 14 days, as a small line. */
function Spark({ rows }: { rows: { day: string; sold: number }[] }) {
  if (rows.length < 2) return <span className="text-xs text-neutral-400">—</span>;
  const max = Math.max(1, ...rows.map((r) => r.sold));
  const w = 96, h = 24;
  const pts = rows.map((r, i) => `${(i / (rows.length - 1)) * w},${h - (r.sold / max) * (h - 2) - 1}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="text-brand-600"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

function Drivers({ rows }: { rows: DriverDay[] }) {
  const paged = usePaged(rows, rows, COTR_PAGE);
  const first = (paged.page - 1) * paged.size;
  return (
    <>
      <table className="m-cards w-full text-sm">
        <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">#</th><th className="px-3 py-2.5">{tr("Driver")}</th><th className="px-3 py-2.5">{tr("Pool / HUB")}</th>
          <th className="px-3 py-2.5 text-right">{tr("Cups")}</th><th className="px-4 py-2.5 text-right">{tr("Sales")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {paged.rows.map((d, i) => (
            <tr key={`${d.code ?? d.name}:${d.pool}`} className="hover:bg-neutral-50">
              <td className="px-4 py-2 tabular-nums text-neutral-400">{first + i + 1}</td>
              <td className="px-3 py-2"><span className="font-medium text-neutral-900">{d.name}</span>{!d.tied && <> <Badge tone="amber">{tr("Not tied")}</Badge></>}</td>
              <td className="px-3 py-2 text-neutral-600">{d.poolName}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{n(d.cups)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CotrPager paged={paged} className="px-4 pb-3" />
    </>
  );
}

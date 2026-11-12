"use client";

// Monitoring COTR → Dashboard (recommendation #7, 2026-11-12): one day of Calf On The Road at a glance — cups sold and
// their value, waste and cupping, the leftover against the calculation per pool / HUB, 14 days of cups sold, the drivers
// of the day and what waits for the COTR team. The day opens on the latest day with figures (the workbooks come late).

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, CupSoda, GitCompareArrows, LayoutDashboard, MapPinned, PackagePlus,
  Scale, Trash2, UserRoundSearch, Users, Wallet, Wrench } from "lucide-react";
import { Badge, ErrorState, Input } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, ValueSkeleton, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { rupiah } from "@/cotr/ui";
import { Freshness } from "@/cotr/Freshness";
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
const weekday = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "short" });

export default function CotrDashboardPage() {
  const [day, setDay] = useState<string>("");
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Dash>(`/api/cotr/dashboard${day ? `?day=${day}` : ""}`).then((r) => { if (alive) { setData(r); if (!day) setDay(r.day); } })
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
    <Page eyebrow="Calf On The Road" media={<LayoutDashboard size={19} />} title={tr("Dashboard")} subtitle={tr("One day of every pool / HUB: cups sold, waste and cupping, the leftover and what waits")}
      actions={<div className="flex items-center gap-2">
        {data && data.day !== data.latest && <button type="button" onClick={() => setDay(data.latest)} className="whitespace-nowrap text-xs font-medium text-brand-700 hover:underline">{tr("Latest day")}</button>}
        <Input type="date" value={day} max={data?.today} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label={tr("Day")} className="w-40" />
      </div>}>
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
            <Panel className="lg:col-span-2" title={tr("Cups sold, last 14 days")} description={tr("Every pool / HUB added up; the day chosen is dark")}>
              {!data ? <div className="skeleton h-44 rounded-lg" /> : <Trend rows={data.trend} chosen={data.day} onPick={setDay} />}
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

          <Panel title={tr("Pools / HUBs")} description={tr("The figures of the day per pool, as Pool Product Stock: the workbook first, else ESB, else the app")}>
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

          <Freshness />

          <Panel title={tr("Drivers of the day")} description={data ? tr("{0} drivers with sales; from the app shifts, else the Report Armada of the workbooks", data.drivers.length) : undefined}>
            {!data ? <SkeletonTable cols={4} /> : data.drivers.length === 0 ? (
              <p className="flex items-center gap-2 py-4 text-sm text-neutral-500"><AlertTriangle size={15} className="text-amber-500" />{tr("No driver figures for this day yet: the Report Armada of the workbooks may not be imported yet.")}</p>
            ) : <Drivers rows={data.drivers} />}
          </Panel>
        </>
      )}
    </Page>
  );
}

/** 14 days of cups sold: one bar a day, the chosen day dark; hover shows the figure, a tap opens the day. */
function Trend({ rows, chosen, onPick }: { rows: Dash["trend"]; chosen: string; onPick: (d: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.sold ?? 0));
  const [hover, setHover] = useState<string | null>(null);
  const shown = rows.find((r) => r.day === (hover ?? chosen));
  return (
    <div>
      <p className="mb-2 h-5 text-sm text-neutral-600">{shown && <><span className="font-semibold tabular-nums text-neutral-900">{n(shown.sold)}</span> {tr("cups")} · {dmyOf(shown.day)}</>}</p>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={tr("Cups sold, last 14 days")} onMouseLeave={() => setHover(null)}>
        {rows.map((r) => (
          <button key={r.day} type="button" onClick={() => onPick(r.day)} onMouseEnter={() => setHover(r.day)} onFocus={() => setHover(r.day)}
            title={`${dmyOf(r.day)}: ${n(r.sold)}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <span className={`block w-full rounded-t-[4px] transition-colors ${r.day === chosen ? "bg-brand-700" : hover === r.day ? "bg-brand-400" : "bg-brand-200"}`}
              style={{ height: `${Math.max(r.sold ? 2 : 0, ((r.sold ?? 0) / max) * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-neutral-200 pt-1">
        {rows.map((r) => <span key={r.day} className={`min-w-0 flex-1 truncate text-center text-[10px] ${r.day === chosen ? "font-semibold text-neutral-800" : "text-neutral-400"}`}>{weekday(r.day)}<span className="block">{r.day.slice(8)}</span></span>)}
      </div>
    </div>
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
  const [all, setAll] = useState(false);
  const shown = useMemo(() => (all ? rows : rows.slice(0, 10)), [rows, all]);
  return (
    <>
      <table className="m-cards w-full text-sm">
        <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">#</th><th className="px-3 py-2.5">{tr("Driver")}</th><th className="px-3 py-2.5">{tr("Pool / HUB")}</th>
          <th className="px-3 py-2.5 text-right">{tr("Cups")}</th><th className="px-4 py-2.5 text-right">{tr("Sales")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">
          {shown.map((d, i) => (
            <tr key={`${d.code ?? d.name}:${d.pool}`} className="hover:bg-neutral-50">
              <td className="px-4 py-2 tabular-nums text-neutral-400">{i + 1}</td>
              <td className="px-3 py-2"><span className="font-medium text-neutral-900">{d.name}</span>{!d.tied && <> <Badge tone="amber">{tr("Not tied")}</Badge></>}</td>
              <td className="px-3 py-2 text-neutral-600">{d.poolName}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{n(d.cups)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{rupiah(d.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 && <button type="button" onClick={() => setAll((a) => !a)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
        <Users size={14} />{all ? tr("Show top 10") : tr("Show all {0} drivers", rows.length)}</button>}
    </>
  );
}


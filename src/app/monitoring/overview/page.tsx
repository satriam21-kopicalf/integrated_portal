"use client";

// Monitoring → Overview (page mon.overview, 2026-10-21): PIC Check In, Monitoring Product and Monitoring Outlet of a
// period together, per branch group (CCI, CTG, CTGP …, Monitoring → Branch groups) and per outlet — coverage, visits,
// scores, findings, the daily trend and the performance per category (integrated_portal_be app/monitoring_overview.py).

import { AlertTriangle, BarChart3, ClipboardList, MapPinCheck, Package, RefreshCw, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { FilterBar, FilterPill } from "@/so/ui/Simple";
import { wibDay } from "@/so/ui/Filters";
import { wibDateTime } from "@/so/lib/wib";
import EChart, { type ChartOption } from "@/components/charts/EChart";
import { call } from "@/so/features/checkin/checkin";
import { RATING_STYLE, RATINGS, scoreTone } from "@/so/features/visit/visit";
import { tr } from "@/lib/i18n";

type Sum = { outlets: number; visited: number; checkins: number; outside: number; productVisits: number; productScore: number | null;
  outletVisits: number; outletScore: number | null; under: number };
type GroupRow = Sum & { id: string; code: string; name: string };
type BranchRow = { code: string; name: string; groupId: string | null; groupCode: string | null; checkins: number; pics: number; outside: number;
  lastCheckin: string | null; productVisits: number; productScore: number | null; outletVisits: number; outletScore: number | null;
  under: number; lastVisit: string | null; visited: boolean };
type SectionPerf = { key: string; title: string; under: number; meet: number; exceed: number };
type Finding = { key: string; label: string; section: string; count: number; branches: string[] };
type Result = {
  period: { from: string; to: string }; summary: Sum & { pics: number }; groups: GroupRow[]; branches: BranchRow[];
  trend: { date: string; checkins: number; product: number; outlet: number; productScore: number | null; outletScore: number | null }[];
  product: { sections: SectionPerf[]; findings: Finding[] }; outlet: { sections: SectionPerf[]; findings: Finding[] };
  groupOptions: { id: string; code: string; name: string; branches: number }[];
};

const PERIODS: Record<string, { label: () => string; range: () => [string, string] }> = {
  "7": { label: () => tr("Last 7 days"), range: () => [wibDay(-6), wibDay(0)] },
  "30": { label: () => tr("Last 30 days"), range: () => [wibDay(-29), wibDay(0)] },
  month: { label: () => tr("This month"), range: () => [`${wibDay(0).slice(0, 8)}01`, wibDay(0)] },
  "90": { label: () => tr("Last 90 days"), range: () => [wibDay(-89), wibDay(0)] },
};
const SORTS: Record<string, { label: () => string; cmp: (a: BranchRow, b: BranchRow) => number }> = {
  low: { label: () => tr("Lowest score"), cmp: (a, b) => (Math.min(a.productScore ?? 999, a.outletScore ?? 999) - Math.min(b.productScore ?? 999, b.outletScore ?? 999)) || a.name.localeCompare(b.name) },
  unvisited: { label: () => tr("Not visited first"), cmp: (a, b) => Number(a.visited) - Number(b.visited) || a.name.localeCompare(b.name) },
  under: { label: () => tr("Most findings"), cmp: (a, b) => b.under - a.under || a.name.localeCompare(b.name) },
  name: { label: () => tr("Outlet name"), cmp: (a, b) => a.name.localeCompare(b.name) },
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Score({ v, n }: { v: number | null; n: number }) {
  if (!n) return <span className="text-xs text-slate-400">—</span>;
  return <span className="whitespace-nowrap"><span className={cx("font-semibold tabular-nums", scoreTone(v))}>{v ?? "—"}%</span> <span className="text-[11px] text-slate-400">· {n}×</span></span>;
}

function Coverage({ a, b }: { a: number; b: number }) {
  const p = pct(a, b);
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${p}%` }} /></span>
      <span className="text-xs tabular-nums text-slate-600">{a}/{b}</span>
    </span>
  );
}

function SectionBars({ title, icon, sections }: { title: string; icon: React.ReactNode; sections: SectionPerf[] }) {
  return (
    <Panel title={title} description={tr("Ratings of the visits of the period, per category")}>
      {sections.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{tr("No visit in this period")}</p> : (
        <ul className="divide-y divide-slate-100">
          {sections.map((s) => {
            const total = s.under + s.meet + s.exceed;
            const p = total ? Math.round(((s.meet + s.exceed) / total) * 1000) / 10 : null;
            return (
              <li key={s.key} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-slate-800">{icon}{s.title}</span>
                  <span className={cx("font-semibold tabular-nums", scoreTone(p))}>{p === null ? "—" : `${p}%`}</span>
                </div>
                <span className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
                  {total > 0 && (["under", "meet", "exceed"] as const).map((k, i) => <span key={k} className={RATING_STYLE[RATINGS[i]].bar} style={{ width: `${(s[k] / total) * 100}%` }} />)}
                </span>
                <p className="mt-1 text-[11px] text-slate-500">{s.under} UNDER · {s.meet} MEET · {s.exceed} EXCEED</p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Findings({ title, items }: { title: string; items: Finding[] }) {
  return (
    <Panel title={title} description={tr("Items rated UNDER most often")}>
      {items.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{tr("No UNDER in this period")}</p> : (
        <ul className="divide-y divide-slate-100">
          {items.map((x) => (
            <li key={x.key} className="flex items-start gap-3 px-4 py-2.5">
              <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-red-50 px-2 text-xs font-bold tabular-nums text-red-700">{x.count}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{x.label}</span>
                <span className="block truncate text-[11px] text-slate-500" title={x.branches.join(", ")}>{x.section} · {x.branches.join(", ")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function MonitoringOverviewPage() {
  const [period, setPeriod] = useState("30");
  const [group, setGroup] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("low");

  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const [from, to] = PERIODS[period].range();
    try {
      setRes(await call<Result>(`/api/monitoring/overview?${new URLSearchParams({ dateFrom: from, dateTo: to, ...(group ? { group } : {}) })}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [period, group]);
  useEffect(() => { void load(); }, [load]);

  const s = res?.summary;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (res?.branches ?? []).filter((b) => !q || b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)).sort(SORTS[sort].cmp);
  }, [res, search, sort]);
  const paged = usePaged(rows, rows.length + search + sort + group + period);

  const activity = useMemo<ChartOption>(() => ({
    grid: { left: 36, right: 12, top: 28, bottom: 28 },
    tooltip: { trigger: "axis" },
    legend: { top: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    xAxis: { type: "category", data: (res?.trend ?? []).map((t) => t.date.slice(5).split("-").reverse().join("/")), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "#eef2f7" } }, axisLabel: { fontSize: 10 } },
    series: [
      { name: tr("PIC Check In"), type: "bar", stack: "a", data: (res?.trend ?? []).map((t) => t.checkins), color: "#0ea5e9", barMaxWidth: 18 },
      { name: tr("Monitoring Product"), type: "bar", stack: "a", data: (res?.trend ?? []).map((t) => t.product), color: "#6366f1", barMaxWidth: 18 },
      { name: tr("Monitoring Outlet"), type: "bar", stack: "a", data: (res?.trend ?? []).map((t) => t.outlet), color: "#f59e0b", barMaxWidth: 18 },
    ],
  }), [res]);
  const scores = useMemo<ChartOption>(() => ({
    grid: { left: 36, right: 12, top: 28, bottom: 28 },
    tooltip: { trigger: "axis", valueFormatter: (v: unknown) => (v === null || v === undefined ? "—" : `${v}%`) },
    legend: { top: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
    xAxis: { type: "category", data: (res?.trend ?? []).map((t) => t.date.slice(5).split("-").reverse().join("/")), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", min: 0, max: 100, splitLine: { lineStyle: { color: "#eef2f7" } }, axisLabel: { fontSize: 10, formatter: "{value}%" } },
    series: [
      { name: tr("Product score"), type: "line", data: (res?.trend ?? []).map((t) => t.productScore), color: "#6366f1", connectNulls: true, symbolSize: 6, lineStyle: { width: 2 } },
      { name: tr("Outlet score"), type: "line", data: (res?.trend ?? []).map((t) => t.outletScore), color: "#f59e0b", connectNulls: true, symbolSize: 6, lineStyle: { width: 2 } },
    ],
  }), [res]);

  const groupLabel = res?.groupOptions.find((g) => g.id === group)?.code ?? (group === "none" ? tr("Without a group") : tr("All groups"));
  return (
    <Page title={tr("Monitoring overview")}
      subtitle={`${PERIODS[period].label()} · ${groupLabel} · ${tr("PIC Check In, Monitoring Product and Monitoring Outlet together")}`}
      actions={<button type="button" onClick={() => void load()} disabled={!res && !error} title={tr("Refresh")} aria-label={tr("Refresh")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait">
        <RefreshCw size={18} className={!res && !error ? "animate-spin" : ""} />
      </button>}
      stats={
        <StatStrip label={tr("Summary")} columns={5} gridClassName="grid-cols-2 xl:grid-cols-5">
          <Stat label={tr("Outlets visited")} emphasis icon={<Store size={13} />} value={s ? `${pct(s.visited, s.outlets)}%` : <StatSkeleton />}>
            {s && <p>{tr("{0} of {1} outlets", fmtNumber(s.visited), fmtNumber(s.outlets))}</p>}
          </Stat>
          <Stat label={tr("PIC Check In")} icon={<MapPinCheck size={13} />} value={s ? fmtNumber(s.checkins) : <StatSkeleton />}>
            {s && <p>{tr("{0} PICs · {1} outside radius", fmtNumber(s.pics), fmtNumber(s.outside))}</p>}
          </Stat>
          <Stat label={tr("Product score")} icon={<Package size={13} />} value={s ? <span className={scoreTone(s.productScore)}>{s.productScore === null ? "—" : `${s.productScore}%`}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} visits", fmtNumber(s.productVisits))}</p>}
          </Stat>
          <Stat label={tr("Outlet score")} icon={<ClipboardList size={13} />} value={s ? <span className={scoreTone(s.outletScore)}>{s.outletScore === null ? "—" : `${s.outletScore}%`}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} visits", fmtNumber(s.outletVisits))}</p>}
          </Stat>
          <Stat label={tr("UNDER findings")} className="col-span-2 xl:col-span-1" icon={<AlertTriangle size={13} />} value={s ? <span className={s.under ? "text-red-600" : undefined}>{fmtNumber(s.under)}</span> : <StatSkeleton />}>
            {s && <p>{tr("on both checklists")}</p>}
          </Stat>
        </StatStrip>
      }>
      <FilterBar search={search} onSearch={setSearch} placeholder={tr("Search outlet")} active={period !== "30" || !!group || !!search}
        onReset={() => { setPeriod("30"); setGroup(""); setSearch(""); }}>
        <FilterPill label={tr("Period")} value={period === "30" ? "" : period} allLabel={PERIODS["30"].label()} onChange={(v) => setPeriod(v || "30")}
          options={Object.keys(PERIODS).filter((k) => k !== "30").map((k) => ({ value: k, label: PERIODS[k].label() }))} />
        <FilterPill label={tr("Group")} value={group} allLabel={tr("All groups")} onChange={setGroup}
          options={[...(res?.groupOptions ?? []).map((g) => ({ value: g.id, label: `${g.code} · ${g.branches}` })), { value: "none", label: tr("Without a group") }]} />
        <FilterPill label={tr("Sort")} value={sort === "low" ? "" : sort} allLabel={SORTS.low.label()} onChange={(v) => setSort(v || "low")}
          options={Object.keys(SORTS).filter((k) => k !== "low").map((k) => ({ value: k, label: SORTS[k].label() }))} />
      </FilterBar>

      {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel> : (
        <>
          <Panel title={tr("Per branch group")} description={tr("Tap a group to look at it alone; manage the groups in Monitoring → Branch groups")}>
            <div className="overflow-x-auto">
              <table className="m-cards w-full min-w-[760px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Group")}</th><th className="px-4 py-2.5">{tr("Outlets visited")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Check-ins")}</th><th className="px-4 py-2.5">{tr("Product")}</th>
                    <th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5 text-right">UNDER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!res ? <SkeletonRows cols={6} rows={3} /> : res.groups.map((g) => (
                    <tr key={g.id} onClick={() => setGroup(group === g.id ? "" : g.id)} className={cx("cursor-pointer hover:bg-slate-50/70", group === g.id && "bg-blue-50/50")}>
                      <td className="px-4 py-2.5" data-label={tr("Group")}><span className="font-semibold text-slate-900">{g.code}</span>{g.name !== g.code && <span className="block text-xs text-slate-500">{g.name}</span>}</td>
                      <td className="px-4 py-2.5" data-label={tr("Outlets visited")}><Coverage a={g.visited} b={g.outlets} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums" data-label={tr("Check-ins")}>{fmtNumber(g.checkins)}</td>
                      <td className="px-4 py-2.5" data-label={tr("Product")}><Score v={g.productScore} n={g.productVisits} /></td>
                      <td className="px-4 py-2.5" data-label={tr("Outlet")}><Score v={g.outletScore} n={g.outletVisits} /></td>
                      <td className={cx("px-4 py-2.5 text-right tabular-nums", g.under ? "font-semibold text-red-600" : "text-slate-400")} data-label="UNDER">{fmtNumber(g.under)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {res && res.trend.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title={tr("Activity per day")} description={tr("Check-ins and visits sent")}><div className="px-2 pb-2"><EChart option={activity} height={220} ariaLabel={tr("Activity per day")} /></div></Panel>
              <Panel title={tr("Score per day")} description={tr("Average of the visits sent that day")}><div className="px-2 pb-2"><EChart option={scores} height={220} ariaLabel={tr("Score per day")} /></div></Panel>
            </div>
          )}

          {res && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <SectionBars title={tr("Monitoring Product · per category")} icon={<Package size={14} className="text-slate-400" />} sections={res.product.sections} />
                <SectionBars title={tr("Monitoring Outlet · per category")} icon={<Store size={14} className="text-slate-400" />} sections={res.outlet.sections} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Findings title={tr("Product findings")} items={res.product.findings} />
                <Findings title={tr("Outlet findings")} items={res.outlet.findings} />
              </div>
            </>
          )}

          <Panel title={tr("Per outlet")} description={tr("Every outlet of the group, visited or not in the period")}
            footer={res ? <><span>{tr("{0} outlets", fmtNumber(rows.length))}</span><PageNav paged={paged} /></> : undefined}>
            {res && rows.length === 0 ? <Empty icon={<BarChart3 size={28} />} title={tr("Nothing matches the search")} /> : (
              <div className="overflow-x-auto">
                <table className="m-cards w-full min-w-[900px] text-sm">
                  <thead className={theadClass}>
                    <tr>
                      <th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Group")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Check-ins")}</th><th className="px-4 py-2.5">{tr("Last check-in")}</th>
                      <th className="px-4 py-2.5">{tr("Product")}</th><th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5 text-right">UNDER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!res ? <SkeletonRows cols={7} /> : paged.rows.map((b) => (
                      <tr key={b.code} className={cx(!b.visited && "bg-amber-50/40")}>
                        <td className="max-w-[18rem] px-4 py-2.5" data-label={tr("Outlet")}>
                          <span className="block truncate font-medium text-slate-900">{b.name}</span>
                          <span className="text-xs text-slate-400">{b.code}{!b.visited && <> · <Badge tone="amber">{tr("Not visited")}</Badge></>}</span>
                        </td>
                        <td className="px-4 py-2.5" data-label={tr("Group")}>{b.groupCode ? <Badge tone="blue">{b.groupCode}</Badge> : <span className="text-xs text-slate-400">—</span>}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" data-label={tr("Check-ins")}>{b.checkins || <span className="text-slate-400">0</span>}{b.outside > 0 && <span className="block text-[11px] text-amber-700">{tr("{0} outside radius", b.outside)}</span>}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600" data-label={tr("Last check-in")}>{b.lastCheckin ? wibDateTime(b.lastCheckin) : "—"}</td>
                        <td className="px-4 py-2.5" data-label={tr("Product")}><Score v={b.productScore} n={b.productVisits} /></td>
                        <td className="px-4 py-2.5" data-label={tr("Outlet")}><Score v={b.outletScore} n={b.outletVisits} /></td>
                        <td className={cx("px-4 py-2.5 text-right tabular-nums", b.under ? "font-semibold text-red-600" : "text-slate-400")} data-label="UNDER">{b.under}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}

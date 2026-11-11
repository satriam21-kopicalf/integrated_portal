"use client";

// Monitoring COTR → Report Armada (migration 089), as the sheet of the pool workbooks: per driver of a pool and per day,
// for every menu B (brought: the start stock + the reloads received), S (left at check out), C (cupping), W (waste),
// T (sold) and its total at the menu price; then the QRIS, the cash, the cash counted and the operational costs (the
// requests). Days before the app come from the imported workbooks.

import { ClipboardList, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, ErrorState, Field, Input, Select, cx } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { rupiah, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Line = { b: number; s: number | null; c: number; w: number; t: number; total: number };
type DayRow = { day: string; status: string; lines: Record<string, Line>; total: number; cash: number; qris: number; operational: number;
  operationalNote?: string | null; cashActual: number | null };
type Driver = { code: string | null; name: string; nickname: string | null; label?: string; pool?: string; days: DayRow[] };
type Report = { pool: string; from: string; to: string; menus: { code: string; name: string; price: number }[]; drivers: Driver[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function ReportArmada() {
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [poolSel, setPoolSel] = useState("");
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [q, setQ] = useState("");
  const pool = poolSel;  // "" = every pool (the default)
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Report>(`/api/cotr/report-armada?dateFrom=${from}&dateTo=${to}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, from, to, tick]);
  const drivers = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (data?.drivers ?? []).filter((d) => !k || `${d.name} ${d.nickname ?? ""} ${d.label ?? ""}`.toLowerCase().includes(k));
  }, [data, q]);
  const all = drivers.flatMap((d) => d.days);
  const sum = (f: (x: DayRow) => number) => all.reduce((a, x) => a + f(x), 0);
  const menus = data?.menus ?? [];
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPoolSel(e.target.value)}><option value="">{tr("All pools")}</option>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tr("Until")}><Input type="date" value={to} max={todayWib()} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search driver")} className="pl-8" />
        </label>
      </div>
      <StatGrid label={tr("Summary")} cols={4}>
        <StatCard label={tr("Cups sold")} tone="brand" value={sum((x) => Object.values(x.lines).reduce((a, l) => a + l.t, 0))} sub={tr("{0} driver days", all.length)} />
        <StatCard label={tr("Sales")} value={rupiah(sum((x) => x.total))} sub={`QRIS ${rupiah(sum((x) => x.qris))}`} />
        <StatCard label={tr("Cupping / Waste")} value={`${sum((x) => Object.values(x.lines).reduce((a, l) => a + l.c, 0))} / ${sum((x) => Object.values(x.lines).reduce((a, l) => a + l.w, 0))}`} />
        <StatCard label={tr("Operational")} value={rupiah(sum((x) => x.operational))} sub={tr("costs asked by the drivers")} />
      </StatGrid>
      <Panel title={tr("Report Armada")} description={tr("B = brought · S = left · C = cupping · W = waste · T = sold")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <SkeletonTable cols={8} /> : drivers.length === 0 ? (
          <EmptyState icon={<ClipboardList />} title={tr("No driver days in this period")} />
        ) : (
          <div className="divide-y divide-neutral-100">
            {drivers.map((d) => (
              <section key={d.code ?? d.label ?? d.name} className="p-4">
                <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-900">{d.name}
                  {d.label && <span className="text-xs font-normal text-neutral-500">{d.label}</span>}
                  {!pool && d.pool && <Badge tone="slate">{usable.find((p) => p.code === d.pool)?.name ?? d.pool}</Badge>}
                  {!d.code && <Badge tone="amber">{tr("Not matched to a driver")}</Badge>}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-xs">
                    <thead className="text-neutral-500">
                      <tr><th rowSpan={2} className="py-1 pr-2 text-left font-medium">{tr("Day")}</th>
                        {menus.map((m) => <th key={m.code} colSpan={5} className="border-l border-neutral-100 px-1 py-1 text-center font-medium">{m.name}</th>)}
                        <th rowSpan={2} className="border-l border-neutral-100 px-2 text-right font-medium">{tr("Total")}</th><th rowSpan={2} className="px-2 text-right font-medium">QRIS</th>
                        <th rowSpan={2} className="px-2 text-right font-medium">{tr("Cash")}</th><th rowSpan={2} className="px-2 text-right font-medium">{tr("Actual Cash")}</th>
                        <th rowSpan={2} className="px-2 text-right font-medium">{tr("Operational")}</th></tr>
                      <tr>{menus.map((m) => ["B", "S", "C", "W", "T"].map((h, i) => <th key={m.code + h} className={cx("px-1 py-1 text-right font-medium", i === 0 && "border-l border-neutral-100")}>{h}</th>))}</tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {d.days.map((x) => (
                        <tr key={x.day}>
                          <td className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{dmyOf(x.day)}{x.status === "sheet" && <span className="ml-1 text-violet-600" title={tr("From the workbook")}>•</span>}{x.status === "open" && <span className="ml-1 text-sky-600" title={tr("On the road")}>•</span>}</td>
                          {menus.map((m) => { const l = x.lines[m.code]; return (["b", "s", "c", "w", "t"] as const).map((k, i) => (
                            <td key={m.code + k} className={cx("px-1 py-1.5 text-right tabular-nums", i === 0 && "border-l border-neutral-100", k === "t" && "font-semibold text-neutral-900")}>{l && l[k] ? l[k] : "—"}</td>)); })}
                          <td className="border-l border-neutral-100 px-2 py-1.5 text-right font-semibold tabular-nums">{rupiah(x.total)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.qris ? rupiah(x.qris) : "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{rupiah(x.cash)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums">{x.cashActual != null ? rupiah(x.cashActual) : "—"}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums" title={x.operationalNote ?? undefined}>{x.operational ? rupiah(x.operational) : "—"}{x.operationalNote ? <span className="block text-[10px] text-neutral-400">{x.operationalNote}</span> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

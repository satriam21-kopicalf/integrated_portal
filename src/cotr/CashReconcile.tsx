"use client";

// Storage & Production → Reports & matching → Cash (recommendation #10, 2026-11-12): per driver per day the sales, the
// QRIS part, the operational costs paid from the cash, the cash that should be handed in and the cash counted — the
// difference shows at once. From Report Armada (the app shifts, else the workbooks).

import { Banknote, Building2, CalendarRange, Download, Filter, Scale, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, ErrorState, usePaged, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { COTR_PAGE, CotrPager, rupiah, useMaster } from "@/cotr/ui";
import { CotrFilters } from "@/cotr/FilterBar";
import { tr } from "@/lib/i18n";
import { downloadXlsx } from "@/lib/xlsx";

type DayRow = { day: string; status: string; total: number; cash: number; qris: number; operational: number; cashActual: number | null };
type Report = { drivers: { code: string | null; name: string; pool: string; days: DayRow[] }[] };
type Row = { key: string; day: string; pool: string; driver: string; sales: number; qris: number; operational: number; expected: number; actual: number | null; diff: number | null };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function CashReconcile() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const name = (code: string) => usable.find((p) => p.code === code)?.name ?? code;
  const [pool, setPool] = useState("");
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [only, setOnly] = useState<"diff" | "">("diff");
  const [min, setMin] = useState(0);
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
  const rows = useMemo<Row[]>(() => (data?.drivers ?? []).flatMap((d) => d.days.filter((x) => x.total || x.cashActual !== null).map((x) => {
    const expected = Math.round(x.total - x.qris - x.operational);
    return { key: `${d.code ?? d.name}:${x.day}`, day: x.day, pool: d.pool, driver: d.name, sales: Math.round(x.total), qris: Math.round(x.qris),
      operational: Math.round(x.operational), expected, actual: x.cashActual, diff: x.cashActual === null ? null : Math.round(x.cashActual - expected) };
  })).sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0) || b.day.localeCompare(a.day)), [data]);
  const listed = only === "diff" ? rows.filter((r) => r.diff && Math.abs(r.diff) > min) : rows;
  const paged = usePaged(listed, `${pool}|${from}|${to}|${only}|${min}`, COTR_PAGE);
  const short = rows.filter((r) => (r.diff ?? 0) < 0);
  const over = rows.filter((r) => (r.diff ?? 0) > 0);
  const exportXlsx = () => downloadXlsx({ fileName: `Rekonsiliasi Uang COTR ${from} - ${to}`, sheet: "Uang", title: `${tr("Cash reconciliation")} · ${dmyOf(from)} – ${dmyOf(to)}`,
    header: [tr("Date"), tr("Pool / HUB"), tr("Driver"), tr("Sales"), "QRIS", tr("Operational"), tr("Cash expected"), tr("Cash counted"), tr("Difference")],
    rows: listed.map((r) => [r.day, name(r.pool), r.driver, r.sales, r.qris, r.operational, r.expected, r.actual, r.diff]) }).catch((e: Error) => toast(e.message, "error"));
  return (
    <>
      <CotrFilters value={{ from, to, pool, only, min: String(min) }}
        onApply={(v) => { setFrom(v.from); setTo(v.to); setPool(v.pool); setOnly(v.only as "diff" | ""); setMin(Number(v.min) || 0); }}
        actions={<Button variant="secondary" disabled={!listed.length} onClick={() => void exportXlsx()}><Download size={15} /> {tr("Export Excel")}</Button>}
        fields={[
          { key: "period", kind: "period", label: tr("Period"), icon: <CalendarRange />, def: `${todayWib().slice(0, 8)}01`, defTo: todayWib(), max: todayWib() },
          { key: "pool", kind: "combo", label: tr("Pool / HUB"), icon: <Building2 />, def: "", allLabel: tr("All pools"), placeholder: tr("Search pool"),
            options: usable.map((p) => ({ value: p.code, label: p.name })) },
          { key: "only", kind: "segments", label: tr("Show"), icon: <Filter />, def: "diff",
            options: [{ value: "diff", label: tr("Differences only") }, { value: "", label: tr("Every driver-day") }] },
          { key: "min", kind: "segments", label: tr("Difference above"), icon: <Scale />, def: "0", when: (v) => v.only === "diff",
            options: [0, 5000, 10000, 50000].map((x) => ({ value: String(x), label: x ? rupiah(x) : tr("Any") })) },
        ]} />
      <StatGrid label={tr("Summary")} cols={4}>
        <StatCard label={tr("Cash expected")} tone="brand" icon={<Banknote />} value={data ? rupiah(rows.reduce((a, r) => a + r.expected, 0)) : "…"} sub={tr("Sales − QRIS − operational")} />
        <StatCard label={tr("Cash counted")} icon={<Scale />} value={data ? rupiah(rows.reduce((a, r) => a + (r.actual ?? 0), 0)) : "…"}
          sub={data && tr("{0} driver-days not counted", rows.filter((r) => r.actual === null).length)} />
        <StatCard label={tr("Short")} icon={<TriangleAlert />} tone={short.length ? "warn" : "default"} value={data ? rupiah(short.reduce((a, r) => a + (r.diff ?? 0), 0)) : "…"}
          sub={data && tr("{0} driver-days", short.length)} />
        <StatCard label={tr("Over")} icon={<Scale />} value={data ? rupiah(over.reduce((a, r) => a + (r.diff ?? 0), 0)) : "…"} sub={data && tr("{0} driver-days", over.length)} />
      </StatGrid>
      <Panel title={tr("Cash per driver per day")} description={tr("Cash expected = sales − QRIS − operational; difference = cash counted − expected; the biggest first")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <SkeletonTable cols={9} /> : listed.length === 0 ? (
          <EmptyState icon={<Scale />} title={only === "diff" ? tr("No cash differences in this period") : tr("Nothing in this period")} />
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Date")}</th><th className="px-3 py-2.5">{tr("Driver")}</th><th className="px-3 py-2.5 text-right">{tr("Sales")}</th>
              <th className="px-3 py-2.5 text-right">QRIS</th><th className="px-3 py-2.5 text-right">{tr("Operational")}</th><th className="px-3 py-2.5 text-right">{tr("Cash expected")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Cash counted")}</th><th className="px-4 py-2.5 text-right">{tr("Difference")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {paged.rows.map((r) => (
                <tr key={r.key} className="hover:bg-neutral-50">
                  <td className="px-4 py-2 tabular-nums">{dmyOf(r.day)}</td>
                  <td className="px-3 py-2"><span className="font-medium text-neutral-900">{r.driver}</span><span className="block text-[11px] text-neutral-500">{name(r.pool)}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(r.sales)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{rupiah(r.qris)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{rupiah(r.operational)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{rupiah(r.expected)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.actual === null ? "—" : rupiah(r.actual)}</td>
                  <td className={`px-4 py-2 text-right font-semibold tabular-nums ${!r.diff ? "text-neutral-400" : r.diff < 0 ? "text-red-700" : "text-amber-700"}`}>
                    {r.diff === null ? "—" : r.diff > 0 ? `+${rupiah(r.diff)}` : r.diff < 0 ? `−${rupiah(-r.diff)}` : "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <CotrPager paged={paged} className="px-4 pb-3" />}
      </Panel>
    </>
  );
}

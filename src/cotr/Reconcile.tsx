"use client";

// Monitoring COTR → Storage & Production → Reconciliation (recommendation #1, 2026-11-12): the workbook of the COTR team
// against ESB COTR, and the app, per pool, day and menu: arrived, transfer, sold, waste and cupping of each source and
// the difference workbook − ESB. A pool-day matches, differs, or has only one source; differences first.

import { ChevronDown, Download, GitCompareArrows, Scale, TriangleAlert, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";
import { downloadXlsx } from "@/lib/xlsx";

type Kind = "arrived" | "transfer" | "sold" | "waste" | "cupping";
type Line = { menu: string; name: string; kind: Kind; sheet: number | null; esb: number | null; app: number | null; diff: number | null };
type Status = "match" | "diff" | "sheet" | "esb" | "app";
type Day = { pool: string; poolName: string; day: string; status: Status; gap: number; lines: Line[] };
type Data = { summary: Record<Status, number>; days: Day[] };

const KIND: Record<Kind, () => string> = { arrived: () => tr("Arrived"), transfer: () => tr("Transfer"), sold: () => tr("Sold"), waste: () => tr("Waste"), cupping: () => tr("Cupping") };
const STATUS: Record<Status, { label: () => string; tone: "green" | "red" | "amber" | "slate" | "blue" }> = {
  match: { label: () => tr("Match"), tone: "green" }, diff: { label: () => tr("Different"), tone: "red" },
  sheet: { label: () => tr("Workbook only"), tone: "amber" }, esb: { label: () => tr("ESB only"), tone: "blue" }, app: { label: () => tr("App only"), tone: "slate" },
};
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const num = (v: number | null) => (v === null ? "—" : v.toLocaleString("id-ID"));

export function Reconcile() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [pool, setPool] = useState("");
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [status, setStatus] = useState<"" | Status>("diff");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Data>(`/api/cotr/reconcile?dateFrom=${from}&dateTo=${to}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, from, to, tick]);
  // the biggest differences first, then the newest days
  const listed = useMemo(() => (data?.days ?? []).filter((d) => !status || d.status === status)
    .sort((a, b) => b.gap - a.gap || b.day.localeCompare(a.day) || a.pool.localeCompare(b.pool)), [data, status]);
  const gap = (data?.days ?? []).reduce((a, d) => a + d.gap, 0);
  const exportXlsx = () => downloadXlsx({ fileName: `Rekonsiliasi COTR ${from} - ${to}`, sheet: "Rekonsiliasi", title: `${tr("Reconciliation")} · ${dmyOf(from)} – ${dmyOf(to)}`,
    header: [tr("Date"), tr("Pool / HUB"), tr("Status"), tr("Menu"), tr("Movement"), tr("Workbook"), "ESB", tr("App"), tr("Workbook − ESB")],
    rows: listed.flatMap((d) => d.lines.map((l) => [d.day, d.poolName, STATUS[d.status].label(), l.name, KIND[l.kind](), l.sheet, l.esb, l.app, l.diff])) })
    .catch((e: Error) => toast(e.message, "error"));
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPool(e.target.value)}><option value="">{tr("All pools")}</option>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label={tr("Status")}><Select value={status} onChange={(e) => setStatus(e.target.value as "" | Status)}><option value="">{tr("All")}</option>
          {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label()}</option>)}</Select></Field>
        <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tr("Until")}><Input type="date" value={to} max={todayWib()} onChange={(e) => setTo(e.target.value)} /></Field>
        <Button variant="secondary" disabled={!listed.length} onClick={() => void exportXlsx()}><Download size={15} /> {tr("Export Excel")}</Button>
      </div>
      <StatGrid label={tr("Summary")} cols={4}>
        <StatCard label={tr("Pool-days matching")} tone="brand" icon={<CheckCircle2 />} value={data ? data.summary.match : "…"} />
        <StatCard label={tr("Pool-days different")} icon={<TriangleAlert />} tone={data?.summary.diff ? "warn" : "default"} value={data ? data.summary.diff : "…"}
          sub={data && tr("{0} cups apart in total", gap.toLocaleString("id-ID"))} />
        <StatCard label={tr("Workbook only")} icon={<FileSpreadsheet />} value={data ? data.summary.sheet : "…"} sub={tr("ESB has no document that day")} />
        <StatCard label={tr("ESB / app only")} icon={<Scale />} value={data ? data.summary.esb + data.summary.app : "…"} sub={tr("No workbook imported that day")} />
      </StatGrid>
      <Panel title={tr("Workbook vs ESB")} description={tr("Per pool and day: the movements of the workbook against ESB COTR and the app; the biggest differences first. Tap a day for its menus.")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <SkeletonTable cols={5} /> : listed.length === 0 ? (
          <EmptyState icon={<GitCompareArrows />} title={status === "diff" ? tr("No differences in this period") : tr("Nothing in this period")} />
        ) : (
          <table className="w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Date")}</th><th className="px-3 py-2.5">{tr("Pool / HUB")}</th><th className="px-3 py-2.5">{tr("Status")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Cups apart")}</th><th className="w-10 px-3 py-2.5" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {listed.map((d) => {
                const key = `${d.pool}:${d.day}`;
                const on = open === key;
                const shown = d.status === "diff" ? d.lines.filter((l) => l.diff) : d.lines;
                return (
                  <Fragment key={key}>
                    <tr className="cursor-pointer hover:bg-neutral-50" onClick={() => setOpen(on ? null : key)} aria-expanded={on}>
                      <td className="px-4 py-2.5 tabular-nums">{dmyOf(d.day)}</td>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{d.poolName}</td>
                      <td className="px-3 py-2.5"><Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label()}</Badge></td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${d.gap ? "text-red-700" : "text-neutral-400"}`}>{d.gap ? d.gap.toLocaleString("id-ID") : "—"}</td>
                      <td className="px-3 py-2.5 text-neutral-400"><ChevronDown size={15} className={on ? "rotate-180 transition-transform" : "transition-transform"} /></td>
                    </tr>
                    {on && (
                      <tr className="bg-neutral-50/70">
                        <td colSpan={5} className="px-4 py-3">
                          {d.status === "diff" && d.lines.length > shown.length && <p className="mb-2 text-xs text-neutral-500">{tr("{0} other movements match", d.lines.length - shown.length)}</p>}
                          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                            <table className="w-full min-w-[34rem] text-xs">
                              <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500"><tr><th className="px-3 py-2">{tr("Menu")}</th><th className="px-3 py-2">{tr("Movement")}</th>
                                <th className="px-3 py-2 text-right">{tr("Workbook")}</th><th className="px-3 py-2 text-right">ESB</th><th className="px-3 py-2 text-right">{tr("App")}</th><th className="px-3 py-2 text-right">{tr("Workbook − ESB")}</th></tr></thead>
                              <tbody className="divide-y divide-neutral-100">
                                {shown.map((l) => (
                                  <tr key={`${l.menu}:${l.kind}`}>
                                    <td className="px-3 py-1.5 text-neutral-800">{l.name}</td><td className="px-3 py-1.5 text-neutral-600">{KIND[l.kind]()}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums">{num(l.sheet)}</td><td className="px-3 py-1.5 text-right tabular-nums">{num(l.esb)}</td>
                                    <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{num(l.app)}</td>
                                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${l.diff ? "text-red-700" : "text-neutral-400"}`}>{l.diff === null ? "—" : l.diff > 0 ? `+${l.diff}` : l.diff}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

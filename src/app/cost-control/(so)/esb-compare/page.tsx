"use client";

// Platform vs ESB (06.9 §7): exported counts, whether ESB already has the stock opname, whether the quantities match
// what was exported, and the variance between ESB's system quantity and the counted one (value).

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Input, Page, Panel, SkeletonRows, fmtDay, fmtNumber, theadClass } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { COMPARE } from "@/so/lib/esb";
import { tr } from "@/lib/i18n";

type Row = { count_id: string; number: string; facility_name: string; business_date: string; count_type: string; status: string;
  mismatches: number | null; variance_value: string | null; esb_doc: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const rp = (v: string | number | null) => (v === null ? "—" : `Rp ${fmtNumber(Math.round(Number(v)))}`);

export default function ComparePage() {
  const [to, setTo] = useState(() => iso(new Date(Date.now() + 7 * 3600e3)));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() + 7 * 3600e3 - 6 * 864e5)));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await api<Row[]>(`/api/so/count-compare?date_from=${from}&date_to=${to}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const all = useMemo(() => rows ?? [], [rows]);
  const n = (s: string) => all.filter((r) => r.status === s).length;
  const variance = all.reduce((t, r) => t + Number(r.variance_value ?? 0), 0);

  return (
    <Page title={tr("ESB comparison")} subtitle={tr("Exported counts against the stock opname in ESB")}
      actions={
        <div className="flex gap-2">
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label={tr("From")} className="w-auto" />
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label={tr("To")} className="w-auto" />
        </div>
      }
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Exported counts")} value={rows ? fmtNumber(all.length) : <StatSkeleton />} />
          <Stat label={tr("Matches ESB")} emphasis value={rows ? fmtNumber(n("MATCHED_ESB")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} differ", fmtNumber(n("ESB_MISMATCH")))}</p>}
          </Stat>
          <Stat label={tr("Waiting for ESB")} value={rows ? fmtNumber(n("WAITING_FOR_ESB")) : <StatSkeleton />} />
          <Stat label={tr("Variance value")} value={rows ? rp(variance) : <StatSkeleton />}>{rows && <p>{tr("ESB actual − ESB system")}</p>}</Stat>
        </StatStrip>
      }>
      <Panel>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && rows.length === 0 ? (
          <Empty icon={<ArrowLeftRight size={28} />} title={tr("No exported counts in this period")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {all.map((r) => (
                <li key={r.count_id}>
                  <Link href={`/cost-control/esb-compare/${r.count_id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{r.facility_name}</span>
                      <span className="block truncate text-xs text-slate-500">{countTypeLabel(r.count_type)} · {fmtDay(r.business_date)} · {rp(r.variance_value)}</span></span>
                    <Badge tone={(COMPARE[r.status] ?? COMPARE.NO_ESB_BRANCH).tone}>{(COMPARE[r.status] ?? COMPARE.NO_ESB_BRANCH).label()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="m-cards w-full min-w-[760px] text-sm">
                <thead className={theadClass}>
                  <tr><th className="px-4 py-2.5">{tr("Facility")}</th><th className="px-4 py-2.5">{tr("Count")}</th><th className="px-4 py-2.5">{tr("ESB document")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th><th className="px-4 py-2.5 text-right">{tr("Differences")}</th><th className="px-4 py-2.5 text-right">{tr("Variance value")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={6} /> : all.map((r) => (
                    <tr key={r.count_id} className="group hover:bg-slate-50/70">
                      <td className="px-4 py-3"><Link href={`/cost-control/esb-compare/${r.count_id}`} className="block font-medium text-slate-900 group-hover:text-blue-700">{r.facility_name}</Link>
                        <span className="block font-mono text-[11px] text-slate-400">{r.number}</span></td>
                      <td className="px-4 py-3 text-slate-700">{countTypeLabel(r.count_type)}<span className="block text-xs text-slate-400">{fmtDay(r.business_date)}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.esb_doc ?? "—"}</td>
                      <td className="px-4 py-3"><Badge tone={(COMPARE[r.status] ?? COMPARE.NO_ESB_BRANCH).tone}>{(COMPARE[r.status] ?? COMPARE.NO_ESB_BRANCH).label()}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.mismatches ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{rp(r.variance_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </Page>
  );
}

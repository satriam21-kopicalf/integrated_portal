"use client";

// Storage & Production → Pool stock → Waste & Cupping: the cupping and waste of the storage (Storage Palmerah) as the
// item journals of ESB COTR record them — per day and material with its value at the HPP (the request of the COTR team).

import { Coffee, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Field, Input, usePaged } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { COTR_PAGE, CotrPager, rupiah } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Row = { day: string; branch: string; item: string; unit: string; kind: "cupping" | "waste" | "other"; qty: number; value: number };
type Data = { rows: Row[]; cupping: number; waste: number };
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function StorageJournals() {
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [data, setData] = useState<Data | null>(null);
  const paged = usePaged(data?.rows ?? [], data?.rows.length ?? 0, COTR_PAGE);
  useEffect(() => {
    let alive = true;
    setData(null);
    call<Data>(`/api/cotr/esb/storage-journals?dateFrom=${from}&dateTo=${to}`).then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setData({ rows: [], cupping: 0, waste: 0 }); });
    return () => { alive = false; };
  }, [from, to]);
  return (
    <Panel title={tr("Cupping & waste of the storage (ESB)")} description={tr("Item journals of ESB COTR at the storage, per day and material, valued at the HPP")}
      toolbar={<div className="flex flex-wrap items-end gap-3 px-4 pt-3">
        <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9" /></Field>
        <Field label={tr("Until")}><Input type="date" value={to} max={todayWib()} onChange={(e) => setTo(e.target.value)} className="h-9" /></Field>
      </div>}>
      {!data ? <SkeletonTable cols={5} /> : (
        <div className="space-y-3 p-4">
          <StatGrid label={tr("Summary")} cols={2}>
            <StatCard label={tr("Cupping")} icon={<Coffee />} value={rupiah(data.cupping)} sub={tr("{0} lines", data.rows.filter((r) => r.kind === "cupping").length)} />
            <StatCard label={tr("Waste")} icon={<Trash2 />} tone={data.waste ? "warn" : "default"} value={rupiah(data.waste)} sub={tr("{0} lines", data.rows.filter((r) => r.kind === "waste").length)} />
          </StatGrid>
          {data.rows.length === 0 ? <p className="py-4 text-center text-sm text-neutral-400">{tr("Nothing in this period")}</p> : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className={kcTable.thead}><tr><th className="px-3 py-2">{tr("Date")}</th><th className="px-3 py-2">{tr("Material")}</th><th className="px-3 py-2">{tr("Kind")}</th>
                  <th className="px-3 py-2 text-right">{tr("Qty")}</th><th className="px-3 py-2 text-right">{tr("Value")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {paged.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 tabular-nums">{dmyOf(r.day)}</td>
                      <td className="px-3 py-1.5 text-neutral-800">{r.item}<span className="block text-[11px] text-neutral-400">{r.branch}</span></td>
                      <td className="px-3 py-1.5"><Badge tone={r.kind === "waste" ? "red" : r.kind === "cupping" ? "amber" : "slate"}>{r.kind === "waste" ? tr("Waste") : r.kind === "cupping" ? tr("Cupping") : tr("Other")}</Badge></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{r.qty.toLocaleString("id-ID")} {r.unit}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{rupiah(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <CotrPager paged={paged} className="px-3 pb-3" />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

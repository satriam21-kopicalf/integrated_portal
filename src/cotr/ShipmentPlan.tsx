"use client";

// Storage & Production → HUB production → Shipment Plan (recommendation #8): the cups to send each pool / HUB for a day —
// per menu the average sold and used (waste + cupping) of the last days with figures, plus a buffer, less what the pool
// still has that is good that day (its last leftover without the lots expiring before). The total per menu is what the
// HUB production prepares.

import { Download, Send, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";
import { downloadXlsx } from "@/lib/xlsx";

type Row = { menu: string; name: string; avgSold: number; avgUsed: number; need: number; have: number; expiring: number; send: number };
type Plan = { day: string; days: number; buffer: number; pools: { pool: string; name: string; counted: string | null; days: number; rows: Row[]; send: number }[];
  totals: { menu: string; name: string; send: number }[] };

const tomorrow = () => new Date(Date.now() + 7 * 3600e3 + 864e5).toISOString().slice(0, 10);
const n = (v: number) => v.toLocaleString(locale());

export function ShipmentPlan() {
  const toast = useToast();
  const [day, setDay] = useState(tomorrow());
  const [days, setDays] = useState(7);
  const [buffer, setBuffer] = useState(10);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setPlan(null); setError(null);
    call<Plan>(`/api/cotr/shipment-plan?day=${day}&days=${days}&buffer=${buffer}`).then((r) => { if (alive) setPlan(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [day, days, buffer, tick]);
  const total = plan?.totals.reduce((a, t) => a + t.send, 0) ?? 0;
  const exportXlsx = () => plan && downloadXlsx({ fileName: `Saran Kirim COTR ${plan.day}`, sheet: "Saran Kirim", title: `${tr("Shipment Plan")} · ${dmyOf(plan.day)}`,
    header: [tr("Pool / HUB"), tr("Menu"), tr("Average sold / day"), tr("Average waste & cupping / day"), tr("Needed"), tr("Good leftover"), tr("Expiring"), tr("Send")],
    rows: plan.pools.flatMap((p) => p.rows.map((r) => [p.name, r.name, r.avgSold, r.avgUsed, r.need, r.have, r.expiring, r.send])) }).catch((e: Error) => toast(e.message, "error"));
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("For the day")}><Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>
        <Field label={tr("Days of sales")}><Select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 7, 14].map((d) => <option key={d} value={d}>{tr("Last {0} days", d)}</option>)}</Select></Field>
        <Field label={tr("Buffer (%)")}><Select value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}>{[0, 5, 10, 15, 20].map((b) => <option key={b} value={b}>{b}%</option>)}</Select></Field>
        <button type="button" disabled={!plan} onClick={() => void exportXlsx()} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
          <Download size={15} /> {tr("Export Excel")}</button>
      </div>
      <StatGrid label={plan ? tr("To send for {0}", dmyOf(plan.day)) : tr("Summary")} cols={Math.max(2, Math.min(6, (plan?.totals.length ?? 0) + 1)) as 2 | 3 | 4 | 5 | 6}>
        <StatCard label={tr("Cups to send")} tone="brand" icon={<Send />} value={plan ? n(total) : "…"} sub={plan && tr("{0} pools need a shipment", plan.pools.filter((p) => p.send).length)} />
        {plan?.totals.map((t) => <StatCard key={t.menu} label={t.name} icon={<Truck />} value={n(t.send)} tone={t.send ? "warn" : "default"} />)}
      </StatGrid>
      <Panel title={tr("Per pool / HUB")} description={tr("Needed = (average sold + waste & cupping) × buffer; send = needed − leftover still good that day")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !plan ? <SkeletonTable cols={7} /> : (
          <div className="space-y-5 p-4">
            {plan.pools.map((p) => (
              <div key={p.pool}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{p.name}</p>
                  <p className="text-xs text-neutral-500">{tr("Leftover of {0} · {1} days of sales", p.counted ? dmyOf(p.counted) : "—", p.days)} · <span className={p.send ? "font-semibold text-brand-700" : ""}>{tr("send {0} cups", n(p.send))}</span></p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className={kcTable.thead}><tr><th className="px-3 py-2">{tr("Menu")}</th><th className="px-3 py-2 text-right">{tr("Sold / day")}</th>
                      <th className="px-3 py-2 text-right">{tr("Waste & cupping / day")}</th><th className="px-3 py-2 text-right">{tr("Needed")}</th>
                      <th className="px-3 py-2 text-right">{tr("Good leftover")}</th><th className="px-3 py-2 text-right">{tr("Send")}</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                      {p.rows.map((r) => (
                        <tr key={r.menu}>
                          <td className="px-3 py-1.5 text-neutral-800">{r.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{n(r.avgSold)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-neutral-500">{n(r.avgUsed)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{n(r.need)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{n(r.have)}{r.expiring > 0 && <span className="ml-1 text-[11px] text-red-600">(−{r.expiring} {tr("expired")})</span>}</td>
                          <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${r.send ? "text-brand-700" : "text-neutral-400"}`}>{r.send ? n(r.send) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

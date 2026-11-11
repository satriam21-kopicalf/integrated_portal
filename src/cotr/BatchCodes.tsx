"use client";

// Monitoring COTR → Storage & Production → Batch Codes: every production / batch code (SSDD: the batch of the day and the
// day it was made, 0808 = batch 8 of the 8th) counted in the physical leftover of the pools, per menu: the day it was
// made, its expiry (the shelf life of the menu), the days it was counted and the cups of its last count per pool.

import { Download, Search, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type PoolQty = { pool: string; poolName: string; day: string; qty: number; counts: number };
type Code = { menu: string; menuName: string; batchNo: string; sequence: number | null; producedOn: string | null; expiresOn: string | null;
  firstCounted: string; lastCounted: string; pools: PoolQty[]; left: number; status: "active" | "expired" };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export function BatchCodes() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [pool, setPool] = useState("");
  const [menu, setMenu] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Code[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setRows(null); setError(null);
    call<{ batches: Code[] }>(`/api/cotr/batch-codes?dateFrom=${from}&dateTo=${to}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((r) => { if (alive) setRows(r.batches); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, from, to, tick]);
  const menus = useMemo(() => [...new Map((rows ?? []).map((r) => [r.menu, r.menuName])).entries()], [rows]);
  const listed = (rows ?? []).filter((r) => (!menu || r.menu === menu) && (!status || r.status === status)
    && (!q.trim() || `${r.batchNo} ${r.menuName}`.toLowerCase().includes(q.trim().toLowerCase())));
  const active = listed.filter((r) => r.status === "active");
  const exportXlsx = () => downloadXlsx({ fileName: `Kode Batch ${from} - ${to}`, sheet: "Kode Batch", title: `${tr("Batch Codes")} · ${dmyOf(from)} – ${dmyOf(to)}`,
    header: [tr("Menu"), tr("Batch code"), tr("Batch No."), tr("Produced"), tr("Expiry"), tr("Status"), tr("First counted"), tr("Last counted"), tr("Left (last count)"), tr("Per pool")],
    rows: listed.map((r) => [r.menuName, r.batchNo, r.sequence, r.producedOn, r.expiresOn, r.status === "active" ? tr("Active") : tr("Expired"), r.firstCounted, r.lastCounted, r.left,
      r.pools.map((p) => `${p.poolName}: ${p.qty} (${p.day})`).join(", ")]) }).catch((e: Error) => toast(e.message, "error"));
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPool(e.target.value)}><option value="">{tr("All pools")}</option>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label={tr("Menu")}><Select value={menu} onChange={(e) => setMenu(e.target.value)}><option value="">{tr("All menus")}</option>{menus.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select></Field>
        <Field label={tr("Status")}><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{tr("All")}</option><option value="active">{tr("Active")}</option><option value="expired">{tr("Expired")}</option></Select></Field>
        <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tr("Until")}><Input type="date" value={to} max={todayWib()} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search batch code")} className="pl-8" /></label>
        <Button variant="secondary" disabled={!listed.length} onClick={() => void exportXlsx()}><Download size={15} /> {tr("Export Excel")}</Button>
      </div>
      <StatGrid label={tr("Summary")} cols={3}>
        <StatCard label={tr("Batch codes")} tone="brand" icon={<Tags />} value={listed.length} sub={tr("{0} menus", new Set(listed.map((r) => r.menu)).size)} />
        <StatCard label={tr("Active")} value={active.length} sub={tr("{0} cups at the last count", active.reduce((a, r) => a + r.left, 0))} />
        <StatCard label={tr("Expired")} tone={listed.some((r) => r.status === "expired" && r.left > 0) ? "warn" : "default"} value={listed.length - active.length} />
      </StatGrid>
      <Panel title={tr("Batch Codes")} description={tr("SSDD: the batch of the day and the day it was made (0808 = batch 8 of the 8th); the expiry follows the shelf life of the menu")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !rows ? <SkeletonTable cols={7} /> : listed.length === 0 ? (
          <EmptyState icon={<Tags />} title={tr("No batch codes in this period")} />
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Batch code")}</th><th className="px-3 py-2.5">{tr("Menu")}</th><th className="px-3 py-2.5">{tr("Produced")}</th>
              <th className="px-3 py-2.5">{tr("Expiry")}</th><th className="px-3 py-2.5">{tr("Counted")}</th><th className="px-3 py-2.5 text-right">{tr("Left (last count)")}</th><th className="px-4 py-2.5">{tr("Per pool")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {listed.map((r) => (
                <tr key={`${r.menu}:${r.batchNo}:${r.producedOn}`} className={r.status === "expired" && r.left > 0 ? "bg-red-50/40" : undefined}>
                  <td className="px-4 py-2.5"><span className="font-mono font-semibold text-neutral-900">{r.batchNo}</span>
                    {r.sequence !== null && <span className="block text-[11px] text-neutral-500">{tr("Batch {0}", r.sequence)}</span>}</td>
                  <td className="px-3 py-2.5">{r.menuName}</td>
                  <td className="px-3 py-2.5 tabular-nums">{r.producedOn ? dmyOf(r.producedOn) : "—"}</td>
                  <td className="px-3 py-2.5"><span className="tabular-nums">{r.expiresOn ? dmyOf(r.expiresOn) : "—"}</span>{" "}
                    <Badge tone={r.status === "expired" ? "red" : "green"}>{r.status === "expired" ? tr("Expired") : tr("Active")}</Badge></td>
                  <td className="px-3 py-2.5 text-xs text-neutral-600">{r.firstCounted === r.lastCounted ? dmyOf(r.firstCounted) : `${dmyOf(r.firstCounted)} – ${dmyOf(r.lastCounted)}`}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.left}</td>
                  <td className="px-4 py-2.5"><span className="flex flex-wrap gap-1">{r.pools.map((p) => <Badge key={p.pool} tone="slate" title={dmyOf(p.day)}>{p.poolName.replace(/^COTR /, "").replace(/ HUB$/, "")} · {p.qty}</Badge>)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

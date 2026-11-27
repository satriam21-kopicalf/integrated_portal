"use client";

// Aggregator Insight → Opening & Closing → Status now (2026-11-27): every outlet x platform as BotFood last read it —
// OPEN, HOLD (closed inside its hours: paused, temporarily closed, busy) or CLOSE (outside them) — since when, the hours
// of today and how old the reading is. Backend: app/aggregator_reports.py now_status.

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Lozenge, QuickChips, SectionMessage, cx, type LozengeTone } from "@/jira";
import { downloadSheets } from "@/aggregator/ui";
import { DataTable, OutletCell, Platform, useScope, type AggFilters, type Col, type Ctx } from "@/aggregator/kit";
import { ago, fmtClock, fmtStamp, nf } from "@/aggregator/time";

type State = "OPEN" | "HOLD" | "CLOSE";
type Row = { channelId: number; name: string; branchCode: string | null; branchName: string | null; platform: string; state: State; noHours: boolean;
  since: string | null; hours: string | null; hoursFrom: "check" | "app" | null; zone: string; localNow: string; synced: string | null;
  syncAgeMin: number | null; stale: boolean; items: number | null; itemsActive: number | null };
type Res = { at: string; count: Record<State, number>; stale: number; unmapped: number; data: Row[] };
type Only = State | "ALL" | "STALE";

const TONE: Record<State, LozengeTone> = { OPEN: "green", HOLD: "amber", CLOSE: "grey" };
export const STATE_LABEL: Record<State, () => string> = { OPEN: () => tr("Open now"), HOLD: () => tr("Hold"), CLOSE: () => tr("Closed now") };
const HINT: Record<State, () => string> = {
  OPEN: () => tr("Taking orders"),
  HOLD: () => tr("Closed inside its hours: paused, temporarily closed or busy"),
  CLOSE: () => tr("Outside its hours today"),
};

export default function StatusNow({ a, ctx, q, excelRef }: { a: AggFilters; ctx: Ctx | null; q: string; excelRef?: (fn: () => void) => void }) {
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [only, setOnly] = useState<Only>("HOLD");
  useEffect(() => {
    let off = false;
    const load = () => call<Res>("/api/aggregator/status-now").then((r) => { if (!off) { setRes(r); setErr(null); } }).catch((e: Error) => { if (!off) setErr(e.message); });
    void load();
    const t = setInterval(load, 5 * 60_000); // BotFood reads the apps about every hour; the page follows every 5 minutes
    return () => { off = true; clearInterval(t); };
  }, []);
  const scoped = useScope(res?.data, a.f, ctx).filter((r) => !a.f.platform || r.platform === a.f.platform);
  const t = q.trim().toLowerCase();
  const found = scoped.filter((r) => !t || `${r.branchName ?? ""} ${r.name} ${r.branchCode ?? ""} ${r.platform}`.toLowerCase().includes(t));
  const n = (o: Only) => found.filter((r) => (o === "ALL" ? true : o === "STALE" ? r.stale : r.state === o)).length;
  const rows = found.filter((r) => (only === "ALL" ? true : only === "STALE" ? r.stale : r.state === only));
  useEffect(() => {
    excelRef?.(() => void downloadSheets("Status outlet", [{ sheet: "Status", title: `Status outlet · ${res ? fmtStamp(res.at) : ""}`,
      header: [tr("Outlet"), tr("Code"), tr("Platform"), tr("Status"), tr("Since"), tr("Hours today"), tr("Zone"), tr("BotFood read"), tr("Active items")],
      rows: rows.map((r) => [r.branchName ?? r.name, r.branchCode, r.platform, STATE_LABEL[r.state](), r.since ? fmtStamp(r.since) : null, r.hours, r.zone, r.synced ? fmtStamp(r.synced) : null,
        r.items != null ? `${r.itemsActive ?? 0} / ${r.items}` : null]) }]));
  }, [excelRef, rows, res]);
  const cols: Col<Row>[] = [
    { key: "outlet", card: "title", label: tr("Outlet"), sort: (r) => r.branchName ?? r.name, render: (r) => r.branchCode ? <OutletCell name={r.branchName ?? r.name} code={r.branchCode} ctx={ctx} /> : <span><span className="font-medium">{r.name}</span><span className="block text-[11px] text-[color:var(--j-AE2E24)]">{tr("not matched to our outlet")}</span></span> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "state", card: "side", label: tr("Status"), sort: (r) => ({ HOLD: 0, CLOSE: 1, OPEN: 2 })[r.state], render: (r) => <span className="inline-flex flex-col items-end gap-0.5 sm:items-start"><Lozenge tone={TONE[r.state]} title={HINT[r.state]()}>{STATE_LABEL[r.state]()}</Lozenge>{r.noHours && <span className="text-[11px] text-[color:var(--j-626F86)]">{tr("hours unknown")}</span>}</span> },
    { key: "since", label: tr("Since"), sort: (r) => r.since ?? "", first: "asc", render: (r) => r.since ? <span className={cx(r.state === "HOLD" && "font-semibold text-[color:var(--j-AE2E24)]")}>{ago(r.since)}<span className="block text-[11px] font-normal text-[color:var(--j-626F86)]">{fmtStamp(r.since)}</span></span> : <span className="text-[color:var(--j-626F86)]">—</span> },
    { key: "hours", label: tr("Hours today"), sort: (r) => r.hours ?? "", className: "whitespace-nowrap tabular-nums", render: (r) => r.hours ? <span>{r.hours}<span className="block text-[11px] text-[color:var(--j-626F86)]">{r.zone}{r.zone !== "WIB" ? ` · ${tr("now {0}", r.localNow)}` : ""} · {r.hoursFrom === "check" ? tr("checked by the team") : tr("merchant app")}</span></span> : <span className="text-[color:var(--j-626F86)]">—</span> },
    { key: "synced", label: tr("BotFood read"), sort: (r) => r.syncAgeMin ?? 9999, render: (r) => <span className={cx(r.stale && "text-[color:var(--j-AE2E24)]")}>{r.synced ? `${ago(r.synced)}` : "—"}<span className="block text-[11px] text-[color:var(--j-626F86)]">{r.synced ? `${fmtClock(r.synced)} WIB` : ""}</span></span> },
    { key: "items", hide: !(res?.data ?? []).some((r) => r.items != null), label: tr("Active items"), right: true, sort: (r) => (r.items ? (r.itemsActive ?? 0) / r.items : 1), render: (r) => r.items != null ? `${nf(r.itemsActive ?? 0)} / ${nf(r.items)}` : "—" },
  ];
  if (err) return <div className="p-4"><SectionMessage tone="error" title={tr("Something went wrong")}>{err}</SectionMessage></div>;
  return (
    <>
      {res && <div className="grid grid-cols-2 gap-2 border-b border-[color:var(--j-DCDFE4)] p-4 sm:grid-cols-4">
        {(["OPEN", "HOLD", "CLOSE"] as State[]).map((x) => (
          <button key={x} type="button" onClick={() => setOnly(x)} aria-pressed={only === x} className={cx("rounded-[3px] border px-3 py-2 text-left transition-colors", only === x ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)]" : "border-[color:var(--j-DCDFE4)] hover:bg-[color:var(--j-F7F8F9)]")}>
            <span className="flex items-center gap-2"><Lozenge tone={TONE[x]}>{STATE_LABEL[x]()}</Lozenge></span>
            <span className="mt-1 block text-xl font-semibold tabular-nums text-[color:var(--j-172B4D)]">{nf(n(x))}</span>
            <span className="block text-xs text-[color:var(--j-626F86)]">{HINT[x]()}</span>
          </button>))}
        <button type="button" onClick={() => setOnly("STALE")} aria-pressed={only === "STALE"} className={cx("rounded-[3px] border px-3 py-2 text-left transition-colors", only === "STALE" ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)]" : "border-[color:var(--j-DCDFE4)] hover:bg-[color:var(--j-F7F8F9)]")}>
          <span className="text-xs font-semibold text-[color:var(--j-626F86)]">{tr("Old reading")}</span>
          <span className="mt-1 block text-xl font-semibold tabular-nums text-[color:var(--j-172B4D)]">{nf(n("STALE"))}</span>
          <span className="block text-xs text-[color:var(--j-626F86)]">{tr("BotFood read it more than 2 hours ago")}</span>
        </button>
      </div>}
      <div className="space-y-2 border-b border-[color:var(--j-DCDFE4)] px-4 py-3">
        <QuickChips<Only> value={only} onChange={setOnly} label={tr("Status")} items={[
          { key: "HOLD", label: STATE_LABEL.HOLD(), dot: "bg-[#E2B203]", count: res ? n("HOLD") : null },
          { key: "CLOSE", label: STATE_LABEL.CLOSE(), dot: "bg-[color:var(--j-8590A2)]", count: res ? n("CLOSE") : null },
          { key: "OPEN", label: STATE_LABEL.OPEN(), dot: "bg-[#22A06B]", count: res ? n("OPEN") : null },
          { key: "STALE", label: tr("Old reading"), dot: "bg-[color:var(--j-C9372C)]", count: res ? n("STALE") : null },
          { key: "ALL", label: tr("All"), count: res ? n("ALL") : null }]} />
        {res && (res.unmapped > 0 || res.stale > 0) && <p className="flex items-start gap-1.5 text-xs text-[color:var(--j-7F5F01)]"><AlertTriangle size={13} className="mt-px shrink-0" />
          {[res.unmapped > 0 && tr("{0} channels are not matched to our outlets (Overview → match them)", res.unmapped), res.stale > 0 && tr("{0} readings of BotFood are older than 2 hours", res.stale)].filter(Boolean).join(" · ")}</p>}
      </div>
      <DataTable key="now" cols={cols} rows={rows} loading={!res} rowKey={(r) => String(r.channelId)} resetKey={`${only}${t}${a.f.platform}${a.f.outlet}${a.f.group}`}
        initial={{ key: "state", dir: "asc" }} minWidth={980} empty={only === "HOLD" ? tr("No outlet on hold now") : tr("Nothing to show")}
        note={tr("HOLD = closed while its hours say open (paused, temporarily closed, busy). The status is BotFood's last reading of the app, up to a few hours old: check the merchant app before acting.")} />
    </>
  );
}

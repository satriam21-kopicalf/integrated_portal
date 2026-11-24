"use client";

// Aggregator Insight → Void Order (page agg.void, 2026-11-25): the void and cancelled bills of the delivery apps in ESB,
// each with the reason the team gives (several at once), and the voids entered by hand that are not in ESB.

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Receipt, Save } from "lucide-react";
import { Button, ErrorState, Field, Input, PageNav, SearchBox, cx, usePaged, useToast } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, JSelect, Lozenge, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PLATFORMS, PeriodBar, daysAgo, downloadSheets } from "@/aggregator/ui";

type Row = { key: string; manual: boolean; orderNo: string; outlet: string; platform: string; day: string; time: string | null; amount: number; editedBy: string | null; reason: string | null; note: string | null; by: string | null; member: string | null };
type Res = { summary: { n: number; amount: number; noReason: number; manual: number; bills: number; pct: number | null }; reasons: { reason: string; n: number }[]; byOutlet: { outlet: string; n: number; amount: number }[];
  choices: string[]; outlets: { code: string; name: string }[]; data: Row[] };
type Tab = "list" | "outlet" | "reason";
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export default function VoidOrder() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  const [only, setOnly] = useState<"none" | "all" | "manual">("none");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const load = () => {
    setErr(null); setPick(new Set());
    call<Res>(`/api/aggregator/voids?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform]);
  const t = q.trim().toLowerCase();
  const rows = useMemo(() => (data?.data ?? []).filter((r) => (only === "all" || (only === "none" ? !r.reason : r.manual)) && (!t || `${r.outlet} ${r.orderNo} ${r.reason ?? ""} ${r.member ?? ""}`.toLowerCase().includes(t))), [data, only, t]);
  const paged = usePaged(rows, `${from}${to}${platform}${only}${t}`, 50);
  const s = data?.summary;
  const save = async () => {
    setBusy(true);
    try { await call("/api/aggregator/voids/reason", { method: "PUT", json: { keys: [...pick], reason, note: note.trim() || null } }); toast(tr("Saved")); setNote(""); load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const toggle = (k: string) => setPick((x) => { const n = new Set(x); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Void ${from} - ${to}`, [
        { sheet: "Summary", title: `Void ${from} – ${to}${platform ? ` · ${platform}` : ""}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Void orders"), data.summary.n], [tr("Value"), Math.round(data.summary.amount)], [tr("Void % of the orders"), data.summary.pct], [tr("Without a reason"), data.summary.noReason], ...data.reasons.map((x) => [x.reason, x.n])] },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Void orders"), tr("Value")], rows: data.byOutlet.map((x) => [x.outlet, x.n, Math.round(x.amount)]) },
        { sheet: "Data", header: [tr("Date"), tr("Time"), tr("Outlet"), tr("Platform"), tr("Order no."), tr("Value"), tr("Reason"), tr("Note"), tr("Source"), tr("Entered by"), tr("On duty")],
          rows: data.data.map((r) => [r.day, r.time, r.outlet, r.platform, r.orderNo, r.amount, r.reason, r.note, r.manual ? "Manual" : "ESB", r.by, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Page title={tr("Void Order")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The void orders of the delivery apps in ESB and those the team enters, with their reason")} media={<Receipt size={19} />}
      actions={<div className="flex gap-2"><Button size="sm" disabled={!data} onClick={() => setAdding(true)}><Plus size={14} /> {tr("Manual void")}</Button><Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button></div>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={4} label={tr("Void Order")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Void orders")} value={s ? s.n.toLocaleString("id-ID") : <StatSkeleton />}>{s && <p>{tr("{0} entered by hand", s.manual)}</p>}</Stat>
            <Stat label={tr("Value")} value={s ? rp(s.amount) : <StatSkeleton />} />
            <Stat label={tr("Void % of the orders")} value={s ? `${s.pct ?? "—"}%` : <StatSkeleton />}>{s && <p>{tr("{0} orders finished", s.bills.toLocaleString("id-ID"))}</p>}</Stat>
            <Stat label={tr("Without a reason")} value={s ? s.noReason.toLocaleString("id-ID") : <StatSkeleton />} />
          </StatStrip>
          <WorkCard active={tab} onTab={setTab} tabs={[{ key: "list", label: tr("Orders"), count: data?.data.length ?? null }, { key: "outlet", label: tr("Per outlet") }, { key: "reason", label: tr("Per reason") }]}
            left={<PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />}>
            {tab === "list" && <Toolbar>
              <div className="flex flex-1 flex-wrap items-center gap-2"><div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet, order or member")} /></div>
                <QuickChips value={only} onChange={setOnly} label={tr("Filter")} items={[{ key: "none", label: tr("Without a reason"), count: s?.noReason ?? null }, { key: "all", label: tr("All") }, { key: "manual", label: tr("Manual"), count: s?.manual ?? null }]} /></div>
            </Toolbar>}
            {tab === "list" && pick.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-brand-200 bg-brand-50/60 px-4 py-2.5 text-sm">
                <span className="font-semibold">{tr("{0} chosen", pick.size)}</span>
                <div className="w-full sm:w-56"><JSelect value={reason} onChange={setReason} placeholder={tr("Choose the reason")} options={(data?.choices ?? []).map((c) => ({ value: c, label: c }))} /></div>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={tr("Note (optional)")} className="h-9 w-full sm:!w-64" />
                <Button size="sm" loading={busy} disabled={!reason || (reason === "Lainnya" && !note.trim())} onClick={() => void save()}><Save size={13} /> {tr("Save")}</Button>
              </div>
            )}
            {!data ? <p className="px-5 py-8 text-center text-sm text-neutral-500">…</p> : tab !== "list" ? (
              <div className="overflow-x-auto"><table className={cx(jTable, "min-w-[860px]")}>
                <thead><tr className={jHeadRow}>{(tab === "outlet" ? [tr("Outlet"), tr("Void orders"), tr("Value")] : [tr("Reason"), tr("Void orders")]).map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                <tbody>{tab === "outlet" ? data.byOutlet.map((o) => <tr key={o.outlet} className="border-b border-neutral-100"><td className={cx(jTd, "font-medium text-neutral-900")}>{o.outlet}</td><td className={cx(jTd, "tabular-nums")}>{o.n}</td><td className={cx(jTd, "tabular-nums")}>{rp(o.amount)}</td></tr>)
                  : data.reasons.map((o) => <tr key={o.reason} className="border-b border-neutral-100"><td className={cx(jTd, "font-medium text-neutral-900")}>{o.reason}</td><td className={cx(jTd, "tabular-nums")}>{o.n}</td></tr>)}</tbody></table></div>
            ) : (
              <div className="overflow-x-auto">
                <table className={cx(jTable, "min-w-[860px]")}>
                  <thead><tr className={jHeadRow}><th className={cx(jTh, "w-8")}><input type="checkbox" aria-label={tr("Choose all shown")} checked={paged.rows.length > 0 && paged.rows.every((r) => pick.has(r.key))}
                    onChange={(e) => setPick((x) => { const n = new Set(x); paged.rows.forEach((r) => (e.target.checked ? n.add(r.key) : n.delete(r.key))); return n; })} /></th>
                    {[tr("Date"), tr("Outlet"), tr("Platform"), tr("Order no."), tr("Value"), tr("Reason"), tr("On duty")].map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.length === 0 ? <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("Nothing in this period")}</td></tr> : paged.rows.map((r) => (
                      <tr key={r.key} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className={jTd}><input type="checkbox" aria-label={r.orderNo} checked={pick.has(r.key)} onChange={() => toggle(r.key)} /></td>
                        <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{dm(r.day)} {r.time ?? ""}</td><td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td>
                        <td className={cx(jTd, "text-xs")}>{r.orderNo}{r.manual && <span className="ml-1.5"><Lozenge>{tr("Manual")}</Lozenge></span>}</td><td className={cx(jTd, "whitespace-nowrap tabular-nums")}>{rp(r.amount)}</td>
                        <td className={jTd}>{r.reason ? <><span className="text-neutral-900">{r.reason}</span>{(r.note || r.by) && <span className="block text-[11px] text-neutral-500">{[r.note, r.by].filter(Boolean).join(" · ")}</span>}</> : <Lozenge tone="amber">{tr("No reason yet")}</Lozenge>}</td>
                        <td className={cx(jTd, "text-neutral-600")}>{r.member ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "list" && <CardFooter><span className="text-xs text-neutral-500">{tr("ESB gives no reason for a void: the team fills it in.")}</span><PageNav paged={paged} /></CardFooter>}
          </WorkCard>
        </div>
      )}
      {adding && data && <Add res={data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </Page>
  );
}

function Add({ res, onClose, onSaved }: { res: Res; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ branchCode: "", platform: "", orderNo: "", day: daysAgo(0), amount: "", reason: "", note: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await call("/api/aggregator/voids", { method: "POST", json: { ...f, amount: Number(f.amount) || 0, note: f.note.trim() || null } }); toast(tr("Saved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Plus size={18} />} title={tr("Manual void")} description={tr("A void on the delivery app that is not in ESB")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!f.branchCode || !f.platform || !f.orderNo.trim() || !f.reason} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Outlet")}><JSelect value={f.branchCode} onChange={(v) => setF({ ...f, branchCode: v })} placeholder={tr("Choose the outlet")} options={res.outlets.map((o) => ({ value: o.code, label: o.name }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Platform")}><JSelect value={f.platform} onChange={(v) => setF({ ...f, platform: v })} placeholder={tr("Choose")} options={PLATFORMS.map((p) => ({ value: p, label: p }))} /></Field>
          <Field label={tr("Date")}><Input type="date" value={f.day} max={daysAgo(0)} onChange={(e) => setF({ ...f, day: e.target.value })} /></Field>
          <Field label={tr("Order no.")}><Input value={f.orderNo} maxLength={60} onChange={(e) => setF({ ...f, orderNo: e.target.value })} /></Field>
          <Field label={tr("Value (Rp)")}><Input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} /></Field>
        </div>
        <Field label={tr("Reason")}><JSelect value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder={tr("Choose the reason")} options={res.choices.map((c) => ({ value: c, label: c }))} /></Field>
        <Field label={tr("Note")}><Input value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

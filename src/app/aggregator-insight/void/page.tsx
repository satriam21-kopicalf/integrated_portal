"use client";

// Aggregator Insight → Void Order (page agg.void, 2026-11-25): the void and cancelled bills of the delivery apps in ESB,
// each with the reason the team gives (several at once), and the voids entered by hand that are not in ESB.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Save } from "lucide-react";
import { useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Tip } from "@/aggregator/info";
import { downloadSheets } from "@/aggregator/ui";
import { Bars, DataTable, FilterBar, OutletCell, platformOptions, Platform, noMembers, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { daysAgo, fmtDay, fmtPeriod, nf, pct, rp } from "@/aggregator/time";
import Drawer, { Page, Stat, StatSkeleton, StatStrip, JSelect, Lozenge, QuickChips, WorkCard, Button, ErrorState, DateField, Group, Row as Line, ctl } from "@/jira";

type Row = { key: string; manual: boolean; orderNo: string; bill?: string | null; branchCode: string | null; outlet: string; platform: string; day: string; time: string | null; amount: number; editedBy: string | null; reason: string | null; note: string | null; by: string | null; member: string | null };
type Res = { summary: { n: number; amount: number; noReason: number; manual: number; bills: number; pct: number | null }; choices: string[]; outlets: { code: string; name: string }[]; data: Row[] };
type Tab = "list" | "outlet" | "cashier" | "reason" | "hour";
type Out = { outlet: string; branchCode: string | null; n: number; amount: number; noReason: number };
const NONE = "__none";

export default function VoidOrder() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("list");
  const [only, setOnly] = useState<"none" | "all" | "manual">("none");
  const [cashier, setCashier] = useState("");
  const [why, setWhy] = useState("");
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => { setErr(null); setPick(new Set()); call<Res>(`/api/aggregator/voids?${a.query}`).then(setData).catch((e: Error) => setErr(e.message)); }, [a.query]);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/voids?${a.query}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query]);
  const t = q.trim().toLowerCase();
  const key = `${a.query}${a.f.outlet}${a.f.group}${only}${cashier}${why}${t}${tab}`;
  // a choice only holds for the rows on screen: another filter clears it, so nothing unseen gets a reason
  useEffect(() => { setPick(new Set()); }, [key]);
  const inScope = useScope(data?.data, a.f, ctx);
  const scoped = useMemo(() => inScope.filter((r) => (!cashier || r.editedBy === cashier) && (!why || (why === NONE ? !r.reason : r.reason === why))), [inScope, cashier, why]);
  const rows = scoped.filter((r) => (only === "all" || (only === "none" ? !r.reason : r.manual)) && (!t || `${r.outlet} ${r.orderNo} ${r.bill ?? ""} ${r.reason ?? ""} ${r.editedBy ?? ""} ${r.member ?? ""}`.toLowerCase().includes(t)));
  const cashiers = useMemo(() => [...new Set(inScope.flatMap((r) => (r.editedBy ? [r.editedBy] : [])))].sort(), [inScope]);
  const count = (k: (r: Row) => string) => Object.entries(scoped.reduce<Record<string, number>>((m, r) => { m[k(r)] = (m[k(r)] ?? 0) + 1; return m; }, {})).map(([key, n]) => ({ key, label: key, n }));
  const outs = useMemo(() => {
    const m = new Map<string, Out>();
    for (const r of scoped) { const x = m.get(r.outlet) ?? { outlet: r.outlet, branchCode: r.branchCode, n: 0, amount: 0, noReason: 0 }; x.n++; x.amount += r.amount; if (!r.reason) x.noReason++; m.set(r.outlet, x); }
    return [...m.values()];
  }, [scoped]);
  const amount = scoped.reduce((x, r) => x + r.amount, 0), noReason = scoped.filter((r) => !r.reason).length, manual = scoped.filter((r) => r.manual).length;
  const narrowed = !!(a.f.outlet || a.f.group || cashier || why);
  const s = data?.summary;
  const save = async () => {
    setBusy(true);
    try { await call("/api/aggregator/voids/reason", { method: "PUT", json: { keys: [...pick], reason, note: note.trim() || null } }); toast(tr("Saved")); setNote(""); load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const cols: Col<Row>[] = [
    { key: "at", label: tr("Time (WIB)"), sort: (r) => `${r.day} ${r.time ?? ""}`, first: "desc", className: "whitespace-nowrap", render: (r) => <>{fmtDay(r.day)}<span className="block text-[11px] text-[color:var(--j-626F86)]">{r.time ?? tr("no time")}</span></> },
    { key: "outlet", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "order", card: "wide", label: tr("Order no."), sort: (r) => r.orderNo, className: "text-xs", render: (r) => <><span className="text-[color:var(--j-172B4D)]">{r.orderNo}</span>{r.manual && <span className="ml-1.5"><Lozenge>{tr("Manual")}</Lozenge></span>}{r.bill && <span className="block text-[11px] text-[color:var(--j-626F86)]">{r.bill}</span>}</> },
    { key: "amount", card: "side", label: tr("Value"), sort: (r) => r.amount, first: "desc", right: true, className: "whitespace-nowrap", render: (r) => rp(r.amount) },
    { key: "cashier", label: tr("Voided by"), sort: (r) => r.editedBy, className: "text-xs text-[color:var(--j-44546F)]", render: (r) => r.editedBy ?? "—" },
    { key: "reason", card: "wide", label: tr("Reason"), sort: (r) => r.reason, render: (r) => r.reason ? <><span className="text-[color:var(--j-172B4D)]">{r.reason}</span>{(r.note || r.by) && <span className="block text-[11px] text-[color:var(--j-626F86)]">{[r.note, r.by].filter(Boolean).join(" · ")}</span>}</> : <Lozenge tone="amber">{tr("No reason yet")}</Lozenge> },
    { key: "member", label: tr("On duty"), sort: (r) => r.member, hide: noMembers(scoped), render: (r) => r.member ?? "—" },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Void ${a.f.from} - ${a.f.to}`, [
        { sheet: "Summary", title: `Void · ${fmtPeriod(a.f.from, a.f.to)}${a.f.platform ? ` · ${a.f.platform}` : ""} · WIB`, header: [tr("Measure"), tr("Value")], rows: [[tr("Void orders"), scoped.length], [tr("Value"), Math.round(amount)], ...(narrowed ? [] : [[tr("Void % of the orders"), data.summary.pct] as [string, number | null]]), [tr("Without a reason"), noReason], ...count((r) => r.reason ?? tr("No reason yet")).map((x): [string, number] => [x.key, x.n])] },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Void orders"), tr("Value"), tr("Without a reason")], rows: outs.map((x) => [x.outlet, x.n, Math.round(x.amount), x.noReason]) },
        { sheet: "Data", header: [tr("Date"), tr("Time (WIB)"), tr("Outlet"), tr("Platform"), tr("Order no."), tr("Bill"), tr("Value"), tr("Voided by"), tr("Reason"), tr("Note"), tr("Source"), tr("Entered by"), tr("On duty")],
          rows: rows.map((r) => [r.day, r.time, r.outlet, r.platform, r.orderNo, r.bill ?? null, r.amount, r.editedBy, r.reason, r.note, r.manual ? "Manual" : "ESB", r.by, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const filter = (
    <FilterBar a={a} ctx={ctx} extra={[{ key: "why", label: tr("Reason"), value: why, onChange: setWhy, options: [{ value: NONE, label: tr("No reason yet") }, ...(data?.choices ?? []).map((c) => ({ value: c, label: c }))] }, { key: "cashier", label: tr("Voided by"), value: cashier, onChange: setCashier, options: cashiers.map((c) => ({ value: c, label: c })) }]} q={tab === "list" ? q : undefined} onQ={setQ} placeholder={tr("Search outlet, order, bill or cashier")} excel={() => void exportXlsx()} excelOff={!data}>{tab === "list" && <><QuickChips<"none" | "all" | "manual"> value={only} onChange={setOnly} label={tr("Filter")} items={[{ key: "none", label: tr("Without a reason"), dot: "bg-amber-400", count: noReason }, { key: "all", label: tr("All"), count: scoped.length }, { key: "manual", label: tr("Manual"), count: manual }]} /></>}</FilterBar>
  );
  const card = <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">{filter}</section>;
  return (
    <Page title={tr("Void Order")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The void orders of the delivery apps in ESB and those the team enters, with their reason")} media={<Receipt size={19} />}
      actions={<><Button size="sm" disabled={!data} onClick={() => setAdding(true)}><Plus size={14} /> {tr("Manual void")}</Button></>}>
      {err ? <>{card}<ErrorState message={err} onRetry={load} /></> : (
        <>
          <StatStrip columns={4} label={tr("Void Order")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Void orders")} value={s ? nf(scoped.length) : <StatSkeleton />}>{s && <p>{tr("{0} entered by hand", manual)}</p>}</Stat>
            <Stat label={tr("Value")} value={s ? rp(amount) : <StatSkeleton />}>{s && scoped.length > 0 && <p>{tr("{0} on average", rp(amount / scoped.length))}</p>}</Stat>
            <Stat label={tr("Void % of the orders")} info={<Tip k="voidPct" />} value={s ? (narrowed ? "—" : pct(s.pct, 2)) : <StatSkeleton />}>{s && <p>{narrowed ? tr("only without an outlet, reason or cashier filter") : tr("{0} orders finished", nf(s.bills))}</p>}</Stat>
            <Stat label={tr("Without a reason")} info={<Tip k="voidReason" />} value={s ? nf(noReason) : <StatSkeleton />}>{s && scoped.length > 0 && <p>{pct((noReason / scoped.length) * 100)}</p>}</Stat>
          </StatStrip>
          {tab === "list" && pick.size > 0 && (
            <section aria-label={tr("Give a reason")} className="sticky top-16 z-[15] space-y-3 rounded-[3px] border border-[color:var(--j-85B8FF)] bg-white p-3 shadow-lg sm:p-4">
              <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Give a reason to {0} voids", nf(pick.size))}</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1.3fr_auto] sm:items-end"><Line label={tr("Reason")} required><JSelect label={tr("Reason")} value={reason} onChange={setReason} placeholder={tr("Choose the reason")} options={(data?.choices ?? []).map((c) => ({ value: c, label: c }))} /></Line>
                <Line label={tr("Note")} required={reason === "Lainnya"}><input aria-label={tr("Note")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={reason === "Lainnya" ? tr("Note (required)") : tr("Note (optional)")} className={ctl} /></Line>
                <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setPick(new Set())}>{tr("Cancel")}</Button><Button loading={busy} disabled={!reason || (reason === "Lainnya" && !note.trim())} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></div></div>
            </section>)}
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "list", label: tr("Orders"), count: s ? scoped.length : null }, { key: "outlet", label: tr("Per outlet"), count: s ? outs.length : null }, { key: "cashier", label: tr("Per cashier") }, { key: "reason", label: tr("Per reason") }, { key: "hour", label: tr("Per hour") }]}>
            {filter}
            {tab === "outlet" ? <DataTable key={tab} rows={outs} loading={!data} rowKey={(r) => r.outlet} resetKey={key} initial={{ key: "n", dir: "desc" }} minWidth={560} onRow={(r) => { setQ(r.outlet); setOnly("all"); setTab("list"); }}
                cols={[{ key: "o", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> }, { key: "n", card: "side", label: tr("Void orders"), sort: (r) => r.n, first: "desc", right: true, render: (r) => nf(r.n) }, { key: "a", label: tr("Value"), sort: (r) => r.amount, first: "desc", right: true, render: (r) => rp(r.amount) }, { key: "x", label: tr("Without a reason"), sort: (r) => r.noReason, first: "desc", right: true, render: (r) => nf(r.noReason) }]} />
              : tab === "cashier" ? <DataTable key={tab} rows={count((r) => r.editedBy ?? "—")} loading={!data} rowKey={(r) => r.key} resetKey={key} initial={{ key: "n", dir: "desc" }} minWidth={360} onRow={(r) => { if (r.key !== "—") { setCashier(r.key); setOnly("all"); setTab("list"); } }}
                cols={[{ key: "c", label: tr("Voided by"), sort: (r) => r.label, render: (r) => <span className="font-medium text-[color:var(--j-172B4D)]">{r.label}</span> }, { key: "n", card: "side", label: tr("Void orders"), sort: (r) => r.n, first: "desc", right: true, render: (r) => nf(r.n) }]} note={tr("The POS account that changed the bill; a shared account is not one person.")} />
              : tab === "reason" ? <Bars rows={count((r) => r.reason ?? tr("No reason yet")).sort((x, y) => y.n - x.n)} />
              : tab === "hour" ? <Bars rows={count((r) => (r.time ? `${r.time.slice(0, 2)}:00` : "—")).sort((x, y) => (x.key < y.key ? -1 : 1))} />
              : <DataTable key={tab} cols={cols} rows={rows} loading={!data} rowKey={(r) => r.key} resetKey={key} initial={{ key: "at", dir: "desc" }} minWidth={1060} select={{ picked: pick, onChange: setPick, label: (r) => r.orderNo }}
                note={tr("ESB gives no reason for a void: the team fills it in.")} />}
          </WorkCard>
        </>
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
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!f.branchCode || !f.platform || !f.orderNo.trim() || !f.reason} onClick={() => void save()}><Save size={14} /> {tr("Save")}</Button></>}>
      <Group title={tr("The order")}>
        <Line label={tr("Outlet")} required><JSelect label={tr("Outlet")} value={f.branchCode} onChange={(v) => setF({ ...f, branchCode: v })} placeholder={tr("Choose the outlet")} options={res.outlets.map((o) => ({ value: o.code, label: o.name }))} /></Line>
        <Line label={tr("Platform")} required><JSelect label={tr("Platform")} value={f.platform} onChange={(v) => setF({ ...f, platform: v })} placeholder={tr("Choose the platform")} options={platformOptions()} /></Line>
        <Line label={tr("Date of the void")} required><DateField label={tr("Date of the void")} value={f.day} max={daysAgo(0)} onChange={(v) => setF({ ...f, day: v })} /></Line>
        <Line label={tr("Order no.")} required hint={tr("As shown in the delivery app")}><input aria-label={tr("Order no.")} value={f.orderNo} maxLength={60} onChange={(e) => setF({ ...f, orderNo: e.target.value })} className={ctl} /></Line>
        <Line label={tr("Value (Rp)")} hint={f.amount ? rp(Number(f.amount)) : undefined}><input aria-label={tr("Value (Rp)")} inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} className={`${ctl} tabular-nums`} /></Line>
      </Group>
      <Group title={tr("Why it was voided")}>
        <Line label={tr("Reason")} required><JSelect label={tr("Reason")} value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder={tr("Choose the reason")} options={res.choices.map((c) => ({ value: c, label: c }))} /></Line>
        <Line label={tr("Note")}><input aria-label={tr("Note")} value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} className={ctl} /></Line>
      </Group>
    </Drawer>
  );
}

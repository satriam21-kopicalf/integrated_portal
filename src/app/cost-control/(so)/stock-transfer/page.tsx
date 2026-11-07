"use client";

// Monitoring Stock → Transfer Stock (page cc.stock-transfer; integrated_portal_be app/stock_transfer.py, migration 075):
// every transfer between outlets with its steps; the approvers (Settings) approve or reject the transfers the source
// accepted, Cost Control labels the received ones whether they go to ESB; exports: the transfers, their lines, per
// outlet (value in / out) and per material.

import { SortTh, useSort } from "@/so/ui/Sort";
import { CalendarDays, CheckCircle2, ClipboardList, ListChecks, Package, Save, Settings2, Store, Tags, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { call } from "@/so/features/checkin/checkin";
import { downloadXlsx } from "@/lib/xlsx";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { TransferDrawer } from "@/so/features/stock-transfer/TransferForm";
import { type Status, type Transfer, ESB_LABEL, STATUS, rpText, shortBranch } from "@/so/features/stock-transfer/transfer";

type Result = { period: { from: string; to: string }; canDecide: boolean; data: Transfer[]; truncated: boolean;
  summary: Record<Status, number> & { total: number; value: number; unlabelled: number } };
type BranchOpt = { branch_code: string; branch_name: string };
type TKey = "number" | "route" | "requested" | "lines" | "value" | "status" | "label";
const tValue = (t: Transfer, k: TKey) => ({ number: t.number, route: `${t.fromName} ${t.toName}`, requested: t.requested.at, lines: t.lines,
  value: t.value ?? t.estimate ?? null, status: t.status, label: t.esbLabel?.value ?? null }[k]);
type F = { period: Period; branch: string; status: Status | "" };
const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, branch: "", status: "" });
const STATUSES: Status[] = ["submitted", "accepted", "approved", "received", "declined", "rejected", "cancelled"];

export default function StockTransferPage() {
  const [tab, setTab] = useState<"transfers" | "settings">("transfers");
  return (
    <Page title={tr("Transfer Stock")} subtitle={tr("Transfers of materials between outlets: approval, ESB label and exports")}
      actions={<div className="inline-flex rounded-lg border border-neutral-200 bg-white p-0.5">
        {([["transfers", tr("Transfers"), Truck], ["settings", tr("Settings"), Settings2]] as const).map(([v, l, Icon]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium", tab === v ? "bg-brand-700 text-white" : "text-neutral-600 hover:bg-neutral-100")}><Icon size={14} />{l}</button>))}
      </div>}>
      {tab === "transfers" ? <Transfers /> : <Settings />}
    </Page>
  );
}

function Transfers() {
  const toast = useToast();
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  const load = useCallback(async () => {
    setError(null); setRes(null);
    const qs = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.branch ? { branch: f.branch } : {}), ...(f.status ? { status: f.status } : {}) });
    try { setRes(await call<Result>(`/api/monitoring/stock/transfers?${qs}`)); } catch (e) { setError((e as Error).message); }
  }, [f]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((t) => !q || `${t.number} ${t.toName} ${t.fromName} ${t.requested.by}`.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const sorted = useSort<Transfer, TKey>(rows, tValue);
  const paged = usePaged(sorted.rows, q + rows.length + JSON.stringify(sorted.sort), 25);
  const s = res?.summary;
  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(periodLabel(f.period, def.period) ? [{ key: "p", label: periodLabel(f.period, def.period)!, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.status ? [{ key: "s", label: STATUS[f.status].label(), onRemove: () => setF({ ...f, status: "" }) }] : []),
  ];
  const label = async (t: Transfer, value: "esb" | "portal" | null) => {
    try { await call(`/api/monitoring/stock/transfers/${t.id}/label`, { method: "POST", json: { label: value } }); void load(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const file = (what: string) => `${what} ${f.period.from} - ${f.period.to}`;
  const header = ["No", "Tanggal", "Dari (outlet tujuan)", "Ke (outlet peminta)", "Status", "Material", "Nilai (Rp)", "Diajukan oleh", "Validasi outlet", "Cost Control", "Diterima", "Label ESB"];
  const exportList = () => downloadXlsx({ fileName: file("Transfer Stock"), sheet: "Transfer", title: file("Transfer Stock"), header,
    rows: rows.map((t) => [t.number, wibDateTime(t.requested.at), t.fromName, t.toName, STATUS[t.status].label(), t.lines, t.value, t.requested.by,
      t.source ? `${t.source.by} · ${t.source.note ?? ""}` : "", t.costControl ? `${t.costControl.by} · ${t.costControl.note ?? ""}` : "",
      t.received?.at ? wibDateTime(t.received.at) : "", t.esbLabel ? ESB_LABEL[t.esbLabel.value]() : ""]) });
  const lines = async () => (await call<{ data: { id: string; code: string; name: string; unit: string; qty: number; requested: number; price: number | null; value: number | null }[] }>(
    `/api/monitoring/stock/transfers/lines?ids=${rows.map((t) => t.id).join(",")}`)).data;
  const exportLines = async () => {
    const by = new Map(rows.map((t) => [t.id, t]));
    const l = await lines();
    await downloadXlsx({ fileName: file("Transfer Stock per baris"), sheet: "Baris", title: file("Transfer Stock per baris"),
      header: ["No", "Tanggal", "Dari", "Ke", "Status", "Kode", "Material", "Qty Diminta", "Qty Disetujui", "Satuan", "Harga", "Nilai"],
      rows: l.map((x) => { const t = by.get(x.id)!; return [t.number, wibDateTime(t.requested.at), t.fromName, t.toName, STATUS[t.status].label(), x.code, x.name, x.requested, x.qty, x.unit, x.price, x.value]; }) });
  };
  const exportOutlets = async () => {
    const m = new Map<string, { name: string; inN: number; inV: number; outN: number; outV: number }>();
    for (const t of rows.filter((x) => x.status === "received")) {
      const a = m.get(t.toBranch) ?? { name: t.toName, inN: 0, inV: 0, outN: 0, outV: 0 };
      a.inN += 1; a.inV += t.value ?? 0; m.set(t.toBranch, a);
      const b = m.get(t.fromBranch) ?? { name: t.fromName, inN: 0, inV: 0, outN: 0, outV: 0 };
      b.outN += 1; b.outV += t.value ?? 0; m.set(t.fromBranch, b);
    }
    await downloadXlsx({ fileName: file("Transfer Stock per outlet"), sheet: "Outlet", title: file("Transfer Stock per outlet (diterima)"),
      header: ["Outlet", "Transfer Masuk", "Nilai Masuk", "Transfer Keluar", "Nilai Keluar", "Bersih"],
      rows: [...m.values()].sort((a, b) => b.inV + b.outV - a.inV - a.outV).map((x) => [x.name, x.inN, x.inV, x.outN, x.outV, x.inV - x.outV]) });
  };
  const exportMaterials = async () => {
    const received = new Set(rows.filter((t) => t.status === "received").map((t) => t.id));
    const m = new Map<string, { name: string; unit: string; qty: number; value: number; n: number }>();
    for (const x of (await lines()).filter((y) => received.has(y.id))) {
      const a = m.get(x.code) ?? { name: x.name, unit: x.unit, qty: 0, value: 0, n: 0 };
      a.qty += x.qty; a.value += x.value ?? 0; a.n += 1; m.set(x.code, a);
    }
    await downloadXlsx({ fileName: file("Transfer Stock per material"), sheet: "Material", title: file("Transfer Stock per material (diterima)"),
      header: ["Kode", "Material", "Qty", "Satuan", "Transfer", "Nilai"], rows: [...m.entries()].sort((a, b) => b[1].value - a[1].value).map(([c, x]) => [c, x.name, x.qty, x.unit, x.n, x.value]) });
  };
  const safe = (fn: () => Promise<void>) => async () => { try { await fn(); } catch (e) { toast((e as Error).message, "error"); } };
  return (
    <>
      <StatStrip label={tr("Summary")} columns={5}>
        <Stat label={tr("Transfers")} emphasis icon={<Truck size={13} />} value={s ? fmtNumber(s.total) : <StatSkeleton />}>{s && <p>{tr("{0} received", fmtNumber(s.received))}</p>}</Stat>
        <Stat label={tr("Waiting for Cost Control")} icon={<ListChecks size={13} />} active={f.status === "accepted"} onClick={s ? () => setF({ ...f, status: f.status === "accepted" ? "" : "accepted" }) : undefined}
          value={s ? <span className={s.accepted ? "text-blue-700" : undefined}>{fmtNumber(s.accepted)}</span> : <StatSkeleton />}>{s && <p>{tr("{0} waiting for the outlet", fmtNumber(s.submitted))}</p>}</Stat>
        <Stat label={tr("To Receive")} icon={<Package size={13} />} value={s ? fmtNumber(s.approved) : <StatSkeleton />}>{s && <p>{tr("approved, goods not received yet")}</p>}</Stat>
        <Stat label={tr("Value Transferred")} icon={<CheckCircle2 size={13} />} value={s ? rpText(s.value) : <StatSkeleton />}>{s && <p>{tr("received transfers")}</p>}</Stat>
        <Stat label={tr("Without ESB Label")} icon={<Tags size={13} />} value={s ? <span className={s.unlabelled ? "text-amber-700" : undefined}>{fmtNumber(s.unlabelled)}</span> : <StatSkeleton />}>{s && <p>{tr("received, to label")}</p>}</Stat>
      </StatStrip>
      <Panel className="mt-4" toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search number, outlet or person")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(NO_F())}
        extra={<div className="ml-auto"><ExcelExportMenu footer={<>{dmy(f.period.from)} – {dmy(f.period.to)}</>} choices={[
          { key: "list", label: tr("Transfers"), hint: tr("Every transfer with its steps and ESB label"), icon: <Truck size={16} />, tone: "bg-brand-50 text-brand-600", count: res ? rows.length : null, run: safe(exportList) },
          { key: "lines", label: tr("Transfer Lines"), hint: tr("Every material of every transfer"), icon: <ClipboardList size={16} />, tone: "bg-violet-50 text-violet-600", run: safe(exportLines) },
          { key: "outlets", label: tr("Per Outlet"), hint: tr("Value in and out of every outlet (received)"), icon: <Store size={16} />, tone: "bg-emerald-50 text-emerald-600", run: safe(exportOutlets) },
          { key: "materials", label: tr("Per Material"), hint: tr("Quantity and value per material (received)"), icon: <Package size={16} />, tone: "bg-amber-50 text-amber-600", run: safe(exportMaterials) },
        ]} /></div>} />}
        footer={res ? <><span>{tr("{0} shown", fmtNumber(rows.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Truck size={26} />} title={tr("No transfer in this period")} /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
              <thead className={theadClass}><tr><SortTh k="number" sort={sorted.sort} onSort={sorted.toggle} pad="py-2.5 pl-5 pr-3">{tr("Number")}</SortTh><SortTh k="route" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5">{tr("From → To")}</SortTh>
                <SortTh k="requested" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5" first="desc">{tr("Requested")}</SortTh><SortTh k="lines" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5" align="right" first="desc">{tr("Materials")}</SortTh>
                <SortTh k="value" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5" align="right" first="desc">{tr("Value")}</SortTh><SortTh k="status" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5">{tr("Status")}</SortTh>
                <SortTh k="label" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2.5 pr-5">{tr("ESB label")}</SortTh></tr></thead>
              <tbody className="divide-y divide-neutral-100">{paged.rows.map((t) => (
                <tr key={t.id} className={cx("cursor-pointer", t.status === "accepted" && res.canDecide ? "bg-blue-50/40 hover:bg-blue-50" : "hover:bg-neutral-50/70")} onClick={() => setOpen(t.id)}>
                  <td className="py-2.5 pl-5 pr-3 font-mono text-[13px] font-medium text-neutral-900">{t.number}</td>
                  <td className="max-w-[18rem] px-3 py-2.5"><p className="truncate text-neutral-800">{shortBranch(t.fromName)} → {shortBranch(t.toName)}</p></td>
                  <td className="whitespace-nowrap px-3 py-2.5"><p className="text-neutral-700">{wibDateTime(t.requested.at)}</p><p className="text-[11px] text-neutral-400">{t.requested.by}</p></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{t.lines}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{t.value != null ? rpText(t.value) : "—"}</td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label()}</Badge></td>
                  <td className="px-3 py-2.5 pr-5" onClick={(e) => e.stopPropagation()}>
                    {t.status === "received" ? (
                      <select className="h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs" value={t.esbLabel?.value ?? ""} onChange={(e) => void label(t, (e.target.value || null) as "esb" | "portal" | null)} aria-label={tr("ESB label")}>
                        <option value="">{tr("Not labelled")}</option><option value="esb">{ESB_LABEL.esb()}</option><option value="portal">{ESB_LABEL.portal()}</option>
                      </select>
                    ) : <span className="text-xs text-neutral-300">—</span>}
                  </td>
                </tr>))}</tbody>
            </table></div>
          )}
      </Panel>
      {sheet && <TransferFilters value={f} branches={branches} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <TransferDrawer id={open} mine={new Set()} monitor onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </>
  );
}

function TransferFilters({ value, branches, onApply, onClose }: { value: F; branches: BranchOpt[]; onApply: (v: F) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  const def = NO_F();
  const period = periodLabel(d.period, def.period);
  return (
    <MonitorFilterSheet active={[period, d.branch, d.status].filter(Boolean).length} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 30 Days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={366} />
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Outlet")} value={branches.find((b) => b.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} allLabel={tr("All Outlets")} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code }))} />
      </FilterRow>
      <FilterRow icon={<ListChecks size={15} />} label={tr("Status")} value={d.status ? STATUS[d.status].label() : null} onClear={() => setD({ ...d, status: "" })}>
        <Segments value={d.status} onChange={(v) => setD({ ...d, status: v as F["status"] })} choices={[{ value: "", label: tr("All statuses") }, ...STATUSES.map((x) => ({ value: x, label: STATUS[x].label() }))]} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

type Person = { id: string; name: string; username: string; role: string };

function Settings() {
  const toast = useToast();
  const [data, setData] = useState<{ approvers: Person[]; candidates: Person[]; canEdit: boolean } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call<{ approvers: Person[]; candidates: Person[]; canEdit: boolean }>("/api/monitoring/stock/settings")
      .then((d) => { setData(d); setPicked(new Set(d.approvers.map((a) => a.id))); }).catch((e: Error) => toast(e.message, "error"));
  }, [toast]);
  const save = async () => {
    setBusy(true);
    try { await call("/api/monitoring/stock/settings", { method: "PUT", json: { approvers: [...picked] } }); toast(tr("Saved")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Panel title={tr("Approvers of Transfer Stock")} description={tr("The Cost Control accounts that approve or reject the transfers the outlets accepted; superadmins always may")}
      actions={data?.canEdit ? <Button size="sm" loading={busy} onClick={() => void save()}><Save size={14} />{tr("Save")}</Button> : undefined}>
      {!data ? <table className="w-full"><tbody><SkeletonRows cols={3} /></tbody></table> : !data.candidates.length ? <Empty title={tr("No Cost Control account yet")} /> : (
        <ul className="divide-y divide-neutral-100">{data.candidates.map((p) => (
          <li key={p.id}><label className={cx("flex items-center gap-3 px-5 py-2.5 text-sm", data.canEdit && "cursor-pointer hover:bg-neutral-50")}>
            <input type="checkbox" disabled={!data.canEdit} checked={picked.has(p.id) || p.role === "superadmin"}
              onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(p.id); else n.delete(p.id); setPicked(n); }} />
            <span className="min-w-0 flex-1"><span className="block font-medium text-neutral-900">{p.name}</span><span className="text-xs text-neutral-500">@{p.username}</span></span>
            <Badge tone={p.role === "superadmin" ? "violet" : "slate"}>{p.role === "superadmin" ? tr("Superadmin") : tr("Cost Control")}</Badge>
          </label></li>))}</ul>
      )}
    </Panel>
  );
}

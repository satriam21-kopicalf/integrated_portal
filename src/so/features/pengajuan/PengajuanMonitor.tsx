"use client";

// Monitoring → Pengajuan (page mon.pengajuan, the portal): every request of the outlets for management and Finance.
// Status tabs (open first, "My turn": waiting at a step of the signed-in user), one Filters sheet (period, branch group,
// outlet, kind, account, category, flags), the summary of what waits, a list and a CSV export of every line (for the
// reconciliation). A request opens in a drawer: the steps of its kind, every line with its receipts and the history; the
// approver of the step waiting approves (the last approval sets the amount), may reject single lines, send it back for
// a revision or reject it (with a note); the payment step records the transfer with its proof. Settings: the approval
// steps of every kind with their users (superadmin) and the petty cash plafon (superadmin, Finance).

import { CardFooter, JSelect, Lozenge, NativeSelect, type LozengeTone, Person, QuickChips, Toolbar, TypeIcon, WorkCard, jHeadRow, jKey, jRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, GripVertical, ClipboardList, Copy, MessageSquareText, Paperclip, Plus, Send, Settings2, Trash2, UserCheck, Wallet, Store, UserRound, ListChecks, ChevronRight, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Field, Page, SkeletonRows, fmtNumber, inputClass, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import Dialog from "@/so/ui/Dialog";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay as wibOffset } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDate, wibDateTime, wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import ExcelIconButton from "@/components/ExcelIconButton";
import { type XlsxCell, downloadXlsx } from "@/lib/xlsx";
import { downloadSheets } from "@/aggregator/ui";
import { LOGOS, useCompany } from "@/lib/company";
import PengajuanView, { FileChip, StatusBadge } from "./PengajuanView";
import RefundPanel from "./PengajuanRefund";
import { BulkBar, ReceivePanel } from "./PengajuanBulk";
import { type Lifecycle, type RuleRow, RulesPanel, VerifyPanel } from "./PengajuanLife";
import { SkeletonList } from "@/components/kc/Skeleton";
import { type Action, type Kind, type Pengajuan, type PgFile, type Status, type Unit, ACTION_LABEL, CATEGORY_LABEL, DE_KINDS, KINDS, KIND_LABEL, OPEN, STATUS_LABEL, acceptedTotal,
  categoryLabel, fmtRp, kindLabel, parseRp, placeOf, requestLabel, setKindLabels, typeRp, upload, type FundOption, type OptionList } from "./pengajuan";

type Result = { period: { from: string; to: string }; me: string; superadmin: boolean; data: Pengajuan[]; categories: Record<string, string>; units?: Unit[]; openByUnit?: Record<string, number> };
type F = { period: Period; bgroup: string; branch: string; kind: Kind | ""; account: string; category: string; flag: "" | "reused" | "negative" | "opening" | "rejected" | "aboveRef" };
const NO_F = (): F => ({ period: { from: wibOffset(-89), to: wibOffset(0) }, bgroup: "", branch: "", kind: "", account: "", category: "", flag: "" });
type GroupOpt = { id: string; code: string; name: string };
type Tab = Status | "" | "OPEN" | "MINE";
const TABS: Tab[] = ["MINE", "OPEN", "", "SUBMITTED", "APPROVED", "REVISION", "PAID", "VERIFYING", "DONE", "REJECTED", "CANCELLED"];
const DOT: Partial<Record<Status, string>> = { SUBMITTED: "bg-brand-500", APPROVED: "bg-cyan-500", REVISION: "bg-amber-500",
  PAID: "bg-violet-500", VERIFYING: "bg-amber-500", DONE: "bg-emerald-500", REJECTED: "bg-red-500", CANCELLED: "bg-neutral-400" };
const sum = (rows: Pengajuan[], f: (p: Pengajuan) => number | null | undefined) => rows.reduce((a, p) => a + (f(p) ?? 0), 0);
/** the requests that are a cost: the money between the PTs stays out of every total */
const cost = (rows: Pengajuan[]) => rows.filter((p) => p.kind !== "INTERCOMPANY");
const flagged = (p: Pengajuan) => ({
  reused: (p.reusedFiles ?? 0) > 0, negative: (p.closingBalance ?? 0) < 0,
  opening: p.openingExpected !== null && p.openingBalance !== null && p.openingExpected !== p.openingBalance,
  rejected: (p.lines ?? []).some((l) => l.review === "REJECTED"),
  aboveRef: !!p.aboveRef,
});

export default function PengajuanMonitor() {
  const [f, setF] = useState<F>(NO_F);
  const [status, setStatus] = useState<Tab>("OPEN");
  // the unit shown (Kopi Calf, Wasgee, COTR, Roastery, Warehouse, Central Kitchen): never mixed; remembered on the device
  const [unit, setUnit] = useState(() => { try { return (typeof window !== "undefined" && window.localStorage.getItem("portal.fund-unit")) || ""; } catch { return ""; } });
  const { companies, setCompany } = useCompany();
  // Kopi Calf / Wasgee chosen here is the brand of the other pages too
  const pickUnit = (code: string) => { setRes(null); setUnit(code); if (companies.some((c) => c.code === code)) setCompany(code); try { window.localStorage.setItem("portal.fund-unit", code); } catch { /* not remembered */ } };
  const [settings, setSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const [res, setRes] = useState<Result | null>(null);
  // phones: the chosen unit in sight (the row only, the page does not move)
  const unitBar = useRef<HTMLDivElement>(null);
  const hasRes = !!res;
  useEffect(() => { const bar = unitBar.current; const el = bar?.querySelector<HTMLElement>("[data-on]"); if (bar && el) bar.scrollLeft = el.offsetLeft - bar.offsetLeft - 16; }, [unit, hasRes]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  // ?open=<id>: opened from a link of the other monitor (Fund Request ↔ Maintenance & Procurement)
  const [open, setOpen] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("open")));
  const [bgroups, setBgroups] = useState<GroupOpt[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await call<Result & { kindLabels?: Partial<Record<Kind, string>> }>(`/api/pengajuan/monitor?dateFrom=${f.period.from}&dateTo=${f.period.to}&unit=${unit || "CALF"}${f.bgroup ? `&group=${encodeURIComponent(f.bgroup)}` : ""}`);
      // the first time, or a unit the account no longer reads: the first of its units
      const first = r.units?.length && !r.units.some((u) => u.code === unit) ? r.units[0].code : null;
      if (first) { setUnit(first); return; }
      setKindLabels(r.kindLabels);
      setRes(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period, f.bgroup, unit]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<{ groups: GroupOpt[] }>("/api/monitoring/branch-groups").then((r) => setBgroups(r.groups)).catch(() => setBgroups([])); }, []);

  const all = useMemo(() => res?.data ?? [], [res]);
  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((p) => (!f.branch || p.branchCode === f.branch) && (!f.kind || p.kind === f.kind) && (!f.account || p.username === f.account)
      && (!f.category || (p.lines ?? []).some((l) => l.category === f.category)) && (!f.flag || flagged(p)[f.flag])
      && (!s || `${p.number} ${p.branchName} ${p.name} ${p.username} ${p.requesterName ?? ""} ${p.purpose ?? ""} ${p.baristas.map((b) => b.name).join(" ")} ${(p.lines ?? []).map((l) => l.description).join(" ")}`.toLowerCase().includes(s)));
  }, [all, f, search]);
  // my turn: waiting at a step of mine (a step without users: the superadmins)
  const mine = useCallback((p: Pengajuan) => !!res && !!p.step && ["SUBMITTED", "APPROVED", "VERIFYING"].includes(p.status)
    && (p.step.userIds.includes(res.me) || (res.superadmin && !p.step.userIds.length)), [res]);
  const inTab = (p: Pengajuan, t: Tab) => !t || (t === "OPEN" ? OPEN.includes(p.status) : t === "MINE" ? mine(p) : p.status === t);
  const rows = useMemo(() => base.filter((p) => inTab(p, status))
    .sort((a, b) => (OPEN.includes(b.status) ? 1 : 0) - (OPEN.includes(a.status) ? 1 : 0) || (status === "APPROVED" ? (a.neededOn ?? "9999").localeCompare(b.neededOn ?? "9999") : status === "PAID" ? (a.proofDueOn ?? "9999").localeCompare(b.proofDueOn ?? "9999") : 0)
      || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- inTab follows `mine`
  [base, status, mine]);
  // several at once: what waits at the signed-in account (approve or pay), never Antar-PT
  const [pick, setPick] = useState<Set<string>>(new Set());
  const canPick = (p: Pengajuan) => mine(p) && (p.status === "SUBMITTED" || p.status === "APPROVED") && p.kind !== "INTERCOMPANY";
  const picked = rows.filter((p) => pick.has(p.id) && canPick(p));
  const togglePick = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f) + status);
  const by = (s: Status) => base.filter((p) => p.status === s);

  const def = NO_F();
  const FLAG_LABEL = { reused: tr("Same receipt used twice"), negative: tr("Negative closing balance"), opening: tr("Opening balance differs"), rejected: tr("With rejected expenses"), aboveRef: tr("Far above the outlet's purchases") };
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.bgroup ? [{ key: "bg", label: `${tr("Group")} ${f.bgroup === "none" ? tr("Without a Group") : bgroups.find((g) => g.id === f.bgroup)?.code ?? ""}`, onRemove: () => setF({ ...f, bgroup: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: all.find((p) => p.branchCode === f.branch)?.branchName ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.kind ? [{ key: "k", label: kindLabel(f.kind), onRemove: () => setF({ ...f, kind: "" }) }] : []),
    ...(f.account ? [{ key: "a", label: `@${f.account}`, onRemove: () => setF({ ...f, account: "" }) }] : []),
    ...(f.category ? [{ key: "c", label: categoryLabel(f.category), onRemove: () => setF({ ...f, category: "" }) }] : []),
    ...(f.flag ? [{ key: "f", label: FLAG_LABEL[f.flag], onRemove: () => setF({ ...f, flag: "" }) }] : []),
  ];
  const branchOpts = useMemo(() => [...new Map(all.map((p) => [p.branchCode, p.branchName])).entries()].map(([value, label]) => ({ value, label })), [all]);
  const accountOpts = useMemo(() => [...new Map(all.map((p) => [p.username, p.name])).entries()].map(([value, label]) => ({ value, label: `${label} (@${value})` })), [all]);

  const unitName = (p: Pengajuan) => res?.units?.find((u) => u.code === p.unit)?.name ?? p.unit;
  /** the daily recap of Finance (layout of the Warehouse recap, one sheet per PT that pays): what is approved and not paid */
  const exportRecap = () => {
    const head = [tr("Timestamp"), tr("Email"), tr("Requester"), tr("Department"), tr("Job Title"), tr("Vendor"), tr("Payment term"), tr("Description and Details"),
      tr("Invoice number"), tr("Invoice date"), tr("Due date"), tr("Total outstanding invoice"), tr("Total Requested"), tr("Account number"), tr("Account holder"), tr("Bank"),
      tr("Status"), tr("Step waiting"), tr("Request number"), tr("Business unit"), tr("Paid from"), tr("Check twice")];
    const list = rows.filter((p) => p.kind !== "PETTY_CASH" || p.status === "APPROVED");
    const payers = [...new Set(list.map((p) => p.payer ?? "—"))];
    setExporting(true);
    downloadSheets(`Recap Pengajuan ${dmy(f.period.to).replaceAll("/", "-")}`, payers.map((payer) => ({ sheet: payer, title: `Recap Pengajuan · ${payer}`, header: head,
      rows: list.filter((p) => (p.payer ?? "—") === payer).map((p) => [wibDateTime(p.submittedAt), p.email ?? "", p.requesterName ?? p.name, p.department ?? "", p.jobTitle ?? "",
        p.vendorName ?? placeOf(p), p.paymentTerm ?? requestLabel(p), p.purpose ?? "", p.invoiceNo ?? "", p.invoiceDate ?? "", p.neededOn ?? "", p.outstandingAmount ?? null,
        p.approvedAmount ?? p.requestedAmount, p.payeeAccount ?? "", p.payeeName ?? "", p.payeeType === "VA" ? `VA ${p.vaProvider ?? p.payeeBank ?? ""}` : p.payeeBank ?? "",
        STATUS_LABEL[p.status](), p.step?.label ?? "", p.number, unitName(p) ?? "", p.payer ?? "", p.twin ? tr("Same account and amount") : ""]) })))
      .catch((e) => toast((e as Error).message, "error")).finally(() => setExporting(false));
  };

  const exportCsv = () => {
    const head = [tr("Number"), tr("Business unit"), tr("Paid from"), tr("Kind"), tr("Status"), tr("Step waiting"), tr("Outlet"), tr("Code"), tr("Account"), tr("Submitted by"), tr("Phone"),
      tr("Bank"), tr("Account number"), tr("Account holder"), tr("Purpose"), tr("Date needed"), tr("Baristas"), tr("Period from"), tr("Period to"),
      tr("Opening Balance"), tr("Money in"), tr("Total money out"), tr("Closing balance"), tr("Plafon"), tr("Amount Asked"), tr("Approved amount"), tr("Paid"),
      tr("Transfer date"), tr("Proof due"), tr("Spent (requester)"), tr("Accepted by Finance"), tr("Difference"), tr("Invoice number"), tr("Line date"), tr("Category"), tr("Description"), tr("Amount"), tr("Line check"), tr("Check note")];
    const out: XlsxCell[][] = [];
    for (const p of rows) {
      const common = [p.number, unitName(p), p.payer, kindLabel(p.kind), STATUS_LABEL[p.status](), p.step?.label, p.branchName, p.branchCode, p.username, p.requesterName, p.requesterPhone,
        (p.payeeType === "VA" ? `VA ${p.vaProvider ?? p.payeeBank ?? ""}` : p.payeeBank), p.payeeAccount, p.payeeName, p.purpose, p.neededOn, p.baristas.map((b) => b.name).join(" / "), p.periodFrom, p.periodTo,
        p.openingBalance, p.incomeAmount, p.totalOut, p.closingBalance, p.plafon, p.requestedAmount, p.approvedAmount, p.paidAmount, p.paidOn,
        p.proofDueOn, p.actualAmount, p.verifiedAmount ?? p.actualAmount, p.difference, p.invoiceNo];
      const lines = p.lines?.length ? p.lines : [null];
      for (const l of lines) out.push([...common, l?.spentOn, l ? categoryLabel(l.category, l.categoryLabel) : "", l?.description, l?.amount, l?.review === "REJECTED" ? tr("Rejected") : l ? "OK" : "", l?.reviewNote]);
    }
    setExporting(true);
    downloadXlsx({ fileName: `${tr("Fund Request")} ${f.period.from} - ${f.period.to}`, sheet: tr("Fund Request"),
      title: `${tr("Fund Request")} · ${dmy(f.period.from)} – ${dmy(f.period.to)}`, header: head, rows: out })
      .catch((e) => toast((e as Error).message, "error")).finally(() => setExporting(false));
  };

  return (
    <Page title={tr("Fund Request")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("petty cash and budget requests of every outlet")}`}
      actions={<div className="flex gap-2">
        <Button variant="secondary" onClick={() => setSettings(true)}><Settings2 size={15} /> {tr("Configurations")}</Button>
        <Button variant="secondary" disabled={!rows.length || exporting} onClick={exportRecap}><ClipboardList size={15} /> {tr("Recap")}</Button>
        <ExcelIconButton label={tr("Export to Excel")} loading={exporting} disabled={!rows.length} onClick={exportCsv} />
      </div>}
      stats={
        <>
        {(res?.units?.length ?? 0) > 1 && (
          <div role="radiogroup" ref={unitBar} aria-label={tr("Business unit")} className="-mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {res!.units!.map((u) => {
              const on = u.code === unit;
              const n = res!.openByUnit?.[u.code] ?? 0;
              return (
                <button key={u.code} type="button" role="radio" aria-checked={on} data-on={on || undefined} onClick={() => !on && pickUnit(u.code)} title={u.payer}
                  className={cx("inline-flex h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded border px-3 text-sm font-medium transition-colors", on ? "border-brand-700 bg-white text-brand-800 ring-1 ring-brand-700" : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {LOGOS[u.code] && <img src={LOGOS[u.code]} alt="" aria-hidden className={cx("max-h-6 max-w-14 object-contain", !on && "opacity-60 grayscale")} />}
                  {u.name}{n > 0 && <span className="rounded-full bg-neutral-200/80 px-1.5 text-[11px] tabular-nums text-neutral-700">{n}</span>}
                </button>
              );
            })}
            <span className="ml-auto hidden self-center text-xs text-neutral-500 sm:inline">{tr("Paid from {0}", res!.units!.find((u) => u.code === unit)?.payer ?? "—")}</span>
          </div>
        )}
        <StatStrip label={tr("Summary")} columns={5} gridClassName="grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat label={tr("My Turn")} emphasis onClick={res ? () => setStatus("MINE") : undefined} active={status === "MINE"} icon={<UserCheck size={13} />}
            value={res ? fmtNumber(base.filter(mine).length) : <StatSkeleton />}>
            {res && <p className="tabular-nums">{fmtRp(sum(cost(base.filter(mine)), (p) => p.approvedAmount ?? p.requestedAmount))}</p>}
          </Stat>
          {(["SUBMITTED", "APPROVED", "PAID", "VERIFYING"] as Status[]).map((s) => (
            <Stat key={s} label={STATUS_LABEL[s]()} onClick={res ? () => setStatus(s) : undefined} active={status === s}
              icon={s === "PAID" || s === "VERIFYING" ? <CheckCircle2 size={13} /> : s === "APPROVED" ? <Wallet size={13} /> : <ClipboardList size={13} />}
              value={res ? fmtNumber(by(s).length) : <StatSkeleton />}>
              {res && <p className="tabular-nums">{fmtRp(sum(cost(by(s)), (p) => (s === "PAID" || s === "VERIFYING" ? p.paidAmount : s === "APPROVED" ? p.approvedAmount : p.requestedAmount)))}</p>}
            </Stat>
          ))}
        </StatStrip>
        </>
      }>
      {/* Jira-like (2026-11-18): one card, the kinds as tabs, the status as quick filters, the requests as an issue table */}
      <WorkCard label={tr("Kind")} active={f.kind || "ALL"} onTab={(k) => setF({ ...f, kind: k === "ALL" ? "" : (k as Kind) })}
        tabs={[{ key: "ALL", label: tr("All kinds"), icon: <Wallet size={15} />, count: all.length },
          ...[...KINDS, "PERSONAL" as Kind, "VENDOR" as Kind, "INTERCOMPANY" as Kind, ...DE_KINDS].filter((k) => (k !== "VENDOR" && k !== "INTERCOMPANY") || !!res?.units?.find((u) => u.code === unit)?.vendor || all.some((p) => p.kind === k)).map((k) => ({ key: k, label: kindLabel(k), count: all.filter((p) => p.kind === k).length }))]}>
        <Toolbar>
          <QuickChips label={tr("Status")} value={status} onChange={setStatus}
            items={TABS.map((t) => ({ key: t, label: t === "OPEN" ? tr("Open") : t === "MINE" ? tr("My Turn") : t ? STATUS_LABEL[t as Status]() : tr("All"),
              dot: t && t !== "OPEN" && t !== "MINE" ? DOT[t as Status] : undefined, count: res ? base.filter((p) => inTab(p, t)).length : null }))} />
          <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search number, outlet, requester, purpose or line")} filters={chips.filter((c) => c.key !== "k")}
            onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />
        </Toolbar>
        <BulkBar rows={picked} onClear={() => setPick(new Set())} onDone={() => { setPick(new Set()); void load(); }} />
        {error ? <div className="p-4"><ErrorState message={error} onRetry={load} /></div> : res && rows.length === 0 ? (
          <Empty icon={<ClipboardList size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No fund request yet")}>
            {!all.length && tr("Fund requests appear here as soon as they are sent from Form → Fund requests.")}
          </Empty>
        ) : !res ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table> : (
          <>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {paged.rows.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p.id)} className="w-full px-4 py-3 text-left hover:bg-neutral-50">
                    <span className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold text-brand-700">{canPick(p) && <input type="checkbox" className="h-4 w-4" aria-label={p.number ?? p.id} checked={pick.has(p.id)} onClick={(e) => e.stopPropagation()} onChange={() => togglePick(p.id)} />}{p.number}</span><PgLozenge s={p.status} /></span>
                    <span className="mt-1 flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-neutral-900">{placeOf(p)}</span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular-nums">{fmtRp(p.requestedAmount ?? p.totalOut)}</span></span>
                    <span className="block truncate text-xs text-neutral-500">{requestLabel(p)} · {p.kind === "PETTY_CASH" && p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : p.purpose ?? "—"}</span>
                    <StepWaiting p={p} />
                    <Flags p={p} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className={cx(jTable, "min-w-[1100px]")}>
                <thead>
                  <tr className={cx(jHeadRow, "whitespace-nowrap")}>
                    <th className={cx(jTh, "w-8")}>{paged.rows.some(canPick) && <input type="checkbox" aria-label={tr("Choose all shown")} checked={paged.rows.filter(canPick).every((p) => pick.has(p.id))} onChange={(e) => setPick((s) => { const n = new Set(s); paged.rows.filter(canPick).forEach((p) => (e.target.checked ? n.add(p.id) : n.delete(p.id))); return n; })} />}</th><th className={jTh}>Key</th><th className={jTh}>{tr("Summary")}</th>
                    <th className={jTh}>{tr("Status")}</th><th className={jTh}>{tr("Reporter")}</th>
                    <th className={cx(jTh, "text-right")}>{tr("Money Out")}</th><th className={cx(jTh, "text-right")}>{tr("Amount Asked")}</th><th className={jTh}>{tr("Created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.rows.map((p) => (
                    <tr key={p.id} onClick={() => setOpen(p.id)} className={jRow}>
                      <td className={jTd}><span className="flex items-center gap-2">{canPick(p) && <input type="checkbox" aria-label={p.number ?? p.id} checked={pick.has(p.id)} onClick={(e) => e.stopPropagation()} onChange={() => togglePick(p.id)} />}<TypeIcon tone={KIND_TONE[p.kind] ?? "bg-neutral-500"} title={requestLabel(p)}><Wallet size={11} /></TypeIcon></span></td>
                      <td className={cx(jTd, "whitespace-nowrap")}><span className={jKey}>{p.number}</span></td>
                      <td className={cx(jTd, "max-w-[22rem]")}>
                        <span className="block truncate text-neutral-900">{placeOf(p)} · {p.kind === "PETTY_CASH" && p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : p.purpose ?? requestLabel(p)}</span>
                        <span className="block truncate text-[11px] text-neutral-400">{requestLabel(p)}{p.kind === "PERSONAL" ? ` · ${p.name}` : ""} · {tr("{0} expenses", p.lines?.length ?? 0)} · {tr("{0} files", p.fileCount ?? 0)}</span>
                        <Flags p={p} />
                      </td>
                      <td className={jTd}><PgLozenge s={p.status} /><StepWaiting p={p} /></td>
                      <td className={cx(jTd, "max-w-[12rem]")}><Person name={p.requesterName || p.name} sub={`@${p.username}`} /></td>
                      <td className={cx(jTd, "whitespace-nowrap text-right tabular-nums text-neutral-700")}>{fmtRp(p.totalOut)}</td>
                      <td className={cx(jTd, "whitespace-nowrap text-right font-semibold tabular-nums text-neutral-900")}>{fmtRp(p.approvedAmount ?? p.requestedAmount)}</td>
                      <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{wibDateTime(p.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {res && <CardFooter><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(all.length))} · {fmtRp(sum(cost(rows), (p) => p.requestedAmount ?? p.totalOut))}{rows.some((p) => p.kind === "INTERCOMPANY") ? ` · ${tr("between PTs {0}", fmtRp(sum(rows.filter((p) => p.kind === "INTERCOMPANY"), (p) => p.requestedAmount)))}` : ""}</span><PageNav paged={paged} /></CardFooter>}
      </WorkCard>

      {settings && <SettingsDrawer branches={branchOpts} onClose={() => setSettings(false)} onChanged={load} />}
      {sheet && <MonitorFilters value={f} bgroups={bgroups} branches={branchOpts} accounts={accountOpts} categories={Object.keys(res?.categories ?? {})}
        flagLabel={FLAG_LABEL} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <TeamDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

const KIND_TONE: Partial<Record<Kind, string>> = { PETTY_CASH: "bg-emerald-600", EMERGENCY: "bg-red-600", MARKETING: "bg-violet-600", EVENT: "bg-sky-600", BILL: "bg-amber-600" };
const PG_TONE: Record<Status, LozengeTone> = { DRAFT: "grey", SUBMITTED: "blue", REVISION: "amber", APPROVED: "cyan", PAID: "violet", VERIFYING: "amber", DONE: "green", REJECTED: "red", CANCELLED: "grey" };
function PgLozenge({ s }: { s: Status }) {
  return <Lozenge tone={PG_TONE[s]}>{STATUS_LABEL[s]()}</Lozenge>;
}

function StepWaiting({ p }: { p: Pengajuan }) {
  const today = wibDate();
  const days = (d: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86400000);
  if (p.status === "PAID" && p.proofDueOn) return <span className={cx("mt-0.5 block truncate text-[11px]", p.proofOverdue ? "font-semibold text-red-700" : "text-neutral-500")}>
    {p.proofOverdue ? tr("Proof overdue since {0}", wibDay(p.proofDueOn)) : tr("Proof due {0}", wibDay(p.proofDueOn))}</span>;
  if (p.status === "APPROVED" && p.neededOn) {
    const n = days(p.neededOn);
    return <span className={cx("mt-0.5 block truncate text-[11px]", n < 0 ? "font-semibold text-red-700" : n <= 3 ? "font-semibold text-amber-700" : "text-neutral-500")}>
      {n < 0 ? tr("Due date passed: {0}", wibDay(p.neededOn)) : n === 0 ? tr("Due today") : tr("Due {0}", wibDay(p.neededOn))}</span>;
  }
  if (!p.step || !["SUBMITTED", "APPROVED", "VERIFYING"].includes(p.status)) return null;
  return <span className="mt-0.5 block truncate text-[11px] text-neutral-500">{p.step.label} · {p.step.users.length ? p.step.users.join(", ") : "Superadmin"}</span>;
}

function Flags({ p }: { p: Pengajuan }) {
  const fl = flagged(p);
  if (!fl.reused && !fl.negative && !fl.opening && !fl.rejected && !fl.aboveRef) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {fl.reused && <Badge tone="amber" icon={<Copy size={10} />}>{tr("Receipt used twice")}</Badge>}
      {fl.negative && <Badge tone="red">{tr("Negative balance")}</Badge>}
      {fl.opening && <Badge tone="amber">{tr("Opening differs")}</Badge>}
      {fl.rejected && <Badge tone="red">{tr("Expense rejected")}</Badge>}
      {fl.aboveRef && <Badge tone="amber" title={tr("Above {0}× the outlet's weekly Simple Purchase ({1})", 2, fmtRp(p.purchaseAvgWeek))}>{tr("Above the purchase reference")}</Badge>}
    </span>
  );
}

function MonitorFilters({ value, bgroups, branches, accounts, categories, flagLabel, onClose, onApply }: {
  value: F; bgroups: GroupOpt[]; branches: { value: string; label: string }[]; accounts: { value: string; label: string }[]; categories: string[];
  flagLabel: Record<string, string>; onClose: () => void; onApply: (v: F) => void;
}) {
  const [v, setV] = useState<F>(value);
  return (
    <FilterSheet title={tr("Filters")} onClose={onClose} onReset={() => setV(NO_F())} onApply={() => onApply(v)}>
      <FilterSection title={tr("Sent in")} hint={tr("Open fund requests always show")}><PeriodField value={v.period} onChange={(period) => setV({ ...v, period })} maxDays={366} /></FilterSection>
      <FilterSection title={tr("Branch Group")}>
        <ChoiceGroup label="" value={v.bgroup} onChange={(bgroup) => setV({ ...v, bgroup })}
          choices={[{ value: "", label: tr("All") }, ...bgroups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a Group") }]} />
      </FilterSection>
      <FilterSection title={tr("Kind")}>
        <ChoiceGroup label="" value={v.kind} onChange={(kind) => setV({ ...v, kind: kind as F["kind"] })}
          choices={[{ value: "", label: tr("All") }, ...[...KINDS, "PERSONAL" as Kind, "VENDOR" as Kind, "INTERCOMPANY" as Kind, ...DE_KINDS].map((k) => ({ value: k, label: kindLabel(k) }))]} />
      </FilterSection>
      <FilterSection title={tr("Outlet")}><SearchChoice label="" anyLabel={tr("Every Outlet")} options={branches} value={v.branch} onChange={(branch) => setV({ ...v, branch })} placeholder={tr("Search outlet")} /></FilterSection>
      <FilterSection title={tr("Account")}><SearchChoice label="" anyLabel={tr("Every account")} options={accounts} value={v.account} onChange={(account) => setV({ ...v, account })} placeholder={tr("Search account")} /></FilterSection>
      <FilterSection title={tr("Expense Category")}>
        <ChoiceGroup label="" value={v.category} onChange={(category) => setV({ ...v, category })}
          choices={[{ value: "", label: tr("All") }, ...categories.map((c) => ({ value: c, label: (CATEGORY_LABEL[c] ?? (() => c))() }))]} />
      </FilterSection>
      <FilterSection title={tr("To Check")}>
        <ChoiceGroup label="" value={v.flag} onChange={(flag) => setV({ ...v, flag: flag as F["flag"] })}
          choices={[{ value: "", label: tr("All") }, ...Object.entries(flagLabel).map(([value, label]) => ({ value, label }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

/** One pengajuan for the team: the next step of the checker, the payment (Finance), every expense and the history. */
function TeamDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [p, setP] = useState<Pengajuan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState({ amount: "", on: wibDate() });
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const base = `/api/pengajuan/monitor/${id}`;
  useEffect(() => { call<Pengajuan>(base).then(setP).catch((e) => setError((e as Error).message)); }, [base]);
  useEffect(() => { if (p?.status === "APPROVED") setPaid((x) => (x.amount ? x : { ...x, amount: typeRp(p.approvedAmount) })); }, [p]);

  const changed = (next: Pengajuan) => { setP(next); onChanged(); };
  const go = async (to: Action) => {
    setBusy(true);
    try {
      changed(await call<Pengajuan>(`${base}/status`, { method: "POST", json: { to, note: note.trim() || null, paidAmount: to === "PAID" ? parseRp(paid.amount) : null, paidOn: to === "PAID" ? paid.on : null } }));
      setAction(null);
      setNote("");
      toast(ACTION_LABEL[to]());
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const review = async (lineId: number, r: "OK" | "REJECTED", n: string) => {
    try { changed(await call<Pengajuan>(`${base}/lines/${lineId}`, { method: "POST", json: { review: r, note: n || null } })); } catch (e) { toast((e as Error).message, "error"); throw e; }
  };
  const proof = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      for (const file of Array.from(list)) {
        const q = new URLSearchParams({ docType: "TRANSFER", name: file.name.slice(0, 150) });
        setP(await upload<Pengajuan>(`${base}/payment-files?${q}`, file));
      }
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const removeProof = async (fileId: string) => {
    try { setP(await call<Pengajuan>(`${base}/payment-files/${fileId}`, { method: "DELETE" })); } catch (e) { toast((e as Error).message, "error"); }
  };
  const addComment = async () => {
    try { setP(await call<Pengajuan>(`${base}/notes`, { method: "POST", json: { note: comment.trim() } })); setComment(""); } catch (e) { toast((e as Error).message, "error"); }
  };

  const next = p?.can?.next ?? [];
  const payment: PgFile[] = (p?.files ?? []).filter((x) => x.kind === "PAYMENT");
  const needNote = action === "REVISION" || action === "REJECTED" || action === "CANCELLED";
  return (
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardList size={18} />} title={p?.number ?? tr("Fund Request")}
      description={p ? `${placeOf(p)} · @${p.username} · ${wibDateTime(p.submittedAt)}` : undefined}
      titleExtra={p ? <StatusBadge s={p.status} /> : undefined}
      footer={p && next.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {action && (
            <div className="space-y-2">
              {action === "PAID" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">{tr("Amount transferred")}</span>
                    <input value={paid.amount} inputMode="numeric" onChange={(e) => setPaid({ ...paid, amount: typeRp(parseRp(e.target.value)) })} className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-neutral-600">{tr("Transfer date")}</span>
                    <input type="date" value={paid.on} max={wibDate()} onChange={(e) => setPaid({ ...paid, on: e.target.value })} className={cx(inputClass, "h-10")} /></label>
                </div>
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000}
                placeholder={needNote ? tr("Reason for the outlet (required)") : tr("Note (optional)")} className={cx(inputClass, "h-auto py-2 text-sm")} />
              {action === "PAID" && !payment.length && <p className="text-xs text-red-600">{tr("Attach the transfer proof above first")}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {action ? (
              <>
                <Button variant="secondary" onClick={() => { setAction(null); setNote(""); }} disabled={busy}>{tr("Cancel")}</Button>
                <Button variant={needNote ? "danger" : "primary"} loading={busy} disabled={(needNote && !note.trim()) || (action === "PAID" && (!payment.length || !parseRp(paid.amount)))}
                  onClick={() => void go(action)}><Send size={15} /> {ACTION_LABEL[action]()}</Button>
              </>
            ) : next.map((s) => (
              <Button key={s} variant={s === "REJECTED" ? "danger" : s === "CANCELLED" ? "ghost" : s === "REVISION" ? "secondary" : "primary"} onClick={() => setAction(s)}>{ACTION_LABEL[s]()}</Button>
            ))}
          </div>
        </div>
      ) : undefined}>
      {error ? <ErrorState message={error} /> : !p ? <SkeletonList rows={5} /> : (
        <div className="space-y-5">
          {p.can?.step && ["SUBMITTED", "APPROVED", "VERIFYING"].includes(p.status) && (
            <p className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700 ring-1 ring-neutral-200"><UserCheck size={14} className="flex-shrink-0 text-neutral-500" />
              {tr("Waiting at {0}: {1}", p.can.step, p.can.stepUsers.length ? p.can.stepUsers.join(", ") : "Superadmin")}{!p.can.next.length && !p.can.verify && ` · ${tr("not your step")}`}</p>
          )}
          {p.can?.reviewLines && (
            <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900"><AlertTriangle size={14} className="mt-px flex-shrink-0" />
              {tr("Check every line and its receipt. A rejected line is left out of the approved amount (lines accepted {0} now).", fmtRp(acceptedTotal(p.lines ?? [])))}</p>
          )}
          {p.can?.payment && (
            <section className="rounded-md border border-cyan-200 bg-cyan-50/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Wallet size={15} /> {tr("Payment: approved {0}", fmtRp(p.approvedAmount))}</p>
              {p.payer && <p className="mb-2 text-sm font-semibold text-cyan-900">{tr("Transfer from the account of {0}", p.payer)}</p>}
              <div className="flex flex-wrap items-end gap-2">
                {payment.map((x) => <FileChip key={x.id} f={x} onRemove={() => void removeProof(x.id)} />)}
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-xs font-medium text-white hover:bg-brand-800">
                  <Paperclip size={13} /> {tr("Attach transfer proof")}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => void proof(e.target.files)} />
                </label>
              </div>
            </section>
          )}
          <VerifyPanel p={p} base={base} onChanged={changed} />
          <ReceivePanel p={p} base={base} onChanged={changed} />
          {p.can?.refund && <RefundPanel p={p} base={base} onChanged={changed} />}
          <PengajuanView p={p} onReview={p.can?.reviewLines ? review : undefined} />
          <section>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><MessageSquareText size={15} className="text-neutral-500" /> {tr("Add a note to the history")}</p>
            <div className="flex gap-2">
              <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder={tr("Seen by the team and the outlet")} className={cx(inputClass, "h-10 min-w-0 flex-1 text-sm")} />
              <Button variant="secondary" disabled={!comment.trim()} onClick={() => void addComment()}>{tr("Add")}</Button>
            </div>
          </section>
        </div>
      )}
    </Drawer>
  );
}

export type StepEdit = { label: string; type: "APPROVE" | "PAY"; userIds: string[] };
export type Approver = { id: string; name: string; username: string; role: string; jobTitle: string | null };
type Settings = { kinds: Record<Kind, string>; flows: Record<string, { label: string; type: "APPROVE" | "PAY"; users: { id: string; name: string }[] }[]>;
  options: Record<OptionList, FundOption[]>; lists: Record<OptionList, string>; listDefaults?: Record<OptionList, string>; kindLabels?: Partial<Record<Kind, string>>; deptPlafon: { department: string; amount: number }[]; departments: string[]; canOptions: boolean;
  users: Approver[]; plafon: { default: number | null; branches: { branchCode: string; amount: number }[] }; canEdit: boolean; canPlafon: boolean;
  /** the life after the payment (migration 144) */ rules?: RuleRow[]; lifecycle?: Lifecycle; canRules?: boolean; proofDocs?: Record<string, string>;
  /** every outlet, for the plafon per outlet */ outlets?: { code: string; name: string }[]; units?: Unit[]; receivers?: Record<string, string[]> };

/** The approval steps of every kind (any number, in order, each with its users; then the payment) and the petty cash plafon. */
type View = { type: "flow"; key: string } | { type: "list"; list: OptionList } | { type: "plafon" } | { type: "dept" } | { type: "rules" } | { type: "units" };
const viewKey = (v: View) => (v.type === "flow" ? `flow:${v.key}` : v.type === "list" ? `list:${v.list}` : v.type);
const PURPOSE_TYPE: Record<string, { label: () => string; tone: LozengeTone }> = {
  "": { label: () => tr("Regular"), tone: "grey" }, ADVANCE: { label: () => tr("Cash in Advance"), tone: "blue" },
  SETTLEMENT: { label: () => tr("Settlement"), tone: "violet" },
};

/** Fund Request settings in the layout of a Jira project settings page (2026-11-20): a navigation on the left
 * (the approval flow of every outlet kind, the default personal flow and one per Keperluan Dana, the lists of the
 * personal form, the plafon) and the chosen part on the right; a list is a table with Create and an edit dialog. */
function SettingsDrawer({ branches, onClose, onChanged }: { branches: { value: string; label: string }[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ type: "flow", key: "PETTY_CASH" });
  const [steps, setSteps] = useState<StepEdit[]>([]);
  const [busy, setBusy] = useState(false);
  const [plafon, setPlafon] = useState({ branch: "", amount: "" });
  // renaming: an outlet kind, the title of a list (LIST:<list>) or a Keperluan Dana (its edit dialog)
  const [renaming, setRenaming] = useState<{ code: string; current: string; fallback: string } | FundOption | null>(null);
  const load = useCallback(async () => {
    try { const d = await call<Settings>("/api/pengajuan/settings"); setKindLabels(d.kindLabels); setData(d); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // the flow of one unit ("<kind>@<unit>"); "" = the flow of every unit without its own
  const [flowUnit, setFlowUnit] = useState("");
  const kind = view.type === "flow" ? view.key : "";
  const flowKey = flowUnit ? `${kind}@${flowUnit}` : kind;
  const ownFlow = !!(kind && data?.flows[flowKey]?.length);
  useEffect(() => {
    if (!data || !kind) return;
    const saved = (ownFlow ? data.flows[flowKey] : data.flows[kind]?.length ? data.flows[kind] : data.flows[kind.startsWith("PERSONAL") ? "PERSONAL" : kind] ?? [])
      .map((x) => ({ label: x.label, type: x.type, userIds: x.users.map((u) => u.id) }));
    // a kind without a flow yet (Maintenance & Procurement, 2026-11-22) starts with one approval and the payment: the
    // backend needs both, saving the payment alone was refused (422)
    setSteps(saved.length ? saved : [{ label: tr("Approval {0}", 1), type: "APPROVE", userIds: [] }, { label: tr("Payment"), type: "PAY", userIds: [] }]);
  }, [data, kind, flowKey, ownFlow]);
  const purposes = data?.options.PURPOSE ?? [];
  const nav: { title: string; hint: string; icon: React.ReactNode; items: { view: View; label: string; count?: number; muted?: boolean }[] }[] = [
    { title: tr("Approval Flow · Outlet"), hint: tr("Who approves each outlet request"), icon: <Store size={13} />, items: KINDS.map((k) => ({ view: { type: "flow", key: k }, label: kindLabel(k) })) },
    { title: tr("Approval Flow · Maintenance & Procurement"), hint: tr("Who approves the funds of the team's requests"), icon: <Wrench size={13} />,
      items: DE_KINDS.map((k) => ({ view: { type: "flow", key: k }, label: kindLabel(k) })) },
    { title: tr("Approval Flow · Personal"), hint: tr("One flow per purpose of funds"), icon: <UserRound size={13} />, items: [{ view: { type: "flow", key: "PERSONAL" }, label: tr("Default Flow") },
      ...purposes.filter((o) => o.isActive).map((o) => ({ view: { type: "flow", key: `PERSONAL:${o.id}` } as View, label: o.name, muted: !data?.flows[`PERSONAL:${o.id}`]?.length }))] },
    { title: tr("Approval Flow · Vendor"), hint: tr("Vendor payments of Roastery, Warehouse and Central Kitchen"), icon: <Wallet size={13} />, items: [{ view: { type: "flow", key: "VENDOR" }, label: kindLabel("VENDOR") }, { view: { type: "flow", key: "INTERCOMPANY" }, label: kindLabel("INTERCOMPANY") }] },
    { title: tr("Business unit"), hint: tr("The PT that pays every unit"), icon: <Store size={13} />, items: [{ view: { type: "units" }, label: tr("Paying PT") }] },
    { title: tr("Rules"), hint: tr("Proof, due date and vendor payments"), icon: <CheckCircle2 size={13} />, items: [{ view: { type: "rules" }, label: tr("Rules after the payment") }] },
    { title: tr("Personal Form Lists"), hint: tr("The choices on the personal form"), icon: <ListChecks size={13} />, items: (Object.keys(data?.lists ?? {}) as OptionList[]).map((l) => ({ view: { type: "list", list: l }, label: data!.lists[l], count: data!.options[l].length })) },
    { title: tr("Plafon"), hint: tr("The most that can be asked"), icon: <Wallet size={13} />, items: [{ view: { type: "plafon" }, label: tr("Outlet Petty Cash") }, { view: { type: "dept" }, label: tr("Department Plafon") }] },
  ];
  const current = nav.flatMap((g) => g.items).find((i) => viewKey(i.view) === viewKey(view));
  const group = nav.find((g) => g.items.some((i) => viewKey(i.view) === viewKey(view)));
  const names = useMemo(() => new Map((data?.users ?? []).map((u) => [u.id, u.name])), [data]);
  const outletOpts = useMemo(() => (data?.outlets?.length ? data.outlets.map((o) => ({ value: o.code, label: o.name })) : branches), [data, branches]);
  const branchName = (code: string) => outletOpts.find((b) => b.value === code)?.label ?? code;
  const approvals = steps.filter((x) => x.type === "APPROVE");
  const pay = steps.find((x) => x.type === "PAY") ?? { label: tr("Payment"), type: "PAY" as const, userIds: [] };
  const setApprovals = (list: StepEdit[]) => setSteps([...list, pay]);
  const save = async () => {
    setBusy(true);
    try {
      await call(`/api/pengajuan/settings/flow/${encodeURIComponent(flowKey)}`, { method: "PUT", json: { steps } });
      await load();
      onChanged();
      toast(tr("Approvals of {0} saved", current?.label ?? kind));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const dropUnitFlow = async () => {
    setBusy(true);
    try { await call(`/api/pengajuan/settings/flow/${encodeURIComponent(flowKey)}`, { method: "PUT", json: { steps: [] } }); await load(); onChanged(); toast(tr("The flow of every unit applies again")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const copyToAll = async () => {
    setBusy(true);
    try {
      for (const k of KINDS) await call(`/api/pengajuan/settings/flow/${k}`, { method: "PUT", json: { steps } });
      await load();
      onChanged();
      toast(tr("The same approvals for every kind"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const savePlafon = async (branchCode: string, amount: number | null) => {
    try {
      const r = await call<Settings["plafon"]>("/api/pengajuan/settings/plafon", { method: "PUT", json: { branchCode, amount } });
      setData((d) => (d ? { ...d, plafon: r } : d));
      setPlafon({ branch: "", amount: "" });
      toast(tr("Plafon saved"));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const edit = !!data?.canEdit;
  const personalFlow = kind.startsWith("PERSONAL");
  return (
    <Drawer open onClose={onClose} size="xl" icon={<Settings2 size={18} />} title={tr("Configurations")}
      description={tr("Fund Request: approval flows, the choices of the personal form and the plafon")}
      footer={edit && view.type === "flow" ? <div className="flex w-full flex-wrap justify-end gap-2">
        {!personalFlow && !flowUnit && <Button variant="secondary" disabled={busy} onClick={() => void copyToAll()}>{tr("Use for Every Kind")}</Button>}
        <Button loading={busy} onClick={() => void save()}>{tr("Save approvals of {0}", current?.label ?? "")}</Button>
      </div> : undefined}>
      {error ? <ErrorState message={error} /> : !data ? <SkeletonList rows={5} /> : (
        <div className="grid gap-5 sm:grid-cols-[16rem_minmax(0,1fr)]">
          {/* the navigation of the settings (a select on a phone) */}
          <nav className="hidden space-y-5 border-r border-neutral-200 pr-3 sm:block" aria-label={tr("Configurations")}>
            {nav.map((g) => (
              <div key={g.title}>
                <p className="flex items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
                  <span className="text-neutral-400">{g.icon}</span>{g.title}</p>
                <p className="mb-1.5 px-2 pl-[1.6rem] text-[11px] text-neutral-400">{g.hint}</p>
                <ul className="space-y-px">
                  {g.items.map((i) => {
                    const on = viewKey(i.view) === viewKey(view);
                    return (
                      <li key={viewKey(i.view)}>
                        <button type="button" onClick={() => setView(i.view)} aria-current={on ? "page" : undefined}
                          className={cx("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]",
                            on ? "bg-brand-50 font-medium text-brand-800" : "text-neutral-700 hover:bg-neutral-100")}>
                          <span className={cx("min-w-0 flex-1 truncate", i.muted && !on && "text-neutral-500")}>{i.label}</span>
                          {i.count !== undefined && <span className="rounded-full bg-neutral-200/70 px-1.5 text-[11px] tabular-nums text-neutral-600">{i.count}</span>}
                          {i.muted && <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" title={tr("Uses the default flow")} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className="sm:hidden">
            <NativeSelect value={viewKey(view)} aria-label={tr("Settings")} className={cx(inputClass, "h-10 w-full")}
              onChange={(e) => { const i = nav.flatMap((g) => g.items).find((x) => viewKey(x.view) === e.target.value); if (i) setView(i.view); }}>
              {nav.flatMap((g) => g.items.map((i) => <option key={viewKey(i.view)} value={viewKey(i.view)}>{`${g.title} — ${i.label}`}</option>))}
            </NativeSelect>
          </div>

          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-1 text-[11px] text-neutral-500">{tr("Configurations")}<ChevronRight size={11} />{group?.title}</p>
            {view.type === "flow" && (
              <section className="space-y-4">
                <PanelHead title={current?.label ?? ""} action={data.canOptions && kind !== "PERSONAL"
                  ? <Button variant="secondary" size="sm" onClick={() => setRenaming(personalFlow
                    ? purposes.find((o) => `PERSONAL:${o.id}` === kind) ?? null
                    : { code: kind, current: kindLabel(kind as Kind), fallback: KIND_LABEL[kind as Kind]?.() ?? kind })}>{tr("Rename")}</Button> : undefined} text={personalFlow
                  ? tr("The approvers of this purpose of funds, in order, then the payment by Finance.")
                  : tr("Who approves this kind of outlet request, in order, then the payment by Finance.")} />
                <div className="flex flex-wrap items-center gap-2">
                  <QuickChips label={tr("Business unit")} value={flowUnit} onChange={setFlowUnit} items={[{ key: "", label: tr("Every unit") },
                    ...(data.units ?? []).filter((u) => (kind !== "VENDOR" && kind !== "INTERCOMPANY") || u.vendor).map((u) => ({ key: u.code, label: u.name, dot: data.flows[`${kind}@${u.code}`]?.length ? "bg-brand-600" : undefined }))]} />
                  {flowUnit && ownFlow && edit && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void dropUnitFlow()}>{tr("Use the flow of every unit")}</Button>}
                </div>
                {flowUnit && !ownFlow && <p className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{tr("This unit follows the flow of every unit. Saving here gives it its own.")}</p>}
                {!flowUnit && personalFlow && kind !== "PERSONAL" && !ownFlow && (
                  <p className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">{tr("No flow of its own yet: the default personal flow applies. Saving here gives it its own.")}</p>
                )}
                {!edit && <p className="text-xs text-neutral-500">{tr("Only a superadmin changes the approvals.")}</p>}
                <ol className="space-y-2">
                  {approvals.map((st, i) => (
                    <StepRow key={i} n={i + 1} step={st} users={data.users} names={names} edit={edit}
                      onChange={(x) => setApprovals(approvals.map((y, j) => (j === i ? x : y)))}
                      onUp={i > 0 ? () => { const l = [...approvals]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setApprovals(l); } : undefined}
                      onDown={i < approvals.length - 1 ? () => { const l = [...approvals]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setApprovals(l); } : undefined}
                      onRemove={approvals.length > 1 ? () => setApprovals(approvals.filter((_, j) => j !== i)) : undefined} />
                  ))}
                  {edit && approvals.length < 8 && (
                    <li><Button variant="secondary" className="w-full" onClick={() => setApprovals([...approvals, { label: tr("Approval {0}", approvals.length + 1), type: "APPROVE", userIds: [] }])}>
                      <Plus size={15} /> {tr("Add approval step")}</Button></li>
                  )}
                  <StepRow n={approvals.length + 1} step={pay} users={data.users} names={names} edit={edit} payment
                    onChange={(x) => setSteps([...approvals, x])} />
                </ol>
                <p className="text-xs text-neutral-500">{tr("Every step is approved in order by one of its users; a step without users is taken by a superadmin. The approvers get the Monitoring → Fund requests page.")}</p>
              </section>
            )}

            {view.type === "list" && <OptionTable data={data} list={view.list} onChanged={() => void load()}
              onRename={() => setRenaming({ code: `LIST:${view.list}`, current: data.lists[view.list], fallback: data.listDefaults?.[view.list] ?? data.lists[view.list] })}
              onFlow={(o) => setView({ type: "flow", key: `PERSONAL:${o.id}` })} />}

            {view.type === "plafon" && (
              <section className="space-y-3">
                <PanelHead title={tr("Outlet Petty Cash")} text={tr("The weekly top-up brings the cash of the outlet back to its plafon. An outlet without its own plafon uses the one of every outlet.")} />
                {data.canPlafon && <Suggestions onApplied={(pl) => setData((d) => (d ? { ...d, plafon: pl } : d))} />}
                <PlafonRow label={tr("Every Outlet")} amount={data.plafon.default} edit={data.canPlafon} onSave={(a) => void savePlafon("*", a)} />
                {data.plafon.branches.map((b) => (
                  <PlafonRow key={b.branchCode} label={branchName(b.branchCode)} amount={b.amount} edit={data.canPlafon} onSave={(a) => void savePlafon(b.branchCode, a)} removable />
                ))}
                {data.canPlafon && (
                  <div className="grid gap-2 rounded-md border border-dashed border-neutral-300 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                    <SearchChoice label="" anyLabel={tr("Choose the outlet")} options={outletOpts.filter((b) => !data.plafon.branches.some((x) => x.branchCode === b.value))}
                      value={plafon.branch} onChange={(branch) => setPlafon({ ...plafon, branch })} placeholder={tr("Search outlet")} />
                    <input value={plafon.amount} inputMode="numeric" placeholder="Rp" onChange={(e) => setPlafon({ ...plafon, amount: typeRp(parseRp(e.target.value)) })}
                      className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} aria-label={tr("Plafon")} />
                    <Button disabled={!plafon.branch || parseRp(plafon.amount) === null} onClick={() => void savePlafon(plafon.branch, parseRp(plafon.amount))}>{tr("Add")}</Button>
                  </div>
                )}
              </section>
            )}

            {view.type === "rules" && data.rules && data.lifecycle && <RulesPanel rules={data.rules} lifecycle={data.lifecycle} docs={data.proofDocs ?? {}} edit={!!data.canRules} onChanged={() => void load()} />}
            {view.type === "units" && <UnitsPanel users={data.users} names={names} receivers={data.receivers ?? {}} admin={data.canEdit} units={data.units ?? []} edit={!!data.canRules} onChanged={() => void load()} />}
            {view.type === "dept" && <DeptPlafon data={data} onChanged={() => void load()} />}
            {renaming && "code" in renaming && <RenameKind {...renaming} onClose={() => setRenaming(null)}
              onSaved={() => { setRenaming(null); void load(); onChanged(); }} />}
            {renaming && "list" in renaming && <OptionDialog list="PURPOSE" label={data.lists.PURPOSE} option={renaming}
              onClose={() => setRenaming(null)} onSaved={() => { setRenaming(null); void load(); onChanged(); }} />}
          </div>
        </div>
      )}
    </Drawer>
  );
}

/** The PT that pays every unit; requests already sent keep the PT they were sent with. */
function UnitsPanel({ units, edit, onChanged, users, names, receivers, admin }: { units: Unit[]; edit: boolean; onChanged: () => void; users: Approver[]; names: Map<string, string>;
  receivers: Record<string, string[]>; admin: boolean }) {
  const toast = useToast();
  const save = async (u: Unit, payer: string) => {
    if (!payer.trim() || payer.trim() === u.payer) return;
    try { await call(`/api/pengajuan/settings/units/${u.code}`, { method: "PUT", json: { payer: payer.trim() } }); toast(tr("Saved")); onChanged(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const setReceivers = async (payer: string, userIds: string[]) => {
    try { await call("/api/pengajuan/settings/receivers", { method: "PUT", json: { payer, userIds } }); toast(tr("Saved")); onChanged(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const history = async (f: File | undefined) => {
    if (!f) return;
    try { const r = await upload<{ rows: number; added: number; total: number }>("/api/pengajuan/vendor/history", f); toast(tr("{0} invoices added ({1} known)", r.added, r.total)); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <section className="space-y-3">
      <PanelHead title={tr("Paying PT")} text={tr("The account each unit is paid from. Requests already sent keep the PT they were sent with.")} />
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className={cx(jTable, "min-w-[460px]")}>
          <thead><tr className={jHeadRow}><th className={jTh}>{tr("Business unit")}</th><th className={jTh}>{tr("Paid from")}</th></tr></thead>
          <tbody>{units.map((u) => (
            <tr key={u.code} className="border-b border-neutral-100">
              <td className={cx(jTd, "font-medium text-neutral-900")}><span className="flex items-center gap-2.5"><span className="flex h-8 w-14 flex-shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {LOGOS[u.code] && <img src={LOGOS[u.code]} alt="" aria-hidden className="max-h-8 max-w-full object-contain" />}</span>{u.name}</span></td>
              <td className={jTd}><input defaultValue={u.payer} disabled={!edit} maxLength={80} aria-label={tr("Paid from")} onBlur={(e) => void save(u, e.target.value)} className={cx(inputClass, "h-9 text-sm")} /></td>
            </tr>))}</tbody>
        </table>
      </div>
      {!edit && <p className="text-xs text-neutral-500">{tr("Only management or Finance changes these rules.")}</p>}
      <PanelHead title={tr("Who confirms the money a PT receives")} text={tr("Between PTs: the request is done once one of them confirms; none = a superadmin. Who recorded the payment never confirms it.")} />
      <ol className="space-y-2">
        {[...new Set(units.map((u) => u.payer))].map((payer, i) => (
          <StepRow key={payer} n={i + 1} step={{ label: payer, type: "APPROVE", userIds: receivers[payer] ?? [] }} users={users} names={names} edit={admin} fixedName
            onChange={(x) => void setReceivers(payer, x.userIds)} />
        ))}
      </ol>
      {edit && (
        <>
          <PanelHead title={tr("Already paid through the Google Form")} text={tr("Upload the recap of what was paid there: the same account, invoice number and amount is refused here, so nothing is paid twice while both are used.")}
            action={<label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50"><Plus size={13} /> {tr("Upload recap")}
              <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { void history(e.target.files?.[0]); e.target.value = ""; }} /></label>} />
        </>
      )}
    </section>
  );
}

/** Rename an outlet kind (Weekly Petty Cash, Marketing & Promo …) or the title of a list of the personal form
 * (code LIST:<list>); empty = back to the default name. */
function RenameKind({ code, current, fallback, onClose, onSaved }: { code: string; current: string; fallback: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call<{ kindLabels: Partial<Record<Kind, string>> }>(`/api/pengajuan/settings/kind-label/${encodeURIComponent(code)}`,
        { method: "PUT", json: { label: name.trim() && name.trim() !== fallback ? name.trim() : null } });
      setKindLabels(r.kindLabels);
      toast(tr("Name saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={tr("Rename")} description={tr("Shown on the form, the monitoring and the exports. Empty: the default name.")}
      footer={<div className="flex w-full justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} onClick={() => void submit()}>{tr("Save")}</Button></div>}>
      <Field label={tr("Name of {0}", fallback)} hint={tr("Default name: {0}", fallback)}>
        <input autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          className={cx(inputClass, "h-10")} /></Field>
    </Dialog>
  );
}

function PanelHead({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-200 pb-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {text && <p className="mt-0.5 max-w-xl text-xs text-neutral-500">{text}</p>}
      </div>
      {action}
    </div>
  );
}

/** One list of the personal form as a Jira table: name, (Keperluan Dana: type, rules, approval flow), status;
 * Create and a row open the edit dialog. An option in use is switched off, never deleted. */
function OptionTable({ data, list, onChanged, onFlow, onRename }: { data: Settings; list: OptionList; onChanged: () => void; onFlow: (o: FundOption) => void; onRename: () => void }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"active" | "inactive" | "all">("active");
  const [editing, setEditing] = useState<FundOption | "new" | null>(null);
  const edit = data.canOptions;
  const purpose = list === "PURPOSE";
  const toast = useToast();
  // dragged order, shown at once and saved on drop; the arrow keys on the handle do the same
  const [order, setOrder] = useState<number[] | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const base = data.options[list];
  const all = order ? [...base].sort((a, b) => (order.indexOf(a.id) + 1 || 1e6) - (order.indexOf(b.id) + 1 || 1e6)) : base;
  const move = async (id: number, to: number) => {
    const ids = all.map((o) => o.id);
    const a = ids.indexOf(id), z = ids.indexOf(to);
    if (a < 0 || z < 0 || a === z) return;
    ids.splice(z, 0, ...ids.splice(a, 1));
    setOrder(ids);
    try { await call("/api/pengajuan/settings/options/order", { method: "PUT", json: { list, ids } }); onChanged(); }
    catch (e) { setOrder(null); toast((e as Error).message, "error"); }
  };
  const step = (id: number, d: -1 | 1) => { const i = rows.findIndex((o) => o.id === id); const t = rows[i + d]; if (t) void move(id, t.id); };
  const rows = all.filter((o) => (show === "all" || (show === "active") === o.isActive) && (!q.trim() || o.name.toLowerCase().includes(q.trim().toLowerCase())));
  const steps = (o: FundOption) => data.flows[`PERSONAL:${o.id}`]?.filter((x) => x.type === "APPROVE").length ?? 0;
  const HINT: Record<OptionList, string> = {
    PURPOSE: tr("What a person asks the money for. Each purpose has its own rules and approval flow."),
    TRANSACTION: tr("The kind of transaction picked on the personal form."),
    PROJECT: tr("The projects a personal request can be charged to."),
    ACCOUNT: tr("The kinds of destination account (personal, VA, credit card …)."),
  };
  return (
    <section className="space-y-3">
      <PanelHead title={data.lists[list]} text={HINT[list]}
        action={edit ? <span className="flex gap-2"><Button variant="secondary" onClick={onRename}>{tr("Rename")}</Button>
          <Button onClick={() => setEditing("new")}><Plus size={15} /> {tr("Create")}</Button></span> : undefined} />
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search {0}", data.lists[list].toLowerCase())} aria-label={tr("Search")}
          className={cx(inputClass, "h-9 w-full max-w-xs text-sm")} />
        <QuickChips label={tr("Status")} value={show} onChange={setShow} items={[
          { key: "active", label: tr("Active"), count: all.filter((o) => o.isActive).length },
          { key: "inactive", label: tr("Inactive"), count: all.filter((o) => !o.isActive).length },
          { key: "all", label: tr("All"), count: all.length }]} />
      </div>
      <div className="overflow-x-auto rounded border border-neutral-200">
        <table className={cx(jTable, "min-w-[520px]")}>
          <thead><tr className={jHeadRow}>
            <th className={jTh}>{tr("Name")}</th>
            {purpose && <><th className={jTh}>{tr("Type")}</th><th className={jTh}>{tr("Rules")}</th><th className={jTh}>{tr("Approval")}</th></>}
            <th className={jTh}>{tr("Status")}</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={purpose ? 5 : 2} className="px-4 py-8 text-center text-sm text-neutral-400">
              {all.length ? tr("Nothing matches") : tr("Nothing yet: press Create")}</td></tr>}
            {rows.map((o) => {
              const t = PURPOSE_TYPE[o.settings.type ?? ""] ?? PURPOSE_TYPE[""];
              const n = steps(o);
              return (
                <tr key={o.id} className={cx(jRow, drag === o.id && "opacity-40", over === o.id && drag !== o.id && "bg-brand-50")} onClick={() => edit && setEditing(o)}
                  onDragOver={(e) => { if (drag != null) { e.preventDefault(); setOver(o.id); } }}
                  onDrop={(e) => { e.preventDefault(); if (drag != null) void move(drag, o.id); setDrag(null); setOver(null); }}>
                  <td className={jTd}>{edit && <button type="button" draggable aria-label={tr("Move {0}: drag, or the arrow keys", o.name)} title={tr("Drag to order")}
                    onClick={(e) => e.stopPropagation()} onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(o.id)); setDrag(o.id); }}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); step(o.id, e.key === "ArrowUp" ? -1 : 1); } }}
                    className="mr-1.5 inline-flex cursor-grab align-middle text-neutral-300 hover:text-neutral-600 active:cursor-grabbing"><GripVertical size={15} /></button>}<span className={cx(edit ? jKey : "font-medium text-neutral-900", !o.isActive && "text-neutral-400 no-underline")}>{o.name}</span></td>
                  {purpose && <>
                    <td className={jTd}><Lozenge tone={t.tone}>{t.label()}</Lozenge></td>
                    <td className={jTd}><span className="flex gap-1 whitespace-nowrap">
                      {o.settings.receipt && <Lozenge tone="amber">{tr("Receipt")}</Lozenge>}
                      {o.settings.outlet && <Lozenge tone="cyan">{tr("Outlet")}</Lozenge>}
                      {o.settings.deptPlafon && <Lozenge tone="red">{tr("Plafon")}</Lozenge>}
                      {!o.settings.receipt && !o.settings.outlet && !o.settings.deptPlafon && <span className="text-neutral-400">—</span>}
                    </span></td>
                    <td className={jTd}><button type="button" onClick={(e) => { e.stopPropagation(); onFlow(o); }} className="whitespace-nowrap text-xs font-medium text-brand-700 hover:underline">
                      {n ? tr("{0} steps", n) : tr("Default Flow")}</button></td>
                  </>}
                  <td className={jTd}><Lozenge tone={o.isActive ? "green" : "grey"}>{o.isActive ? tr("Active") : tr("Inactive")}</Lozenge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!edit && <p className="text-xs text-neutral-500">{tr("Only a superadmin or admin changes these lists.")}</p>}
      {editing && <OptionDialog list={list} label={data.lists[list]} option={editing === "new" ? null : editing}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </section>
  );
}

/** Create or edit one option (Jira "Create" dialog): its name; a Keperluan Dana also its type and rules; switching
 * it off keeps the requests that used it. */
function OptionDialog({ list, label, option, onClose, onSaved }: { list: OptionList; label: string; option: FundOption | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(option?.name ?? "");
  const [type, setType] = useState<string>(option?.settings.type ?? "");
  const [rules, setRules] = useState({ receipt: !!option?.settings.receipt, outlet: !!option?.settings.outlet, deptPlafon: !!option?.settings.deptPlafon });
  const [active, setActive] = useState(option?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const purpose = list === "PURPOSE";
  const settings = purpose ? { ...rules, type: type || null } : {};
  const submit = async () => {
    setBusy(true);
    try {
      if (option) await call(`/api/pengajuan/settings/options/${option.id}`, { method: "PATCH", json: { name: name.trim(), isActive: active, settings } });
      else await call("/api/pengajuan/settings/options", { method: "POST", json: { list, name: name.trim(), settings } });
      toast(option ? tr("Saved") : tr("{0} created", name.trim()));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await call(`/api/pengajuan/settings/options/${option!.id}`, { method: "DELETE" }); toast(tr("Deleted")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const rule = (key: keyof typeof rules, title: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-3 rounded border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50">
      <input type="checkbox" className="mt-0.5" checked={rules[key]} onChange={(e) => setRules({ ...rules, [key]: e.target.checked })} />
      <span><span className="block text-sm font-medium text-neutral-900">{title}</span><span className="block text-xs text-neutral-500">{hint}</span></span>
    </label>
  );
  return (
    <Dialog open onClose={onClose} size="md" title={option ? tr("Edit {0}", label) : tr("Create {0}", label)}
      description={purpose ? tr("The name shown on the form, its type and the rules checked before sending.") : undefined}
      footer={<div className="flex w-full justify-end gap-2">
        {option && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} title={tr("Only when never used; otherwise switch it off")} onClick={() => void remove()}><Trash2 size={14} /> {tr("Delete")}</Button>}
        <Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!name.trim()} onClick={() => void submit()}>{option ? tr("Save") : tr("Create")}</Button>
      </div>}>
      <div className="space-y-4">
        <Field label={tr("Name")} required>
          <input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim() && !purpose) void submit(); }}
            className={cx(inputClass, "h-10")} /></Field>
        {purpose && <>
          <Field label={tr("Type")} hint={type === "ADVANCE" ? tr("Paid ahead; the proof and the amount spent follow in the same request") : type === "SETTLEMENT" ? tr("Picks the Cash in Advance it settles and shows the difference") : tr("A normal request")}>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label={tr("Type")} className={cx(inputClass, "h-10 w-full")}>
              <option value="">{tr("Regular")}</option><option value="ADVANCE">{tr("Cash in Advance")}</option><option value="SETTLEMENT">{tr("Settlement of a Cash in Advance")}</option>
            </NativeSelect></Field>
          <div className="space-y-2">
            <p className="text-xs font-medium text-neutral-600">{tr("Rules")}</p>
            {rule("receipt", tr("Receipt required"), tr("A bill, receipt or photo must be attached before sending"))}
            {rule("outlet", tr("Outlet required"), tr("The request must name the outlet it is for"))}
            {rule("deptPlafon", tr("Department plafon"), tr("Refused above the plafon of the requester's department (set in Plafon → Department)"))}
          </div>
        </>}
        {option && (
          <label className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2.5">
            <span><span className="block text-sm font-medium text-neutral-900">{tr("Active")}</span>
              <span className="block text-xs text-neutral-500">{tr("Inactive: no longer on the form; requests that used it keep it")}</span></span>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} aria-label={tr("Active")} />
          </label>
        )}
      </div>
    </Dialog>
  );
}

/** The plafon per department for the purposes with the Department plafon rule (empty: no limit). */
function DeptPlafon({ data, onChanged }: { data: Settings; onChanged: () => void }) {
  const toast = useToast();
  const [dept, setDept] = useState({ department: "", amount: "" });
  const edit = data.canOptions;
  const put = async (department: string, amount: number | null) => {
    try { await call("/api/pengajuan/settings/dept-plafon", { method: "PUT", json: { department, amount } }); toast(tr("Plafon saved")); onChanged(); setDept({ department: "", amount: "" }); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <section className="space-y-3">
      <PanelHead title={tr("Department plafon")} text={tr("The most a department may ask at once for a purpose marked Department plafon. Empty: no limit.")} />
      {data.deptPlafon.length === 0 && <p className="rounded border border-neutral-200 px-3 py-6 text-center text-sm text-neutral-400">{tr("No department has a plafon: no limit")}</p>}
      {data.deptPlafon.map((d) => <PlafonRow key={d.department} label={d.department} amount={d.amount} edit={edit} removable onSave={(a) => void put(d.department, a)} />)}
      {edit && (
        <div className="grid gap-2 rounded-md border border-dashed border-neutral-300 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <NativeSelect value={dept.department} onChange={(e) => setDept({ ...dept, department: e.target.value })} aria-label={tr("Department")} className={cx(inputClass, "h-10")}>
            <option value="">{tr("Choose the department")}</option>
            {data.departments.filter((d) => !data.deptPlafon.some((x) => x.department === d)).map((d) => <option key={d} value={d}>{d}</option>)}
          </NativeSelect>
          <input value={dept.amount} inputMode="numeric" placeholder="Rp" onChange={(e) => setDept({ ...dept, amount: typeRp(parseRp(e.target.value)) })}
            className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} aria-label={tr("Plafon")} />
          <Button disabled={!dept.department || parseRp(dept.amount) === null} onClick={() => void put(dept.department, parseRp(dept.amount))}>{tr("Add")}</Button>
        </div>
      )}
    </section>
  );
}

export function StepRow({ n, step, users, names, edit, payment, fixedName, onChange, onUp, onDown, onRemove }: { n: number; step: StepEdit; users: Approver[];
  names: Map<string, string>; edit: boolean; payment?: boolean; /** the name is not edited (a PT) */ fixedName?: boolean; onChange: (s: StepEdit) => void; onUp?: () => void; onDown?: () => void; onRemove?: () => void }) {
  const [pick, setPick] = useState("");
  return (
    <li className={cx("rounded-md border p-3", payment ? "border-cyan-200 bg-cyan-50/40" : "border-neutral-200 bg-white")}>
      <div className="flex items-center gap-2">
        <span className={cx("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", payment ? "bg-cyan-600" : "bg-brand-600")}>{n}</span>
        {edit && !fixedName ? <input value={step.label} maxLength={60} onChange={(e) => onChange({ ...step, label: e.target.value })} aria-label={tr("Step Name")}
          className={cx(inputClass, "h-9 min-w-0 flex-1 text-sm font-semibold")} /> : <p className="flex-1 text-sm font-semibold text-neutral-900">{step.label}</p>}
        {payment && <Badge tone="cyan">{tr("Payment")}</Badge>}
        {edit && onUp && <button type="button" onClick={onUp} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100" aria-label={tr("Move Up")}><ArrowUp size={15} /></button>}
        {edit && onDown && <button type="button" onClick={onDown} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100" aria-label={tr("Move Down")}><ArrowDown size={15} /></button>}
        {edit && onRemove && <button type="button" onClick={onRemove} className="rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove Step")}><Trash2 size={15} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {step.userIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-2.5 pr-1 text-xs font-medium text-neutral-700">
            {names.get(id) ?? id}
            {edit && <button type="button" onClick={() => onChange({ ...step, userIds: step.userIds.filter((x) => x !== id) })} className="rounded-full p-0.5 hover:bg-white" aria-label={tr("Remove {0}", names.get(id) ?? "")}>×</button>}
          </span>
        ))}
        {!step.userIds.length && <span className="text-xs text-neutral-400">{tr("No user yet: a superadmin takes this step")}</span>}
      </div>
      {edit && (
        <div className="mt-2">
          {/* a compact dropdown (2026-10-30: the open list made the panel long); typing the first letters jumps to a name */}
          <JSelect value={pick} label={tr("Add an Approver")} placeholder={tr("+ Add an approver ({0} users)", users.filter((u) => !step.userIds.includes(u.id)).length)}
            onChange={(id) => { if (id) onChange({ ...step, userIds: [...step.userIds, id] }); setPick(""); }}
            options={users.filter((u) => !step.userIds.includes(u.id)).map((u) => ({ value: u.id, label: u.name, hint: u.jobTitle ? `@${u.username} · ${u.jobTitle}` : `@${u.username}` }))} />
        </div>
      )}
    </li>
  );
}

function PlafonRow({ label, amount, edit, removable, onSave }: { label: string; amount: number | null; edit: boolean; removable?: boolean; onSave: (a: number | null) => void }) {
  const [v, setV] = useState(typeRp(amount));
  useEffect(() => setV(typeRp(amount)), [amount]);
  const changed = parseRp(v) !== amount;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">{label}</p>
      {edit ? <>
        <input value={v} inputMode="numeric" placeholder={tr("No plafon")} onChange={(e) => setV(typeRp(parseRp(e.target.value)))} aria-label={tr("Plafon {0}", label)}
          className={cx(inputClass, "h-9 w-36 text-right font-semibold tabular-nums")} />
        {changed && <Button onClick={() => onSave(parseRp(v))}>{tr("Save")}</Button>}
        {removable && <button type="button" onClick={() => onSave(null)} className="rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><Trash2 size={15} /></button>}
      </> : <span className="text-sm font-semibold tabular-nums text-neutral-900">{fmtRp(amount)}</span>}
    </div>
  );
}

type Suggestion = { code: string; name: string; avgWeek: number; suggested: number | null; current: number | null };

/** A plafon per outlet from its own Simple Purchase in ESB (weekly average × factor, rounded up): Finance picks the
 * outlets (by default those without a plafon), applies, then adjusts one by one (2026-10-30). */
function Suggestions({ onApplied }: { onApplied: (p: Settings["plafon"]) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [factor, setFactor] = useState("1.2");
  const [rows, setRows] = useState<Suggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (fct: string) => {
    setRows(null);
    try {
      const r = await call<{ data: Suggestion[] }>(`/api/pengajuan/settings/plafon-suggestions?factor=${Number(fct) || 1.2}`);
      setRows(r.data);
      setPicked(new Set(r.data.filter((x) => x.suggested && x.current === null).map((x) => x.code)));
    } catch (e) { toast((e as Error).message, "error"); }
  }, [toast]);
  useEffect(() => { if (open) void load(factor); }, [open, factor, load]);
  const apply = async () => {
    setBusy(true);
    try {
      const r = await call<Settings["plafon"] & { applied: number }>("/api/pengajuan/settings/plafon-suggestions",
        { method: "POST", json: { codes: [...picked], factor: Number(factor) || 1.2 } });
      onApplied(r);
      toast(tr("Plafon set for {0} outlets", r.applied));
      setOpen(false);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  if (!open) {
    return <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>{tr("Suggest the plafon from Simple Purchase (ESB)")}</Button>;
  }
  const withSug = (rows ?? []).filter((x) => x.suggested);
  return (
    <div className="space-y-2 rounded-md border border-brand-200 bg-brand-50/40 p-3">
      <p className="text-sm font-semibold text-neutral-900">{tr("Plafon from Simple Purchase")}</p>
      <p className="text-xs text-neutral-600">{tr("Weekly average of what the outlet bought itself in ESB (13 weeks) × the factor, rounded up to Rp 50.000. Outlets without a plafon are ticked; adjust any of them afterwards.")}</p>
      <label className="flex items-center gap-2 text-xs text-neutral-700">{tr("Factor")}
        <JSelect value={factor} onChange={setFactor} className="w-28" placeholder="× 1" label={tr("Factor")}
          options={["1", "1.1", "1.2", "1.3", "1.5", "2"].map((x) => ({ value: x, label: `× ${x}` }))} />
        <span className="ml-auto">{tr("{0} of {1} ticked", picked.size, withSug.length)}</span>
      </label>
      {!rows ? <SkeletonList rows={4} /> : (
        <div className="max-h-72 overflow-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-xs">
            <thead className={theadClass}><tr><th className="w-8 px-2 py-1.5" /><th className="px-2 py-1.5 text-left">{tr("Outlet")}</th>
              <th className="px-2 py-1.5 text-right">{tr("Average / Week")}</th><th className="px-2 py-1.5 text-right">{tr("Suggested")}</th><th className="px-2 py-1.5 text-right">{tr("Now")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((x) => (
                <tr key={x.code} className={cx(!x.suggested && "text-neutral-400")}>
                  <td className="px-2 py-1.5"><input type="checkbox" disabled={!x.suggested} checked={picked.has(x.code)} aria-label={x.name}
                    onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(x.code)) n.delete(x.code); else n.add(x.code); return n; })} /></td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5">{x.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtRp(x.avgWeek)}</td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{x.suggested ? fmtRp(x.suggested) : tr("no purchase")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{x.current === null ? "—" : fmtRp(x.current)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>{tr("Cancel")}</Button>
        <Button size="sm" loading={busy} disabled={!picked.size} onClick={() => void apply()}>{tr("Set the plafon of {0} outlets", picked.size)}</Button>
      </div>
    </div>
  );
}


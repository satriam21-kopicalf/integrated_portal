"use client";

// Monitoring → Pengajuan (page mon.pengajuan, the portal): every request of the outlets for management and Finance.
// Status tabs (open first, "My turn": waiting at a step of the signed-in user), one Filters sheet (period, branch group,
// outlet, kind, account, category, flags), the summary of what waits, a list and a CSV export of every line (for the
// reconciliation). A request opens in a drawer: the steps of its kind, every line with its receipts and the history; the
// approver of the step waiting approves (the last approval sets the amount), may reject single lines, send it back for
// a revision or reject it (with a note); the payment step records the transfer with its proof. Settings: the approval
// steps of every kind with their users (superadmin) and the petty cash plafon (superadmin, Finance).

import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardList, Copy, Download, MessageSquareText, Paperclip, Plus, Send, Settings2, Trash2, UserCheck, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Page, Panel, SkeletonRows, fmtNumber, inputClass, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay as wibOffset } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDate, wibDateTime, wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import PengajuanView, { FileChip, StatusBadge } from "./PengajuanView";
import { type Action, type Kind, type Pengajuan, type PgFile, type Status, ACTION_LABEL, CATEGORY_LABEL, KINDS, OPEN, STATUS_LABEL, acceptedTotal,
  categoryLabel, fmtRp, kindLabel, parseRp, typeRp, upload } from "./pengajuan";

type Result = { period: { from: string; to: string }; me: string; superadmin: boolean; data: Pengajuan[]; categories: Record<string, string> };
type F = { period: Period; bgroup: string; branch: string; kind: Kind | ""; account: string; category: string; flag: "" | "reused" | "negative" | "opening" | "rejected" };
const NO_F = (): F => ({ period: { from: wibOffset(-89), to: wibOffset(0) }, bgroup: "", branch: "", kind: "", account: "", category: "", flag: "" });
type GroupOpt = { id: string; code: string; name: string };
type Tab = Status | "" | "OPEN" | "MINE";
const TABS: Tab[] = ["MINE", "OPEN", "", "SUBMITTED", "APPROVED", "REVISION", "PAID", "REJECTED"];
const DOT: Partial<Record<Status, string>> = { SUBMITTED: "bg-blue-500", APPROVED: "bg-cyan-500", REVISION: "bg-amber-500",
  PAID: "bg-emerald-500", REJECTED: "bg-red-500" };
const sum = (rows: Pengajuan[], f: (p: Pengajuan) => number | null | undefined) => rows.reduce((a, p) => a + (f(p) ?? 0), 0);
const flagged = (p: Pengajuan) => ({
  reused: (p.reusedFiles ?? 0) > 0, negative: (p.closingBalance ?? 0) < 0,
  opening: p.openingExpected !== null && p.openingBalance !== null && p.openingExpected !== p.openingBalance,
  rejected: (p.lines ?? []).some((l) => l.review === "REJECTED"),
});

export default function PengajuanMonitor() {
  const [f, setF] = useState<F>(NO_F);
  const [status, setStatus] = useState<Tab>("OPEN");
  const [settings, setSettings] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [bgroups, setBgroups] = useState<GroupOpt[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRes(await call<Result>(`/api/pengajuan/monitor?dateFrom=${f.period.from}&dateTo=${f.period.to}${f.bgroup ? `&group=${encodeURIComponent(f.bgroup)}` : ""}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period, f.bgroup]);
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
  const mine = useCallback((p: Pengajuan) => !!res && !!p.step && (p.status === "SUBMITTED" || p.status === "APPROVED")
    && (p.step.userIds.includes(res.me) || (res.superadmin && !p.step.userIds.length)), [res]);
  const inTab = (p: Pengajuan, t: Tab) => !t || (t === "OPEN" ? OPEN.includes(p.status) : t === "MINE" ? mine(p) : p.status === t);
  const rows = useMemo(() => base.filter((p) => inTab(p, status))
    .sort((a, b) => (OPEN.includes(b.status) ? 1 : 0) - (OPEN.includes(a.status) ? 1 : 0) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- inTab follows `mine`
  [base, status, mine]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f) + status);
  const by = (s: Status) => base.filter((p) => p.status === s);

  const def = NO_F();
  const FLAG_LABEL = { reused: tr("Same receipt used twice"), negative: tr("Negative closing balance"), opening: tr("Opening balance differs"), rejected: tr("With rejected expenses") };
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.bgroup ? [{ key: "bg", label: `${tr("Group")} ${f.bgroup === "none" ? tr("Without a group") : bgroups.find((g) => g.id === f.bgroup)?.code ?? ""}`, onRemove: () => setF({ ...f, bgroup: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: all.find((p) => p.branchCode === f.branch)?.branchName ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.kind ? [{ key: "k", label: kindLabel(f.kind), onRemove: () => setF({ ...f, kind: "" }) }] : []),
    ...(f.account ? [{ key: "a", label: `@${f.account}`, onRemove: () => setF({ ...f, account: "" }) }] : []),
    ...(f.category ? [{ key: "c", label: categoryLabel(f.category), onRemove: () => setF({ ...f, category: "" }) }] : []),
    ...(f.flag ? [{ key: "f", label: FLAG_LABEL[f.flag], onRemove: () => setF({ ...f, flag: "" }) }] : []),
  ];
  const branchOpts = useMemo(() => [...new Map(all.map((p) => [p.branchCode, p.branchName])).entries()].map(([value, label]) => ({ value, label })), [all]);
  const accountOpts = useMemo(() => [...new Map(all.map((p) => [p.username, p.name])).entries()].map(([value, label]) => ({ value, label: `${label} (@${value})` })), [all]);

  const exportCsv = () => {
    const head = [tr("Number"), tr("Kind"), tr("Status"), tr("Step waiting"), tr("Outlet"), tr("Code"), tr("Account"), tr("Submitted by"), tr("Phone"),
      tr("Bank"), tr("Account number"), tr("Account holder"), tr("Purpose"), tr("Date needed"), tr("Baristas"), tr("Period from"), tr("Period to"),
      tr("Opening balance"), tr("Money in"), tr("Total money out"), tr("Closing balance"), tr("Plafon"), tr("Amount asked"), tr("Approved amount"), tr("Paid"),
      tr("Transfer date"), tr("Line date"), tr("Category"), tr("Description"), tr("Amount"), tr("Line check"), tr("Check note")];
    const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [head.join(",")];
    for (const p of rows) {
      const common = [p.number, kindLabel(p.kind), STATUS_LABEL[p.status](), p.step?.label, p.branchName, p.branchCode, p.username, p.requesterName, p.requesterPhone,
        p.payeeBank, p.payeeAccount, p.payeeName, p.purpose, p.neededOn, p.baristas.map((b) => b.name).join(" / "), p.periodFrom, p.periodTo,
        p.openingBalance, p.incomeAmount, p.totalOut, p.closingBalance, p.plafon, p.requestedAmount, p.approvedAmount, p.paidAmount, p.paidOn];
      const lines = p.lines?.length ? p.lines : [null];
      for (const l of lines) out.push([...common, l?.spentOn, l ? categoryLabel(l.category) : "", l?.description, l?.amount, l?.review === "REJECTED" ? tr("Rejected") : l ? "OK" : "", l?.reviewNote].map(esc).join(","));
    }
    const blob = new Blob([`﻿${out.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tr("Fund requests").toLowerCase().replace(/\s+/g, "-")}-${f.period.from}-${f.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page title={tr("Monitoring Fund Requests")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("petty cash and budget requests of every outlet")}`}
      actions={<div className="flex gap-2">
        <Button variant="secondary" onClick={() => setSettings(true)}><Settings2 size={15} /> {tr("Approvals & plafon")}</Button>
        <Button variant="secondary" disabled={!rows.length} onClick={exportCsv}><Download size={15} /> {tr("Export CSV")}</Button>
      </div>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("My turn")} emphasis onClick={res ? () => setStatus("MINE") : undefined} active={status === "MINE"} icon={<UserCheck size={13} />}
            value={res ? fmtNumber(base.filter(mine).length) : <StatSkeleton />}>
            {res && <p className="tabular-nums">{fmtRp(sum(base.filter(mine), (p) => p.approvedAmount ?? p.requestedAmount))}</p>}
          </Stat>
          {(["SUBMITTED", "APPROVED", "PAID"] as Status[]).map((s) => (
            <Stat key={s} label={STATUS_LABEL[s]()} onClick={res ? () => setStatus(s) : undefined} active={status === s}
              icon={s === "PAID" ? <CheckCircle2 size={13} /> : s === "APPROVED" ? <Wallet size={13} /> : <ClipboardList size={13} />}
              value={res ? fmtNumber(by(s).length) : <StatSkeleton />}>
              {res && <p className="tabular-nums">{fmtRp(sum(by(s), (p) => (s === "PAID" ? p.paidAmount : s === "APPROVED" ? p.approvedAmount : p.requestedAmount)))}</p>}
            </Stat>
          ))}
        </StatStrip>
      }>
      <Panel title={tr("Fund requests")} description={tr("Oldest waiting first; tap one to check it")}
        toolbar={<>
          <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label={tr("Status")}>
            {TABS.map((t) => {
              const on = status === t;
              return (
                <button key={t || "all"} type="button" role="tab" aria-selected={on} onClick={() => setStatus(t)}
                  className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", on ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900")}>
                  {t && t !== "OPEN" && t !== "MINE" && <span className={cx("h-2 w-2 rounded-full", DOT[t])} aria-hidden />}
                  {t === "OPEN" ? tr("Open") : t === "MINE" ? tr("My turn") : t ? STATUS_LABEL[t as Status]() : tr("All")}
                  <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-slate-900 text-white" : "bg-white text-slate-700")}>{fmtNumber(base.filter((p) => inTab(p, t)).length)}</span>
                </button>
              );
            })}
          </div>
          <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search number, outlet, requester, purpose or line")} filters={chips}
            onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />
        </>}
        footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(all.length))} · {fmtRp(sum(rows, (p) => p.requestedAmount ?? p.totalOut))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : res && rows.length === 0 ? (
          <Empty icon={<ClipboardList size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No fund request yet")}>
            {!all.length && tr("Fund requests appear here as soon as they are sent from Form → Fund requests.")}
          </Empty>
        ) : !res ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table> : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                    <span className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-slate-500">{p.number}</span><StatusBadge s={p.status} /></span>
                    <span className="mt-1 flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{p.branchName}</span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular-nums">{fmtRp(p.requestedAmount ?? p.totalOut)}</span></span>
                    <span className="block truncate text-xs text-slate-500">{kindLabel(p.kind)} · {p.kind === "PETTY_CASH" && p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : p.purpose ?? "—"}</span>
                    <StepWaiting p={p} />
                    <Flags p={p} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] text-sm">
                <thead className={theadClass}>
                  <tr className="whitespace-nowrap">
                    <th className="px-4 py-2.5">{tr("Number")}</th><th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Kind")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Money out")}</th><th className="px-4 py-2.5 text-right">{tr("Amount asked")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th><th className="px-4 py-2.5">{tr("Sent")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.rows.map((p) => (
                    <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-slate-600">{p.number}</td>
                      <td className="max-w-[16rem] px-4 py-2.5"><p className="truncate font-medium text-slate-900">{p.branchName}</p>
                        <p className="truncate text-xs text-slate-500">@{p.username} · {tr("{0} expenses", p.lines?.length ?? 0)} · {tr("{0} files", p.fileCount ?? 0)}</p><Flags p={p} /></td>
                      <td className="max-w-[14rem] px-4 py-2.5 text-xs text-slate-600"><p className="font-medium text-slate-800">{kindLabel(p.kind)}</p>
                        <p className="truncate">{p.kind === "PETTY_CASH" && p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : p.purpose ?? "—"}</p></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-slate-700">{fmtRp(p.totalOut)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">{fmtRp(p.approvedAmount ?? p.requestedAmount)}</td>
                      <td className="px-4 py-2.5"><StatusBadge s={p.status} /><StepWaiting p={p} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-slate-500">{wibDateTime(p.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {settings && <SettingsDrawer branches={branchOpts} onClose={() => setSettings(false)} onChanged={load} />}
      {sheet && <MonitorFilters value={f} bgroups={bgroups} branches={branchOpts} accounts={accountOpts} categories={Object.keys(res?.categories ?? {})}
        flagLabel={FLAG_LABEL} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <TeamDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

function StepWaiting({ p }: { p: Pengajuan }) {
  if (!p.step || (p.status !== "SUBMITTED" && p.status !== "APPROVED")) return null;
  return <span className="mt-0.5 block truncate text-[11px] text-slate-500">{p.step.label} · {p.step.users.length ? p.step.users.join(", ") : "Superadmin"}</span>;
}

function Flags({ p }: { p: Pengajuan }) {
  const fl = flagged(p);
  if (!fl.reused && !fl.negative && !fl.opening && !fl.rejected) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {fl.reused && <Badge tone="amber" icon={<Copy size={10} />}>{tr("Receipt used twice")}</Badge>}
      {fl.negative && <Badge tone="red">{tr("Negative balance")}</Badge>}
      {fl.opening && <Badge tone="amber">{tr("Opening differs")}</Badge>}
      {fl.rejected && <Badge tone="red">{tr("Expense rejected")}</Badge>}
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
      <FilterSection title={tr("Branch group")}>
        <ChoiceGroup label="" value={v.bgroup} onChange={(bgroup) => setV({ ...v, bgroup })}
          choices={[{ value: "", label: tr("All") }, ...bgroups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a group") }]} />
      </FilterSection>
      <FilterSection title={tr("Kind")}>
        <ChoiceGroup label="" value={v.kind} onChange={(kind) => setV({ ...v, kind: kind as F["kind"] })}
          choices={[{ value: "", label: tr("All") }, ...KINDS.map((k) => ({ value: k, label: kindLabel(k) }))]} />
      </FilterSection>
      <FilterSection title={tr("Outlet")}><SearchChoice label="" anyLabel={tr("Every outlet")} options={branches} value={v.branch} onChange={(branch) => setV({ ...v, branch })} placeholder={tr("Search outlet")} /></FilterSection>
      <FilterSection title={tr("Account")}><SearchChoice label="" anyLabel={tr("Every account")} options={accounts} value={v.account} onChange={(account) => setV({ ...v, account })} placeholder={tr("Search account")} /></FilterSection>
      <FilterSection title={tr("Expense category")}>
        <ChoiceGroup label="" value={v.category} onChange={(category) => setV({ ...v, category })}
          choices={[{ value: "", label: tr("All") }, ...categories.map((c) => ({ value: c, label: (CATEGORY_LABEL[c] ?? (() => c))() }))]} />
      </FilterSection>
      <FilterSection title={tr("To check")}>
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
  const needNote = action === "REVISION" || action === "REJECTED";
  return (
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardList size={18} />} title={p?.number ?? tr("Fund requests")}
      description={p ? `${p.branchName} · @${p.username} · ${wibDateTime(p.submittedAt)}` : undefined}
      titleExtra={p ? <StatusBadge s={p.status} /> : undefined}
      footer={p && next.length > 0 ? (
        <div className="flex w-full flex-col gap-2">
          {action && (
            <div className="space-y-2">
              {action === "PAID" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{tr("Amount transferred")}</span>
                    <input value={paid.amount} inputMode="numeric" onChange={(e) => setPaid({ ...paid, amount: typeRp(parseRp(e.target.value)) })} className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} /></label>
                  <label className="block"><span className="mb-1 block text-xs font-medium text-slate-600">{tr("Transfer date")}</span>
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
              <Button key={s} variant={s === "REJECTED" ? "danger" : s === "REVISION" ? "secondary" : "primary"} onClick={() => setAction(s)}>{ACTION_LABEL[s]()}</Button>
            ))}
          </div>
        </div>
      ) : undefined}>
      {error ? <ErrorState message={error} /> : !p ? <div className="skeleton h-96 rounded-xl" /> : (
        <div className="space-y-5">
          {p.can?.step && (p.status === "SUBMITTED" || p.status === "APPROVED") && (
            <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200"><UserCheck size={14} className="flex-shrink-0 text-slate-500" />
              {tr("Waiting at {0}: {1}", p.can.step, p.can.stepUsers.length ? p.can.stepUsers.join(", ") : "Superadmin")}{!p.can.next.length && ` · ${tr("not your step")}`}</p>
          )}
          {p.can?.reviewLines && (
            <p className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900"><AlertTriangle size={14} className="mt-px flex-shrink-0" />
              {tr("Check every line and its receipt. A rejected line is left out of the approved amount (lines accepted {0} now).", fmtRp(acceptedTotal(p.lines ?? [])))}</p>
          )}
          {p.can?.payment && (
            <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Wallet size={15} /> {tr("Payment: approved {0}", fmtRp(p.approvedAmount))}</p>
              <div className="flex flex-wrap items-end gap-2">
                {payment.map((x) => <FileChip key={x.id} f={x} onRemove={() => void removeProof(x.id)} />)}
                <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800">
                  <Paperclip size={13} /> {tr("Attach transfer proof")}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => void proof(e.target.files)} />
                </label>
              </div>
            </section>
          )}
          <PengajuanView p={p} onReview={p.can?.reviewLines ? review : undefined} />
          <section>
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><MessageSquareText size={15} className="text-slate-500" /> {tr("Add a note to the history")}</p>
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

type StepEdit = { label: string; type: "APPROVE" | "PAY"; userIds: string[] };
type Approver = { id: string; name: string; username: string; role: string; jobTitle: string | null };
type Settings = { kinds: Record<Kind, string>; flows: Record<Kind, { label: string; type: "APPROVE" | "PAY"; users: { id: string; name: string }[] }[]>;
  users: Approver[]; plafon: { default: number | null; branches: { branchCode: string; amount: number }[] }; canEdit: boolean; canPlafon: boolean };

/** The approval steps of every kind (any number, in order, each with its users; then the payment) and the petty cash plafon. */
function SettingsDrawer({ branches, onClose, onChanged }: { branches: { value: string; label: string }[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("PETTY_CASH");
  const [steps, setSteps] = useState<StepEdit[]>([]);
  const [busy, setBusy] = useState(false);
  const [plafon, setPlafon] = useState({ branch: "", amount: "" });
  const load = useCallback(async () => {
    try { setData(await call<Settings>("/api/pengajuan/settings")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (data) setSteps(data.flows[kind].map((x) => ({ label: x.label, type: x.type, userIds: x.users.map((u) => u.id) })));
  }, [data, kind]);
  const names = useMemo(() => new Map((data?.users ?? []).map((u) => [u.id, u.name])), [data]);
  const branchName = (code: string) => branches.find((b) => b.value === code)?.label ?? code;
  const approvals = steps.filter((x) => x.type === "APPROVE");
  const pay = steps.find((x) => x.type === "PAY") ?? { label: tr("Payment"), type: "PAY" as const, userIds: [] };
  const setApprovals = (list: StepEdit[]) => setSteps([...list, pay]);
  const save = async () => {
    setBusy(true);
    try {
      await call(`/api/pengajuan/settings/flow/${kind}`, { method: "PUT", json: { steps } });
      await load();
      onChanged();
      toast(tr("Approvals of {0} saved", kindLabel(kind)));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
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
  return (
    <Drawer open onClose={onClose} size="xl" icon={<Settings2 size={18} />} title={tr("Approvals & plafon")}
      description={tr("Who approves each kind of request, in order, and the petty cash plafon")}
      footer={edit ? <div className="flex w-full flex-wrap justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void copyToAll()}>{tr("Use for every kind")}</Button>
        <Button loading={busy} onClick={() => void save()}>{tr("Save approvals of {0}", kindLabel(kind))}</Button>
      </div> : undefined}>
      {error ? <ErrorState message={error} /> : !data ? <div className="skeleton h-72 rounded-xl" /> : (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label={tr("Kind")}>
              {KINDS.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
                  className={cx("flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium", kind === k ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900")}>{kindLabel(k)}</button>
              ))}
            </div>
            {!edit && <p className="text-xs text-slate-500">{tr("Only a superadmin changes the approvals.")}</p>}
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
            <p className="text-xs text-slate-500">{tr("Every step is approved in order by one of its users; a step without users is taken by a superadmin. The approvers get the Monitoring → Fund requests page.")}</p>
          </section>

          <section className="space-y-3 border-t border-slate-100 pt-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">{tr("Petty cash plafon")}</p>
              <p className="text-xs text-slate-500">{tr("The weekly top-up brings the cash of the outlet back to its plafon. An outlet without its own plafon uses the one of every outlet.")}</p>
            </div>
            <PlafonRow label={tr("Every outlet")} amount={data.plafon.default} edit={data.canPlafon} onSave={(a) => void savePlafon("*", a)} />
            {data.plafon.branches.map((b) => (
              <PlafonRow key={b.branchCode} label={branchName(b.branchCode)} amount={b.amount} edit={data.canPlafon} onSave={(a) => void savePlafon(b.branchCode, a)} removable />
            ))}
            {data.canPlafon && (
              <div className="grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <SearchChoice label="" anyLabel={tr("Choose the outlet")} options={branches.filter((b) => !data.plafon.branches.some((x) => x.branchCode === b.value))}
                  value={plafon.branch} onChange={(branch) => setPlafon({ ...plafon, branch })} placeholder={tr("Search outlet")} />
                <input value={plafon.amount} inputMode="numeric" placeholder="Rp" onChange={(e) => setPlafon({ ...plafon, amount: typeRp(parseRp(e.target.value)) })}
                  className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} aria-label={tr("Plafon")} />
                <Button disabled={!plafon.branch || parseRp(plafon.amount) === null} onClick={() => void savePlafon(plafon.branch, parseRp(plafon.amount))}>{tr("Add")}</Button>
              </div>
            )}
            {!branches.length && data.canPlafon && <p className="text-xs text-slate-400">{tr("Outlets appear here once they sent a request in the period.")}</p>}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function StepRow({ n, step, users, names, edit, payment, onChange, onUp, onDown, onRemove }: { n: number; step: StepEdit; users: Approver[];
  names: Map<string, string>; edit: boolean; payment?: boolean; onChange: (s: StepEdit) => void; onUp?: () => void; onDown?: () => void; onRemove?: () => void }) {
  const [pick, setPick] = useState("");
  return (
    <li className={cx("rounded-xl border p-3", payment ? "border-cyan-200 bg-cyan-50/40" : "border-slate-200 bg-white")}>
      <div className="flex items-center gap-2">
        <span className={cx("flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", payment ? "bg-cyan-600" : "bg-blue-600")}>{n}</span>
        {edit ? <input value={step.label} maxLength={60} onChange={(e) => onChange({ ...step, label: e.target.value })} aria-label={tr("Step name")}
          className={cx(inputClass, "h-9 min-w-0 flex-1 text-sm font-semibold")} /> : <p className="flex-1 text-sm font-semibold text-slate-900">{step.label}</p>}
        {payment && <Badge tone="cyan">{tr("Payment")}</Badge>}
        {edit && onUp && <button type="button" onClick={onUp} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label={tr("Move up")}><ArrowUp size={15} /></button>}
        {edit && onDown && <button type="button" onClick={onDown} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label={tr("Move down")}><ArrowDown size={15} /></button>}
        {edit && onRemove && <button type="button" onClick={onRemove} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove step")}><Trash2 size={15} /></button>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {step.userIds.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs font-medium text-slate-700">
            {names.get(id) ?? id}
            {edit && <button type="button" onClick={() => onChange({ ...step, userIds: step.userIds.filter((x) => x !== id) })} className="rounded-full p-0.5 hover:bg-white" aria-label={tr("Remove {0}", names.get(id) ?? "")}>×</button>}
          </span>
        ))}
        {!step.userIds.length && <span className="text-xs text-slate-400">{tr("No user yet: a superadmin takes this step")}</span>}
      </div>
      {edit && (
        <div className="mt-2">
          <SearchChoice label="" anyLabel={tr("Add an approver")} placeholder={tr("Search name or username")} value={pick}
            options={users.filter((u) => !step.userIds.includes(u.id)).map((u) => ({ value: u.id, label: `${u.name} (@${u.username})${u.jobTitle ? ` · ${u.jobTitle}` : ""}` }))}
            onChange={(id) => { if (id) onChange({ ...step, userIds: [...step.userIds, id] }); setPick(""); }} />
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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{label}</p>
      {edit ? <>
        <input value={v} inputMode="numeric" placeholder={tr("No plafon")} onChange={(e) => setV(typeRp(parseRp(e.target.value)))} aria-label={tr("Plafon {0}", label)}
          className={cx(inputClass, "h-9 w-36 text-right font-semibold tabular-nums")} />
        {changed && <Button onClick={() => onSave(parseRp(v))}>{tr("Save")}</Button>}
        {removable && <button type="button" onClick={() => onSave(null)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><Trash2 size={15} /></button>}
      </> : <span className="text-sm font-semibold tabular-nums text-slate-900">{fmtRp(amount)}</span>}
    </div>
  );
}

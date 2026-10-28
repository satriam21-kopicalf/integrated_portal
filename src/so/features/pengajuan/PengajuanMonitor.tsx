"use client";

// Monitoring → Pengajuan (page mon.pengajuan): every pengajuan of the outlets for Operations, Finance and management.
// Status tabs (open first), one Filters sheet (period, branch group, outlet, account, category, flags), the summary of
// what waits at every step, a list and a CSV export of every expense. A pengajuan opens in a drawer: the steps, the
// balances, every expense with its receipts and the history; the next step follows the access of the checker:
// Operations (mon.pengajuan.verify) verifies, Finance (mon.pengajuan.finance) approves and records the payment with the
// transfer proof. Both may reject single expenses, send it back for a revision or reject it (with a note).

import { AlertTriangle, CheckCircle2, ClipboardList, Copy, Download, MessageSquareText, Paperclip, Send, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Page, Panel, SkeletonRows, fmtNumber, inputClass, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay as wibOffset } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDate, wibDateTime, wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import PengajuanView, { FileChip, StatusBadge } from "./PengajuanView";
import { type Pengajuan, type PgFile, type Status, ACTION_LABEL, CATEGORY_LABEL, OPEN, STATUS_LABEL, acceptedTotal, categoryLabel, fmtRp, parseRp,
  typeRp, upload } from "./pengajuan";

type Result = { period: { from: string; to: string }; perms: string[]; data: Pengajuan[]; categories: Record<string, string> };
type F = { period: Period; bgroup: string; branch: string; account: string; category: string; flag: "" | "reused" | "negative" | "opening" | "rejected" };
const NO_F = (): F => ({ period: { from: wibOffset(-89), to: wibOffset(0) }, bgroup: "", branch: "", account: "", category: "", flag: "" });
type GroupOpt = { id: string; code: string; name: string };
const TABS: (Status | "" | "OPEN")[] = ["OPEN", "", "SUBMITTED", "VERIFIED", "APPROVED", "REVISION", "PAID", "REJECTED"];
const DOT: Partial<Record<Status, string>> = { SUBMITTED: "bg-blue-500", VERIFIED: "bg-violet-500", APPROVED: "bg-cyan-500", REVISION: "bg-amber-500",
  PAID: "bg-emerald-500", REJECTED: "bg-red-500" };
const sum = (rows: Pengajuan[], f: (p: Pengajuan) => number | null | undefined) => rows.reduce((a, p) => a + (f(p) ?? 0), 0);
const flagged = (p: Pengajuan) => ({
  reused: (p.reusedFiles ?? 0) > 0, negative: (p.closingBalance ?? 0) < 0,
  opening: p.openingExpected !== null && p.openingBalance !== null && p.openingExpected !== p.openingBalance,
  rejected: (p.lines ?? []).some((l) => l.review === "REJECTED"),
});

export default function PengajuanMonitor() {
  const [f, setF] = useState<F>(NO_F);
  const [status, setStatus] = useState<Status | "" | "OPEN">("OPEN");
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
    return all.filter((p) => (!f.branch || p.branchCode === f.branch) && (!f.account || p.username === f.account)
      && (!f.category || (p.lines ?? []).some((l) => l.category === f.category)) && (!f.flag || flagged(p)[f.flag])
      && (!s || `${p.number} ${p.branchName} ${p.name} ${p.username} ${p.baristas.map((b) => b.name).join(" ")} ${(p.lines ?? []).map((l) => l.description).join(" ")}`.toLowerCase().includes(s)));
  }, [all, f, search]);
  const inTab = (p: Pengajuan, t: Status | "" | "OPEN") => !t || (t === "OPEN" ? OPEN.includes(p.status) : p.status === t);
  const rows = useMemo(() => base.filter((p) => inTab(p, status))
    .sort((a, b) => (OPEN.includes(b.status) ? 1 : 0) - (OPEN.includes(a.status) ? 1 : 0) || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")), [base, status]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f) + status);
  const by = (s: Status) => base.filter((p) => p.status === s);
  const perms = res?.perms ?? [];

  const def = NO_F();
  const FLAG_LABEL = { reused: tr("Same receipt used twice"), negative: tr("Negative closing balance"), opening: tr("Opening balance differs"), rejected: tr("With rejected expenses") };
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.bgroup ? [{ key: "bg", label: `${tr("Group")} ${f.bgroup === "none" ? tr("Without a group") : bgroups.find((g) => g.id === f.bgroup)?.code ?? ""}`, onRemove: () => setF({ ...f, bgroup: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: all.find((p) => p.branchCode === f.branch)?.branchName ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.account ? [{ key: "a", label: `@${f.account}`, onRemove: () => setF({ ...f, account: "" }) }] : []),
    ...(f.category ? [{ key: "c", label: categoryLabel(f.category), onRemove: () => setF({ ...f, category: "" }) }] : []),
    ...(f.flag ? [{ key: "f", label: FLAG_LABEL[f.flag], onRemove: () => setF({ ...f, flag: "" }) }] : []),
  ];
  const branchOpts = useMemo(() => [...new Map(all.map((p) => [p.branchCode, p.branchName])).entries()].map(([value, label]) => ({ value, label })), [all]);
  const accountOpts = useMemo(() => [...new Map(all.map((p) => [p.username, p.name])).entries()].map(([value, label]) => ({ value, label: `${label} (@${value})` })), [all]);

  const exportCsv = () => {
    const head = ["Nomor", "Status", "Outlet", "Kode", "Akun", "Barista", "Periode dari", "Periode sampai", "Saldo awal", "Dana masuk", "Total keluar",
      "Saldo akhir", "Disetujui", "Dibayar", "Tgl pengeluaran", "Kategori", "Keterangan", "Nominal", "Pemeriksaan", "Catatan pemeriksaan"];
    const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const out = [head.join(",")];
    for (const p of rows) {
      const common = [p.number, STATUS_LABEL[p.status](), p.branchName, p.branchCode, p.username, p.baristas.map((b) => b.name).join(" / "), p.periodFrom, p.periodTo,
        p.openingBalance, p.incomeAmount, p.totalOut, p.closingBalance, p.approvedAmount, p.paidAmount];
      const lines = p.lines?.length ? p.lines : [null];
      for (const l of lines) out.push([...common, l?.spentOn, l ? categoryLabel(l.category) : "", l?.description, l?.amount, l?.review, l?.reviewNote].map(esc).join(","));
    }
    const blob = new Blob([`﻿${out.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pengajuan-${f.period.from}-${f.period.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Page title={tr("Monitoring Pengajuan")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("petty cash and other requests of every outlet")}`}
      actions={<Button variant="secondary" disabled={!rows.length} onClick={exportCsv}><Download size={15} /> {tr("Export CSV")}</Button>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          {(["SUBMITTED", "VERIFIED", "APPROVED", "PAID"] as Status[]).map((s) => (
            <Stat key={s} label={STATUS_LABEL[s]()} emphasis={s === "SUBMITTED"} onClick={res ? () => setStatus(s) : undefined} active={status === s}
              icon={s === "PAID" ? <CheckCircle2 size={13} /> : s === "APPROVED" ? <Wallet size={13} /> : <ClipboardList size={13} />}
              value={res ? fmtNumber(by(s).length) : <StatSkeleton />}>
              {res && <p className="tabular-nums">{fmtRp(sum(by(s), (p) => (s === "PAID" ? p.paidAmount : s === "APPROVED" ? p.approvedAmount : p.totalOut)))}</p>}
            </Stat>
          ))}
        </StatStrip>
      }>
      {res && (
        <p className="text-xs text-slate-500">
          {tr("Your steps")}: {perms.length ? perms.map((p) => (p === "verify" ? tr("verify (Operations)") : tr("approve & pay (Finance)"))).join(" · ") : tr("view only")}
        </p>
      )}
      <Panel title={tr("Pengajuan")} description={tr("Oldest waiting first; tap one to check it")}
        toolbar={<>
          <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label={tr("Status")}>
            {TABS.map((t) => {
              const on = status === t;
              return (
                <button key={t || "all"} type="button" role="tab" aria-selected={on} onClick={() => setStatus(t)}
                  className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", on ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900")}>
                  {t && t !== "OPEN" && <span className={cx("h-2 w-2 rounded-full", DOT[t])} aria-hidden />}
                  {t === "OPEN" ? tr("Open") : t ? STATUS_LABEL[t]() : tr("All")}
                  <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-slate-900 text-white" : "bg-white text-slate-700")}>{fmtNumber(base.filter((p) => inTab(p, t)).length)}</span>
                </button>
              );
            })}
          </div>
          <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search number, outlet, barista or expense")} filters={chips}
            onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />
        </>}
        footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(all.length))} · {fmtRp(sum(rows, (p) => p.totalOut))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : res && rows.length === 0 ? (
          <Empty icon={<ClipboardList size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No pengajuan yet")}>
            {!all.length && tr("Pengajuan appear here as soon as the outlets send them from Form → Pengajuan.")}
          </Empty>
        ) : !res ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table> : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setOpen(p.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
                    <span className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-slate-500">{p.number}</span><StatusBadge s={p.status} /></span>
                    <span className="mt-1 flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{p.branchName}</span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular-nums">{fmtRp(p.totalOut)}</span></span>
                    <span className="block truncate text-xs text-slate-500">{p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : "—"} · {tr("{0} expenses", p.lines?.length ?? 0)}</span>
                    <Flags p={p} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead className={theadClass}>
                  <tr className="whitespace-nowrap">
                    <th className="px-4 py-2.5">{tr("Number")}</th><th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Period")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Money in")}</th><th className="px-4 py-2.5 text-right">{tr("Money out")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Closing")}</th><th className="px-4 py-2.5">{tr("Status")}</th><th className="px-4 py-2.5">{tr("Sent")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.rows.map((p) => (
                    <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-slate-600">{p.number}</td>
                      <td className="max-w-[16rem] px-4 py-2.5"><p className="truncate font-medium text-slate-900">{p.branchName}</p>
                        <p className="truncate text-xs text-slate-500">@{p.username} · {tr("{0} expenses", p.lines?.length ?? 0)} · {tr("{0} files", p.fileCount ?? 0)}</p><Flags p={p} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">{p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-emerald-700">{fmtRp(p.incomeAmount)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">{fmtRp(p.totalOut)}</td>
                      <td className={cx("whitespace-nowrap px-4 py-2.5 text-right tabular-nums", (p.closingBalance ?? 0) < 0 ? "text-red-700" : "text-slate-700")}>{fmtRp(p.closingBalance)}</td>
                      <td className="px-4 py-2.5"><StatusBadge s={p.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-slate-500">{wibDateTime(p.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <MonitorFilters value={f} bgroups={bgroups} branches={branchOpts} accounts={accountOpts} categories={Object.keys(res?.categories ?? {})}
        flagLabel={FLAG_LABEL} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <TeamDrawer id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
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
      <FilterSection title={tr("Sent in")} hint={tr("Open pengajuan always show")}><PeriodField value={v.period} onChange={(period) => setV({ ...v, period })} maxDays={366} /></FilterSection>
      <FilterSection title={tr("Branch group")}>
        <ChoiceGroup label="" value={v.bgroup} onChange={(bgroup) => setV({ ...v, bgroup })}
          choices={[{ value: "", label: tr("All") }, ...bgroups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a group") }]} />
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
  const [action, setAction] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [paid, setPaid] = useState({ amount: "", on: wibDate() });
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const base = `/api/pengajuan/monitor/${id}`;
  useEffect(() => { call<Pengajuan>(base).then(setP).catch((e) => setError((e as Error).message)); }, [base]);
  useEffect(() => { if (p?.status === "APPROVED") setPaid((x) => (x.amount ? x : { ...x, amount: typeRp(p.approvedAmount) })); }, [p]);

  const changed = (next: Pengajuan) => { setP(next); onChanged(); };
  const go = async (to: Status) => {
    setBusy(true);
    try {
      changed(await call<Pengajuan>(`${base}/status`, { method: "POST", json: { to, note: note.trim() || null, paidAmount: to === "PAID" ? parseRp(paid.amount) : null, paidOn: to === "PAID" ? paid.on : null } }));
      setAction(null);
      setNote("");
      toast(tr("Status: {0}", STATUS_LABEL[to]()));
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
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardList size={18} />} title={p?.number ?? tr("Pengajuan")}
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
                  onClick={() => void go(action)}><Send size={15} /> {ACTION_LABEL[action]?.()}</Button>
              </>
            ) : next.map((s) => (
              <Button key={s} variant={s === "REJECTED" ? "danger" : s === "REVISION" ? "secondary" : "primary"} onClick={() => setAction(s)}>{ACTION_LABEL[s]?.()}</Button>
            ))}
          </div>
        </div>
      ) : undefined}>
      {error ? <ErrorState message={error} /> : !p ? <div className="skeleton h-96 rounded-xl" /> : (
        <div className="space-y-5">
          {p.can?.reviewLines && (
            <p className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900"><AlertTriangle size={14} className="mt-px flex-shrink-0" />
              {tr("Check every receipt against its expense. Reject an expense that has no valid receipt: it is left out of the approved amount ({0} now).", fmtRp(acceptedTotal(p.lines ?? [])))}</p>
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

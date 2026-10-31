"use client";

// Waste monitor (page cc.waste-monitor) and review (page cc.waste-review) of Cost Control (integrated_portal_be
// app/waste.py): the waste every branch entered in a period, filtered by branch, type, category and status; totals per
// item, branch and category; each entry with its photo, note and author. In review mode the entries waiting for review
// are ticked and approved or rejected (with a note), one by one or many at once. Export: CSV of the filtered entries.

import { CheckCircle2, Download, Package, Store, Tags, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { Segmented } from "@/so/ui/Simple";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { PeriodField, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { mapsUrl } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { type Entry, type MonitorData, type Scope, type Status, SCOPES, fmtQty, photoUrl, scopeLabel, statusLabel, statusTone } from "./waste";

type View = "entries" | "items" | "branches" | "categories";
type BranchOpt = { branch_code: string; branch_name: string };

export default function WasteMonitor({ mode }: { mode: "monitor" | "review" }) {
  const toast = useToast();
  const review = mode === "review";
  const [period, setPeriod] = useState<Period>({ from: wibDay(-6), to: wibDay(0) });
  const [branch, setBranch] = useState("");
  const [scope, setScope] = useState<Scope | "">("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<Status | "">(review ? "submitted" : "");
  const [view, setView] = useState<View>("entries");
  const [res, setRes] = useState<MonitorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [verdict, setVerdict] = useState<"approved" | "rejected" | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const q = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}), ...(scope ? { scope } : {}),
      ...(category ? { category } : {}), status });
    try {
      setRes(await call<MonitorData>(`/api/waste/${review ? "reviews" : "monitor"}?${q}`));
      setPicked(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [period, branch, scope, category, status, review]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (res?.data ?? []).filter((e) => !s || e.itemName.toLowerCase().includes(s) || e.branchName.toLowerCase().includes(s)
      || e.name.toLowerCase().includes(s) || e.itemCode.toLowerCase().includes(s));
  }, [res, search]);
  const paged = usePaged(rows, rows.length + search);
  const sm = res?.summary;
  const waiting = rows.filter((e) => e.status === "submitted");

  const decide = async (note: string) => {
    if (!verdict) return;
    setBusy(true);
    try {
      const ids = open && !picked.size ? [open.id] : [...picked];
      const out = await call<{ updated: number }>("/api/waste/reviews", { method: "POST", json: { ids, status: verdict, note: note.trim() || null } });
      toast(tr("{0} entries {1}", out.updated, verdict === "approved" ? tr("approved") : tr("rejected")));
      setVerdict(null);
      setOpen(null);
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const head = ["Tanggal", "Cabang", "Jenis", "Kode", "Item", "Qty", "Satuan", "Kategori", "Catatan", "Status", "Diinput oleh", "Waktu input", "Catatan review"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((e) => [e.businessDate, e.branchName, scopeLabel(e.scope), e.itemCode, e.itemName, e.qty, e.unit, e.category, e.note,
      statusLabel(e.status), e.name, wibDateTime(e.createdAt), e.review?.note].map(esc).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `waste_${period.from}_${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Page title={review ? tr("Waste review") : tr("Waste monitor")}
      subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${review ? tr("approve or reject the waste of the branches") : tr("Waste entered by every branch")}`}
      actions={<Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}><Download size={14} />{tr("Export")}</Button>}
      stats={
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Entries")} emphasis icon={<Trash2 size={13} />} value={sm ? fmtNumber(sm.entries) : <StatSkeleton />}>
            {sm && <p>{tr("{0} people entered", fmtNumber(sm.people))}</p>}
          </Stat>
          <Stat label={tr("Branches")} icon={<Store size={13} />} onClick={() => setView("branches")} active={view === "branches"} value={sm ? fmtNumber(sm.branches) : <StatSkeleton />} />
          <Stat label={tr("Items")} icon={<Package size={13} />} onClick={() => setView("items")} active={view === "items"} value={sm ? fmtNumber(sm.items) : <StatSkeleton />} />
          <Stat label={tr("Waiting review")} icon={<Tags size={13} />} onClick={() => setStatus(status === "submitted" ? "" : "submitted")} active={status === "submitted"}
            value={sm ? <span className={sm.submitted ? "text-amber-600" : undefined}>{fmtNumber(sm.submitted)}</span> : <StatSkeleton />} />
          <Stat label={tr("Approved / rejected")} icon={<CheckCircle2 size={13} />} value={sm ? `${fmtNumber(sm.approved)} / ${fmtNumber(sm.rejected)}` : <StatSkeleton />} />
        </StatStrip>
      }>
      <Panel toolbar={
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <PeriodField value={period} onChange={setPeriod} maxDays={92} />
            <select className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)} aria-label={tr("Branch")}>
              <option value="">{tr("All branches")}</option>
              {branches.map((b) => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
            </select>
            <select className={inputClass} value={scope} onChange={(e) => setScope(e.target.value as Scope | "")} aria-label={tr("Type")}>
              <option value="">{tr("All types")}</option>
              {SCOPES.map((s) => <option key={s} value={s}>{scopeLabel(s)}</option>)}
            </select>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tr("Waste category")}>
              <option value="">{tr("All categories")}</option>
              {(res?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as Status | "")} aria-label={tr("Status")}>
              <option value="">{tr("All statuses")}</option>
              {(["submitted", "approved", "rejected"] as Status[]).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Segmented label={tr("View")} value={view} onChange={setView} options={[
              { value: "entries", label: tr("Entries") }, { value: "items", label: tr("Per item") },
              { value: "branches", label: tr("Per branch") }, { value: "categories", label: tr("Per category") }]} />
            {view === "entries" && <input className={cx(inputClass, "sm:max-w-xs")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search item, branch or person")} />}
          </div>
          {review && view === "entries" && waiting.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={picked.size > 0 && picked.size === waiting.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(waiting.map((x) => x.id)) : new Set())} />
                {tr("{0} of {1} selected", picked.size, waiting.length)}
              </label>
              <span className="flex-1" />
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={() => setVerdict("rejected")}><XCircle size={14} />{tr("Reject")}</Button>
              <Button size="sm" disabled={!picked.size} onClick={() => setVerdict("approved")}><CheckCircle2 size={14} />{tr("Approve")}</Button>
            </div>
          )}
        </div>
      }
        footer={res && view === "entries" ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 2,000 of the period")}` : ""}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <SkeletonRows cols={6} /> : view === "entries" ? (
          rows.length === 0 ? (
            <Empty icon={<Trash2 size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No waste in this period")}>
              {!res.data.length && tr("Waste appears here as soon as the branches enter it from Waste (input).")}
            </Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {paged.rows.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  {review && e.status === "submitted" && <input type="checkbox" className="mt-4" checked={picked.has(e.id)} onChange={() => toggle(e.id)} aria-label={e.itemName} />}
                  <button type="button" onClick={() => setOpen(e)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(e.id)} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-lg bg-slate-100 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-slate-900">{e.itemName}</span>
                        <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge>
                      </span>
                      <span className="block text-xs text-slate-600">{fmtQty(e.qty)} {e.unit} · {scopeLabel(e.scope)} · {e.category}</span>
                      <span className="block truncate text-xs text-slate-500">{e.branchName} · {dmy(e.businessDate)} · {e.name}{e.note ? ` · “${e.note}”` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Totals view={view} res={res} onBranch={(c) => { setBranch(c); setView("entries"); }} />
        )}
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open?.itemName ?? ""} description={open ? `${open.branchName} · ${dmy(open.businessDate)}` : ""}
        footer={open && review && open.status === "submitted" ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setPicked(new Set()); setVerdict("rejected"); }}><XCircle size={14} />{tr("Reject")}</Button>
            <Button onClick={() => { setPicked(new Set()); setVerdict("approved"); }}><CheckCircle2 size={14} />{tr("Approve")}</Button>
          </div>
        ) : undefined}>
        {open && (
          <div className="space-y-4">
            <a href={photoUrl(open.id)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(open.id)} alt={tr("Photo evidence")} className="w-full rounded-xl bg-slate-100 object-contain" />
            </a>
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
              {([
                [tr("Status"), <Badge key="s" tone={statusTone(open.status)}>{statusLabel(open.status)}</Badge>],
                [tr("Type"), scopeLabel(open.scope)],
                [tr("Item"), `${open.itemName} (${open.itemCode})`],
                [tr("Quantity"), `${fmtQty(open.qty)} ${open.unit}`],
                [tr("Waste category"), open.category],
                [tr("Note / reason"), open.note || "—"],
                [tr("Entered by"), `${open.name} · @${open.username}`],
                [tr("Entered at"), wibDateTime(open.createdAt)],
                [tr("Photo taken"), open.photoTakenAt ? wibDateTime(open.photoTakenAt) : "—"],
                [tr("Position"), open.latitude !== null && open.longitude !== null
                  ? <a key="p" href={mapsUrl(open.latitude, open.longitude)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{open.latitude.toFixed(5)}, {open.longitude.toFixed(5)}</a> : "—"],
                ...(open.review ? [[tr("Review"), `${open.review.by ?? ""} · ${open.review.at ? wibDateTime(open.review.at) : ""}${open.review.note ? ` · ${open.review.note}` : ""}`]] : []),
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2"><dt className="w-32 flex-shrink-0 text-slate-500">{k}</dt><dd className="min-w-0 flex-1 text-slate-800">{v}</dd></div>
              ))}
            </dl>
          </div>
        )}
      </Drawer>

      <ConfirmDialog open={!!verdict} busy={busy} danger={verdict === "rejected"}
        title={verdict === "approved" ? tr("Approve the waste?") : tr("Reject the waste?")}
        description={tr("{0} entries", open && !picked.size ? 1 : picked.size)}
        confirmLabel={verdict === "approved" ? tr("Approve") : tr("Reject")} reasonLabel={tr("Note for the branch (optional)")}
        onConfirm={(note) => void decide(note)} onClose={() => setVerdict(null)} />
    </Page>
  );
}

function Totals({ view, res, onBranch }: { view: Exclude<View, "entries">; res: MonitorData; onBranch: (code: string) => void }) {
  if (view === "items") {
    return !res.byItem.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Type")}</th>
          <th className="px-4 py-2.5 text-right">{tr("Quantity")}</th><th className="px-4 py-2.5 text-right">{tr("Entries")}</th><th className="px-4 py-2.5 text-right">{tr("Branches")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{res.byItem.map((i) => (
          <tr key={`${i.scope}:${i.code}:${i.unit}`}><td className="px-4 py-2"><p className="font-medium text-slate-800">{i.name}</p><p className="text-[11px] text-slate-400">{i.code}</p></td>
            <td className="px-4 py-2 text-slate-600">{scopeLabel(i.scope)}</td><td className="px-4 py-2 text-right tabular-nums">{fmtQty(i.qty)} {i.unit}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(i.entries)}</td><td className="px-4 py-2 text-right tabular-nums">{fmtNumber(i.branches)}</td></tr>
        ))}</tbody></table>
        <p className="px-4 py-2 text-[11px] text-slate-400">{tr("Rejected entries are not counted")}</p></div>
    );
  }
  if (view === "branches") {
    return !res.byBranch.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Branch")}</th><th className="px-4 py-2.5 text-right">{tr("Entries")}</th>
          <th className="px-4 py-2.5 text-right">{tr("Waiting review")}</th><th className="px-4 py-2.5 text-right">{tr("Days with waste")}</th><th className="px-4 py-2.5">{tr("Last entry")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{res.byBranch.map((b) => (
          <tr key={b.code} className="cursor-pointer hover:bg-slate-50" onClick={() => onBranch(b.code)}><td className="px-4 py-2 font-medium text-slate-800">{b.name}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.entries)}</td><td className={cx("px-4 py-2 text-right tabular-nums", b.submitted > 0 && "text-amber-600")}>{fmtNumber(b.submitted)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.days)}</td><td className="px-4 py-2 text-slate-600">{b.last_at ? wibDateTime(b.last_at) : "—"}</td></tr>
        ))}</tbody></table></div>
    );
  }
  const max = Math.max(1, ...res.byCategory.map((c) => c.entries));
  return !res.byCategory.length ? <Empty title={tr("No waste in this period")} /> : (
    <ul className="divide-y divide-slate-100">{res.byCategory.map((c) => (
      <li key={c.name} className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-800">{c.name}</span><span className="tabular-nums text-slate-600">{fmtNumber(c.entries)}</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(c.entries / max) * 100}%` }} /></div>
      </li>
    ))}</ul>
  );
}

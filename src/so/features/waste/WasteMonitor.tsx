"use client";

// Waste monitor (page cc.waste-monitor) and review (page cc.waste-review) of Cost Control (integrated_portal_be
// app/waste.py): the waste every branch entered in a period, filtered by branch, type, category and status; totals per
// item, branch and category; each entry with its photo, note and author. In review mode the entries waiting for review
// are ticked and approved or rejected (with a note), one by one or many at once. Export: Excel (entries, per item, daily report, Usage Management) from the Excel icon.
// Daily report: the branches that reported their waste each day; Usage Management: the daily lists (WasteDaily.tsx).
// Layout (2026-11-06): tabs with icons and counts; the entries as a table on a desktop (cards on a phone), the totals
// ranked with their share of the value; the filters in the monitor filter sheet.

import { CalendarCheck, CalendarDays, CheckCircle2, ClipboardList, FileSearch, Layers, ListChecks, Package, Store, Tags, Trash2, XCircle } from "lucide-react";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { downloadXlsx } from "@/lib/xlsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { mapsUrl } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { DailyReport, UsageReport } from "./WasteDaily";
import { CategoriesDrawer, Ingredients, InvestigationDrawer, InvestigationList } from "./Investigation";
import { type DailyData, type Entry, type MonitorData, type UsageRow, type Scope, type Status, PRICE_SOURCE, SCOPES, fmtQty, fmtRp, photoUrl, usagePhotoUrl, scopeLabel, signatureUrl, statusLabel, statusTone } from "./waste";
import { thumb } from "@/lib/assets";

const DEFAULT_PERIOD = (): Period => ({ from: wibDay(-6), to: wibDay(0) });
type Filters = { period: Period; branch: string; scope: Scope | ""; category: string; status: Status | "" };
type View = "entries" | "items" | "branches" | "categories" | "daily" | "usage" | "investigations";
type BranchOpt = { branch_code: string; branch_name: string };
const VIEWS: { value: View; label: () => string; icon: typeof Trash2 }[] = [
  { value: "entries", label: () => tr("Entries"), icon: Trash2 }, { value: "items", label: () => tr("Per Item"), icon: Package },
  { value: "branches", label: () => tr("Per Branch"), icon: Store }, { value: "categories", label: () => tr("Per Category"), icon: Layers },
  { value: "daily", label: () => tr("Daily Report"), icon: CalendarCheck }, { value: "usage", label: () => tr("Usage Management"), icon: ClipboardList },
  { value: "investigations", label: () => tr("Investigations"), icon: FileSearch },
];

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
  const [sheet, setSheet] = useState(false);
  // migration 055: the investigation open in the editor, the categories of the forms
  const [investigation, setInvestigation] = useState<string | null>(null);
  const [cats, setCats] = useState(false);

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
  // not decided yet: waiting review or under investigation
  const waiting = rows.filter((e) => e.status === "submitted" || e.status === "investigating");
  const investigate = async () => {
    const ids = open && !picked.size ? [open.id] : [...picked];
    setBusy(true);
    try {
      const out = await call<{ id: string; reportNo: number }>("/api/waste/investigations", { method: "POST", json: { ids } });
      toast(tr("Investigation No. {0} opened", String(out.reportNo).padStart(2, "0")));
      setOpen(null);
      setInvestigation(out.id);
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

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

  // Excel (POST /api/xlsx): the filtered entries, the totals per item, the daily report and the Usage Management lists
  const file = (what: string) => `${what} ${period.from} - ${period.to}`;
  const exportEntries = () => downloadXlsx({ fileName: file("Waste"), sheet: "Waste", title: `Waste ${dmy(period.from)} – ${dmy(period.to)}`,
    header: ["Tanggal", "Cabang", "Jenis", "Kode", "Item", "Qty", "Satuan", "Kategori", "Production date", "Expired date", "Catatan", "Status",
      "Diinput oleh", "Waktu input", "Catatan review", "Foto", "Harga satuan (Rp)", "Nilai (Rp)", "Sumber harga"],
    rows: rows.map((e) => [e.businessDate, e.branchName, scopeLabel(e.scope), e.itemCode, e.itemName, e.qty, e.unit, e.category,
      e.productionDate, e.expiredDate, e.note, statusLabel(e.status), e.name, wibDateTime(e.createdAt), e.review?.note,
      `${location.origin}${photoUrl(e.id)}`, e.unitPrice ?? null, e.value ?? null, e.priceSource ? PRICE_SOURCE[e.priceSource]() : null]) });
  const exportItems = () => downloadXlsx({ fileName: file("Waste per item"), sheet: "Per item", title: `Waste per item ${dmy(period.from)} – ${dmy(period.to)}`,
    header: ["Jenis", "Kode", "Item", "Qty", "Satuan", "Entri", "Cabang", "Nilai (Rp)"],
    rows: (res?.byItem ?? []).map((i) => [scopeLabel(i.scope), i.code, i.name, i.qty, i.unit, i.entries, i.branches, i.value ?? null]) });
  const q = () => new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}) });
  const exportDaily = async () => {
    const d = await call<DailyData>(`/api/waste/daily?${q()}`);
    const mark = (c: DailyData["branches"][number]["days"][number]) => (c.entries ? c.entries : c.noWaste ? "Tidak ada waste" : "Belum lapor");
    await downloadXlsx({ fileName: file("Laporan waste harian"), sheet: "Laporan harian", title: `Laporan waste harian ${dmy(period.from)} – ${dmy(period.to)}`,
      header: ["Cabang", "Kode", "Hari lapor", "Hari belum lapor", "Hari daftar usage", ...d.dates.map(dmy)],
      rows: d.branches.map((b) => [b.name, b.code, b.reported, b.missing, b.usageDays, ...b.days.map(mark)]) });
  };
  const exportUsage = async () => {
    const u = await call<{ data: UsageRow[] }>(`/api/waste/usage?${q()}`);
    await downloadXlsx({ fileName: file("Usage Management"), sheet: "Usage Management", title: `Usage Management ${dmy(period.from)} – ${dmy(period.to)}`,
      header: ["Tanggal", "Cabang", "Kode", "Item", "Qty", "Satuan", "Kategori", "Alasan", "Diisi oleh", "Waktu", "Foto"],
      rows: u.data.map((r) => [r.businessDate, r.branchName, r.itemCode, r.itemName, r.qty, r.unit, r.category, r.note, r.by,
        wibDateTime(r.updatedAt), r.hasPhoto ? `${location.origin}${usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode)}` : ""]) });
  };
  const safe = (f: () => Promise<void>) => async () => { try { await f(); } catch (e) { toast((e as Error).message, "error"); } };

  // the filters in force, as chips; each removable
  const isDefaultPeriod = period.from === wibDay(-6) && period.to === wibDay(0);
  const chips: ActiveFilter[] = [
    ...(!isDefaultPeriod ? [{ key: "p", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod(DEFAULT_PERIOD()) }] : []),
    ...(branch ? [{ key: "b", label: branches.find((x) => x.branch_code === branch)?.branch_name ?? branch, onRemove: () => setBranch("") }] : []),
    ...(scope ? [{ key: "t", label: scopeLabel(scope), onRemove: () => setScope("") }] : []),
    ...(category ? [{ key: "c", label: category, onRemove: () => setCategory("") }] : []),
    ...(status ? [{ key: "s", label: statusLabel(status), onRemove: () => setStatus("") }] : []),
  ];

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Page title={review ? tr("Waste Review") : tr("Waste Monitor")}
      subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${review ? tr("approve or reject the waste of the branches") : tr("Waste entered by every branch")}`}
      actions={review ? <Button variant="secondary" size="sm" onClick={() => setCats(true)}><Tags size={14} />{tr("Categories")}</Button> : undefined}
      stats={
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Entries")} emphasis icon={<Trash2 size={13} />} value={sm ? fmtNumber(sm.entries) : <StatSkeleton />}>
            {sm && <p>{tr("{0} people entered", fmtNumber(sm.people))}</p>}
          </Stat>
          <Stat label={tr("Branches")} icon={<Store size={13} />} onClick={() => setView("branches")} active={view === "branches"} value={sm ? fmtNumber(sm.branches) : <StatSkeleton />} />
          <Stat label={tr("Waiting Review")} icon={<Tags size={13} />} onClick={() => setStatus(status === "submitted" ? "" : "submitted")} active={status === "submitted"}
            value={sm ? <span className={sm.submitted ? "text-amber-600" : undefined}>{fmtNumber(sm.submitted)}</span> : <StatSkeleton />} />
          <Stat label={tr("Waste Value")} icon={<Package size={13} />} onClick={() => setView("items")} active={view === "items"} value={sm ? fmtRp(sm.value ?? 0) : <StatSkeleton />}>
            {sm && <p>{sm.unpriced ? tr("{0} entries without a price", fmtNumber(sm.unpriced)) : tr("Without rejected entries")}</p>}
          </Stat>
          <Stat label={tr("Approved / Rejected")} icon={<CheckCircle2 size={13} />} value={sm ? `${fmtNumber(sm.approved)} / ${fmtNumber(sm.rejected)}` : <StatSkeleton />} />
        </StatStrip>
      }>
      <Panel toolbar={
        <div className="space-y-3">
          <FilterToolbar search={view === "entries" ? search : undefined} onSearch={view === "entries" ? setSearch : undefined}
            placeholder={tr("Search item, branch or person")} filters={chips} onOpen={() => setSheet(true)}
            onClear={() => { setPeriod(DEFAULT_PERIOD()); setBranch(""); setScope(""); setCategory(""); setStatus(review ? "submitted" : ""); }}
            extra={<div className="ml-auto"><ExcelExportMenu footer={<>{branch ? `${branches.find((b) => b.branch_code === branch)?.branch_name ?? branch} · ` : `${tr("All Branches")} · `}{dmy(period.from)} – {dmy(period.to)}</>} choices={[
        { key: "entries", label: tr("Waste Entries"), hint: tr("Every entry with category, dates, note, status and photo link (filters applied)"), icon: <Trash2 size={16} />, tone: "bg-brand-50 text-brand-600", count: res ? rows.length : null, run: safe(exportEntries) },
        { key: "items", label: tr("Totals per Item"), hint: tr("Quantity per SKU, without rejected entries"), icon: <Package size={16} />, tone: "bg-violet-50 text-violet-600", count: res ? res.byItem.length : null, run: safe(exportItems) },
        { key: "daily", label: tr("Daily Report"), hint: tr("Per branch and day: waste entries, no waste or not reported"), icon: <CalendarCheck size={16} />, tone: "bg-amber-50 text-amber-600", run: safe(exportDaily) },
        { key: "usage", label: tr("Usage Management"), hint: tr("The daily usage lists of the branches"), icon: <ClipboardList size={16} />, tone: "bg-emerald-50 text-emerald-600", run: safe(exportUsage) },
      ]} /></div>} />
          <div role="tablist" aria-label={tr("View")} className="-mx-1 flex gap-1 overflow-x-auto border-b border-neutral-200 px-1">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const count = !res ? null : v.value === "entries" ? res.data.length : v.value === "items" ? res.byItem.length
                : v.value === "branches" ? res.byBranch.length : v.value === "categories" ? res.byCategory.length : null;
              const on = view === v.value;
              return (
                <button key={v.value} type="button" role="tab" aria-selected={on} onClick={() => setView(v.value)}
                  className={cx("-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    on ? "border-brand-700 text-brand-800" : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800")}>
                  <Icon size={15} className={on ? "text-brand-700" : "text-neutral-400"} />{v.label()}
                  {count !== null && <span className={cx("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", on ? "bg-brand-100 text-brand-800" : "bg-neutral-100 text-neutral-500")}>{fmtNumber(count)}</span>}
                </button>
              );
            })}
          </div>
          {review && view === "entries" && waiting.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-neutral-700">
                <input type="checkbox" checked={picked.size > 0 && picked.size === waiting.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(waiting.map((x) => x.id)) : new Set())} />
                {tr("{0} of {1} selected", picked.size, waiting.length)}
              </label>
              <span className="flex-1" />
              <Button size="sm" variant="secondary" disabled={!picked.size || busy} onClick={() => void investigate()}><FileSearch size={14} />{tr("Investigate")}</Button>
              <Button size="sm" variant="secondary" disabled={!picked.size} onClick={() => setVerdict("rejected")}><XCircle size={14} />{tr("Reject")}</Button>
              <Button size="sm" disabled={!picked.size} onClick={() => setVerdict("approved")}><CheckCircle2 size={14} />{tr("Approve")}</Button>
            </div>
          )}
        </div>
      }
        footer={res && view === "entries" ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 2,000 of the period")}` : ""}</span><PageNav paged={paged} /></> : undefined}>
        {view === "investigations" ? <InvestigationList key={String(investigation)} onOpen={setInvestigation} />
          : view === "daily" ? <DailyReport period={period} branch={branch} onBranch={(c) => { setBranch(c); setView("entries"); }} />
          : view === "usage" ? <UsageReport period={period} branch={branch} />
          : error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <SkeletonRows cols={6} /> : view === "entries" ? (
          rows.length === 0 ? (
            <Empty icon={<Trash2 size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No waste in this period")}>
              {!res.data.length && tr("Waste appears here as soon as the branches enter it from Waste (input).")}
            </Empty>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[960px] text-sm">
                <thead className={theadClass}><tr>
                  {review && <th className="w-10 py-2.5 pl-5"><span className="sr-only">{tr("Select")}</span></th>}
                  <th className={cx("w-16 py-2.5 pr-3", review ? "pl-2" : "pl-5")}>{tr("Photo")}</th><th className="px-3 py-2.5">{tr("Item")}</th>
                  <th className="px-3 py-2.5">{tr("Branch")}</th><th className="px-3 py-2.5">{tr("Date")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Quantity")}</th><th className="px-3 py-2.5 text-right">{tr("Value")}</th>
                  <th className="px-3 py-2.5">{tr("Waste category")}</th><th className="px-3 py-2.5">{tr("Entered by")}</th><th className="px-3 py-2.5 pr-5">{tr("Status")}</th>
                </tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {paged.rows.map((e) => {
                    const pick = review && (e.status === "submitted" || e.status === "investigating");
                    return (
                      <tr key={e.id} onClick={() => setOpen(e)} className={cx("cursor-pointer", picked.has(e.id) ? "bg-brand-50/60" : "hover:bg-neutral-50/70")}>
                        {review && <td className="py-2.5 pl-5" onClick={(x) => x.stopPropagation()}>{pick && <input type="checkbox" checked={picked.has(e.id)} onChange={() => toggle(e.id)} aria-label={e.itemName} />}</td>}
                        <td className={cx("py-2 pr-3", review ? "pl-2" : "pl-5")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb(photoUrl(e.id), 96)} decoding="async" alt="" loading="lazy" className="h-11 w-11 rounded-lg bg-neutral-100 object-cover" />
                        </td>
                        <td className="max-w-[16rem] px-3 py-2"><p className="truncate font-medium text-neutral-900">{e.itemName}</p>
                          <p className="truncate text-[11px] text-neutral-400">{e.itemCode} · {scopeLabel(e.scope)}</p></td>
                        <td className="max-w-[12rem] px-3 py-2"><p className="truncate text-neutral-700">{e.branchName}</p></td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-700">{dmy(e.businessDate)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtQty(e.qty)} <span className="text-neutral-400">{e.unit}</span></td>
                        <td className={cx("whitespace-nowrap px-3 py-2 text-right tabular-nums", e.value == null ? "text-amber-700" : "font-medium text-neutral-900")}>{e.value == null ? tr("No price") : fmtRp(e.value)}</td>
                        <td className="max-w-[10rem] px-3 py-2"><p className="truncate text-neutral-600">{e.category || "—"}</p>{e.note && <p className="truncate text-[11px] text-neutral-400" title={e.note}>“{e.note}”</p>}</td>
                        <td className="max-w-[10rem] px-3 py-2"><p className="truncate text-neutral-700">{e.name}</p><p className="text-[11px] text-neutral-400">{wibDateTime(e.createdAt)}</p></td>
                        <td className="px-3 py-2 pr-5"><Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {paged.rows.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50">
                  {review && (e.status === "submitted" || e.status === "investigating") && <input type="checkbox" className="mt-4" checked={picked.has(e.id)} onChange={() => toggle(e.id)} aria-label={e.itemName} />}
                  <button type="button" onClick={() => setOpen(e)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(photoUrl(e.id), 160)} decoding="async" alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-lg bg-neutral-100 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-neutral-900">{e.itemName}</span>
                        <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge>
                      </span>
                      <span className="block text-xs text-neutral-600">{fmtQty(e.qty)} {e.unit} · {fmtRp(e.value)} · {scopeLabel(e.scope)} · {e.category}</span>
                      <span className="block truncate text-xs text-neutral-500">{e.branchName} · {dmy(e.businessDate)} · {e.name}{e.note ? ` · “${e.note}”` : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            </>
          )
        ) : (
          <Totals view={view} res={res} onBranch={(c) => { setBranch(c); setView("entries"); }} />
        )}
      </Panel>

      <Drawer open={!!open} onClose={() => setOpen(null)} icon={<Trash2 size={18} />} title={open?.itemName ?? ""} description={open ? `${open.branchName} · ${dmy(open.businessDate)}` : ""}
        footer={open && review && (open.status === "submitted" || open.status === "investigating") ? (
          <div className="flex flex-wrap justify-end gap-2">
            {open.investigationId
              ? <Button variant="secondary" className="mr-auto" onClick={() => { setInvestigation(open.investigationId!); setOpen(null); }}><FileSearch size={14} />{tr("Open the investigation")}</Button>
              : <Button variant="secondary" className="mr-auto" disabled={busy} onClick={() => { setPicked(new Set()); void investigate(); }}><FileSearch size={14} />{tr("Investigate")}</Button>}
            <Button variant="secondary" onClick={() => { setPicked(new Set()); setVerdict("rejected"); }}><XCircle size={14} />{tr("Reject")}</Button>
            <Button onClick={() => { setPicked(new Set()); setVerdict("approved"); }}><CheckCircle2 size={14} />{tr("Approve")}</Button>
          </div>
        ) : open && review && open.status === "approved" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-xs text-neutral-500">{tr("Approved: counted in the COGS; QA can still investigate it")}</span>
            {open.investigationId
              ? <Button variant="secondary" onClick={() => { setInvestigation(open.investigationId!); setOpen(null); }}><FileSearch size={14} />{tr("Open the investigation")}</Button>
              : <Button variant="secondary" disabled={busy} onClick={() => { setPicked(new Set()); void investigate(); }}><FileSearch size={14} />{tr("Investigate")}</Button>}
          </div>
        ) : undefined}>
        {open && (
          <div className="space-y-4">
            <a href={photoUrl(open.id)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb(photoUrl(open.id), 640)} decoding="async" loading="lazy" alt={tr("Photo evidence")} className="w-full rounded-xl bg-neutral-100 object-contain" />
            </a>
            <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
              {([
                [tr("Status"), <Badge key="s" tone={statusTone(open.status)}>{statusLabel(open.status)}</Badge>],
                [tr("Type"), scopeLabel(open.scope)],
                [tr("Item"), `${open.itemName} (${open.itemCode})`],
                [tr("Quantity"), `${fmtQty(open.qty)} ${open.unit}`],
                [tr("Value"), `${fmtRp(open.value)}${open.unitPrice != null ? ` (${fmtRp(open.unitPrice)} / ${open.unit})` : ""} · ${open.priceSource ? PRICE_SOURCE[open.priceSource]() : "—"}`],
                [tr("Waste category"), open.category],
                [tr("Production Date"), open.productionDate || "—"], [tr("Expired Date"), open.expiredDate || "—"],
                [tr("Note / reason"), open.note || "—"],
                [tr("Entered by"), `${open.name} · @${open.username}`],
                [tr("Entered at"), wibDateTime(open.createdAt)],
                [tr("Photo taken"), open.photoTakenAt ? wibDateTime(open.photoTakenAt) : "—"],
                [tr("Position"), open.latitude !== null && open.longitude !== null
                  ? <a key="p" href={mapsUrl(open.latitude, open.longitude)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{open.latitude.toFixed(5)}, {open.longitude.toFixed(5)}</a> : "—"],
                ...(open.investigationId ? [[tr("Investigation"), <button key="inv" type="button" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                  onClick={() => { setInvestigation(open.investigationId!); setOpen(null); }}><FileSearch size={13} />{tr("Open the investigation")}</button>]] : []),
                ...(open.review ? [[tr("Review"), `${open.review.by ?? ""} · ${open.review.at ? wibDateTime(open.review.at) : ""}${open.review.note ? ` · ${open.review.note}` : ""}`]] : []),
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="flex gap-3 px-3 py-2"><dt className="w-32 flex-shrink-0 text-neutral-500">{k}</dt><dd className="min-w-0 flex-1 text-neutral-800">{v}</dd></div>
              ))}
            </dl>
            <Ingredients entry={open} />
            {open.signed && (
              <div className="rounded-xl border border-neutral-200 p-3">
                <p className="mb-1 text-xs font-semibold text-neutral-700">{tr("Signature of {0}", open.name)}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signatureUrl(open.id)} alt={tr("Signature")} className="max-h-28 object-contain" />
              </div>
            )}
          </div>
        )}
      </Drawer>

      {sheet && <WasteFilterSheet value={{ period, branch, scope, category, status }} branches={branches} categories={res?.categories ?? []}
        onClose={() => setSheet(false)}
        onApply={(f) => { setPeriod(f.period); setBranch(f.branch); setScope(f.scope); setCategory(f.category); setStatus(f.status); setSheet(false); }}
        onReset={() => ({ period: DEFAULT_PERIOD(), branch: "", scope: "", category: "", status: review ? "submitted" : "" })} />}
      {investigation && <InvestigationDrawer id={investigation} onClose={() => setInvestigation(null)} onChanged={() => void load()} />}
      {cats && <CategoriesDrawer onClose={() => setCats(false)} />}
      <ConfirmDialog open={!!verdict} busy={busy} danger={verdict === "rejected"}
        title={verdict === "approved" ? tr("Approve the waste?") : tr("Reject the waste?")}
        description={tr("{0} entries", open && !picked.size ? 1 : picked.size)}
        confirmLabel={verdict === "approved" ? tr("Approve") : tr("Reject")} reasonLabel={tr("Note for the branch (optional)")}
        onConfirm={(note) => void decide(note)} onClose={() => setVerdict(null)} />
    </Page>
  );
}

/** The share of a value in the total: a thin bar with the percentage. */
function Share({ value, total }: { value: number | null | undefined; total: number }) {
  const r = total > 0 && value ? value / total : 0;
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, r * 100)}%` }} /></span>
      <span className="w-11 text-right text-xs tabular-nums text-neutral-500">{(r * 100).toFixed(1)}%</span>
    </span>
  );
}
const rank = "w-10 py-2.5 pl-5 text-right text-xs tabular-nums text-neutral-400";

function Totals({ view, res, onBranch }: { view: Exclude<View, "entries" | "investigations">; res: MonitorData; onBranch: (code: string) => void }) {
  if (view === "items") {
    const items = [...res.byItem].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
    const total = items.reduce((a, i) => a + (i.value ?? 0), 0);
    return !items.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="m-cards w-full min-w-[820px] text-sm">
        <thead className={theadClass}><tr><th className={rank}>#</th><th className="px-3 py-2.5">{tr("Item")}</th><th className="px-3 py-2.5">{tr("Type")}</th>
          <th className="px-3 py-2.5 text-right">{tr("Quantity")}</th><th className="px-3 py-2.5 text-right">{tr("Value")}</th><th className="px-3 py-2.5 text-right">{tr("Share of Value")}</th>
          <th className="px-3 py-2.5 text-right">{tr("Entries")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Branches")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{items.map((i, n) => (
          <tr key={`${i.scope}:${i.code}:${i.unit}`} className="hover:bg-neutral-50/70"><td className={rank}>{n + 1}</td>
            <td className="px-3 py-2"><p className="font-medium text-neutral-800">{i.name}</p><p className="text-[11px] text-neutral-400">{i.code}</p></td>
            <td className="px-3 py-2"><Badge tone="slate">{scopeLabel(i.scope)}</Badge></td><td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtQty(i.qty)} <span className="text-neutral-400">{i.unit}</span></td>
            <td className={cx("whitespace-nowrap px-3 py-2 text-right tabular-nums", i.value == null ? "text-amber-700" : "font-medium text-neutral-900")}>{i.value == null ? tr("No price") : fmtRp(i.value)}</td>
            <td className="px-3 py-2"><Share value={i.value} total={total} /></td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(i.entries)}</td><td className="px-3 py-2 pr-5 text-right tabular-nums">{fmtNumber(i.branches)}</td></tr>
        ))}</tbody>
        <tfoot className="border-t border-neutral-200 bg-neutral-50 text-sm font-semibold"><tr><td /><td className="px-3 py-2.5" colSpan={3}>{tr("Total")}</td>
          <td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(total)}</td><td /><td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(items.reduce((a, i) => a + i.entries, 0))}</td><td /></tr></tfoot>
        </table>
        <p className="px-5 py-2 text-[11px] text-neutral-400">{tr("Rejected entries are not counted")}</p></div>
    );
  }
  if (view === "branches") {
    const total = res.byBranch.reduce((a, b) => a + (b.value ?? 0), 0);
    return !res.byBranch.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="m-cards w-full min-w-[860px] text-sm">
        <thead className={theadClass}><tr><th className={rank}>#</th><th className="px-3 py-2.5">{tr("Branch")}</th><th className="px-3 py-2.5 text-right">{tr("Value")}</th><th className="px-3 py-2.5 text-right">{tr("Share of Value")}</th>
          <th className="px-3 py-2.5 text-right">{tr("Entries")}</th><th className="px-3 py-2.5 text-right">{tr("Waiting Review")}</th><th className="px-3 py-2.5 text-right">{tr("Days with Waste")}</th><th className="px-3 py-2.5 pr-5">{tr("Last Entry")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{res.byBranch.map((b, n) => (
          <tr key={b.code} className="cursor-pointer hover:bg-neutral-50/70" onClick={() => onBranch(b.code)}><td className={rank}>{n + 1}</td>
            <td className="px-3 py-2 font-medium text-neutral-800">{b.name}</td><td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{fmtRp(b.value)}</td>
            <td className="px-3 py-2"><Share value={b.value} total={total} /></td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(b.entries)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{b.submitted > 0 ? <Badge tone="amber">{fmtNumber(b.submitted)}</Badge> : <span className="text-neutral-300">0</span>}</td>
            <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(b.days)}</td><td className="whitespace-nowrap px-3 py-2 pr-5 text-neutral-600">{b.last_at ? wibDateTime(b.last_at) : "—"}</td></tr>
        ))}</tbody>
        <tfoot className="border-t border-neutral-200 bg-neutral-50 text-sm font-semibold"><tr><td /><td className="px-3 py-2.5">{tr("Total")}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmtRp(total)}</td><td />
          <td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(res.byBranch.reduce((a, b) => a + b.entries, 0))}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(res.byBranch.reduce((a, b) => a + b.submitted, 0))}</td><td colSpan={2} /></tr></tfoot>
        </table>
        <p className="px-5 py-2 text-[11px] text-neutral-400">{tr("Open a branch to see its entries")}</p></div>
    );
  }
  const total = res.byCategory.reduce((a, c) => a + c.entries, 0);
  return !res.byCategory.length ? <Empty title={tr("No waste in this period")} /> : (
    <ul className="divide-y divide-neutral-100">{res.byCategory.map((c, n) => (
      <li key={c.name} className="flex items-center gap-3 px-5 py-3">
        <span className="w-6 text-right text-xs tabular-nums text-neutral-400">{n + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-neutral-800">{c.name}</span>
            <span className="flex-shrink-0 tabular-nums text-neutral-600">{tr("{0} entries", fmtNumber(c.entries))} · {total ? ((c.entries / total) * 100).toFixed(1) : "0.0"}%</span></span>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${total ? (c.entries / total) * 100 : 0}%` }} /></span>
        </span>
      </li>
    ))}</ul>
  );
}

/** The filters of the monitor / review in one sheet: period, branch, type, category, status. */
function WasteFilterSheet({ value, branches, categories, onApply, onClose, onReset }: {
  value: Filters; branches: BranchOpt[]; categories: string[]; onApply: (f: Filters) => void; onClose: () => void; onReset: () => Filters;
}) {
  const [d, setD] = useState<Filters>(value);
  const def = DEFAULT_PERIOD();
  const period = periodLabel(d.period, def);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  const active = [period, d.branch, d.scope, d.status, d.category].filter(Boolean).length;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onReset={() => setD(onReset())} onApply={() => onApply(d)} applyDisabled={days > 92}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 7 Days")} onClear={period ? () => setD({ ...d, period: def }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={92} />
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Branch")} value={branches.find((b) => b.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} allLabel={tr("All Branches")} placeholder={tr("Search branch")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code }))} />
      </FilterRow>
      <FilterRow icon={<Package size={15} />} label={tr("Type")} value={d.scope ? scopeLabel(d.scope) : null} onClear={() => setD({ ...d, scope: "" })}>
        <Segments value={d.scope} onChange={(v) => setD({ ...d, scope: v as Filters["scope"] })}
          choices={[{ value: "", label: tr("All types") }, ...SCOPES.map((x) => ({ value: x, label: scopeLabel(x) }))]} />
      </FilterRow>
      <FilterRow icon={<ListChecks size={15} />} label={tr("Status")} value={d.status ? statusLabel(d.status) : null} onClear={() => setD({ ...d, status: "" })}>
        <Segments value={d.status} onChange={(v) => setD({ ...d, status: v as Filters["status"] })}
          choices={[{ value: "", label: tr("All statuses") }, ...(["submitted", "investigating", "approved", "rejected"] as Status[]).map((x) => ({ value: x, label: statusLabel(x) }))]} />
      </FilterRow>
      <FilterRow icon={<Tags size={15} />} label={tr("Waste Category")} value={d.category || null} onClear={() => setD({ ...d, category: "" })}>
        <ComboFilter value={d.category} onChange={(v) => setD({ ...d, category: v })} allLabel={tr("All categories")} placeholder={tr("Search category")}
          options={categories.map((c) => ({ value: c, label: c }))} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

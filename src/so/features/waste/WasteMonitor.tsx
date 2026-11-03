"use client";

// Waste monitor (page cc.waste-monitor) and review (page cc.waste-review) of Cost Control (integrated_portal_be
// app/waste.py): the waste every branch entered in a period, filtered by branch, type, category and status; totals per
// item, branch and category; each entry with its photo, note and author. In review mode the entries waiting for review
// are ticked and approved or rejected (with a note), one by one or many at once. Export: Excel (entries, per item, daily report, Usage Management) from the Excel icon.
// Daily report: the branches that reported their waste each day; Usage Management: the daily lists (WasteDaily.tsx).

import { CalendarCheck, CheckCircle2, ClipboardList, FileSearch, Package, Store, Tags, Trash2, XCircle } from "lucide-react";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { downloadXlsx } from "@/lib/xlsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { Segmented } from "@/so/ui/Simple";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterSection, FilterSheet, FilterToolbar, PeriodField, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { mapsUrl } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { DailyReport, UsageReport } from "./WasteDaily";
import { CategoriesDrawer, Ingredients, InvestigationDrawer, InvestigationList } from "./Investigation";
import { type DailyData, type Entry, type MonitorData, type UsageRow, type Scope, type Status, SCOPES, fmtQty, photoUrl, usagePhotoUrl, scopeLabel, signatureUrl, statusLabel, statusTone } from "./waste";
import { thumb } from "@/lib/assets";

const DEFAULT_PERIOD = (): Period => ({ from: wibDay(-6), to: wibDay(0) });
type Filters = { period: Period; branch: string; scope: Scope | ""; category: string; status: Status | "" };
type View = "entries" | "items" | "branches" | "categories" | "daily" | "usage" | "investigations";
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
      "Diinput oleh", "Waktu input", "Catatan review", "Foto"],
    rows: rows.map((e) => [e.businessDate, e.branchName, scopeLabel(e.scope), e.itemCode, e.itemName, e.qty, e.unit, e.category,
      e.productionDate, e.expiredDate, e.note, statusLabel(e.status), e.name, wibDateTime(e.createdAt), e.review?.note,
      `${location.origin}${photoUrl(e.id)}`]) });
  const exportItems = () => downloadXlsx({ fileName: file("Waste per item"), sheet: "Per item", title: `Waste per item ${dmy(period.from)} – ${dmy(period.to)}`,
    header: ["Jenis", "Kode", "Item", "Qty", "Satuan", "Entri", "Cabang"],
    rows: (res?.byItem ?? []).map((i) => [scopeLabel(i.scope), i.code, i.name, i.qty, i.unit, i.entries, i.branches]) });
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
      actions={<>{review && <Button variant="secondary" size="sm" onClick={() => setCats(true)}><Tags size={14} />{tr("Categories")}</Button>}<ExcelExportMenu footer={<>{branch ? `${branches.find((b) => b.branch_code === branch)?.branch_name ?? branch} · ` : `${tr("All Branches")} · `}{dmy(period.from)} – {dmy(period.to)}</>} choices={[
        { key: "entries", label: tr("Waste Entries"), hint: tr("Every entry with category, dates, note, status and photo link (filters applied)"), icon: <Trash2 size={16} />, tone: "bg-brand-50 text-brand-600", count: res ? rows.length : null, run: safe(exportEntries) },
        { key: "items", label: tr("Totals per Item"), hint: tr("Quantity per SKU, without rejected entries"), icon: <Package size={16} />, tone: "bg-violet-50 text-violet-600", count: res ? res.byItem.length : null, run: safe(exportItems) },
        { key: "daily", label: tr("Daily Report"), hint: tr("Per branch and day: waste entries, no waste or not reported"), icon: <CalendarCheck size={16} />, tone: "bg-amber-50 text-amber-600", run: safe(exportDaily) },
        { key: "usage", label: tr("Usage Management"), hint: tr("The daily usage lists of the branches"), icon: <ClipboardList size={16} />, tone: "bg-emerald-50 text-emerald-600", run: safe(exportUsage) },
      ]} /></>}
      stats={
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Entries")} emphasis icon={<Trash2 size={13} />} value={sm ? fmtNumber(sm.entries) : <StatSkeleton />}>
            {sm && <p>{tr("{0} people entered", fmtNumber(sm.people))}</p>}
          </Stat>
          <Stat label={tr("Branches")} icon={<Store size={13} />} onClick={() => setView("branches")} active={view === "branches"} value={sm ? fmtNumber(sm.branches) : <StatSkeleton />} />
          <Stat label={tr("Items")} icon={<Package size={13} />} onClick={() => setView("items")} active={view === "items"} value={sm ? fmtNumber(sm.items) : <StatSkeleton />} />
          <Stat label={tr("Waiting Review")} icon={<Tags size={13} />} onClick={() => setStatus(status === "submitted" ? "" : "submitted")} active={status === "submitted"}
            value={sm ? <span className={sm.submitted ? "text-amber-600" : undefined}>{fmtNumber(sm.submitted)}</span> : <StatSkeleton />} />
          <Stat label={tr("Approved / Rejected")} icon={<CheckCircle2 size={13} />} value={sm ? `${fmtNumber(sm.approved)} / ${fmtNumber(sm.rejected)}` : <StatSkeleton />} />
        </StatStrip>
      }>
      <Panel toolbar={
        <div className="space-y-3">
          <FilterToolbar search={view === "entries" ? search : undefined} onSearch={view === "entries" ? setSearch : undefined}
            placeholder={tr("Search item, branch or person")} filters={chips} onOpen={() => setSheet(true)}
            onClear={() => { setPeriod(DEFAULT_PERIOD()); setBranch(""); setScope(""); setCategory(""); setStatus(review ? "submitted" : ""); }} />
          <Segmented label={tr("View")} value={view} onChange={setView} options={[
            { value: "entries", label: tr("Entries") }, { value: "items", label: tr("Per Item") },
            { value: "branches", label: tr("Per Branch") }, { value: "categories", label: tr("Per Category") },
            { value: "daily", label: tr("Daily Report") }, { value: "usage", label: tr("Usage Management") },
            { value: "investigations", label: tr("Investigations") }]} />
          {review && view === "entries" && waiting.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm">
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
            <ul className="divide-y divide-neutral-100">
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
                      <span className="block text-xs text-neutral-600">{fmtQty(e.qty)} {e.unit} · {scopeLabel(e.scope)} · {e.category}</span>
                      <span className="block truncate text-xs text-neutral-500">{e.branchName} · {dmy(e.businessDate)} · {e.name}{e.note ? ` · “${e.note}”` : ""}</span>
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

      <Drawer open={!!open} onClose={() => setOpen(null)} icon={<Trash2 size={18} />} title={open?.itemName ?? ""} description={open ? `${open.branchName} · ${dmy(open.businessDate)}` : ""}
        footer={open && review && (open.status === "submitted" || open.status === "investigating") ? (
          <div className="flex flex-wrap justify-end gap-2">
            {open.investigationId
              ? <Button variant="secondary" className="mr-auto" onClick={() => { setInvestigation(open.investigationId!); setOpen(null); }}><FileSearch size={14} />{tr("Open the investigation")}</Button>
              : <Button variant="secondary" className="mr-auto" disabled={busy} onClick={() => { setPicked(new Set()); void investigate(); }}><FileSearch size={14} />{tr("Investigate")}</Button>}
            <Button variant="secondary" onClick={() => { setPicked(new Set()); setVerdict("rejected"); }}><XCircle size={14} />{tr("Reject")}</Button>
            <Button onClick={() => { setPicked(new Set()); setVerdict("approved"); }}><CheckCircle2 size={14} />{tr("Approve")}</Button>
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
                [tr("Waste category"), open.category],
                [tr("Production Date"), open.productionDate || "—"], [tr("Expired Date"), open.expiredDate || "—"],
                [tr("Note / reason"), open.note || "—"],
                [tr("Entered by"), `${open.name} · @${open.username}`],
                [tr("Entered at"), wibDateTime(open.createdAt)],
                [tr("Photo taken"), open.photoTakenAt ? wibDateTime(open.photoTakenAt) : "—"],
                [tr("Position"), open.latitude !== null && open.longitude !== null
                  ? <a key="p" href={mapsUrl(open.latitude, open.longitude)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{open.latitude.toFixed(5)}, {open.longitude.toFixed(5)}</a> : "—"],
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

function Totals({ view, res, onBranch }: { view: Exclude<View, "entries" | "investigations">; res: MonitorData; onBranch: (code: string) => void }) {
  if (view === "items") {
    return !res.byItem.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Type")}</th>
          <th className="px-4 py-2.5 text-right">{tr("Quantity")}</th><th className="px-4 py-2.5 text-right">{tr("Entries")}</th><th className="px-4 py-2.5 text-right">{tr("Branches")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{res.byItem.map((i) => (
          <tr key={`${i.scope}:${i.code}:${i.unit}`}><td className="px-4 py-2"><p className="font-medium text-neutral-800">{i.name}</p><p className="text-[11px] text-neutral-400">{i.code}</p></td>
            <td className="px-4 py-2 text-neutral-600">{scopeLabel(i.scope)}</td><td className="px-4 py-2 text-right tabular-nums">{fmtQty(i.qty)} {i.unit}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(i.entries)}</td><td className="px-4 py-2 text-right tabular-nums">{fmtNumber(i.branches)}</td></tr>
        ))}</tbody></table>
        <p className="px-4 py-2 text-[11px] text-neutral-400">{tr("Rejected entries are not counted")}</p></div>
    );
  }
  if (view === "branches") {
    return !res.byBranch.length ? <Empty title={tr("No waste in this period")} /> : (
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Branch")}</th><th className="px-4 py-2.5 text-right">{tr("Entries")}</th>
          <th className="px-4 py-2.5 text-right">{tr("Waiting Review")}</th><th className="px-4 py-2.5 text-right">{tr("Days with Waste")}</th><th className="px-4 py-2.5">{tr("Last Entry")}</th></tr></thead>
        <tbody className="divide-y divide-neutral-100">{res.byBranch.map((b) => (
          <tr key={b.code} className="cursor-pointer hover:bg-neutral-50" onClick={() => onBranch(b.code)}><td className="px-4 py-2 font-medium text-neutral-800">{b.name}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.entries)}</td><td className={cx("px-4 py-2 text-right tabular-nums", b.submitted > 0 && "text-amber-600")}>{fmtNumber(b.submitted)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{fmtNumber(b.days)}</td><td className="px-4 py-2 text-neutral-600">{b.last_at ? wibDateTime(b.last_at) : "—"}</td></tr>
        ))}</tbody></table></div>
    );
  }
  const max = Math.max(1, ...res.byCategory.map((c) => c.entries));
  return !res.byCategory.length ? <Empty title={tr("No waste in this period")} /> : (
    <ul className="divide-y divide-neutral-100">{res.byCategory.map((c) => (
      <li key={c.name} className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-neutral-800">{c.name}</span><span className="tabular-nums text-neutral-600">{fmtNumber(c.entries)}</span></div>
        <div className="mt-1 h-1.5 rounded-full bg-neutral-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(c.entries / max) * 100}%` }} /></div>
      </li>
    ))}</ul>
  );
}

/** The filters of the monitor / review in one sheet: period, branch, type, category, status. */
function WasteFilterSheet({ value, branches, categories, onApply, onClose, onReset }: {
  value: Filters; branches: BranchOpt[]; categories: string[]; onApply: (f: Filters) => void; onClose: () => void; onReset: () => Filters;
}) {
  const [d, setD] = useState<Filters>(value);
  const pill = (on: boolean) => cx("rounded-full border px-3 py-1.5 text-xs font-medium", on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50");
  return (
    <FilterSheet onClose={onClose} onReset={() => setD(onReset())} onApply={() => onApply(d)}>
      <FilterSection title={tr("Period")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={92} /></FilterSection>
      <FilterSection title={tr("Branch")}>
        <select className={inputClass} value={d.branch} onChange={(e) => setD({ ...d, branch: e.target.value })} aria-label={tr("Branch")}>
          <option value="">{tr("All Branches")}</option>
          {branches.map((b) => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
        </select>
      </FilterSection>
      <FilterSection title={tr("Type")}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill(!d.scope)} onClick={() => setD({ ...d, scope: "" })}>{tr("All types")}</button>
          {SCOPES.map((s) => <button key={s} type="button" className={pill(d.scope === s)} onClick={() => setD({ ...d, scope: s })}>{scopeLabel(s)}</button>)}
        </div>
      </FilterSection>
      <FilterSection title={tr("Status")}>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={pill(!d.status)} onClick={() => setD({ ...d, status: "" })}>{tr("All statuses")}</button>
          {(["submitted", "investigating", "approved", "rejected"] as Status[]).map((s) => <button key={s} type="button" className={pill(d.status === s)} onClick={() => setD({ ...d, status: s })}>{statusLabel(s)}</button>)}
        </div>
      </FilterSection>
      <FilterSection title={tr("Waste Category")}>
        <select className={inputClass} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} aria-label={tr("Waste Category")}>
          <option value="">{tr("All categories")}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </FilterSection>
    </FilterSheet>
  );
}

"use client";

// Counts to review (PPIC / Cost Control Supervisor, D-36): what waits for a decision first, every status on demand, the
// figures of the period and every filter in one drawer. Export Excel (2026-10-28): the counts of the period as one xlsx
// for every branch — what the branches sent (approved or not), what waits for a review, everything incl. counts still in
// progress, or the approved ones only; it follows the period and the count type filter.

import LocationBadges from "@/so/features/count/LocationBadges";
import { AlertTriangle, ChevronRight, ClipboardCheck, FileSpreadsheet, Loader2, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, fmtDate, fmtNumber, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import { assetUrl } from "@/lib/assets";
import { useClickOutside } from "@/lib/useClickOutside";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, PeriodField, Period, dmy, wibDay } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { ENTRY_SOURCE, STATUS, countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Row = {
  id: string; number: string; facility_code: string; facility_name: string; facility_type: string; count_type: string; business_date: string;
  status: string; entry_source?: string; is_late: boolean; outside_radius: boolean; submitted_at: string | null; started_by_name: string | null; lines: number;
  low_accuracy?: boolean; facility_located?: boolean; start_distance_m?: number | null; start_accuracy_m?: number | string | null;
  counted: number; flagged: number;
};
type F = { period: Period; status: string; type: string; facilityType: string; source: string };

const DEFAULT: () => F = () => ({ period: { from: wibDay(-6), to: wibDay(0) }, status: "SUBMITTED", type: "", facilityType: "", source: "" });
const STATUSES = ["SUBMITTED", "RECOUNT_REQUESTED", "IN_PROGRESS", "APPROVED", "EXPORTED", "CANCELLED"];

export default function ReviewsPage() {
  const toast = useToast();
  const [f, setF] = useState<F>(DEFAULT);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setExporting(false), exporting);

  // every status of the period: the figures count all of them, the status filter only narrows the list
  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await api<Row[]>(`/api/so/counts?date_from=${f.period.from}&date_to=${f.period.to}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [f.period.from, f.period.to]);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!f.status || r.status === f.status) && (!f.type || r.count_type === f.type) && (!f.facilityType || r.facility_type === f.facilityType)
      && (!f.source || (r.entry_source ?? "CREW") === f.source)
      && (!s || [r.facility_name, r.facility_code, r.number].some((v) => v.toLowerCase().includes(s))));
  }, [all, search, f]);
  const paged = usePaged(shown, shown.length + search + JSON.stringify(f));
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const flaggedCounts = all.filter((r) => r.status === "SUBMITTED" && r.flagged > 0).length;

  // every branch of the period in one file, one sheet per branch; `status` = which counts (REPORT_STATUSES of the platform)
  const download = async (status: ExportKind) => {
    setDownloading(true);
    try {
      const qs = new URLSearchParams({ date_from: f.period.from, date_to: f.period.to, status, per_branch: "true", ...(f.type ? { count_type: f.type } : {}) });
      const res = await fetch(`/api/so/count-reports/file?${qs}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(res.status === 404 ? tr("No count with this status in the period") : body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname ${EXPORT_FILE[status]} ${f.period.from} - ${f.period.to}.xlsx` }).click();
      URL.revokeObjectURL(href);
      setExporting(false);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setDownloading(false);
    }
  };
  const exportCount: Record<ExportKind, number> = {
    ENTERED: all.filter((r) => ["SUBMITTED", "RECOUNT_REQUESTED", "APPROVED", "EXPORTED"].includes(r.status) && (!f.type || r.count_type === f.type)).length,
    SUBMITTED: all.filter((r) => r.status === "SUBMITTED" && (!f.type || r.count_type === f.type)).length,
    ALL: all.filter((r) => r.status !== "CANCELLED" && (!f.type || r.count_type === f.type)).length,
    REVIEWED: all.filter((r) => ["APPROVED", "EXPORTED"].includes(r.status) && (!f.type || r.count_type === f.type)).length,
  };

  const def = DEFAULT();
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to
      ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.status ? [{ key: "s", label: tr("Status: {0}", STATUS[f.status]?.label() ?? f.status), onRemove: () => setF({ ...f, status: "" }) }] : []),
    ...(f.type ? [{ key: "t", label: countTypeLabel(f.type), onRemove: () => setF({ ...f, type: "" }) }] : []),
    ...(f.facilityType ? [{ key: "ft", label: f.facilityType, onRemove: () => setF({ ...f, facilityType: "" }) }] : []),
    ...(f.source ? [{ key: "src", label: ENTRY_SOURCE[f.source]?.() ?? f.source, onRemove: () => setF({ ...f, source: "" }) }] : []),
  ];

  return (
    <Page title={tr("Review Stock Opname")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("approve submitted counts or ask for a recount")}`}
      actions={
        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setExporting(!exporting)} disabled={downloading} aria-expanded={exporting} aria-haspopup="menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            title={downloading ? tr("Export in progress") : tr("Export to Excel")} aria-label={tr("Export")}>
            {downloading ? <Loader2 size={18} className="animate-spin text-slate-600" />
              : <span className="relative h-6 w-6"><Image src={assetUrl("assets/xlsx.png")} alt="" fill sizes="24px" className="object-contain" /></span>}
          </button>
          {exporting && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
              <div className="p-1.5">
                <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Export to")} Excel</p>
                {EXPORT_KINDS.map((k) => (
                  <button key={k} type="button" role="menuitem" disabled={exportCount[k] === 0} onClick={() => void download(k)}
                    className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent">
                    <FileSpreadsheet size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-800">{EXPORT_LABEL[k]()}</span>
                      <span className="block text-xs text-slate-500">{EXPORT_HINT[k]()}</span>
                    </span>
                    <span className="mt-0.5 flex-shrink-0 text-xs font-semibold tabular-nums text-slate-500">{fmtNumber(exportCount[k])}</span>
                  </button>
                ))}
                <p className="border-t border-slate-100 px-2.5 pb-1 pt-2 text-[11px] text-slate-400">
                  {f.type ? `${countTypeLabel(f.type)} · ` : ""}{tr("every branch, one sheet per branch")} · {dmy(f.period.from)} – {dmy(f.period.to)}
                </p>
              </div>
            </div>
          )}
        </div>
      }
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Waiting for review")} emphasis value={rows ? fmtNumber(n("SUBMITTED")) : <StatSkeleton />}>
            {rows && <p>{flaggedCounts ? tr("{0} with lines to check", fmtNumber(flaggedCounts)) : tr("No flagged lines")}</p>}
          </Stat>
          <Stat label={tr("Recount requested")} icon={<RotateCcw size={12} />} value={rows ? fmtNumber(n("RECOUNT_REQUESTED")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} in progress", fmtNumber(n("IN_PROGRESS")))}</p>}
          </Stat>
          <Stat label={tr("Approved")} value={rows ? fmtNumber(n("APPROVED") + n("EXPORTED")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} exported to ESB", fmtNumber(n("EXPORTED")))}</p>}
          </Stat>
          <Stat label={tr("Counts in the period")} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} late · {1} outside radius", fmtNumber(all.filter((r) => r.is_late).length), fmtNumber(all.filter((r) => r.outside_radius).length))}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search facility or count number")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF({ ...DEFAULT(), status: "" })} />}
        footer={rows ? <><span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<ClipboardCheck size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No counts in this period")}>
            {f.status === "SUBMITTED" && all.length > 0 && tr("Nothing is waiting for review. Change the status filter to see the other counts.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((r) => {
                const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                return (
                  <li key={r.id}>
                    <Link href={`/cost-control/reviews/${r.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">{r.facility_name}</span>
                        <span className="block truncate text-xs text-slate-500">{countTypeLabel(r.count_type)} · {dmy(r.business_date)} · {r.counted}/{r.lines}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                        </span>
                      </span>
                      <Badge tone={st.tone} dot>{st.label()}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Facility")}</th>
                    <th className="px-4 py-2.5">{tr("Count")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Counted")}</th>
                    <th className="px-4 py-2.5">{tr("Checks")}</th>
                    <th className="px-4 py-2.5">{tr("Submitted")}</th>
                    <th className="w-16 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={7} /> : paged.rows.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                    const p = r.lines ? Math.round((r.counted / r.lines) * 100) : 0;
                    return (
                      <tr key={r.id} className="group hover:bg-slate-50/70">
                        <td className="max-w-[18rem] px-4 py-3">
                          <Link href={`/cost-control/reviews/${r.id}`} className="block min-w-0">
                            <span className="block truncate font-medium text-slate-900 group-hover:text-blue-700">{r.facility_name}</span>
                            <span className="block truncate font-mono text-[11px] text-slate-400">{r.number}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{countTypeLabel(r.count_type)}<span className="block text-xs text-slate-400">{dmy(r.business_date)}</span></td>
                        <td className="px-4 py-3"><Badge tone={st.tone} dot>{st.label()}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <span className="tabular-nums text-slate-700">{r.counted}/{r.lines}</span>
                          <span className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${p}%` }} /></span>
                        </td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                          <LocationBadges s={r} />
                        </div></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{r.submitted_at ? fmtDate(r.submitted_at) : "—"}
                          {r.started_by_name && <span className="block">{r.started_by_name}</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/cost-control/reviews/${r.id}`} className="inline-flex items-center text-xs font-semibold text-blue-700 hover:underline">{tr("Open")}<ChevronRight size={13} /></Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <ReviewFilters value={f} types={Array.from(new Set(all.map((r) => r.count_type)))} facilityTypes={Array.from(new Set(all.map((r) => r.facility_type)))}
        onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Page>
  );
}

function ReviewFilters({ value, types, facilityTypes, onApply, onClose }: {
  value: F; types: string[]; facilityTypes: string[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD({ ...DEFAULT(), status: "" })} applyDisabled={days > 93}>
      <FilterSection title={tr("Count day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={93} /></FilterSection>
      <FilterSection title={tr("Status")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={[{ value: "", label: tr("All") }, ...STATUSES.map((s) => ({ value: s, label: STATUS[s].label() }))]} />
      </FilterSection>
      <FilterSection title={tr("Count type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All") }, ...types.map((t) => ({ value: t, label: countTypeLabel(t) }))]} />
      </FilterSection>
      <FilterSection title={tr("Facility type")}>
        <ChoiceGroup label="" value={d.facilityType} onChange={(v) => setD({ ...d, facilityType: v })}
          choices={[{ value: "", label: tr("All") }, ...facilityTypes.map((t) => ({ value: t, label: t }))]} />
      </FilterSection>
      <FilterSection title={tr("Entered by")}>
        <ChoiceGroup label="" value={d.source} onChange={(v) => setD({ ...d, source: v })}
          choices={[{ value: "", label: tr("All") }, ...["CREW", "COST_CONTROL", "IMPORT"].map((s) => ({ value: s, label: ENTRY_SOURCE[s]() }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

type ExportKind = "ENTERED" | "SUBMITTED" | "ALL" | "REVIEWED";
const EXPORT_KINDS: ExportKind[] = ["ENTERED", "SUBMITTED", "ALL", "REVIEWED"];
const EXPORT_LABEL: Record<ExportKind, () => string> = {
  ENTERED: () => tr("Everything sent by the branches"), SUBMITTED: () => tr("Waiting for review only"),
  ALL: () => tr("Everything, incl. counts in progress"), REVIEWED: () => tr("Approved only"),
};
const EXPORT_HINT: Record<ExportKind, () => string> = {
  ENTERED: () => tr("Submitted, recount requested, approved and exported — no need to wait for the approval"),
  SUBMITTED: () => tr("Counts submitted and not reviewed yet"),
  ALL: () => tr("Also the counts still being entered (quantities so far)"),
  REVIEWED: () => tr("Approved and exported counts, as in Report Stock Opname"),
};
const EXPORT_FILE: Record<ExportKind, string> = { ENTERED: "Entered", SUBMITTED: "Waiting Review", ALL: "All", REVIEWED: "Approved" };

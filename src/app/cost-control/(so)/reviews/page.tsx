"use client";

// Counts to review (PPIC / Cost Control Supervisor, D-36): what waits for a decision first, every status on demand, the
// figures of the period and every filter in one drawer. Export Excel (2026-10-28): the counts of the period as one xlsx
// for every branch — what the branches sent (approved or not), what waits for a review, everything incl. counts still in
// progress, or the approved ones only; it follows the period and the count type filter.

import { ccUrl } from "@/lib/company";
import LocationBadges from "@/so/features/count/LocationBadges";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Layers, RotateCcw, Send } from "lucide-react";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, fmtDate, fmtNumber, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { Tabs } from "@/components/kc";
import { SkeletonList } from "@/components/kc/Skeleton";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, PeriodField, Period, dmy, wibDay } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { ENTRY_SOURCE, STATUS, countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { SortTh, useSort } from "@/so/ui/Sort";

type SortKey = "facility" | "type" | "date" | "status" | "counted" | "progress" | "flagged" | "submitted";
const STATUS_ORDER = ["SUBMITTED", "RECOUNT_REQUESTED", "IN_PROGRESS", "APPROVED", "EXPORTED", "CANCELLED"];
const sortValue = (r: Row, k: SortKey) => ({
  facility: r.facility_name, type: countTypeLabel(r.count_type), date: r.business_date, status: STATUS_ORDER.indexOf(r.status),
  counted: r.counted, progress: r.lines ? r.counted / r.lines : 0, flagged: r.flagged, submitted: r.submitted_at,
}[k]);

type Row = {
  id: string; number: string; facility_code: string; facility_name: string; facility_type: string; count_type: string; business_date: string;
  status: string; entry_source?: string; is_late: boolean; outside_radius: boolean; submitted_at: string | null; started_by_name: string | null; lines: number;
  low_accuracy?: boolean; facility_located?: boolean; start_distance_m?: number | null; start_accuracy_m?: number | string | null;
  counted: number; flagged: number;
};
type F = { period: Period; status: string; type: string; facilityType: string; source: string };

const DEFAULT: () => F = () => ({ period: { from: wibDay(-6), to: wibDay(0) }, status: "", type: "", facilityType: "", source: "" });
const STATUSES = ["SUBMITTED", "RECOUNT_REQUESTED", "IN_PROGRESS", "APPROVED", "EXPORTED", "CANCELLED"];
/** the tabs above the list (2026-11-04): what waits for Cost Control first; "Approved" holds the exported ones too */
const TABS = ["SUBMITTED", "RECOUNT_REQUESTED", "IN_PROGRESS", "APPROVED", ""];
const FLOW_LABEL: Record<string, () => string> = {
  SUBMITTED: () => tr("Waiting for review"), RECOUNT_REQUESTED: () => tr("Branch recounting"), IN_PROGRESS: () => tr("Branch counting"),
  APPROVED: () => tr("Approved"),
};
const statusMatch = (r: Row, st: string) => !st || r.status === st || (st === "APPROVED" && r.status === "EXPORTED");

export default function ReviewsPage() {
  const toast = useToast();
  const [f, setF] = useState<F>(DEFAULT);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);

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
    return all.filter((r) => statusMatch(r, f.status) && (!f.type || r.count_type === f.type) && (!f.facilityType || r.facility_type === f.facilityType)
      && (!f.source || (r.entry_source ?? "CREW") === f.source)
      && (!s || [r.facility_name, r.facility_code, r.number].some((v) => v.toLowerCase().includes(s))));
  }, [all, search, f]);
  const { rows: ordered, sort, toggle, setSort } = useSort(shown, sortValue);
  const paged = usePaged(ordered, shown.length + search + JSON.stringify(f) + JSON.stringify(sort));
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const flaggedCounts = all.filter((r) => r.status === "SUBMITTED" && r.flagged > 0).length;

  // every branch of the period in one file, one sheet per branch; `status` = which counts (REPORT_STATUSES of the platform)
  const download = async (status: ExportKind) => {
    try {
      const qs = new URLSearchParams({ date_from: f.period.from, date_to: f.period.to, status, per_branch: "true", ...(f.type ? { count_type: f.type } : {}) });
      const res = await fetch(ccUrl(`/api/so/count-reports/file?${qs}`), { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(res.status === 404 ? tr("No count with this status in the period") : body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname ${EXPORT_FILE[status]} ${f.period.from} - ${f.period.to}.xlsx` }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
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
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Waiting for Review")} emphasis value={rows ? fmtNumber(n("SUBMITTED")) : <StatSkeleton />}>
            {rows && <p>{flaggedCounts ? tr("{0} with lines to check", fmtNumber(flaggedCounts)) : tr("No flagged lines")}</p>}
          </Stat>
          <Stat label={tr("Recount Requested")} icon={<RotateCcw size={12} />} value={rows ? fmtNumber(n("RECOUNT_REQUESTED")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} in progress", fmtNumber(n("IN_PROGRESS")))}</p>}
          </Stat>
          <Stat label={tr("Approved")} value={rows ? fmtNumber(n("APPROVED") + n("EXPORTED")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} exported to ESB", fmtNumber(n("EXPORTED")))}</p>}
          </Stat>
          <Stat label={tr("Counts in the Period")} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} late · {1} outside radius", fmtNumber(all.filter((r) => r.is_late).length), fmtNumber(all.filter((r) => r.outside_radius).length))}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<>
        <Tabs label={tr("Status")} value={f.status} onChange={(status) => setF({ ...f, status })}
          tabs={TABS.map((k) => ({ key: k, label: k ? FLOW_LABEL[k]() : tr("All"), count: rows ? fmtNumber(all.filter((r) => statusMatch(r, k)).length) : undefined }))} />
        <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search facility or count number")} filters={chips.filter((c) => c.key !== "s")}
          onOpen={() => setSheet(true)} onClear={() => setF({ ...DEFAULT(), status: f.status })}
          extra={<div className="ml-auto"><ExcelExportMenu choices={EXPORT_KINDS.map((k) => ({ key: k, label: EXPORT_LABEL[k](), hint: EXPORT_HINT[k](), icon: EXPORT_ICON[k],
            tone: EXPORT_TONE[k], count: exportCount[k], run: () => download(k) }))}
            footer={<>{f.type ? `${countTypeLabel(f.type)} · ` : ""}{tr("every branch, one sheet per branch")} · {dmy(f.period.from)} – {dmy(f.period.to)}</>} /></div>} />
      </>}
        footer={rows ? <><span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<ClipboardCheck size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No counts in this period")}>
            {f.status === "SUBMITTED" && all.length > 0 && tr("Nothing is waiting for review. Change the status filter to see the other counts.")}
          </Empty>
        ) : (
          <>
            {/* phones: one card per count; the whole card opens it */}
            <div className="flex items-center gap-2 px-3 pt-3 md:hidden">
              <label className="text-xs text-neutral-500" htmlFor="review-sort">{tr("Sort")}</label>
              <select id="review-sort" className="h-9 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-sm"
                value={sort.key ? `${sort.key}:${sort.dir}` : ""}
                onChange={(e) => { const [k, d] = e.target.value.split(":") as [SortKey, "asc" | "desc"]; setSort(e.target.value ? { key: k, dir: d } : { key: null, dir: "asc" }); }}>
                <option value="">{tr("Default order")}</option>
                {([["submitted:desc", tr("Submitted, newest")], ["submitted:asc", tr("Submitted, oldest")], ["facility:asc", tr("Facility A–Z")],
                  ["flagged:desc", tr("Most lines to check")], ["progress:asc", tr("Least counted")], ["date:desc", tr("Count date, newest")]] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <ul className="space-y-2.5 p-3 md:hidden">
              {rows === null ? <li><SkeletonList rows={4} /></li> : paged.rows.map((r) => {
                const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                const p = r.lines ? Math.round((r.counted / r.lines) * 100) : 0;
                return (
                  <li key={r.id}>
                    <Link href={`/cost-control/reviews/${r.id}`} className="block rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm active:bg-neutral-50">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-neutral-900">{r.facility_name}</span>
                          <span className="block truncate text-xs text-neutral-500">{countTypeLabel(r.count_type)} · {dmy(r.business_date)}</span>
                        </span>
                        <Badge tone={st.tone} dot>{st.label()}</Badge>
                      </span>
                      <span className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${p}%` }} /></span>
                        <span className="tabular-nums">{r.counted}/{r.lines}</span>
                      </span>
                      <span className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                          <LocationBadges s={r} />
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-700">{r.submitted_at ? fmtDate(r.submitted_at) : tr("Open")}<ChevronRight size={14} /></span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <SortTh k="facility" sort={sort} onSort={toggle}>{tr("Facility")}</SortTh>
                    <SortTh k="date" sort={sort} onSort={toggle} first="desc">{tr("Count")}</SortTh>
                    <SortTh k="status" sort={sort} onSort={toggle}>{tr("Status")}</SortTh>
                    <SortTh k="progress" sort={sort} onSort={toggle} align="right" first="desc">{tr("Counted")}</SortTh>
                    <SortTh k="flagged" sort={sort} onSort={toggle} first="desc">{tr("Checks")}</SortTh>
                    <SortTh k="submitted" sort={sort} onSort={toggle} first="desc">{tr("Submitted")}</SortTh>
                    <th className="w-16 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows === null ? <SkeletonRows cols={7} /> : paged.rows.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                    const p = r.lines ? Math.round((r.counted / r.lines) * 100) : 0;
                    return (
                      <tr key={r.id} className="group hover:bg-neutral-50/70">
                        <td className="max-w-[18rem] px-4 py-3">
                          <Link href={`/cost-control/reviews/${r.id}`} className="block min-w-0">
                            <span className="block truncate font-medium text-neutral-900 group-hover:text-brand-700">{r.facility_name}</span>
                            <span className="block truncate font-mono text-[11px] text-neutral-400">{r.number}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">{countTypeLabel(r.count_type)}<span className="block text-xs text-neutral-400">{dmy(r.business_date)}</span></td>
                        <td className="px-4 py-3"><Badge tone={st.tone} dot>{st.label()}</Badge></td>
                        <td className="px-4 py-3 text-right">
                          <span className="tabular-nums text-neutral-700">{r.counted}/{r.lines}</span>
                          <span className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${p}%` }} /></span>
                        </td>
                        <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                          <LocationBadges s={r} />
                        </div></td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500">{r.submitted_at ? fmtDate(r.submitted_at) : "—"}
                          {r.started_by_name && <span className="block">{r.started_by_name}</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/cost-control/reviews/${r.id}`} className="inline-flex items-center text-xs font-semibold text-brand-700 hover:underline">{tr("Open")}<ChevronRight size={13} /></Link>
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
      <FilterSection title={tr("Count Day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={93} /></FilterSection>
      <FilterSection title={tr("Status")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={[{ value: "", label: tr("All") }, ...STATUSES.map((s) => ({ value: s, label: STATUS[s].label() }))]} />
      </FilterSection>
      <FilterSection title={tr("Count Type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All") }, ...types.map((t) => ({ value: t, label: countTypeLabel(t) }))]} />
      </FilterSection>
      <FilterSection title={tr("Facility Type")}>
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
const EXPORT_ICON: Record<ExportKind, React.ReactNode> = {
  ENTERED: <Send size={16} />, SUBMITTED: <Clock size={16} />, ALL: <Layers size={16} />, REVIEWED: <CheckCircle2 size={16} />,
};
const EXPORT_TONE: Record<ExportKind, string> = {
  ENTERED: "bg-brand-50 text-brand-600", SUBMITTED: "bg-amber-50 text-amber-600", ALL: "bg-neutral-100 text-neutral-600",
  REVIEWED: "bg-emerald-50 text-emerald-600",
};
const EXPORT_FILE: Record<ExportKind, string> = { ENTERED: "Entered", SUBMITTED: "Waiting Review", ALL: "All", REVIEWED: "Approved" };

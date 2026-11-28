"use client";

// Counts to review (PPIC / Cost Control Supervisor, D-36): what waits for a decision first, every status on demand, the
// figures of the period and every filter in one drawer. Export Excel (2026-10-28): the counts of the period as one xlsx
// for every branch — what the branches sent (approved or not), what waits for a review, everything incl. counts still in
// progress, or the approved ones only; it follows the period and the count type filter.

import { NativeSelect } from "@/so/ui/Jira";
import { downloadFile } from "@/lib/download-progress";
import { ccUrl } from "@/lib/company";
import LocationBadges from "@/so/features/count/LocationBadges";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, Clock, Layers, RotateCcw, Send } from "lucide-react";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { SoGroupTabs, soGroupOf, soGroupTypes, useGroupTypes, useSoGroup } from "@/so/ui/SoGroupTabs";
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
import { DataSources } from '@/so/features/health/DataHealth';
import { useMe } from "@/so/lib/me";
import Drawer from "@/so/ui/Drawer";
import { Button, cx, inputClass } from "@/so/ui";

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
// bulk review (2026-11-18): approve and recount the sent counts, reject (cancel) the counts not approved yet
type Bulk = "APPROVE" | "RECOUNT" | "CANCEL";
const BULK_OK: Record<Bulk, string[]> = { APPROVE: ["SUBMITTED"], RECOUNT: ["SUBMITTED"], CANCEL: ["IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED"] };
const pickable = (r: Row) => BULK_OK.CANCEL.includes(r.status);

export default function ReviewsPage() {
  const toast = useToast();
  const [f, setF] = useState<F>(DEFAULT);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [group, setGroupOnly] = useSoGroup();
  const setGroup = (g: typeof group) => { setGroupOnly(g); setF((x) => ({ ...x, type: "" })); };
  const typeChoices = useGroupTypes(group, (rows ?? []).map((r) => r.count_type));
  const { can } = useMe();
  const canReview = can("inventory.count.review");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<Bulk | null>(null);
  const pick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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

  // Daily apart from Weekly - Monthly (2026-11-09): the list, the figures and the download follow the tab
  const all = useMemo(() => (rows ?? []).filter((r) => soGroupOf(r.count_type) === group), [rows, group]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => statusMatch(r, f.status) && (!f.type || r.count_type === f.type) && (!f.facilityType || r.facility_type === f.facilityType)
      && (!f.source || (r.entry_source ?? "CREW") === f.source)
      && (!s || [r.facility_name, r.facility_code, r.number].some((v) => v.toLowerCase().includes(s))));
  }, [all, search, f]);
  const { rows: ordered, sort, toggle, setSort } = useSort(shown, sortValue);
  // the selection keeps only what is still shown and still open to a decision
  useEffect(() => { setPicked((p) => new Set([...p].filter((id) => shown.some((r) => r.id === id && pickable(r))))); }, [shown]);
  const selected = (rows ?? []).filter((r) => picked.has(r.id));
  const paged = usePaged(ordered, shown.length + search + JSON.stringify(f) + JSON.stringify(sort));
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const flaggedCounts = all.filter((r) => r.status === "SUBMITTED" && r.flagged > 0).length;

  // every branch of the period in one file, one sheet per branch; `status` = which counts (REPORT_STATUSES of the platform)
  const download = async (status: ExportKind) => {
    try {
      const types = f.type || soGroupTypes((rows ?? []).map((r) => r.count_type), group);
      if (!types) throw new Error(tr("No count with this status in the period"));
      const qs = new URLSearchParams({ date_from: f.period.from, date_to: f.period.to, status, per_branch: "true", count_type: types });
      await downloadFile(`Stock Opname ${group === "daily" ? "Daily" : "Weekly-Monthly"} ${EXPORT_FILE[status]} ${f.period.from} - ${f.period.to}.xlsx`,
        (signal) => fetch(ccUrl(`/api/so/count-reports/file?${qs}`), { credentials: "same-origin", signal }),
        async (res) => {
          const body = await res.json().catch(() => null);
          return res.status === 404 ? tr("No count with this status in the period") : body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded");
        });
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
    <Page title={tr("Stock Opname Review")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("approve submitted counts or ask for a recount")}`}
      stats={<>
        <SoGroupTabs value={group} onChange={setGroup} counts={rows ? { daily: rows.filter((r) => soGroupOf(r.count_type) === "daily").length, periodic: rows.filter((r) => soGroupOf(r.count_type) === "periodic").length } : undefined} />
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
      </>}>
      <DataSources keys={['so']} />
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
        {canReview && selected.length > 0 && (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-4 py-2 sm:px-5">
            <span className="text-sm font-semibold text-[color:var(--j-0055CC)]">{tr("{0} selected", selected.length)}</span>
            <button type="button" onClick={() => setPicked(new Set())} className="text-xs text-[color:var(--j-0C66E4)] hover:underline">{tr("Clear")}</button>
            <span className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" disabled={!selected.some((r) => BULK_OK.APPROVE.includes(r.status))} onClick={() => setBulk("APPROVE")}><CheckCircle2 size={14} /> {tr("Approve")} ({selected.filter((r) => BULK_OK.APPROVE.includes(r.status)).length})</Button>
              <Button size="sm" variant="secondary" disabled={!selected.some((r) => BULK_OK.RECOUNT.includes(r.status))} onClick={() => setBulk("RECOUNT")}><RotateCcw size={14} /> {tr("Recount")} ({selected.filter((r) => BULK_OK.RECOUNT.includes(r.status)).length})</Button>
              <Button size="sm" variant="danger" onClick={() => setBulk("CANCEL")}>{tr("Reject")} ({selected.length})</Button>
            </span>
          </div>
        )}
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<ClipboardCheck size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No counts in this period")}>
            {f.status === "SUBMITTED" && all.length > 0 && tr("Nothing is waiting for review. Change the status filter to see the other counts.")}
          </Empty>
        ) : (
          <>
            {/* phones: one card per count; the whole card opens it */}
            <div className="flex items-center gap-2 px-3 pt-3 md:hidden">
              <label className="text-xs text-[color:var(--j-626F86)]" htmlFor="review-sort">{tr("Sort")}</label>
              <NativeSelect id="review-sort" className="h-9 flex-1 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-2 text-sm"
                value={sort.key ? `${sort.key}:${sort.dir}` : ""}
                onChange={(e) => { const [k, d] = e.target.value.split(":") as [SortKey, "asc" | "desc"]; setSort(e.target.value ? { key: k, dir: d } : { key: null, dir: "asc" }); }}>
                <option value="">{tr("Default order")}</option>
                {([["submitted:desc", tr("Submitted, newest")], ["submitted:asc", tr("Submitted, oldest")], ["facility:asc", tr("Facility A–Z")],
                  ["flagged:desc", tr("Most lines to check")], ["progress:asc", tr("Least counted")], ["date:desc", tr("Count date, newest")]] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </NativeSelect>
            </div>
            <ul className="space-y-2.5 p-3 md:hidden">
              {rows === null ? <li><SkeletonList rows={4} /></li> : paged.rows.map((r) => {
                const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                const p = r.lines ? Math.round((r.counted / r.lines) * 100) : 0;
                return (
                  <li key={r.id} className="relative">
                    {canReview && pickable(r) && <input type="checkbox" className="absolute right-3 top-3 z-[1] h-5 w-5 accent-[color:var(--j-0C66E4)]" checked={picked.has(r.id)}
                      onChange={() => pick(r.id)} aria-label={tr("Select {0}", r.facility_name)} />}
                    <Link href={`/cost-control/reviews/${r.id}`} className={cx("block rounded-[3px] border bg-white p-3.5 active:bg-[color:var(--j-F7F8F9)]", picked.has(r.id) ? "border-[color:var(--j-388BFF)]" : "border-[color:var(--j-DCDFE4)]", canReview && pickable(r) && "pr-11")}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{r.facility_name}</span>
                          <span className="block truncate text-xs text-[color:var(--j-626F86)]">{countTypeLabel(r.count_type)} · {dmy(r.business_date)}</span>
                        </span>
                        <Badge tone={st.tone} dot>{st.label()}</Badge>
                      </span>
                      <span className="mt-3 flex items-center gap-2 text-xs text-[color:var(--j-626F86)]">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--j-091E420F)]"><span className="block h-full rounded-full bg-[color:var(--j-0C66E4)]" style={{ width: `${p}%` }} /></span>
                        <span className="tabular-nums">{r.counted}/{r.lines}</span>
                      </span>
                      <span className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                          <LocationBadges s={r} />
                        </span>
                        <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-[color:var(--j-0C66E4)]">{r.submitted_at ? fmtDate(r.submitted_at) : tr("Open")}<ChevronRight size={14} /></span>
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
                    {canReview && <th className="w-10 px-3 py-2">
                      <input type="checkbox" className="h-4 w-4 cursor-pointer accent-[color:var(--j-0C66E4)]" aria-label={tr("Select all shown")}
                        checked={paged.rows.some(pickable) && paged.rows.filter(pickable).every((r) => picked.has(r.id))}
                        onChange={(e) => setPicked((p) => { const n = new Set(p); for (const r of paged.rows.filter(pickable)) { if (e.target.checked) n.add(r.id); else n.delete(r.id); } return n; })} /></th>}
                    <SortTh k="facility" sort={sort} onSort={toggle}>{tr("Facility")}</SortTh>
                    <SortTh k="date" sort={sort} onSort={toggle} first="desc">{tr("Count")}</SortTh>
                    <SortTh k="status" sort={sort} onSort={toggle}>{tr("Status")}</SortTh>
                    <SortTh k="progress" sort={sort} onSort={toggle} align="right" first="desc">{tr("Counted")}</SortTh>
                    <SortTh k="flagged" sort={sort} onSort={toggle} first="desc">{tr("Checks")}</SortTh>
                    <SortTh k="submitted" sort={sort} onSort={toggle} first="desc">{tr("Submitted")}</SortTh>
                    <th className="w-16 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
                  {rows === null ? <SkeletonRows cols={canReview ? 8 : 7} /> : paged.rows.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.IN_PROGRESS;
                    const p = r.lines ? Math.round((r.counted / r.lines) * 100) : 0;
                    return (
                      <tr key={r.id} className={cx("group hover:bg-[color:var(--j-F7F8F9)]", picked.has(r.id) && "bg-[color:var(--j-E9F2FF)]")}>
                        {canReview && <td className="px-3 py-2">{pickable(r) && <input type="checkbox" className="h-4 w-4 cursor-pointer accent-[color:var(--j-0C66E4)]"
                          checked={picked.has(r.id)} onChange={() => pick(r.id)} aria-label={tr("Select {0}", r.facility_name)} />}</td>}
                        <td className="max-w-[18rem] px-3 py-2">
                          <Link href={`/cost-control/reviews/${r.id}`} className="block min-w-0">
                            <span className="block truncate font-medium text-[color:var(--j-172B4D)] group-hover:text-[color:var(--j-0C66E4)]">{r.facility_name}</span>
                            <span className="block truncate font-mono text-[11px] text-[color:var(--j-626F86)]">{r.number}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-[color:var(--j-44546F)]">{countTypeLabel(r.count_type)}<span className="block text-xs text-[color:var(--j-626F86)]">{dmy(r.business_date)}</span></td>
                        <td className="px-3 py-2"><Badge tone={st.tone} dot>{st.label()}</Badge></td>
                        <td className="px-3 py-2 text-right">
                          <span className="tabular-nums text-[color:var(--j-44546F)]">{r.counted}/{r.lines}</span>
                          <span className="ml-auto mt-1 block h-1 w-16 overflow-hidden rounded-full bg-[color:var(--j-091E420F)]"><span className="block h-full rounded-full bg-[color:var(--j-0C66E4)]" style={{ width: `${p}%` }} /></span>
                        </td>
                        <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                          {r.flagged > 0 && <Badge tone="amber" icon={<AlertTriangle size={11} />}>{tr("{0} to check", r.flagged)}</Badge>}
                          {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                          {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                          <LocationBadges s={r} />
                        </div></td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-[color:var(--j-626F86)]">{r.submitted_at ? fmtDate(r.submitted_at) : "—"}
                          {r.started_by_name && <span className="block">{r.started_by_name}</span>}</td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/cost-control/reviews/${r.id}`} className="inline-flex items-center text-xs font-semibold text-[color:var(--j-0C66E4)] hover:underline">{tr("Open")}<ChevronRight size={13} /></Link>
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

      {bulk && <BulkReview action={bulk} rows={selected.filter((r) => BULK_OK[bulk].includes(r.status))} onClose={() => setBulk(null)}
        onDone={() => { setBulk(null); setPicked(new Set()); void load(); }} />}
      {sheet && <ReviewFilters value={f} types={typeChoices} facilityTypes={Array.from(new Set(all.map((r) => r.facility_type)))}
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
  ENTERED: "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]", SUBMITTED: "bg-[color:var(--j-FFF7D6)] text-[color:var(--j-B38600)]", ALL: "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)]",
  REVIEWED: "bg-[color:var(--j-DCFFF1)] text-[color:var(--j-22A06B)]",
};
const EXPORT_FILE: Record<ExportKind, string> = { ENTERED: "Entered", SUBMITTED: "Waiting Review", ALL: "All", REVIEWED: "Approved" };

/** Approve, recount or reject many counts at once (2026-11-18): the same review of every count, one after the other;
 *  a count that changed meanwhile (reviewed in another tab) is reported, the others go on. */
function BulkReview({ action, rows, onClose, onDone }: { action: Bulk; rows: Row[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; ok: boolean; msg?: string }[]>([]);
  const label = { APPROVE: tr("Approve"), RECOUNT: tr("Recount"), CANCEL: tr("Reject") }[action];
  const needNote = action !== "APPROVE";
  const run = async () => {
    setBusy(true);
    const out: { id: string; ok: boolean; msg?: string }[] = [];
    for (const r of rows) {
      try {
        await api(`/api/so/counts/${r.id}/review`, { method: "POST", json: { action, note: note.trim() || null, line_ids: null, wip_line_ids: null, missing_items: false } });
        out.push({ id: r.id, ok: true });
      } catch (e) {
        out.push({ id: r.id, ok: false, msg: errorText(e) });
      }
      setDone([...out]);
    }
    setBusy(false);
    const ok = out.filter((x) => x.ok).length;
    toast(tr("{0} of {1} counts: {2}", ok, rows.length, label), ok === rows.length ? "ok" : "error");
    if (ok === rows.length) onDone();
  };
  const failed = done.filter((x) => !x.ok);
  return (
    <Drawer open onClose={busy ? () => undefined : (done.length ? onDone : onClose)} size="md" icon={action === "APPROVE" ? <CheckCircle2 size={18} /> : <RotateCcw size={18} />}
      title={tr("{0} {1} counts", label, rows.length)} description={action === "APPROVE" ? tr("Every count below is approved as it was sent")
        : action === "RECOUNT" ? tr("Every item of the counts below is asked again from the branch") : tr("The counts below are cancelled; the branch counts again from the start")}
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={done.length ? onDone : onClose}>{done.length ? tr("Close") : tr("Cancel")}</Button>
        {!done.length && <Button variant={action === "CANCEL" ? "danger" : "primary"} loading={busy} disabled={!rows.length || (needNote && !note.trim())} onClick={() => void run()}>{label} ({rows.length})</Button>}
      </>}>
      <div className="space-y-4">
        {needNote && (
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{tr("Note for the branches")} *</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={cx(inputClass, "h-auto py-2")}
              placeholder={action === "RECOUNT" ? tr("e.g. the quantities look wrong, count again") : tr("e.g. counted on the wrong day")} />
          </label>
        )}
        <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)]">
          {rows.map((r) => {
            const d = done.find((x) => x.id === r.id);
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[color:var(--j-172B4D)]">{r.facility_name}</span>
                  <span className="text-[11px] text-[color:var(--j-626F86)]">{r.number} · {countTypeLabel(r.count_type)} · {dmy(r.business_date)}</span>
                  {d && !d.ok && <span className="block text-[11px] text-[color:var(--j-AE2E24)]">{d.msg}</span>}</span>
                {d ? <Badge tone={d.ok ? "green" : "red"}>{d.ok ? tr("Done") : tr("Failed")}</Badge> : busy ? <span className="text-[11px] text-[color:var(--j-626F86)]">{tr("Waiting…")}</span> : null}
              </li>
            );
          })}
        </ul>
        {failed.length > 0 && <p className="text-xs text-[color:var(--j-AE2E24)]">{tr("{0} counts could not be changed (they may have been reviewed meanwhile)", failed.length)}</p>}
      </div>
    </Drawer>
  );
}

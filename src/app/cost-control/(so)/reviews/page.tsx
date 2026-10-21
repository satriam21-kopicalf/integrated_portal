"use client";

// Counts to review (PPIC / Cost Control Supervisor, D-36): what waits for a decision first, every status on demand, the
// figures of the period and every filter in one drawer. The approved counts of the period download as one xlsx for
// every branch (2026-10-15).

import LocationBadges from "@/so/features/count/LocationBadges";
import { AlertTriangle, ChevronRight, ClipboardCheck, RotateCcw } from "lucide-react";
import ExcelIconButton from "@/components/ExcelIconButton";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, fmtDate, fmtNumber, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
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

  // every branch of the period in one file: approved and exported counts, one sheet per branch
  const downloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/so/count-reports/file?date_from=${f.period.from}&date_to=${f.period.to}&status=REVIEWED&per_branch=true`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname Report ${f.period.from} - ${f.period.to}.xlsx` }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setDownloading(false);
    }
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
      actions={<ExcelIconButton label={tr("Download all branches")} loading={downloading} onClick={downloadAll} />}
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

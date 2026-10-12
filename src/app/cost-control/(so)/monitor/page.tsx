"use client";

// Cost Control monitor (06.9 §9): every outlet and hub in scope x count type due on a day, with its status.

import { Gauge } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Input, Page, Panel, SearchBox, SkeletonRows, fmtNumber, theadClass } from "@/so/ui";
import { ActiveFilter, ActiveFilters, ChoiceGroup, FilterButton } from "@/so/ui/FilterControls";
import Drawer from "@/so/ui/Drawer";
import { Button } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { api, errorText } from "@/so/lib/api";
import { STATUS, countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Row = {
  facility_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: string;
  count_type: string;
  status: string;
  session: { id: string; status: string; is_late: boolean; outside_radius: boolean; submitted_at: string | null } | null;
};

const todayIso = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // Asia/Jakarta business day

export default function MonitorPage() {
  const [day, setDay] = useState(todayIso);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await api<Row[]>(`/api/so/counts/monitor?day=${day}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [day]);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!status || r.status === status) && (!type || r.count_type === type) && (!facilityType || r.facility_type === facilityType) &&
      (!s || r.facility_name.toLowerCase().includes(s) || r.facility_code.toLowerCase().includes(s)));
  }, [all, search, status, type, facilityType]);
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const late = all.filter((r) => r.session?.is_late).length;
  const done = n("SUBMITTED") + n("APPROVED") + n("RECOUNT_REQUESTED") + n("EXPORTED");
  const activeFilters: ActiveFilter[] = [
    ...(status ? [{ key: "s", label: tr("Status: {0}", STATUS[status]?.label() ?? status), onRemove: () => setStatus("") }] : []),
    ...(type ? [{ key: "t", label: countTypeLabel(type), onRemove: () => setType("") }] : []),
    ...(facilityType ? [{ key: "f", label: facilityType, onRemove: () => setFacilityType("") }] : []),
  ];

  return (
    <Page title={tr("Stock opname monitor")} subtitle={tr("Every outlet and hub with a count due on the day")}
      actions={<Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-auto" aria-label={tr("Day")} />}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Due")} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} facilities", fmtNumber(new Set(all.map((r) => r.facility_id)).size))}</p>}
          </Stat>
          <Stat label={tr("Submitted")} emphasis value={rows ? fmtNumber(done) : <StatSkeleton />}>
            {rows && <p>{tr("{0} approved · {1} late", fmtNumber(n("APPROVED")), fmtNumber(late))}</p>}
          </Stat>
          <Stat label={tr("In progress")} value={rows ? fmtNumber(n("IN_PROGRESS")) : <StatSkeleton />} />
          <Stat label={tr("Not started")} value={rows ? fmtNumber(n("NOT_STARTED") + n("MISSED")) : <StatSkeleton />}>
            {rows && n("MISSED") > 0 && <p>{tr("{0} missed", fmtNumber(n("MISSED")))}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={
        <>
          <div className="flex gap-2">
            <SearchBox value={search} onChange={setSearch} placeholder={tr("Search outlet or hub")} />
            <FilterButton count={activeFilters.length} onClick={() => setFiltersOpen(true)} />
          </div>
          <ActiveFilters filters={activeFilters} onClear={() => { setStatus(""); setType(""); setFacilityType(""); }} />
        </>
      }>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<Gauge size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No count is due on this day")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {shown.map((r) => <MobileRow key={`${r.facility_id}:${r.count_type}`} r={r} />)}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Facility")}</th>
                    <th className="px-4 py-2.5">{tr("Count")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th>
                    <th className="px-4 py-2.5">{tr("Evidence")}</th>
                    <th className="w-24 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={5} /> : shown.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.NOT_STARTED;
                    return (
                      <tr key={`${r.facility_id}:${r.count_type}`} className="hover:bg-slate-50/70">
                        <td className="max-w-[20rem] px-4 py-3">
                          <span className="block truncate font-medium text-slate-900">{r.facility_name}</span>
                          <span className="block truncate text-xs text-slate-400">{r.facility_code} · {r.facility_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{countTypeLabel(r.count_type)}</td>
                        <td className="px-4 py-3"><Badge tone={st.tone} dot>{st.label()}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.session?.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                            {r.session?.outside_radius && <Badge tone="amber">{tr("Outside radius")}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.session && <Link href={`/cost-control/reviews/${r.session.id}`} className="text-xs font-semibold text-blue-700 hover:underline">{tr("Open")}</Link>}
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
      {filtersOpen && (
        <MonitorFilters value={{ status, type, facilityType }} types={Array.from(new Set(all.map((r) => r.count_type)))}
          facilityTypes={Array.from(new Set(all.map((r) => r.facility_type)))} onClose={() => setFiltersOpen(false)}
          onApply={(v) => { setStatus(v.status); setType(v.type); setFacilityType(v.facilityType); setFiltersOpen(false); }} />
      )}
    </Page>
  );
}

function MobileRow({ r }: { r: Row }) {
  const st = STATUS[r.status] ?? STATUS.NOT_STARTED;
  const body = (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{r.facility_name}</p>
        <p className="truncate text-xs text-slate-500">{countTypeLabel(r.count_type)} · {r.facility_code}</p>
      </div>
      <Badge tone={st.tone} dot>{st.label()}</Badge>
    </div>
  );
  return <li>{r.session ? <Link href={`/cost-control/reviews/${r.session.id}`} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
}

type F = { status: string; type: string; facilityType: string };

function MonitorFilters({ value, types, facilityTypes, onApply, onClose }: {
  value: F; types: string[]; facilityTypes: string[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <Drawer open onClose={onClose} size="sm" title={tr("Filter")}
      footer={
        <>
          <Button variant="secondary" className="mr-auto" onClick={() => setD({ status: "", type: "", facilityType: "" })}>{tr("Reset")}</Button>
          <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button onClick={() => onApply(d)}>{tr("Apply filters")}</Button>
        </>
      }>
      <div className="space-y-6">
        <ChoiceGroup label={tr("Status")} value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={[{ value: "", label: tr("All") }, ...["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED", "APPROVED", "MISSED"].map((s) => ({ value: s, label: STATUS[s].label() }))]} />
        <ChoiceGroup label={tr("Count")} value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All") }, ...types.map((t) => ({ value: t, label: countTypeLabel(t) }))]} />
        <ChoiceGroup label={tr("Facility type")} value={d.facilityType} onChange={(v) => setD({ ...d, facilityType: v })}
          choices={[{ value: "", label: tr("All") }, ...facilityTypes.map((t) => ({ value: t, label: t }))]} />
      </div>
    </Drawer>
  );
}

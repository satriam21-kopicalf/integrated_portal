"use client";

// Cost Control monitor (06.9 §9): every outlet and hub in scope x count type due on a day, with its status, how far the
// day is (completion, status mix, per count type) and every filter in one drawer.

import { AlertTriangle, CalendarDays, ChevronRight, Gauge, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, fmtNumber, theadClass } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, DayField, FilterSection, FilterSheet, FilterToolbar, SegmentBar, dmy, wibDay } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { STATUS, countTypeLabel } from "@/so/lib/counts";
import LocationBadges from "@/so/features/count/LocationBadges";
import { locale, tr } from "@/lib/i18n";

type Row = {
  facility_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: string;
  facility_located?: boolean;
  facility_radius_m?: number;
  count_type: string;
  status: string;
  session: { id: string; status: string; is_late: boolean; outside_radius: boolean; submitted_at: string | null;
    start_distance_m?: number | null; start_accuracy_m?: number | string | null; low_accuracy?: boolean; entry_source?: string } | null;
};
/** loc: "" | outside (outside the radius) | low (weak GPS fix) | unlocated (facility without coordinates) */
type F = { day: string; status: string; type: string; facilityType: string; loc: string };
const NO_F: () => F = () => ({ day: wibDay(0), status: "", type: "", facilityType: "", loc: "" });
const LOC: Record<string, () => string> = {
  outside: () => tr("Outside radius"), low: () => tr("Low GPS accuracy"), unlocated: () => tr("Outlet has no coordinates"),
};
const locMatch = (r: Row, loc: string) => !loc || (loc === "outside" ? !!r.session?.outside_radius
  : loc === "low" ? !!r.session?.low_accuracy : r.facility_located === false);

const DONE = ["SUBMITTED", "APPROVED", "RECOUNT_REQUESTED", "EXPORTED"];
const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED", "APPROVED", "MISSED"];
const weekday = (iso: string) => new Date(`${iso}T12:00:00+07:00`).toLocaleDateString(locale(), { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeOf = (v: string | null) => (v ? new Date(v).toLocaleTimeString(locale(), { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "");

export default function MonitorPage() {
  const [f, setF] = useState<F>(NO_F);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await api<Row[]>(`/api/so/counts/monitor?day=${f.day}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [f.day]);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!f.status || r.status === f.status) && (!f.type || r.count_type === f.type) && (!f.facilityType || r.facility_type === f.facilityType) && locMatch(r, f.loc) &&
      (!s || r.facility_name.toLowerCase().includes(s) || r.facility_code.toLowerCase().includes(s)));
  }, [all, search, f]);
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const done = DONE.reduce((a, s) => a + n(s), 0);
  const late = all.filter((r) => r.session?.is_late).length;
  const outside = all.filter((r) => r.session?.outside_radius).length;
  const weak = all.filter((r) => r.session?.low_accuracy).length;
  const unlocated = new Set(all.filter((r) => r.facility_located === false).map((r) => r.facility_id)).size;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const byType = useMemo(() => {
    const m = new Map<string, { due: number; done: number }>();
    for (const r of all) {
      const x = m.get(r.count_type) ?? { due: 0, done: 0 };
      x.due += 1;
      if (DONE.includes(r.status)) x.done += 1;
      m.set(r.count_type, x);
    }
    return [...m.entries()];
  }, [all]);

  const isToday = f.day === wibDay(0);
  const chips: ActiveFilter[] = [
    ...(!isToday ? [{ key: "d", label: tr("Day: {0}", dmy(f.day)), onRemove: () => setF({ ...f, day: wibDay(0) }) }] : []),
    ...(f.status ? [{ key: "s", label: tr("Status: {0}", STATUS[f.status]?.label() ?? f.status), onRemove: () => setF({ ...f, status: "" }) }] : []),
    ...(f.type ? [{ key: "t", label: countTypeLabel(f.type), onRemove: () => setF({ ...f, type: "" }) }] : []),
    ...(f.facilityType ? [{ key: "f", label: f.facilityType, onRemove: () => setF({ ...f, facilityType: "" }) }] : []),
    ...(f.loc ? [{ key: "l", label: LOC[f.loc](), onRemove: () => setF({ ...f, loc: "" }) }] : []),
  ];

  return (
    <Page title={tr("Stock opname monitor")} subtitle={`${isToday ? `${tr("Today")} · ` : ""}${weekday(f.day)} · ${tr("every outlet and hub with a count due")}`}
      actions={<button type="button" onClick={() => void load()} disabled={rows === null} title={tr("Refresh")} aria-label={tr("Refresh")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait">
        <RefreshCw size={18} className={rows === null ? "animate-spin" : ""} />
      </button>}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Due")} icon={<CalendarDays size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} facilities", fmtNumber(new Set(all.map((r) => r.facility_id)).size))}</p>}
          </Stat>
          <Stat label={tr("Completed")} emphasis value={rows ? `${pct}%` : <StatSkeleton />}>
            {rows && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                <p>{tr("{0} of {1} submitted · {2} approved", fmtNumber(done), fmtNumber(all.length), fmtNumber(n("APPROVED") + n("EXPORTED")))}</p>
              </>
            )}
          </Stat>
          <Stat label={tr("In progress")} value={rows ? fmtNumber(n("IN_PROGRESS")) : <StatSkeleton />}>
            {rows && <p>{tr("{0} waiting for review", fmtNumber(n("SUBMITTED")))}</p>}
          </Stat>
          <Stat label={tr("Not started")} value={rows ? fmtNumber(n("NOT_STARTED") + n("MISSED")) : <StatSkeleton />}>
            {rows && <p>{n("MISSED") > 0 ? tr("{0} missed", fmtNumber(n("MISSED"))) : tr("Nothing missed")}{late ? ` · ${tr("{0} late", fmtNumber(late))}` : ""}</p>}
          </Stat>
        </StatStrip>
      }>
      {rows && all.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel title={tr("Status of the day")}>
            <div className="p-4 sm:p-5">
              <SegmentBar parts={[
                { label: STATUS.APPROVED.label(), value: n("APPROVED") + n("EXPORTED"), color: "bg-emerald-500" },
                { label: STATUS.SUBMITTED.label(), value: n("SUBMITTED"), color: "bg-violet-500" },
                { label: STATUS.RECOUNT_REQUESTED.label(), value: n("RECOUNT_REQUESTED"), color: "bg-amber-500" },
                { label: STATUS.IN_PROGRESS.label(), value: n("IN_PROGRESS"), color: "bg-blue-500" },
                { label: STATUS.NOT_STARTED.label(), value: n("NOT_STARTED"), color: "bg-slate-300" },
                { label: STATUS.MISSED.label(), value: n("MISSED"), color: "bg-red-500" },
              ]} />
              {(late > 0 || outside > 0 || weak > 0 || unlocated > 0) && (
                <p className="mt-3 flex flex-wrap gap-3 text-xs text-amber-800">
                  {late > 0 && <span className="inline-flex items-center gap-1"><AlertTriangle size={13} /> {tr("{0} submitted late", late)}</span>}
                  {outside > 0 && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {tr("{0} outside the facility radius", outside)}</span>}
                  {weak > 0 && <span className="inline-flex items-center gap-1 text-slate-600">{tr("{0} with low GPS accuracy", weak)}</span>}
                  {unlocated > 0 && <Link href="/cost-control/locations" className="inline-flex items-center gap-1 text-slate-600 underline-offset-2 hover:underline">{tr("{0} facilities without coordinates", unlocated)}</Link>}
                </p>
              )}
            </div>
          </Panel>
          <Panel title={tr("Per count type")}>
            <ul className="divide-y divide-slate-100">
              {byType.map(([t, x]) => {
                const p = x.due ? Math.round((x.done / x.due) * 100) : 0;
                return (
                  <li key={t} className="px-4 py-2.5 sm:px-5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-800">{countTypeLabel(t)}</span>
                      <span className="tabular-nums text-slate-600">{x.done}/{x.due} · <span className="font-semibold text-slate-900">{p}%</span></span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${p}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or hub")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={rows ? <span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))}</span> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<Gauge size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No count is due on this day")}>
            {!all.length && tr("Counts appear here on the days the count types schedule them.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {shown.map((r) => <MobileRow key={`${r.facility_id}:${r.count_type}`} r={r} />)}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Facility")}</th>
                    <th className="px-4 py-2.5">{tr("Count")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th>
                    <th className="px-4 py-2.5">{tr("Submitted")}</th>
                    <th className="px-4 py-2.5">{tr("Evidence")}</th>
                    <th className="w-20 px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={6} /> : shown.map((r) => {
                    const st = STATUS[r.status] ?? STATUS.NOT_STARTED;
                    return (
                      <tr key={`${r.facility_id}:${r.count_type}`} className="hover:bg-slate-50/70">
                        <td className="max-w-[20rem] px-4 py-3">
                          <span className="block truncate font-medium text-slate-900">{r.facility_name}</span>
                          <span className="block truncate text-xs text-slate-400">{r.facility_code} · {r.facility_type}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{countTypeLabel(r.count_type)}</td>
                        <td className="px-4 py-3"><Badge tone={st.tone} dot>{st.label()}</Badge></td>
                        <td className="px-4 py-3 text-xs tabular-nums text-slate-500">{timeOf(r.session?.submitted_at ?? null) ? `${timeOf(r.session!.submitted_at)} WIB` : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {r.session?.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                            {r.session && <LocationBadges s={{ ...r.session, facility_located: r.facility_located }} />}
                            {!r.session && r.facility_located === false && <LocationBadges s={{ facility_located: false }} />}
                            {r.session && !r.session.is_late && !r.session.outside_radius && !r.session.low_accuracy && r.session.start_distance_m == null
                              && r.facility_located !== false && <span className="text-xs text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.session && (
                            <Link href={`/cost-control/reviews/${r.session.id}`} className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 hover:underline">
                              {tr("Open")} <ChevronRight size={13} />
                            </Link>
                          )}
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

      {sheet && <MonitorFilters value={f} types={Array.from(new Set(all.map((r) => r.count_type)))}
        facilityTypes={Array.from(new Set(all.map((r) => r.facility_type)))} onClose={() => setSheet(false)}
        onApply={(v) => { setF(v); setSheet(false); }} />}
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
        {(r.session || r.facility_located === false) && (
          <p className="mt-1 flex flex-wrap items-center gap-1">
            {r.session?.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
            <LocationBadges s={{ ...(r.session ?? {}), facility_located: r.facility_located }} />
          </p>
        )}
      </div>
      <Badge tone={st.tone} dot>{st.label()}</Badge>
    </div>
  );
  return <li>{r.session ? <Link href={`/cost-control/reviews/${r.session.id}`} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
}

function MonitorFilters({ value, types, facilityTypes, onApply, onClose }: {
  value: F; types: string[]; facilityTypes: string[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F())}>
      <FilterSection title={tr("Day")}><DayField value={d.day} onChange={(day) => setD({ ...d, day })} /></FilterSection>
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
      <FilterSection title={tr("Location")}>
        <ChoiceGroup label="" value={d.loc} onChange={(v) => setD({ ...d, loc: v })}
          choices={[{ value: "", label: tr("All") }, ...Object.keys(LOC).map((k) => ({ value: k, label: LOC[k]() }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

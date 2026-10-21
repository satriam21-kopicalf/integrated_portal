"use client";

// Cost Control monitor (06.9 §9): every outlet and hub in scope x count type due on a day, with its status, how far the
// day is (completion; status and count type tabs above the table that filter it) and every filter in one drawer.

import { AlertTriangle, CalendarDays, ChevronRight, Clock, Gauge, MapPin } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, cx, fmtNumber, theadClass, PageNav, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, DayField, FilterSection, FilterSheet, FilterToolbar, dmy, wibDay } from "@/so/ui/Filters";
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
/** loc: "" | late (submitted after the window) | outside (outside the radius) | low (weak GPS fix) | unlocated (facility without coordinates) */
type F = { day: string; status: string; type: string; facilityType: string; loc: string };
const NO_F: () => F = () => ({ day: wibDay(0), status: "", type: "", facilityType: "", loc: "" });
const LOC: Record<string, () => string> = {
  late: () => tr("Submitted late"), outside: () => tr("Outside radius"), low: () => tr("Low GPS accuracy"), unlocated: () => tr("Outlet has no coordinates"),
};
const locMatch = (r: Row, loc: string) => !loc || (loc === "late" ? !!r.session?.is_late : loc === "outside" ? !!r.session?.outside_radius
  : loc === "low" ? !!r.session?.low_accuracy : r.facility_located === false);

const DONE = ["SUBMITTED", "APPROVED", "RECOUNT_REQUESTED", "EXPORTED"];
const STATUSES = ["NOT_STARTED", "IN_PROGRESS", "SUBMITTED", "RECOUNT_REQUESTED", "APPROVED", "MISSED"];
/** "Approved" also holds the counts already exported to ESB */
const statusMatch = (r: Row, st: string) => !st || r.status === st || (st === "APPROVED" && r.status === "EXPORTED");
/** the status tabs above the table, in the order of the day */
const TABS: { key: string; color: string }[] = [
  { key: "APPROVED", color: "bg-emerald-500" }, { key: "SUBMITTED", color: "bg-violet-500" },
  { key: "RECOUNT_REQUESTED", color: "bg-amber-500" }, { key: "IN_PROGRESS", color: "bg-blue-500" },
  { key: "NOT_STARTED", color: "bg-slate-300" }, { key: "MISSED", color: "bg-red-500" },
];
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
    return all.filter((r) => statusMatch(r, f.status) && (!f.type || r.count_type === f.type) && (!f.facilityType || r.facility_type === f.facilityType) && locMatch(r, f.loc) &&
      (!s || r.facility_name.toLowerCase().includes(s) || r.facility_code.toLowerCase().includes(s)));
  }, [all, search, f]);
  const paged = usePaged(shown, shown.length + search + JSON.stringify(f));
  const n = (st: string) => all.filter((r) => r.status === st).length;
  const tabCount = (st: string) => all.filter((r) => statusMatch(r, st)).length;
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
    <Page title={tr("Monitoring Stock Opname")} subtitle={`${isToday ? `${tr("Today")} · ` : ""}${weekday(f.day)} · ${tr("every outlet and hub with a count due")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
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
      <Panel toolbar={<>
        {rows && all.length > 0 && (
          <DayOverview total={all.length} tabCount={tabCount} status={f.status} onStatus={(status) => setF({ ...f, status: f.status === status ? "" : status })}
            byType={byType} type={f.type} onType={(type) => setF({ ...f, type: f.type === type ? "" : type })}
            alerts={{ late, outside, low: weak, unlocated }} loc={f.loc} onLoc={(loc) => setF({ ...f, loc: f.loc === loc ? "" : loc })} />
        )}
        <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or hub")} filters={chips}
          onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />
      </>}
        footer={rows ? <><span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<Gauge size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No count is due on this day")}>
            {!all.length && tr("Counts appear here on the days the count types schedule them.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((r) => <MobileRow key={`${r.facility_id}:${r.count_type}`} r={r} />)}
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
                  {rows === null ? <SkeletonRows cols={6} /> : paged.rows.map((r) => {
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

/** The day above the table: status tabs (with the completion bar), the count types and the location alerts; each one
 *  filters the table below, tapping it again clears it. */
function DayOverview({ total, tabCount, status, onStatus, byType, type, onType, alerts, loc, onLoc }: {
  total: number; tabCount: (st: string) => number; status: string; onStatus: (st: string) => void;
  byType: [string, { due: number; done: number }][]; type: string; onType: (t: string) => void;
  alerts: { late: number; outside: number; low: number; unlocated: number }; loc: string; onLoc: (l: string) => void;
}) {
  const ALERTS: { key: string; n: number; icon: typeof Clock; label: (n: number) => string }[] = [
    { key: "late", n: alerts.late, icon: Clock, label: (n) => tr("{0} submitted late", n) },
    { key: "outside", n: alerts.outside, icon: MapPin, label: (n) => tr("{0} outside the facility radius", n) },
    { key: "low", n: alerts.low, icon: AlertTriangle, label: (n) => tr("{0} with low GPS accuracy", n) },
    { key: "unlocated", n: alerts.unlocated, icon: MapPin, label: (n) => tr("{0} facilities without coordinates", n) },
  ];
  return (
    <div className="space-y-3">
      <div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img"
          aria-label={TABS.map((t) => `${STATUS[t.key].label()} ${tabCount(t.key)}`).join(", ")}>
          {TABS.map((t) => tabCount(t.key) > 0 && <span key={t.key} className={t.color} style={{ width: `${(tabCount(t.key) / total) * 100}%` }} />)}
        </div>
        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label={tr("Status of the day")}>
          {[{ key: "", color: "bg-slate-900" }, ...TABS].map((t) => {
            const on = status === t.key;
            const count = t.key ? tabCount(t.key) : total;
            return (
              <button key={t.key || "all"} type="button" role="tab" aria-selected={on} onClick={() => onStatus(t.key)} disabled={!!t.key && !count && !on}
                className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40",
                  on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {t.key && <span className={cx("h-2 w-2 rounded-full", t.color)} aria-hidden />}
                {t.key ? STATUS[t.key].label() : tr("All")}
                <span className={cx("tabular-nums", on ? "text-white/80" : "font-semibold text-slate-900")}>{fmtNumber(count)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {byType.length > 1 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={tr("Per count type")}>
          {byType.map(([t, x]) => {
            const p = x.due ? Math.round((x.done / x.due) * 100) : 0;
            const on = type === t;
            return (
              <button key={t} type="button" onClick={() => onType(t)} aria-pressed={on}
                className={cx("rounded-lg border px-3 py-2 text-left transition-colors",
                  on ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")}>
                <span className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-slate-800">{countTypeLabel(t)}</span>
                  <span className="flex-shrink-0 tabular-nums text-slate-500">{x.done}/{x.due} · <span className="font-semibold text-slate-900">{p}%</span></span>
                </span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${p}%` }} /></span>
              </button>
            );
          })}
        </div>
      )}
      {ALERTS.some((a) => a.n > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {ALERTS.filter((a) => a.n > 0).map((a) => (
            <button key={a.key} type="button" onClick={() => onLoc(a.key)} aria-pressed={loc === a.key}
              className={cx("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                loc === a.key ? "border-amber-600 bg-amber-600 text-white" : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300")}>
              <a.icon size={12} /> {a.label(a.n)}
            </button>
          ))}
        </div>
      )}
    </div>
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

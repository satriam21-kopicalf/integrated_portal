"use client";

// Crew "Today" (06.9 §9): the counts Cost Control scheduled for today at the facilities of the signed-in user, with the
// count window (opens / open / late), what the list holds, the last count and what is coming in the next days.

import { CalendarClock, CalendarDays, ChevronRight, ClipboardList, Clock, History, Layers, Loader2, MapPin, Play, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Page, Panel, cx, fmtDay, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { type Count, type TodayCount, type TodayFacility, STATUS, countTypeLabel, getPosition } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";
import { TZ, windowText, wibClock } from "@/so/lib/wib";

const WINDOW: Record<string, { tone: "slate" | "green" | "amber"; label: (c: TodayCount) => string }> = {
  UPCOMING: { tone: "slate", label: (c) => tr("Opens at {0}", windowText(c.window_start)) },
  OPEN: { tone: "green", label: (c) => tr("Open now · until {0}", windowText(c.window_end)) },
  LATE: { tone: "amber", label: (c) => tr("Window closed at {0} · still to do", windowText(c.window_end)) },
};

function Clock24() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-700">
      <Clock size={14} className="text-slate-400" />
      {wibClock(now)}
    </span>
  );
}

export default function TodayView({ basePath = "" }: { basePath?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<TodayFacility[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<TodayFacility[]>("/api/so/counts/today"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 120_000); // the window state moves with the clock
    return () => clearInterval(t);
  }, [load]);

  const start = async (facilityId: string, countType: string) => {
    const key = `${facilityId}:${countType}`;
    setStarting(key);
    try {
      const pos = await getPosition();
      if (!pos) toast(tr("Location is not available; the count is marked for review"), "error");
      const c = await api<Count>("/api/so/counts", {
        method: "POST",
        json: { facility_id: facilityId, count_type: countType, lat: pos?.lat ?? null, lng: pos?.lng ?? null, device: navigator.userAgent.slice(0, 300) },
      });
      router.push(`${basePath}/stock-opname/${c.id}`);
    } catch (e) {
      toast(errorText(e), "error");
      setStarting(null);
    }
  };

  const day = rows?.[0]?.business_date;
  const total = (rows ?? []).reduce((n, f) => n + f.counts.length, 0);
  return (
    <Page title={tr("Stock opname today")}
      subtitle={day ? new Date(`${day}T00:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : tr("Counts due at your facilities")}
      actions={<Clock24 />}>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel>
        : rows === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
        ) : rows.length === 0 ? (
          <Panel><Empty icon={<Store size={28} />} title={tr("No facility assigned to you")}>{tr("Ask your administrator to assign your outlet or hub in Access Center.")}</Empty></Panel>
        ) : (
          <>
            {total === 0 && (
              <Panel><Empty icon={<ClipboardList size={28} />} title={tr("No count is due today")}>{tr("Counts appear here on the day Cost Control scheduled them.")}</Empty></Panel>
            )}
            {rows.map((f) => (
              <Panel key={f.facility.id} title={f.facility.name}
                description={`${f.facility.code} · ${f.facility.facility_type}${f.facility.latitude ? "" : ` · ${tr("no location set")}`}`}>
                {f.counts.length > 0 && (
                  <ul className="divide-y divide-slate-100">
                    {f.counts.map((c) => {
                      const s = c.session;
                      const st = STATUS[s?.status ?? "NOT_STARTED"];
                      const win = !s || s.status === "IN_PROGRESS" ? (c.window_state ? WINDOW[c.window_state] : null) : null;
                      const key = `${f.facility.id}:${c.count_type}`;
                      return (
                        <li key={c.count_type} className="space-y-3 px-4 py-4 sm:px-5">
                          <div className="flex flex-wrap items-start gap-3">
                            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ClipboardList size={18} /></span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{countTypeLabel(c.count_type, c.name)}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <Badge tone={st.tone} dot>{st.label()}</Badge>
                                {win && <Badge tone={win.tone} icon={<CalendarClock size={11} />}>{win.label(c)}</Badge>}
                                {s?.is_late && <Badge tone="amber">{tr("Late")}</Badge>}
                              </div>
                            </div>
                            {!s ? (
                              <Button className="w-full sm:w-auto" loading={starting === key} disabled={!!starting} onClick={() => start(f.facility.id, c.count_type)}>
                                {starting === key ? null : <Play size={16} />} {tr("Start count")}
                              </Button>
                            ) : (
                              <Button variant={s.status === "IN_PROGRESS" || s.status === "RECOUNT_REQUESTED" ? "primary" : "secondary"} className="w-full sm:w-auto"
                                onClick={() => router.push(`${basePath}/stock-opname/${s.id}`)}>
                                {s.status === "IN_PROGRESS" ? tr("Continue") : s.status === "RECOUNT_REQUESTED" ? tr("Recount") : tr("View")} <ChevronRight size={16} />
                              </Button>
                            )}
                          </div>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-4">
                            <Info icon={<CalendarClock size={13} />} label={tr("Count window")} value={c.window_start ? windowText(c.window_start, c.window_end) : "—"} />
                            <Info icon={<Layers size={13} />} label={tr("Items")} value={c.items !== null && c.items !== undefined ? tr("{0} items · {1} areas", c.items, c.areas.length) : "—"} />
                            <Info icon={<History size={13} />} label={tr("Last count")} value={c.last ? `${fmtDay(c.last.business_date)} · ${(STATUS[c.last.status] ?? STATUS.IN_PROGRESS).label()}` : tr("None yet")} />
                            <Info icon={<ClipboardList size={13} />} label={tr("ESB purpose")} value={c.esb_purpose ?? tr("Not set")} />
                          </dl>
                          {c.areas.length > 0 && (
                            <p className="text-[11px] text-slate-400">{tr("Areas")}: {c.areas.join(" · ")}</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {f.upcoming.length > 0 && (
                  <div className={cx("px-4 py-3 sm:px-5", f.counts.length > 0 && "border-t border-slate-100")}>
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><CalendarDays size={12} /> {tr("Next 7 days")}</p>
                    <ul className="flex flex-wrap gap-2">
                      {f.upcoming.map((u) => (
                        <li key={`${u.date}:${u.count_type}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs">
                          <span className="font-semibold text-slate-800">{new Date(`${u.date}T12:00:00+07:00`).toLocaleDateString(locale(), { timeZone: TZ, weekday: "short", day: "numeric", month: "short" })}</span>
                          <span className="text-slate-500"> · {countTypeLabel(u.count_type, u.name)} · {windowText(u.window_start)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>
            ))}
            <p className="flex items-start gap-2 px-1 text-xs text-slate-400">
              <MapPin size={14} className="mt-0.5 flex-shrink-0" />
              {tr("Your location is recorded when a count starts and when it is submitted, as evidence for Cost Control.")}
            </p>
          </>
        )}
      {starting && <span className="sr-only"><Loader2 className="animate-spin" /></span>}
    </Page>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-slate-400">{icon}{label}</dt>
      <dd className="truncate font-medium text-slate-700" title={value}>{value}</dd>
    </div>
  );
}

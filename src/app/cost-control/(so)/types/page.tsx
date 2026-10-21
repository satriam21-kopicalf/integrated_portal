"use client";

// Count types (Cost Control): the name each stock opname has, when it is due (daily on chosen days, weekly on a day,
// monthly on a date or the last day, or on dates picked on the calendar), its count window (WIB) and validity period,
// and its ESB purpose. Quick setups fill the usual schedules in one tap. A month calendar
// shows the schedule the server computes from these rules; the editor previews an unsaved schedule live.

import { CalendarClock, CalendarDays, CalendarRange, ChevronDown, ChevronRight, Clock, FlaskConical, ListChecks, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, Field, Input, Page, Panel, fmtNumber, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { FormCard, Segmented, Switch } from "@/so/ui/Simple";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import MonthCalendar, { CalendarDay, gridStart, iso, TYPE_COLORS } from "@/so/features/schedule/MonthCalendar";
import { reloadCountTypeNames } from "@/so/features/CountTypeNames";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";
import { wibDate, wibMonthStart, windowText } from "@/so/lib/wib";

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "DATES" | "ADHOC";
type CountType = {
  code: string; name: string; frequency: Frequency; weekday: number | null; days_of_week: number[]; month_day: number;
  valid_from: string | null; valid_to: string | null; window_start: string; window_end: string; esb_purpose: string | null; wip_enabled: boolean;
  sort: number; is_active: boolean; lists: number; overrides: number; next_dates: string[]; dates: string[];
  /** days a count stays open: 1 = the due day; 2 = the due day and the next (e.g. 14–15 Oct) */
  period_days: number;
};
type Draft = Omit<CountType, "lists" | "overrides" | "next_dates">;

const dayName = (d: number, style: "long" | "short" = "long") => new Date(2024, 0, d).toLocaleDateString(locale(), { weekday: style }); // 2024-01-01 = Monday
const fmtDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
const FREQUENCIES: { key: Frequency; label: () => string }[] = [
  { key: "DAILY", label: () => tr("Daily") }, { key: "WEEKLY", label: () => tr("Weekly") },
  { key: "MONTHLY", label: () => tr("Monthly") }, { key: "DATES", label: () => tr("On chosen dates") },
  { key: "ADHOC", label: () => tr("When needed") },
];
/** One-tap schedules Cost Control uses most. */
const QUICK: { label: () => string; set: Partial<Draft> }[] = [
  { label: () => tr("Every day"), set: { frequency: "DAILY", days_of_week: [] } },
  { label: () => tr("Monday to Saturday"), set: { frequency: "DAILY", days_of_week: [1, 2, 3, 4, 5, 6] } },
  { label: () => tr("Every Monday"), set: { frequency: "WEEKLY", weekday: 1 } },
  { label: () => tr("Last day of the month"), set: { frequency: "MONTHLY", month_day: 0 } },
  { label: () => tr("Pick dates on the calendar"), set: { frequency: "DATES" } },
];
const WINDOWS: [string, string][] = [["06:00", "08:00"], ["07:00", "09:00"], ["14:00", "16:00"], ["21:00", "23:00"], ["22:00", "23:59"]];

/** "Every day except Sunday, 07:00–08:00" and the like. */
export function scheduleText(t: Pick<CountType, "frequency" | "weekday" | "days_of_week" | "month_day"> & { dates?: string[]; period_days?: number }): string {
  const base = baseScheduleText(t);
  return t.frequency !== "ADHOC" && (t.period_days ?? 1) > 1 ? `${base} · ${tr("open {0} days", t.period_days ?? 1)}` : base;
}

function baseScheduleText(t: Pick<CountType, "frequency" | "weekday" | "days_of_week" | "month_day"> & { dates?: string[] }): string {
  if (t.frequency === "DAILY") {
    const days = t.days_of_week ?? [];
    if (!days.length || days.length === 7) return tr("Every day");
    if (days.length === 6) return tr("Every day except {0}", dayName([1, 2, 3, 4, 5, 6, 7].find((d) => !days.includes(d))!));
    if (days.join() === "1,2,3,4,5") return tr("Monday to Friday");
    if (days.length === 1) return tr("Every {0}", dayName(days[0]));
    return days.map((d) => dayName(d, "short")).join(", ");
  }
  if (t.frequency === "WEEKLY") return t.weekday ? tr("Every {0}", dayName(t.weekday)) : tr("Weekly (no day set)");
  if (t.frequency === "MONTHLY") return t.month_day ? tr("Every month on day {0}", t.month_day) : tr("Last day of every month");
  if (t.frequency === "DATES") return tr("{0} chosen dates", (t.dates ?? []).length);
  return tr("When needed (no schedule)");
}

type TF = { status: string; frequency: string };
const TF_EMPTY: TF = { status: "", frequency: "" };

/** Every filter of Count Types in one drawer (same sheet as Monitoring Stock Opname and Items Groups). */
function TypeFilters({ value, onApply, onClose }: { value: TF; onApply: (v: TF) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(TF_EMPTY)}>
      <FilterSection title={tr("Status")} hint={tr("Inactive count types are not scheduled anywhere")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={[{ value: "", label: tr("All") }, { value: "active", label: tr("Active") }, { value: "inactive", label: tr("Inactive") }]} />
      </FilterSection>
      <FilterSection title={tr("Frequency")} hint={tr("How often the count is due")}>
        <ChoiceGroup label="" value={d.frequency} onChange={(v) => setD({ ...d, frequency: v })}
          choices={[{ value: "", label: tr("All") }, ...FREQUENCIES.map((f) => ({ value: f.key, label: f.label() }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

const slug = (name: string) => name.normalize("NFD").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "SO_$1").slice(0, 40) || "SO_TYPE";

export default function TypesPage() {
  const [rows, setRows] = useState<CountType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CountType | "new" | null>(null);
  const [month, setMonth] = useState(() => wibMonthStart());
  const [calendar, setCalendar] = useState<CalendarDay[] | undefined>();
  const [q, setQ] = useState("");
  const [tf, setTf] = useState<TF>(TF_EMPTY);
  const [sheet, setSheet] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<CountType[]>("/api/so/count-settings/types"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const loadCalendar = useCallback(async () => {
    setCalendar(undefined);
    setCalendar(await api<CalendarDay[]>(`/api/so/count-settings/calendar?start=${iso(gridStart(month))}&days=42`).catch(() => []));
  }, [month]);
  useEffect(() => { void loadCalendar(); }, [loadCalendar]);

  const colors = useMemo(() => new Map((rows ?? []).map((t, i) => [t.code, TYPE_COLORS[i % TYPE_COLORS.length]])), [rows]);
  const colorOf = (code: string) => colors.get(code) ?? "bg-slate-400";
  const labelOf = (code: string, name: string) => countTypeLabel(code, name);
  const all = rows ?? [];
  const shownTypes = all.filter((t) => (!q.trim() || `${countTypeLabel(t.code, t.name)} ${t.code}`.toLowerCase().includes(q.trim().toLowerCase()))
    && (!tf.status || (tf.status === "active") === t.is_active) && (!tf.frequency || t.frequency === tf.frequency));
  const paged = usePaged(shownTypes, shownTypes.length + q + JSON.stringify(tf));
  const chips: ActiveFilter[] = [
    ...(tf.status ? [{ key: "s", label: tf.status === "active" ? tr("Active") : tr("Inactive"), onRemove: () => setTf({ ...tf, status: "" }) }] : []),
    ...(tf.frequency ? [{ key: "f", label: FREQUENCIES.find((x) => x.key === tf.frequency)?.label() ?? tf.frequency, onRemove: () => setTf({ ...tf, frequency: "" }) }] : []),
  ];
  const next = all.filter((t) => t.is_active && t.next_dates.length).map((t) => ({ t, d: t.next_dates[0] })).sort((a, b) => a.d.localeCompare(b.d))[0];
  const monthKey = wibDate().slice(0, 7);
  const thisMonth = (calendar ?? []).filter((d) => d.date.startsWith(monthKey)).reduce((a, d) => a + d.counts.length, 0);

  return (
    <Page title={tr("Count Types")} subtitle={tr("Name, schedule and count window of each stock opname; the calendar follows automatically")}
      actions={<Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New count type")}</Button>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Active count types")} icon={<CalendarDays size={13} />} value={rows ? fmtNumber(all.filter((t) => t.is_active).length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} in total", fmtNumber(all.length))}</p>}
          </Stat>
          <Stat label={tr("Next stock opname")} emphasis value={rows ? (next ? fmtDate(next.d) : "—") : <StatSkeleton />} valueClassName="truncate text-lg sm:text-xl">
            {rows && <p className="truncate">{next ? `${countTypeLabel(next.t.code, next.t.name)} · ${windowText(next.t.window_start)}` : tr("Nothing scheduled")}</p>}
          </Stat>
          <Stat label={tr("This month")} icon={<CalendarClock size={13} />} value={calendar ? fmtNumber(thisMonth) : <StatSkeleton />}>
            {calendar && <p>{tr("count days on the calendar")}</p>}
          </Stat>
          <Stat label={tr("Count lists")} value={rows ? fmtNumber(all.reduce((a, t) => a + t.lists, 0)) : <StatSkeleton />}>
            {rows && <p>{tr("{0} branch schedule overrides", fmtNumber(all.reduce((a, t) => a + t.overrides, 0)))}</p>}
          </Stat>
        </StatStrip>
      }>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search count type")} filters={chips}
              onOpen={() => setSheet(true)} onClear={() => setTf(TF_EMPTY)} />
          </div>
          {rows && shownTypes.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">{tr("Nothing matches the search or filters")}</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {rows === null ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-64 rounded-xl" />) : paged.rows.map((t) => (
              <TypeCard key={t.code} t={t} color={colorOf(t.code)} onOpen={() => setOpen(t)} />
            ))}
          </div>
          <div className="flex justify-end text-xs text-slate-500 empty:hidden"><PageNav paged={paged} /></div>
          <Panel>
            <div className="p-4">
              <MonthCalendar month={month} days={calendar} colorOf={colorOf} labelOf={labelOf} onMonth={setMonth} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={14} />
                {tr("Dates and windows follow the count types; a branch can have its own day or window (count lists).")}</p>
            </div>
          </Panel>
        </div>
      )}
      {sheet && <TypeFilters value={tf} onClose={() => setSheet(false)} onApply={(v) => { setTf(v); setSheet(false); }} />}
      {open && (
        <TypeDrawer type={open === "new" ? null : open} onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); void load(); void loadCalendar(); void reloadCountTypeNames(); }} />
      )}
    </Page>
  );
}

const FREQ_TONE: Record<Frequency, string> = {
  DAILY: "bg-sky-50 text-sky-700", WEEKLY: "bg-emerald-50 text-emerald-700", MONTHLY: "bg-amber-50 text-amber-700",
  DATES: "bg-violet-50 text-violet-700", ADHOC: "bg-slate-100 text-slate-600",
};

/** One count type: what it is, when it is due, its window and validity, the next dates, then lists / WIP / ESB. */
function TypeCard({ t, color, onOpen }: { t: CountType; color: string; onOpen: () => void }) {
  const end = (d: string) => fmtDate(new Date(Date.parse(`${d}T12:00:00Z`) + (t.period_days - 1) * 864e5).toISOString().slice(0, 10));
  const validity = t.valid_from || t.valid_to
    ? `${t.valid_from ? fmtDate(t.valid_from) : tr("now")} – ${t.valid_to ? fmtDate(t.valid_to) : tr("no end")}` : tr("Always");
  return (
    <button type="button" onClick={onOpen}
      className={cx("group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        t.is_active ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50/60")}>
      <span className={cx("h-1 w-full", t.is_active ? color : "bg-slate-300")} aria-hidden />
      <span className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-slate-900 group-hover:text-blue-700" title={countTypeLabel(t.code, t.name)}>{countTypeLabel(t.code, t.name)}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", FREQ_TONE[t.frequency])}>{FREQUENCIES.find((f) => f.key === t.frequency)?.label()}</span>
            {t.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge>{tr("Inactive")}</Badge>}
          </span>
        </span>
        <ChevronRight size={18} className="mt-0.5 flex-shrink-0 text-slate-300 transition-colors group-hover:text-blue-600" aria-hidden />
      </span>
      <span className="mx-4 block divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
        <Row icon={<CalendarDays size={14} />} k={tr("Schedule")} v={scheduleText(t)} />
        <Row icon={<Clock size={14} />} k={tr("Count window")} v={t.frequency === "ADHOC" ? tr("Any time") : windowText(t.window_start, t.window_end)} />
        <Row icon={<CalendarRange size={14} />} k={tr("Valid period")} v={validity} />
      </span>
      <span className="block px-4 pt-3">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Next")}</span>
        <span className="mt-1.5 flex min-h-[1.5rem] flex-wrap gap-1">
          {t.next_dates.length === 0 ? <span className="text-xs text-slate-400">{t.frequency === "ADHOC" ? tr("Started when needed") : tr("Nothing scheduled")}</span>
            : t.next_dates.slice(0, 3).map((d) => (
              <span key={d} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{fmtDate(d)}{t.period_days > 1 ? ` – ${end(d)}` : ""}</span>
            ))}
        </span>
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1" title={t.overrides ? tr("{0} branch overrides", t.overrides) : undefined}><ListChecks size={12} /> {tr("{0} lists", t.lists)}</span>
        {t.wip_enabled && <span className="inline-flex items-center gap-1 text-violet-700"><FlaskConical size={12} /> {tr("WIP form")}</span>}
        <span className="ml-auto max-w-full truncate font-mono text-slate-400" title={t.esb_purpose ?? undefined}>{t.code}</span>
        {t.esb_purpose && <span className="w-full truncate text-slate-400" title={t.esb_purpose}>ESB: {t.esb_purpose}</span>}
      </span>
    </button>
  );
}

function Row({ icon, k, v }: { icon: React.ReactNode; k: string; v: string }) {
  return (
    <span className="flex items-start gap-2 px-3 py-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] text-slate-500">{k}</span>
        <span className="block text-[13px] font-medium leading-snug text-slate-800">{v}</span>
      </span>
    </span>
  );
}

const QUICK_KEYS = ["", ...QUICK.map((_, i) => String(i))];

function TypeDrawer({ type, onClose, onSaved }: { type: CountType | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const creating = !type;
  const [d, setD] = useState<Draft>(() => type ? { ...type, name: countTypeLabel(type.code, type.name) } : {
    code: "", name: "", frequency: "WEEKLY", weekday: 1, days_of_week: [], month_day: 0, valid_from: null, valid_to: null,
    window_start: "07:00", window_end: "08:00", esb_purpose: null, sort: 50, is_active: true, wip_enabled: false, dates: [],
    period_days: 1,
  });
  const [code, setCode] = useState(type?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(false);
  const [editCode, setEditCode] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(!!(type && (type.valid_from || type.valid_to)));
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((o) => ({ ...o, [k]: v }));
  const [month, setMonth] = useState(() => wibMonthStart());

  const rule = useMemo(() => ({
    frequency: d.frequency, weekday: d.frequency === "WEEKLY" ? d.weekday : null, days_of_week: d.days_of_week,
    month_day: d.month_day, valid_from: d.valid_from || null, valid_to: d.valid_to || null,
    dates: d.frequency === "DATES" ? d.dates : null, period_days: d.period_days || 1,
  }), [d.frequency, d.weekday, d.days_of_week, d.month_day, d.valid_from, d.valid_to, d.dates, d.period_days]);
  useEffect(() => {
    if (d.frequency === "ADHOC") { setPreview([]); return; }
    if (d.frequency === "DATES") { setPreview(d.dates); setPreviewError(""); return; }
    const timer = setTimeout(() => {
      api<string[]>(`/api/so/count-settings/types/preview?start=${iso(gridStart(month))}&days=84`, { method: "POST", json: rule })
        .then((r) => { setPreview(r); setPreviewError(""); })
        .catch((e) => { setPreview(null); setPreviewError(errorText(e)); });
    }, 300);
    return () => clearTimeout(timer);
  }, [rule, month, d.frequency, d.dates]);
  // every day a count is open (a period of several days marks them all)
  const marked = useMemo(() => {
    const out = new Set<string>();
    for (const x of preview ?? []) {
      for (let k = 0; k < (d.period_days || 1); k++) {
        const day = new Date(`${x}T12:00:00Z`);
        day.setUTCDate(day.getUTCDate() + k);
        out.add(day.toISOString().slice(0, 10));
      }
    }
    return out;
  }, [preview, d.period_days]);
  const pickDate = (day: string) => set("dates", d.dates.includes(day) ? d.dates.filter((x) => x !== day) : [...d.dates, day].sort());
  const upcoming = (preview ?? []).filter((x) => x >= wibDate()).slice(0, 4);

  // no days = every day: tapping a day then leaves it out; a schedule keeps at least one day
  const toggleDay = (n: number) => {
    const cur = d.days_of_week.length ? d.days_of_week : [1, 2, 3, 4, 5, 6, 7];
    const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort();
    if (next.length) set("days_of_week", next.length === 7 ? [] : next);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    const target = creating ? (code || slug(d.name)) : type.code;
    try {
      await api(`/api/so/count-settings/types/${target}`, {
        method: "PUT",
        json: { name: d.name.trim(), ...rule, window_start: d.window_start, window_end: d.window_end,
                esb_purpose: d.esb_purpose || null, sort: Number(d.sort) || 0, is_active: d.is_active, wip_enabled: d.wip_enabled },
      });
      toast(creating ? tr("Count type created") : tr("Count type saved"));
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const dayBtn = (on: boolean) => cx("h-9 rounded-lg border text-sm font-medium transition-colors",
    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300");
  const windowPreset = WINDOWS.findIndex(([a, b]) => d.window_start === a && d.window_end === b);
  const summary = scheduleText({ ...d, weekday: d.weekday });

  return (
    <Drawer open onClose={onClose} size="lg" icon={<CalendarDays size={18} />}
      title={creating ? tr("New count type") : countTypeLabel(type.code, type.name)}
      description={creating ? tr("Name it, choose when it is due and its count window") : type.code}
      footer={<>
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!d.name.trim() || (d.frequency === "DATES" && !d.dates.length)} onClick={save}>
          <Save size={16} /> {creating ? tr("Create count type") : tr("Save changes")}
        </Button>
      </>}>
      <div className="space-y-4">
        {/* what the staff will see */}
        <section className="rounded-xl bg-slate-900 p-4 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Summary")}</p>
          <p className="mt-1 truncate text-lg font-semibold">{d.name.trim() || tr("Untitled count type")}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" />{summary}</span>
            {d.frequency !== "ADHOC" && <span className="inline-flex items-center gap-1.5"><Clock size={14} className="text-slate-400" />{windowText(d.window_start, d.window_end)}</span>}
          </p>
          {upcoming.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-1.5">
              {upcoming.map((x) => <span key={x} className="rounded-md bg-white/10 px-2 py-0.5 text-xs">{fmtDate(x)}</span>)}
            </p>
          )}
          <p className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            <span className={cx("rounded-full px-2 py-0.5 font-semibold", d.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300")}>{d.is_active ? tr("Active") : tr("Inactive")}</span>
            {d.wip_enabled && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 font-semibold text-violet-200">{tr("WIP form")}</span>}
          </p>
        </section>

        <FormCard n={1} title={tr("Name")} hint={tr("Shown to the staff on the stock opname screen and to Cost Control")}>
          <Field label={tr("Count type name")} required>
            <Input value={d.name} autoFocus={creating} onChange={(e) => { set("name", e.target.value); if (creating && !codeTouched) setCode(slug(e.target.value)); }}
              placeholder={tr("e.g. SO Mingguan Bahan Baku")} />
          </Field>
          {creating && (editCode ? (
            <Field label={tr("Code")} hint={tr("Capital letters, digits and _")}>
              <Input value={code} onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_")); }} className="font-mono" />
            </Field>
          ) : (
            <p className="text-xs text-slate-500">{tr("Code")}: <span className="font-mono text-slate-700">{code || "—"}</span>
              <button type="button" onClick={() => setEditCode(true)} className="ml-2 font-medium text-blue-700 hover:underline">{tr("Edit code")}</button></p>
          ))}
        </FormCard>

        <FormCard n={2} title={tr("Schedule")} hint={tr("When the branches have to count")}
          aside={(
            <select value="" aria-label={tr("Quick setup")} onChange={(e) => { const q = QUICK[Number(e.target.value)]; if (q) setD((o) => ({ ...o, ...q.set })); }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-600">
              {QUICK_KEYS.map((k) => <option key={k || "x"} value={k}>{k === "" ? tr("Quick setup…") : QUICK[Number(k)].label()}</option>)}
            </select>
          )}>
          <Segmented label={tr("Frequency")} value={d.frequency} onChange={(v) => set("frequency", v)}
            options={FREQUENCIES.map((f) => ({ value: f.key, label: f.label() }))} />
          {d.frequency === "DAILY" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{tr("On these days")}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} type="button" className={dayBtn(!d.days_of_week.length || d.days_of_week.includes(n))} onClick={() => toggleDay(n)}>{dayName(n, "short")}</button>
                ))}
              </div>
            </div>
          )}
          {d.frequency === "WEEKLY" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{tr("Day of the week")}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" className={dayBtn(d.weekday === n)} onClick={() => set("weekday", n)} title={dayName(n)}>{dayName(n, "short")}</button>)}
              </div>
            </div>
          )}
          {d.frequency === "MONTHLY" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{tr("Day of the month")}</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={cx(dayBtn(d.month_day === n), "h-8 tabular-nums")} onClick={() => set("month_day", n)}>{n}</button>
                ))}
                <button type="button" className={cx(dayBtn(d.month_day === 0), "col-span-4 h-8")} onClick={() => set("month_day", 0)}>{tr("Last day")}</button>
              </div>
              {d.month_day > 28 && <p className="mt-1.5 text-xs text-slate-500">{tr("Months without day {0} use their last day.", d.month_day)}</p>}
            </div>
          )}
          {d.frequency === "DATES" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">{tr("Tap the dates the count is due (tap again to remove)")}</p>
              <MonthCalendar month={month} onMonth={setMonth} colorOf={() => "bg-blue-600"} labelOf={(_c, n) => n} highlight={marked} onPick={pickDate} compact />
              <div className="flex flex-wrap items-center gap-1.5">
                {d.dates.length === 0 ? <span className="text-xs text-amber-700">{tr("No date chosen yet")}</span> : d.dates.map((x) => (
                  <button key={x} type="button" onClick={() => pickDate(x)} className="rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-800 hover:bg-red-50 hover:text-red-700"
                    title={tr("Remove")}>{fmtDate(x)} ×</button>
                ))}
                {d.dates.length > 0 && <button type="button" className="text-xs font-medium text-slate-500 hover:underline" onClick={() => set("dates", [])}>{tr("Clear all")}</button>}
              </div>
            </div>
          )}
          {d.frequency === "ADHOC" && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{tr("No schedule: the branch starts this count whenever it is needed.")}</p>}
        </FormCard>

        {d.frequency !== "ADHOC" && (
          <FormCard n={3} title={tr("Count window")} hint={tr("The hours (WIB) the count can be started, and how long it stays open")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={(d.period_days || 1) > 1 ? tr("Opens on the first day") : tr("Opens")}><Input type="time" value={d.window_start} onChange={(e) => set("window_start", e.target.value)} /></Field>
              <Field label={(d.period_days || 1) > 1 ? tr("Closes on the last day") : tr("Closes")}><Input type="time" value={d.window_end} onChange={(e) => set("window_end", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-500">{tr("Common")}:</span>
              {WINDOWS.map(([a, b], i) => (
                <button key={a + b} type="button" onClick={() => setD((o) => ({ ...o, window_start: a, window_end: b }))}
                  className={cx("rounded-full border px-2.5 py-0.5 text-xs font-medium", windowPreset === i ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{a}–{b}</button>
              ))}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">{tr("The count stays open")}</p>
              <Segmented label={tr("The count stays open")} value={String(d.period_days || 1)} onChange={(v) => set("period_days", Number(v))}
                options={[1, 2, 3, 7].map((n) => ({ value: String(n), label: n === 1 ? tr("Same day") : tr("{0} days", n) }))} />
              {(d.period_days || 1) > 1 && <p className="mt-1.5 text-xs text-slate-500">{tr("The window opens on the scheduled day and closes on day {0} (e.g. 14–15 Oct). One count per branch for the whole period.", d.period_days)}</p>}
            </div>
          </FormCard>
        )}

        {d.frequency !== "ADHOC" && d.frequency !== "DATES" && (
          <FormCard n={4} title={tr("Calendar preview")} hint={tr("Highlighted: the dates this schedule produces (not saved yet).")}>
            {previewError ? <p className="text-sm text-red-600">{previewError}</p>
              : <MonthCalendar month={month} onMonth={setMonth} colorOf={() => "bg-blue-600"} labelOf={(_c, n) => n} highlight={marked} compact />}
          </FormCard>
        )}

        <section className="rounded-xl border border-slate-200 bg-white">
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more}
            className="flex w-full items-center justify-between px-4 py-3 text-left">
            <span>
              <span className="block text-sm font-semibold text-slate-900">{tr("More settings")}</span>
              <span className="block text-xs text-slate-500">{tr("Status, WIP form, validity, ESB purpose and order")}</span>
            </span>
            <ChevronDown size={18} className={cx("text-slate-400 transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <div className="space-y-4 border-t border-slate-100 p-4">
              <Switch label={tr("Active")} hint={tr("An inactive count type is not offered to the branches")} checked={d.is_active} onChange={(v) => set("is_active", v)} />
              <Switch label={tr("WIP form")} hint={tr("The count also asks for WIP / premix in grams; its ingredients are added to the count")}
                checked={d.wip_enabled} onChange={(v) => set("wip_enabled", v)} />
              {d.frequency !== "ADHOC" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tr("Valid from")} hint={tr("Empty = from now")}><Input type="date" value={d.valid_from ?? ""} onChange={(e) => set("valid_from", e.target.value || null)} /></Field>
                  <Field label={tr("Valid until")} hint={tr("Empty = no end")}><Input type="date" value={d.valid_to ?? ""} min={d.valid_from ?? undefined} onChange={(e) => set("valid_to", e.target.value || null)} /></Field>
                </div>
              )}
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label={tr("ESB purpose")} hint={tr("Purpose name in the ESB stock opname import file")}>
                  <Input value={d.esb_purpose ?? ""} onChange={(e) => set("esb_purpose", e.target.value)} placeholder="STOCK OPNAME MINGGUAN (OUTLET)" />
                </Field>
                <Field label={tr("Order")}><Input inputMode="numeric" value={String(d.sort)} onChange={(e) => set("sort", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
              </div>
            </div>
          )}
        </section>
        {!creating && type.lists === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("No count list uses this type yet: add one under Count lists so branches count it.")}</p>}
      </div>
    </Drawer>
  );
}

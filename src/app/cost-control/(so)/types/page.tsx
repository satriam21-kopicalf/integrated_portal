"use client";

// Count types (Cost Control): the name each stock opname has, when it is due (daily on chosen days, weekly on a day,
// monthly on a date or the last day), its count window and validity period, and its ESB purpose. A month calendar
// shows the schedule the server computes from these rules; the editor previews an unsaved schedule live.

import { CalendarClock, CalendarDays, Clock, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Checkbox, cx, ErrorState, Field, Input, Page, Panel, useToast } from "@/so/ui";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import MonthCalendar, { CalendarDay, gridStart, iso, TYPE_COLORS } from "@/so/features/schedule/MonthCalendar";
import { reloadCountTypeNames } from "@/so/features/CountTypeNames";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";
import { wibDate, wibMonthStart, windowText } from "@/so/lib/wib";

type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "ADHOC";
type CountType = {
  code: string; name: string; frequency: Frequency; weekday: number | null; days_of_week: number[]; month_day: number;
  valid_from: string | null; valid_to: string | null; window_start: string; window_end: string; esb_purpose: string | null; wip_enabled: boolean;
  sort: number; is_active: boolean; lists: number; overrides: number; next_dates: string[];
};
type Draft = Omit<CountType, "lists" | "overrides" | "next_dates">;

const dayName = (d: number, style: "long" | "short" = "long") => new Date(2024, 0, d).toLocaleDateString(locale(), { weekday: style }); // 2024-01-01 = Monday
const fmtDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short" });
const FREQUENCIES: { key: Frequency; label: () => string }[] = [
  { key: "DAILY", label: () => tr("Daily") }, { key: "WEEKLY", label: () => tr("Weekly") },
  { key: "MONTHLY", label: () => tr("Monthly") }, { key: "ADHOC", label: () => tr("When needed") },
];

/** "Every day except Sunday, 07:00–08:00" and the like. */
export function scheduleText(t: Pick<CountType, "frequency" | "weekday" | "days_of_week" | "month_day">): string {
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
  return tr("When needed (no schedule)");
}

const slug = (name: string) => name.normalize("NFD").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "SO_$1").slice(0, 40) || "SO_TYPE";

export default function TypesPage() {
  const [rows, setRows] = useState<CountType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CountType | "new" | null>(null);
  const [month, setMonth] = useState(() => wibMonthStart());
  const [calendar, setCalendar] = useState<CalendarDay[] | undefined>();

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

  return (
    <Page title={tr("Count types")} subtitle={tr("Name, schedule and count window of each stock opname; the calendar follows automatically")}
      actions={<Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New count type")}</Button>}>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : (
        <div className="space-y-5">
          <Panel>
            <div className="p-4">
              <MonthCalendar month={month} days={calendar} colorOf={colorOf} labelOf={labelOf} onMonth={setMonth} />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={14} />
                {tr("Dates and windows follow the count types; a branch can have its own day or window (count lists).")}</p>
            </div>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {rows === null ? Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-28 rounded-xl" />) : rows.map((t) => (
              <button key={t.code} type="button" onClick={() => setOpen(t)}
                className={cx("block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow",
                  t.is_active ? "border-slate-200" : "border-dashed border-slate-300 opacity-70")}>
                <span className="flex items-start gap-3">
                  <span className={cx("mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full", colorOf(t.code))} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{countTypeLabel(t.code, t.name)}</span>
                      {!t.is_active && <Badge>{tr("Inactive")}</Badge>}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-700"><CalendarDays size={14} className="text-slate-400" /> {scheduleText(t)}</span>
                    {t.frequency !== "ADHOC" && (
                      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-700"><Clock size={14} className="text-slate-400" /> {windowText(t.window_start, t.window_end)}</span>
                    )}
                    {(t.valid_from || t.valid_to) && (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {t.valid_from ? tr("From {0}", fmtDate(t.valid_from)) : ""}{t.valid_from && t.valid_to ? " · " : ""}{t.valid_to ? tr("until {0}", fmtDate(t.valid_to)) : ""}
                      </span>
                    )}
                    {t.next_dates.length > 0 && (
                      <span className="mt-2 flex flex-wrap gap-1">
                        {t.next_dates.slice(0, 3).map((d) => <span key={d} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{fmtDate(d)}</span>)}
                      </span>
                    )}
                    <span className="mt-2 block text-[11px] text-slate-400">
                      <span className="font-mono">{t.code}</span> · {tr("{0} lists", t.lists)}{t.overrides ? ` · ${tr("{0} branch overrides", t.overrides)}` : ""}{t.esb_purpose ? ` · ${t.esb_purpose}` : ""}{t.wip_enabled ? ` · ${tr("WIP form")}` : ""}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {open && (
        <TypeDrawer type={open === "new" ? null : open} onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); void load(); void loadCalendar(); void reloadCountTypeNames(); }} />
      )}
    </Page>
  );
}

function TypeDrawer({ type, onClose, onSaved }: { type: CountType | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const creating = !type;
  const [d, setD] = useState<Draft>(() => type ? { ...type, name: countTypeLabel(type.code, type.name) } : {
    code: "", name: "", frequency: "WEEKLY", weekday: 1, days_of_week: [], month_day: 0, valid_from: null, valid_to: null,
    window_start: "07:00", window_end: "08:00", esb_purpose: null, sort: 50, is_active: true, wip_enabled: false,
  });
  const [code, setCode] = useState(type?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((o) => ({ ...o, [k]: v }));
  const month = useMemo(() => wibMonthStart(), []);

  const rule = useMemo(() => ({
    frequency: d.frequency, weekday: d.frequency === "WEEKLY" ? d.weekday : null, days_of_week: d.days_of_week,
    month_day: d.month_day, valid_from: d.valid_from || null, valid_to: d.valid_to || null,
  }), [d.frequency, d.weekday, d.days_of_week, d.month_day, d.valid_from, d.valid_to]);
  useEffect(() => {
    if (d.frequency === "ADHOC") { setPreview([]); return; }
    const timer = setTimeout(() => {
      api<string[]>(`/api/so/count-settings/types/preview?start=${iso(gridStart(month))}&days=84`, { method: "POST", json: rule })
        .then((r) => { setPreview(r); setPreviewError(""); })
        .catch((e) => { setPreview(null); setPreviewError(errorText(e)); });
    }, 300);
    return () => clearTimeout(timer);
  }, [rule, month, d.frequency]);
  const marked = useMemo(() => new Set(preview ?? []), [preview]);
  const upcoming = (preview ?? []).filter((x) => x >= wibDate()).slice(0, 6);

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

  const chip = (on: boolean) => cx("rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors",
    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300");

  return (
    <Drawer open onClose={onClose} size="lg" icon={<CalendarDays size={18} />}
      title={creating ? tr("New count type") : countTypeLabel(type.code, type.name)} description={creating ? tr("Name it, then choose when it is due") : type.code}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!d.name.trim()} onClick={save}><Save size={16} /> {creating ? tr("Create") : tr("Save")}</Button></>}>
      <div className="space-y-6">
        <DrawerSection title={tr("Name")}>
          <Field label={tr("Name shown to staff and Cost Control")} required>
            <Input value={d.name} onChange={(e) => { set("name", e.target.value); if (creating && !codeTouched) setCode(slug(e.target.value)); }}
              placeholder={tr("e.g. SO Mingguan Bahan Baku")} />
          </Field>
          {creating && (
            <Field label={tr("Code")} hint={tr("Made from the name; capital letters, digits and _")}>
              <Input value={code} onChange={(e) => { setCodeTouched(true); setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_")); }} className="font-mono" />
            </Field>
          )}
        </DrawerSection>

        <DrawerSection title={tr("Schedule")}>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Frequency")}>
            {FREQUENCIES.map((f) => (
              <button key={f.key} type="button" role="radio" aria-checked={d.frequency === f.key} className={chip(d.frequency === f.key)}
                onClick={() => set("frequency", f.key)}>{f.label()}</button>
            ))}
          </div>
          {d.frequency === "DAILY" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("On these days")}</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button key={n} type="button" className={chip(!d.days_of_week.length || d.days_of_week.includes(n))}
                    onClick={() => toggleDay(n)}>{dayName(n, "short")}</button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => set("days_of_week", [])}>{tr("Every day")}</button>
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => set("days_of_week", [1, 2, 3, 4, 5, 6])}>{tr("Monday to Saturday")}</button>
                <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => set("days_of_week", [1, 2, 3, 4, 5])}>{tr("Monday to Friday")}</button>
              </div>
            </div>
          )}
          {d.frequency === "WEEKLY" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("Day of the week")}</p>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => <button key={n} type="button" className={chip(d.weekday === n)} onClick={() => set("weekday", n)}>{dayName(n)}</button>)}
              </div>
            </div>
          )}
          {d.frequency === "MONTHLY" && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("Day of the month")}</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" className={cx(chip(d.month_day === n), "px-0 tabular-nums")} onClick={() => set("month_day", n)}>{n}</button>
                ))}
                <button type="button" className={cx(chip(d.month_day === 0), "col-span-4")} onClick={() => set("month_day", 0)}>{tr("Last day")}</button>
              </div>
              {d.month_day > 28 && <p className="mt-1.5 text-xs text-slate-500">{tr("Months without day {0} use their last day.", d.month_day)}</p>}
            </div>
          )}
          {d.frequency !== "ADHOC" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr("Count window opens (WIB)")}><Input type="time" value={d.window_start} onChange={(e) => set("window_start", e.target.value)} /></Field>
                <Field label={tr("Count window closes (WIB)")}><Input type="time" value={d.window_end} onChange={(e) => set("window_end", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr("Valid from")} hint={tr("Empty = from now")}><Input type="date" value={d.valid_from ?? ""} onChange={(e) => set("valid_from", e.target.value || null)} /></Field>
                <Field label={tr("Valid until")} hint={tr("Empty = no end")}><Input type="date" value={d.valid_to ?? ""} min={d.valid_from ?? undefined} onChange={(e) => set("valid_to", e.target.value || null)} /></Field>
              </div>
            </>
          )}
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="font-medium">{scheduleText({ ...d, weekday: d.weekday })}</span>
            {d.frequency !== "ADHOC" && <span className="text-slate-500"> · {windowText(d.window_start, d.window_end)}</span>}
          </p>
        </DrawerSection>

        {d.frequency !== "ADHOC" && (
          <DrawerSection title={tr("Calendar preview")} description={tr("Highlighted: the dates this schedule produces (not saved yet).")}>
            {previewError ? <p className="text-sm text-red-600">{previewError}</p> : (
              <>
                <MonthCalendar month={month} colorOf={() => "bg-blue-600"} labelOf={(_c, n) => n} highlight={marked} compact />
                <MonthCalendar month={new Date(month.getFullYear(), month.getMonth() + 1, 1)} colorOf={() => "bg-blue-600"} labelOf={(_c, n) => n} highlight={marked} compact />
                {upcoming.length > 0 && (
                  <p className="text-xs text-slate-500">{tr("Next")}: {upcoming.map(fmtDate).join(" · ")}</p>
                )}
              </>
            )}
          </DrawerSection>
        )}

        <DrawerSection title={tr("ESB & display")}>
          <Field label={tr("ESB purpose")} hint={tr("Purpose name in the ESB stock opname import file")}>
            <Input value={d.esb_purpose ?? ""} onChange={(e) => set("esb_purpose", e.target.value)} placeholder="STOCK OPNAME MINGGUAN (OUTLET)" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("Order")}><Input inputMode="numeric" value={String(d.sort)} onChange={(e) => set("sort", Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
            <div className="flex items-end pb-2"><Checkbox label={tr("Active")} checked={d.is_active} onChange={(e) => set("is_active", e.target.checked)} /></div>
          </div>
          <Checkbox label={tr("WIP form")} hint={tr("The count also asks for WIP / premix (pail, teko, gram); its ingredients are added to the count")}
            checked={d.wip_enabled} onChange={(e) => set("wip_enabled", e.target.checked)} />
          {!creating && type.lists === 0 && <p className="text-xs text-amber-700">{tr("No count list uses this type yet: add one under Count lists so branches count it.")}</p>}
        </DrawerSection>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      </div>
    </Drawer>
  );
}

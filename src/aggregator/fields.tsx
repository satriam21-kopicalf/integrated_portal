"use client";

// The fields of Aggregator Insight (2026-11-25): one height and look on every form and filter, dates written as
// "Rab, 25 Nov 2026" with a calendar of our own, times in 24 hours typed as four digits.

import { useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Floating from "@/components/kc/Floating";
import { Button, cx } from "@/so/ui";
import { locale, tr } from "@/lib/i18n";
import { daysAgo, fmtDay, fmtPeriod } from "./time";

/** 16px on phones: iOS zooms into smaller text */
export const ctl = "h-11 w-full rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-3 text-base text-[color:var(--j-172B4D)] placeholder:text-[color:var(--j-626F86)] transition-colors hover:border-[color:var(--j-8590A2)] focus:border-[color:var(--j-388BFF)] focus:outline-none focus:ring-2 focus:ring-[color:var(--j-388BFF)] disabled:bg-[color:var(--j-091E420F)] sm:h-10 sm:text-sm";
const trigger = "flex h-11 w-full items-center gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-3 text-left text-[15px] text-[color:var(--j-172B4D)] transition-colors hover:border-[color:var(--j-8590A2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)] sm:h-10 sm:text-sm";

/** A field with its label above, what it means below. Not a <label>: the control may be a list or a calendar. */
export function Row({ label, hint, required, error, children, className }: { label: string; hint?: ReactNode; required?: boolean; error?: string | null; children: ReactNode; className?: string }) {
  return <div className={cx("min-w-0", className)}><p className="mb-1.5 text-[13px] font-medium text-[color:var(--j-44546F)] sm:text-xs">{label}{required ? <span className="ml-0.5 text-red-500">*</span> : null}</p>{children}
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-[color:var(--j-626F86)]">{hint}</p> : null}</div>;
}
/** A titled group of fields in a drawer. */
export function Group({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return <section className="space-y-3.5 border-b border-[color:var(--j-DCDFE4)] pb-5 last:border-b-0 last:pb-0 [&:not(:first-child)]:pt-5"><div><h3 className="text-[13px] font-semibold text-[color:var(--j-172B4D)]">{title}</h3>{note && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{note}</p>}</div>{children}</section>;
}
/** Label and value, for what cannot be changed. */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)] text-sm">{rows.map(([k, v]) => <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2"><dt className="flex-shrink-0 text-xs text-[color:var(--j-626F86)]">{k}</dt><dd className="min-w-0 break-words text-right font-medium text-[color:var(--j-172B4D)]">{v}</dd></div>)}</dl>;
}

// ---------------------------------------------------------------- calendar

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function Calendar({ from, to, min, max, month, onMonth, onPick }: { from: string; to: string; min?: string; max?: string; month: [number, number]; onMonth: (m: [number, number]) => void; onPick: (day: string) => void }) {
  const [y, m] = month;
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), today = daysAgo(0);
  const go = (x: number) => { const d = new Date(y, m + x, 1); onMonth([d.getFullYear(), d.getMonth()]); };
  const days = [tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat"), tr("Sun")];
  const nav = "flex h-10 w-10 items-center justify-center rounded-[3px] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] disabled:opacity-30 sm:h-8 sm:w-8";
  return (
    <div className="px-3 pb-3 pt-1">
      <div className="mb-1 flex items-center justify-between"><button type="button" className={nav} aria-label={tr("Previous Month")} disabled={!!min && iso(y, m, 1) <= min} onClick={() => go(-1)}><ChevronLeft size={18} /></button>
        <span className="text-sm font-semibold text-[color:var(--j-172B4D)]">{new Date(y, m, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" })}</span>
        <button type="button" className={nav} aria-label={tr("Next Month")} disabled={!!max && iso(y, m, n) >= max} onClick={() => go(1)}><ChevronRight size={18} /></button></div>
      <div className="grid grid-cols-7 text-center">
        {days.map((d) => <span key={d} className="py-1 text-[11px] font-medium text-[color:var(--j-626F86)]">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: n }, (_, i) => {
          const d = iso(y, m, i + 1), edge = d === from || d === to, mid = !!from && !!to && d > from && d < to;
          return <button key={d} type="button" disabled={(!!max && d > max) || (!!min && d < min)} aria-pressed={edge} aria-label={fmtDay(d)} onClick={() => onPick(d)}
            className={cx("h-11 text-sm tabular-nums disabled:text-[color:var(--j-8590A2)] sm:h-9", edge ? "rounded-[3px] bg-[color:var(--j-0C66E4)] font-semibold text-white" : mid ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)]" : cx("rounded-[3px] enabled:hover:bg-[color:var(--j-091E420F)]", d === today ? "font-semibold text-[color:var(--j-0C66E4)] ring-1 ring-inset ring-[color:var(--j-85B8FF)]" : "text-[color:var(--j-44546F)]"))}>{i + 1}</button>;
        })}
      </div>
    </div>
  );
}
const monthOf = (day: string): [number, number] => [Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1];

/** One date: "Rab, 25 Nov 2026". */
export function DateField({ value, onChange, label, min, max, quick = true }: { value: string; onChange: (v: string) => void; label: string; min?: string; max?: string; quick?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value));
  const pick = (d: string) => { onChange(d); setOpen(false); };
  const ok = (d: string) => (!max || d <= max) && (!min || d >= min);
  return (
    <>
      <button ref={ref} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth(monthOf(value)); setOpen(!open); }} className={trigger}>
        <CalendarDays size={16} className="flex-shrink-0 text-[color:var(--j-626F86)]" /><span className="min-w-0 flex-1 truncate">{fmtDay(value)}</span><ChevronDown size={15} className="flex-shrink-0 text-[color:var(--j-626F86)]" /></button>
      <Floating open={open} onClose={() => setOpen(false)} title={label} subtitle={fmtDay(value)} anchor={ref} width={320}>
        {quick && <div className="flex gap-2 px-3 pt-3">{([[tr("Today"), daysAgo(0)], [tr("Yesterday"), daysAgo(1)]] as const).filter(([, d]) => ok(d)).map(([l, d]) => <button key={l} type="button" onClick={() => pick(d)} className={cx("h-9 flex-1 rounded-[3px] border text-sm font-medium sm:h-8 sm:text-xs", value === d ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-0C66E4)] text-white" : "border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]")}>{l}</button>)}</div>}
        <Calendar from={value} to={value} min={min} max={max} month={month} onMonth={setMonth} onPick={pick} />
      </Floating>
    </>
  );
}

const span = (a: string, z: string) => Math.round((new Date(z).getTime() - new Date(a).getTime()) / 86400_000) + 1;
/** A period: the shortcuts, or the first and the last day on one calendar. */
export function PeriodField({ from, to, preset, presets, onChange, label, maxDays = 93 }: {
  from: string; to: string; preset: string; presets: { value: string; label: string; from: string; to: string }[]; onChange: (from: string, to: string, preset: string) => void; label: string; maxDays?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(from);
  const [z, setZ] = useState(to);
  const [end, setEnd] = useState<"from" | "to">("from");
  const [month, setMonth] = useState(monthOf(to));
  const start = () => { setA(from); setZ(to); setEnd("from"); setMonth(monthOf(to)); setOpen(!open); };
  const pick = (d: string) => {
    if (end === "from") { setA(d); if (d > z) setZ(d); setEnd("to"); }
    else if (d < a) { setA(d); }
    else { setZ(d); setEnd("from"); }
  };
  const n = span(a, z), bad = n > maxDays;
  const name = presets.find((p) => p.value === preset)?.label ?? tr("Chosen dates");
  const tile = (k: "from" | "to", l: string, d: string) => <button type="button" aria-pressed={end === k} onClick={() => { setEnd(k); setMonth(monthOf(d)); }} className={cx("min-w-0 flex-1 rounded-[3px] border px-3 py-2 text-left", end === k ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)]" : "border-[color:var(--j-DCDFE4)]")}><span className="block text-[11px] font-medium text-[color:var(--j-626F86)]">{l}</span><span className="block truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{fmtDay(d)}</span></button>;
  return (
    <>
      <button ref={ref} type="button" aria-label={`${label}: ${name}, ${fmtPeriod(from, to)}`} aria-haspopup="dialog" aria-expanded={open} onClick={start} className={trigger}>
        <CalendarDays size={16} className="flex-shrink-0 text-[color:var(--j-0C66E4)]" /><span className="min-w-0 flex-1 truncate"><span className="font-medium">{fmtPeriod(from, to)}</span><span className="ml-2 hidden text-xs text-[color:var(--j-626F86)] sm:inline">{name}</span></span><ChevronDown size={15} className="flex-shrink-0 text-[color:var(--j-626F86)]" /></button>
      <Floating open={open} onClose={() => setOpen(false)} title={label} subtitle={fmtPeriod(a, z)} anchor={ref} width={352}
        footer={<><span className={cx("min-w-0 flex-1 text-xs", bad ? "font-medium text-red-600" : "text-[color:var(--j-626F86)]")}>{bad ? tr("{0} days: at most {1}", n, maxDays) : n === 1 ? tr("1 day") : tr("{0} days", n)}</span><Button disabled={bad} onClick={() => { onChange(a, z, "custom"); setOpen(false); }}>{tr("Apply")}</Button></>}>
        <div className="grid grid-cols-3 gap-2 p-3">{presets.map((p) => <button key={p.value} type="button" aria-pressed={preset === p.value} onClick={() => { onChange(p.from, p.to, p.value); setOpen(false); }} className={cx("h-10 rounded-[3px] border px-1 text-[13px] font-medium sm:h-8 sm:text-xs", preset === p.value ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-0C66E4)] text-white" : "border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]")}>{p.label}</button>)}</div>
        <div className="border-t border-[color:var(--j-F1F2F4)] px-3 pt-3"><p className="mb-1.5 text-[11px] font-semibold text-[color:var(--j-626F86)]">{tr("Or choose the dates")}</p><div className="flex gap-2">{tile("from", tr("First day"), a)}{tile("to", tr("Last day"), z)}</div></div>
        <Calendar from={a} to={z} max={daysAgo(0)} month={month} onMonth={setMonth} onPick={pick} />
      </Floating>
    </>
  );
}

const clean = (t: string) => { const d = t.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d; };
const whole = (t: string) => { const d = t.replace(/\D/g, ""); if (!d) return ""; const p = d.length <= 2 ? d.padStart(2, "0") + "00" : d.padStart(4, "0"); return Number(p.slice(0, 2)) < 24 && Number(p.slice(2)) < 60 ? `${p.slice(0, 2)}:${p.slice(2)}` : null; };
/** A time in 24 hours: 0730 → 07:30, 7 → 07:00. */
export function TimeField({ value, onChange, label, prefix }: { value: string; onChange: (v: string) => void; label: string; prefix?: string }) {
  const [text, setText] = useState<string | null>(null);
  const bad = text != null && text.length === 5 && whole(text) == null;
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-xs text-[color:var(--j-626F86)]"><Clock size={14} className="text-[color:var(--j-626F86)]" />{prefix}</span>
      <input inputMode="numeric" aria-label={label} aria-invalid={bad} placeholder="--:--" maxLength={5} value={text ?? value} onFocus={(e) => e.target.select()}
        onChange={(e) => { const t = clean(e.target.value); setText(t); const w = t.length === 5 ? whole(t) : t === "" ? "" : null; if (w != null) onChange(w); }}
        onBlur={() => { if (text != null) { const w = whole(text); if (w != null) onChange(w); setText(null); } }}
        className={cx(ctl, "text-right tabular-nums", bad && "!border-red-500")} />
    </span>
  );
}

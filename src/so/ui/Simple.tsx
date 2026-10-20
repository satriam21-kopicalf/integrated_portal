"use client";

// Simple controls of the settings pages (2026-10-20): filters as pills in the toolbar (no drawer), a switch for on / off
// settings and a numbered card for the steps of a form in a drawer.

import { ChevronDown, RotateCcw } from "lucide-react";
import { ReactNode } from "react";
import { cx } from "@/so/ui";
import { tr } from "@/lib/i18n";

export type PillOption = { value: string; label: string };

/** "Status · Active ▾": a native select styled as a pill; highlighted when a value is chosen. */
export function FilterPill({ label, value, options, onChange, allLabel }: {
  label: string; value: string; options: PillOption[]; onChange: (v: string) => void; allLabel?: string;
}) {
  const on = !!value;
  const current = options.find((o) => o.value === value)?.label;
  return (
    <label className={cx("relative inline-flex h-9 flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border pl-3.5 pr-8 text-sm transition-colors",
      on ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
      <span className={cx(on ? "text-blue-600" : "text-slate-400")}>{label}</span>
      <span className="font-medium">{current ?? allLabel ?? tr("All")}</span>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 opacity-60" />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0">
        <option value="">{allLabel ?? tr("All")}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Search + filter pills + reset, in one row (wraps on phones). */
export function FilterBar({ search, onSearch, placeholder, children, active, onReset }: {
  search: string; onSearch: (v: string) => void; placeholder: string; children: ReactNode; active: boolean; onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 2xl:flex-row 2xl:items-center">
      <div className="relative min-w-0 sm:max-w-md 2xl:w-72 2xl:flex-none">
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="h-9 w-full rounded-full border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
      </div>
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {children}
        {active && (
          <button type="button" onClick={onReset} className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <RotateCcw size={14} /> {tr("Reset")}
          </button>
        )}
      </div>
    </div>
  );
}

/** On / off with a label and a hint. */
export function Switch({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean;
}) {
  return (
    <label className={cx("flex items-start justify-between gap-4", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          checked ? "bg-blue-600" : "bg-slate-300")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

/** A numbered step of a form in a drawer. */
export function FormCard({ n, title, hint, children, aside }: { n?: number; title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        {n !== undefined && <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{n}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{title}</span>
          {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
        </span>
        {aside}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

/** Segmented choice (2–6 options). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx("flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{o.label}</button>
      ))}
    </div>
  );
}

"use client";

// Simple controls of the settings pages (2026-10-20): a switch for on / off settings and a numbered card for the steps
// of a form in a drawer.

import { ReactNode } from "react";
import { cx } from "@/so/ui";

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
    <section className="rounded-2xl border border-slate-200/80 bg-white">
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

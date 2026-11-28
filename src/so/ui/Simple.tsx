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
        <span className="block text-sm font-medium text-[color:var(--j-172B4D)]">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-[color:var(--j-626F86)]">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-85B8FF)] focus-visible:ring-offset-2",
          checked ? "bg-[color:var(--j-0C66E4)]" : "bg-[color:var(--j-8590A2)]")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

/** A numbered step of a form in a drawer. */
export function FormCard({ n, title, hint, children, aside }: { n?: number; title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
      <header className="flex items-start gap-3 border-b border-[color:var(--j-F1F2F4)] px-4 py-3">
        {n !== undefined && <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--j-E9F2FF)] text-[11px] font-semibold text-[color:var(--j-0C66E4)] ring-1 ring-inset ring-[color:var(--j-85B8FF)]">{n}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[color:var(--j-172B4D)]">{title}</span>
          {hint && <span className="mt-0.5 block text-xs text-[color:var(--j-626F86)]">{hint}</span>}
        </span>
        {aside}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

const NOTE_TONE = {
  info: "border-[color:var(--j-CCE0FF)] bg-[color:var(--j-E9F2FF)]/70 text-[color:var(--j-0055CC)] [&_.note-icon]:text-[color:var(--j-0C66E4)]",
  muted: "border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] text-[color:var(--j-44546F)] [&_.note-icon]:text-[color:var(--j-626F86)]",
  warn: "border-[color:var(--j-F8E6A0)]/70 bg-[color:var(--j-FFF7D6)] text-[color:var(--j-7F5F01)] [&_.note-icon]:text-[color:var(--j-B38600)]",
  ok: "border-[color:var(--j-BAF3DB)]/70 bg-[color:var(--j-DCFFF1)] text-[color:var(--j-216E4E)] [&_.note-icon]:text-[color:var(--j-22A06B)]",
} as const;

/** A note or a piece of information on a form: an icon, an optional title and the text, in one of four tones. */
export function Note({ icon, title, children, tone = "muted", action, className }: {
  icon?: ReactNode; title?: string; children: ReactNode; tone?: keyof typeof NOTE_TONE; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2 rounded-[3px] border px-3.5 py-3 text-xs leading-relaxed sm:flex-row sm:items-center", NOTE_TONE[tone], className)}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {icon && <span className="note-icon mt-px flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <div className="min-w-0">
          {title && <p className="mb-0.5 text-[13px] font-semibold">{title}</p>}
          <div>{children}</div>
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/** Segmented choice (2–6 options). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    // one line on phones too: the options scroll sideways instead of wrapping onto a second row (2026-10-28)
    <div role="radiogroup" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx("min-h-8 flex-shrink-0 whitespace-nowrap rounded-[4px] border px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:text-[13px]",
            value === o.value ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-0C66E4)] text-white" : "border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]")}>{o.label}</button>
      ))}
    </div>
  );
}

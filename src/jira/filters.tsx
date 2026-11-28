"use client";

// The props of @/components/ui/FilterControls in the Jira look (2026-11-27, Management): a Filter button with the number
// in use, choices as toggle buttons (the chosen one in the selected blue), a searchable list with radio marks, the
// filters in use as removable chips with "Clear all". Phones: 44px targets.

import { useMemo, useState, type ReactNode } from "react";
import { Check, Search, SlidersHorizontal, X } from "lucide-react";
import { SkeletonList } from "@/components/kc/Skeleton";
import { tr } from "@/lib/i18n";
import Drawer, { cx } from "./index";
import { inputClass } from "./kc";

/** The look of every Filter button of the portal (also for the ones that keep their own <button>, e.g. with a ref). */
export const filterBtnClass = (count: number) => cx("inline-flex h-10 flex-shrink-0 items-center justify-center gap-1.5 rounded-[3px] px-3 text-sm font-medium transition-colors sm:h-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)]",
  count ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)] ring-1 ring-inset ring-[color:var(--j-0C66E4)]" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)]");
/** The count badge of a Filter button. */
export const FilterCount = ({ count }: { count: number }) => (count > 0 ? <span className="rounded-[2rem] bg-[color:var(--j-0C66E4)] px-1.5 text-xs font-semibold leading-4 text-white tabular-nums">{count}</span> : null);

export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" className={filterBtnClass(count)}>
      <SlidersHorizontal size={16} />{tr("Filter")}<FilterCount count={count} />
    </button>
  );
}

export interface Choice { value: string; label: string; hint?: string }

/** One filter as toggle buttons (single choice; '' = any). */
export function ChoiceGroup({ label, choices, value, onChange }: { label: string; choices: Choice[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold text-[color:var(--j-44546F)]">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((c) => {
          const on = c.value === value;
          return (
            <button key={c.value || "any"} type="button" onClick={() => onChange(c.value)} aria-pressed={on} title={c.hint}
              className={cx("inline-flex h-10 items-center gap-1.5 rounded-[3px] px-3 text-sm font-medium transition-colors sm:h-8",
                on ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)] ring-1 ring-inset ring-[color:var(--j-0C66E4)]" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)]")}>
              {on && <Check size={14} />}{c.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One filter as a searchable list (single choice; '' = any). */
export function SearchChoice({ label, anyLabel, options, value, onChange, placeholder, loading }: {
  label: string; anyLabel: string; options: { value: string; label: string; meta?: ReactNode }[]; value: string; onChange: (v: string) => void; placeholder: string; loading?: boolean;
}) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)) : options; }, [options, q]);
  const row = (v: string, text: ReactNode, meta?: ReactNode) => {
    const on = v === value;
    return (
      <li key={v || "any"}>
        <button type="button" onClick={() => onChange(v)} aria-pressed={on}
          className={cx("relative flex min-h-11 w-full items-center gap-2.5 px-3 text-left text-sm transition-colors sm:min-h-9",
            on ? "bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)] before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-[color:var(--j-0C66E4)]" : "text-[color:var(--j-172B4D)] hover:bg-[color:var(--j-091E420F)]")}>
          <span className={cx("flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2", on ? "border-[color:var(--j-0C66E4)]" : "border-[color:var(--j-8590A2)]")}>{on && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--j-0C66E4)]" />}</span>
          <span className="min-w-0 flex-1 truncate">{text}</span>{meta}
        </button>
      </li>
    );
  };
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold text-[color:var(--j-44546F)]">{label}</legend>
      <div className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)]">
        <div className="relative border-b border-[color:var(--j-DCDFE4)] p-2">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cx(inputClass, "pl-8")} />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {!q && row("", anyLabel)}
          {loading ? <li><SkeletonList rows={3} /></li>
            : shown.length === 0 ? <li className="px-3 py-4 text-center text-sm text-[color:var(--j-626F86)]">{q.trim() ? <>{tr("No match for “")}{q}”</> : tr("Nothing to choose yet")}</li>
            : shown.map((o) => row(o.value, o.label, o.meta))}
        </ul>
      </div>
    </fieldset>
  );
}

export interface ActiveFilter { key: string; label: string; onRemove: () => void }

/** The filters in use as removable chips, with Clear all. */
export function ActiveFilters({ filters, onClear }: { filters: ActiveFilter[]; onClear: () => void }) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <span key={f.key} className="inline-flex min-h-8 items-center gap-1 rounded-[3px] bg-[color:var(--j-E9F2FF)] py-0.5 pl-2 pr-0.5 text-xs font-medium text-[color:var(--j-0055CC)]">
          {f.label}
          <button type="button" onClick={f.onRemove} className="flex h-7 w-7 items-center justify-center rounded-[3px] text-[color:var(--j-0055CC)] hover:bg-[color:var(--j-CCE0FF)] sm:h-5 sm:w-5" aria-label={tr("Remove {0}", f.label)}><X size={12} /></button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="px-1 text-xs font-medium text-[color:var(--j-0C66E4)] hover:underline">{tr("Clear All")}</button>
    </div>
  );
}

/**
 * The one filter drawer of the portal (2026-11-28): every filter of a page in one place, applied together on
 * "Show results"; Reset as a quiet link. Children are the sections (FilterField).
 */
export function FilterDrawer({ title, onClose, onApply, onReset, children }: {
  title?: string; onClose: () => void; onApply: () => void; onReset?: () => void; children: ReactNode;
}) {
  return (
    <Drawer open onClose={onClose} size="sm" icon={<SlidersHorizontal size={18} />} title={title ?? tr("Filter")}
      footer={
        <div className="flex w-full items-center gap-2">
          {onReset && <button type="button" onClick={onReset} className="inline-flex h-10 items-center px-1 text-sm font-medium text-[color:var(--j-0C66E4)] hover:underline sm:h-8">{tr("Reset")}</button>}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={cx(BTN2, "max-sm:flex-1")}>{tr("Cancel")}</button>
          <button type="button" onClick={onApply} className={cx(BTN1, "max-sm:flex-1")}>{tr("Apply Filters")}</button>
        </div>}>
      <div className="divide-y divide-[color:var(--j-F1F2F4)]">{children}</div>
    </Drawer>
  );
}
const BTN1 = "inline-flex h-10 items-center justify-center rounded-[3px] bg-[color:var(--j-0C66E4)] px-3 text-sm font-medium text-white hover:bg-[color:var(--j-0055CC)] sm:h-8";
const BTN2 = "inline-flex h-10 items-center justify-center rounded-[3px] bg-[color:var(--j-091E420F)] px-3 text-sm font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E4224)] sm:h-8";

/** A section of the filter drawer: its title and the control. */
export function FilterField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

"use client";

// The filters of a COTR page (2026-11-13, the COTR team: "every filter in one Filters button"): one Filters button with
// the number of filters narrowing the data, the search (or other tools) beside it, and under them a quiet line with
// what is chosen (day, pool, …) — a tap on it opens the same drawer. Same props as components/kc/ScopeBar, so a page
// swaps one for the other; the drawer (so/ui MonitorFilters) stays the page's own.

import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/kc";
import { DayField, dmyOf, type Scope } from "@/components/kc/ScopeBar";
import { Field, Input } from "@/so/ui";
import { ComboFilter, FilterRow, MonitorFilterSheet, OptionList, Segments } from "@/so/ui/MonitorFilters";
import { tr } from "@/lib/i18n";

type Choice = { value: string; label: string; hint?: string };
/** One filter of a COTR tab. `period` edits the values `from` and `to`; the others the value under `key`. */
export type CotrField = {
  key: string; label: string; icon: ReactNode;
  /** the value when nothing narrows the data (not counted on the button; Reset goes back to it) */ def: string;
  /** combo = searchable list (pools, menus), segments = 2-4 short choices, list = longer choices, day, period */
  kind: "combo" | "segments" | "list" | "day" | "period";
  options?: Choice[]; allLabel?: string; placeholder?: string;
  /** period: the default until (`def` is the default from) and the latest day allowed */ defTo?: string; max?: string;
  /** day: today and tomorrow can be chosen */ future?: boolean;
  /** shown only when the other filters allow it (e.g. "Difference above" with "Differences only") */ when?: (v: Record<string, string>) => boolean;
};

const shown = (f: CotrField, v: Record<string, string>): string => {
  if (f.kind === "period") return `${dmyOf(v.from)} – ${dmyOf(v.to)}`;
  if (f.kind === "day") return v[f.key] ? dmyOf(v[f.key]) : (f.allLabel ?? "");  // "" = the page picks (allLabel says which)
  return f.options?.find((o) => o.value === v[f.key])?.label ?? (v[f.key] || f.allLabel || tr("All"));
};
const narrows = (f: CotrField, v: Record<string, string>) =>
  f.kind === "period" ? v.from !== f.def || v.to !== f.defTo : (v[f.key] ?? "") !== f.def;

/**
 * The filters of a COTR tab from a list of fields (2026-11-13): the Filters button with its count, the summary line,
 * and the drawer with a draft that is applied at once on "Show". Saves every tab its own drawer code.
 */
export function CotrFilters({ fields, value, onApply, right, actions, onRefresh, refreshing }: {
  fields: CotrField[]; value: Record<string, string>; onApply: (v: Record<string, string>) => void;
  /** beside the button (a search) */ right?: ReactNode; /** at the end of the row (export, import) */ actions?: ReactNode;
  onRefresh?: () => void; refreshing?: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const live = fields.filter((f) => !f.when || f.when(value));
  const set = (patch: Record<string, string>) => setDraft((d) => ({ ...(d ?? value), ...patch }));
  const reset = () => Object.fromEntries(fields.flatMap((f) => (f.kind === "period" ? [["from", f.def], ["to", f.defTo ?? f.def]] : [[f.key, f.def]])));
  const bar = (
    <CotrFilterBar onOpen={() => setDraft({ ...value })} right={right} onRefresh={onRefresh} refreshing={refreshing}
      scopes={live.map((f) => ({ key: f.key, icon: f.icon, label: f.label, value: shown(f, value), active: narrows(f, value) }))} />
  );
  return (
    <>
      {actions ? <div className="flex flex-wrap items-start justify-between gap-3">{bar}<div className="flex flex-wrap items-center gap-2">{actions}</div></div> : bar}
      {draft && (
        <MonitorFilterSheet active={fields.filter((f) => (!f.when || f.when(draft)) && narrows(f, draft)).length}
          onClose={() => setDraft(null)} onReset={() => setDraft({ ...draft, ...reset() })} onApply={() => { onApply(draft); setDraft(null); }}>
          {fields.filter((f) => !f.when || f.when(draft)).map((f) => (
            <FilterRow key={f.key} icon={f.icon} label={f.label} value={f.kind === "period" || draft[f.key] ? shown(f, draft) || null : null}
              onClear={f.kind === "period" || f.kind === "day" ? undefined : () => set({ [f.key]: f.def })}>
              {f.kind === "period" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label={tr("From")}><Input type="date" value={draft.from} max={draft.to} onChange={(e) => e.target.value && set({ from: e.target.value })} /></Field>
                  <Field label={tr("Until")}><Input type="date" value={draft.to} min={draft.from} max={f.max} onChange={(e) => e.target.value && set({ to: e.target.value })} /></Field>
                </div>
              ) : f.kind === "day" ? (
                <DayField value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} future={f.future} max={f.max} />
              ) : f.kind === "combo" ? (
                <ComboFilter value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} options={f.options ?? []} allLabel={f.allLabel ?? tr("All")} placeholder={f.placeholder ?? tr("Search")} />
              ) : f.kind === "segments" ? (
                <Segments value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} choices={f.options ?? []} />
              ) : (
                <OptionList value={draft[f.key]} onChange={(v) => set({ [f.key]: v })} choices={f.options ?? []} />
              )}
            </FilterRow>
          ))}
        </MonitorFilterSheet>
      )}
    </>
  );
}

export function CotrFilterBar({ scopes, onOpen, onRefresh, refreshing, right }: {
  scopes: Scope[]; onOpen: () => void; onRefresh?: () => void; refreshing?: boolean; right?: ReactNode;
}) {
  const count = scopes.filter((s) => s.active).length;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onOpen} aria-label={count ? tr("Filters, {0} active", count) : tr("Filters")}
          className={cx("inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold shadow-sm transition-colors sm:h-9",
            count ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700" : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50")}>
          <SlidersHorizontal size={15} /> {tr("Filters")}
          {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold tabular-nums text-brand-700">{count}</span>}
        </button>
        {right && <div className="min-w-0 flex-1 sm:max-w-sm">{right}</div>}
        {onRefresh && (
          <button type="button" onClick={onRefresh} title={tr("Refresh")} aria-label={tr("Refresh")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:bg-neutral-50 hover:text-neutral-900 sm:h-9 sm:w-9">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} />
          </button>
        )}
      </div>
      {scopes.length > 0 && (
        <button type="button" onClick={onOpen} className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-left text-xs text-neutral-500 hover:text-neutral-800">
          {scopes.map((s, i) => (
            <span key={s.key} className="inline-flex min-w-0 items-center gap-1">
              {i > 0 && <span className="text-neutral-300" aria-hidden>·</span>}
              <span className={cx("flex-shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5", s.active ? "text-brand-600" : "text-neutral-400")}>{s.icon}</span>
              <span className="sr-only">{s.label}:</span>
              <span className={cx("truncate", s.active && "font-semibold text-brand-700")}>{s.value}</span>
            </span>
          ))}
        </button>
      )}
    </div>
  );
}

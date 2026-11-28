"use client";

// The filters of a COTR page (2026-11-13, the COTR team: "every filter in one Filters button"): one Filters button with
// the number of filters narrowing the data, the search (or other tools) beside it, and under them a quiet line with
// what is chosen (day, pool, …) — a tap on it opens the same drawer. Same props as components/kc/ScopeBar, so a page
// swaps one for the other; the drawer (so/ui MonitorFilters) stays the page's own.

import { RefreshCw, } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/kc";
import { DayField, dmyOf, ScopeLine, type Scope } from "@/components/kc/ScopeBar";
import { FilterButton } from "@/jira/filters";
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

/** Quick choices of a toolbar (status of the drivers, of the shifts …): one tap, the count beside each. */
export function CotrChips<T extends string>({ value, onChange, choices, label }: {
  value: T; onChange: (v: T) => void; label: string; choices: { value: T; label: string; count?: number; tone?: "warn" }[];
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full flex-wrap gap-1">
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={cx("inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[3px] border px-2.5 text-xs font-medium transition-colors",
              on ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-0C66E4)] text-white" : "border-[color:var(--j-DCDFE4)] bg-white text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]")}>
            {c.label}
            {c.count !== undefined && <span className={cx("tabular-nums", on ? "text-white/75" : c.tone === "warn" && c.count > 0 ? "font-semibold text-[color:var(--j-C9372C)]" : "text-[color:var(--j-626F86)]")}>{c.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The one toolbar row of a COTR tab (2026-11-23, the team found the filters, search and buttons scattered): the Filters
 * button (when there is a drawer), the search, the quick choices (`chips`), then the buttons of the tab at the right.
 * On a phone the buttons go to their own line, full width.
 */
export function CotrFilterBar({ scopes, onOpen, onRefresh, refreshing, right, chips, actions }: {
  scopes: Scope[]; onOpen?: () => void; onRefresh?: () => void; refreshing?: boolean; right?: ReactNode;
  /** quick choices beside the search (status chips) */ chips?: ReactNode; /** the buttons of the tab, at the right */ actions?: ReactNode;
}) {
  const count = scopes.filter((s) => s.active).length;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {onOpen && <FilterButton count={count} onClick={onOpen} />}
        {right && <div className="min-w-0 flex-1 sm:max-w-xs">{right}</div>}
        {chips && <div className="flex max-w-full flex-wrap items-center gap-1">{chips}</div>}
        {onRefresh && (
          <button type="button" onClick={onRefresh} title={tr("Refresh")} aria-label={tr("Refresh")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] sm:h-8 sm:w-8">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : undefined} />
          </button>
        )}
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto [&>*]:max-sm:flex-1">{actions}</div>}
      </div>
      <ScopeLine scopes={scopes} onOpen={onOpen} />
    </div>
  );
}

"use client";

// Daily Stock Opname apart from Weekly - Monthly Stock Opname (2026-11-09, Cost Control): Monitor, Review and Report
// show one of the two at a time — the list, the figures and the Excel download — so the daily counts are never mixed
// with the weekly / monthly ones. The choice is kept in the address (?so=daily|periodic) so a link opens it.

import { CalendarDays, CalendarRange } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cx } from "@/components/kc";
import { tr } from "@/lib/i18n";

export type SoGroup = "daily" | "periodic";

/** the group of a count type: DAILY_* is daily; weekly, monthly and ad hoc counts are the others */
export const soGroupOf = (countType: string): SoGroup => (countType.toUpperCase().startsWith("DAILY") ? "daily" : "periodic");

/** the chosen group, from ?so= (daily first) */
export function useSoGroup(): [SoGroup, (g: SoGroup) => void] {
  const [group, setGroup] = useState<SoGroup>("daily");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("so") === "periodic") setGroup("periodic");
  }, []);
  const choose = useCallback((g: SoGroup) => {
    setGroup(g);
    const url = new URL(window.location.href);
    url.searchParams.set("so", g);
    window.history.replaceState(null, "", url);
  }, []);
  return [group, choose];
}

/** the count types of a group for the Excel download (comma separated); null when none of them is in the list */
export const soGroupTypes = (types: Iterable<string>, group: SoGroup) => {
  const out = [...new Set(types)].filter((t) => soGroupOf(t) === group);
  return out.length ? out.join(",") : null;
};

export function SoGroupTabs({ value, onChange, counts }: { value: SoGroup; onChange: (g: SoGroup) => void; counts?: Partial<Record<SoGroup, number>> }) {
  const tabs: { key: SoGroup; label: string; icon: typeof CalendarDays }[] = [
    { key: "daily", label: tr("Daily Stock Opname"), icon: CalendarDays },
    { key: "periodic", label: tr("Weekly - Monthly Stock Opname"), icon: CalendarRange },
  ];
  return (
    <div role="tablist" aria-label={tr("Stock opname")} className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 sm:inline-grid sm:w-auto">
      {tabs.map(({ key, label, icon: Icon }) => {
        const on = key === value;
        return (
          <button key={key} type="button" role="tab" aria-selected={on} onClick={() => onChange(key)}
            className={cx("flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors sm:px-4",
              on ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800")}>
            <Icon size={15} className={on ? "text-brand-700" : undefined} />
            <span className="truncate">{label}</span>
            {counts?.[key] !== undefined && (
              <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-brand-50 text-brand-700" : "bg-neutral-200 text-neutral-600")}>{counts[key]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

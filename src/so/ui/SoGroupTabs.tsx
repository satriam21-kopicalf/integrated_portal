"use client";

// Daily Stock Opname apart from Weekly - Monthly Stock Opname (2026-11-09, Cost Control): Monitor, Review and Report
// show one of the two at a time — the list, the figures and the Excel download — so the daily counts are never mixed
// with the weekly / monthly ones. The choice is kept in the address (?so=daily|periodic) so a link opens it.

import { CalendarDays, CalendarRange } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/so/lib/api";
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

/** the count types of a group for the filters: the active ones of the master (Count Types) and those in the data —
 *  a type with no count in the period (Monthly - SO in a week without one) can still be chosen (2026-11-09) */
export function useGroupTypes(group: SoGroup, inData: Iterable<string>): string[] {
  const [master, setMaster] = useState<{ code: string; is_active?: boolean }[]>([]);
  useEffect(() => {
    void api<{ code: string; is_active?: boolean }[]>("/api/so/count-settings/types").then(setMaster).catch(() => setMaster([]));
  }, []);
  const data = [...new Set(inData)].join(",");
  return useMemo(() => [...new Set([...master.filter((t) => t.is_active !== false).map((t) => t.code), ...data.split(",").filter(Boolean)])]
    .filter((t) => soGroupOf(t) === group), [master, data, group]);
}

/** the count types of a group for the Excel download (comma separated); null when none of them is in the list */
export const soGroupTypes = (types: Iterable<string>, group: SoGroup) => {
  const out = [...new Set(types)].filter((t) => soGroupOf(t) === group);
  return out.length ? out.join(",") : null;
};

export function SoGroupTabs({ value, onChange, counts }: { value: SoGroup; onChange: (g: SoGroup) => void; counts?: Partial<Record<SoGroup, number>> }) {
  // phones get the short names (2026-11-16: the long ones were cut)
  const tabs: { key: SoGroup; label: string; short: string; icon: typeof CalendarDays }[] = [
    { key: "daily", label: tr("Daily Stock Opname"), short: tr("Daily"), icon: CalendarDays },
    { key: "periodic", label: tr("Weekly - Monthly Stock Opname"), short: tr("Weekly - Monthly"), icon: CalendarRange },
  ];
  return (
    <div role="tablist" aria-label={tr("Stock opname")} className="inline-flex max-w-full flex-wrap gap-1">
      {tabs.map(({ key, label, short, icon: Icon }) => {
        const on = key === value;
        return (
          <button key={key} type="button" role="tab" aria-selected={on} onClick={() => onChange(key)}
            className={cx("flex min-w-0 items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-xs font-medium transition-colors",
              on ? "border-brand-700 bg-brand-700 text-white" : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100")}>
            <Icon size={13} />
            <span className="truncate sm:hidden">{short}</span><span className="hidden truncate sm:inline">{label}</span>
            {counts?.[key] !== undefined && (
              <span className={cx("tabular-nums", on ? "text-white/70" : "text-neutral-400")}>{counts[key]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

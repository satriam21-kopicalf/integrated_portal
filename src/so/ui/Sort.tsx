"use client";

// Sortable tables (2026-11-07): useSort keeps the column and the direction, sorts the rows with the value of the column
// (numbers, dates as ISO text, text in the language order, empty last); SortTh is the clickable header with its arrow.

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cx } from "@/so/ui";
import { locale, tr } from "@/lib/i18n";

export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K | null; dir: SortDir };
type Value = string | number | boolean | null | undefined;

export function useSort<T, K extends string>(rows: T[], value: (row: T, key: K) => Value, initial: SortState<K> = { key: null, dir: "asc" }) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const k = sort.key;
    const collator = new Intl.Collator(locale(), { numeric: true, sensitivity: "base" });
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = value(a, k), y = value(b, k);
      const ex = x === null || x === undefined || x === "", ey = y === null || y === undefined || y === "";
      if (ex || ey) return ex === ey ? 0 : ex ? 1 : -1;  // empty last whatever the direction
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      if (typeof x === "boolean" && typeof y === "boolean") return (Number(x) - Number(y)) * sign;
      return collator.compare(String(x), String(y)) * sign;
    });
  }, [rows, sort, value]);
  /** a click: this column ascending, again descending, a third time back to the default order */
  const toggle = (key: K, first: SortDir = "asc") => setSort((s) => (s.key !== key ? { key, dir: first }
    : s.dir === first ? { key, dir: first === "asc" ? "desc" : "asc" } : { key: null, dir: "asc" }));
  return { rows: sorted, sort, toggle, setSort };
}

export function SortTh<K extends string>({ k, sort, onSort, children, align = "left", first = "asc", className }: {
  k: K; sort: SortState<K>; onSort: (k: K, first?: SortDir) => void; children: React.ReactNode; align?: "left" | "right"; first?: SortDir; className?: string;
}) {
  const on = sort.key === k;
  const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cx("px-4 py-2.5", align === "right" && "text-right", className)} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k, first)} title={tr("Sort")}
        className={cx("group inline-flex items-center gap-1 uppercase tracking-wide hover:text-neutral-900", align === "right" && "flex-row-reverse", on ? "text-neutral-900" : "")}>
        {children}<Icon size={12} className={cx("flex-shrink-0", on ? "text-brand-600" : "text-neutral-300 group-hover:text-neutral-500")} />
      </button>
    </th>
  );
}

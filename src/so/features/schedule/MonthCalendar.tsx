"use client";

// Month view of the stock-opname schedule (Count types page): every scheduled count on its date with its window,
// computed by the server from the same rules that make a count due (GET /count-settings/calendar).

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/so/ui";
import { locale, tr } from "@/lib/i18n";
import { TZ_LABEL, wibDate, wibMonthStart } from "@/so/lib/wib";

export type CalendarCount = { code: string; name: string; frequency: string; window_start: string; window_end: string };
export type CalendarDay = { date: string; counts: CalendarCount[] };

export const TYPE_COLORS = [
  "bg-[color:var(--j-0C66E4)]", "bg-emerald-600", "bg-amber-500", "bg-violet-600", "bg-rose-600", "bg-cyan-600", "bg-lime-600", "bg-orange-500",
];

/** Monday on or before the first day of the month: the first cell of a 6-week month grid. */
export function gridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const shift = (first.getDay() + 6) % 7;
  return new Date(first.getFullYear(), first.getMonth(), 1 - shift);
}

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function MonthCalendar({ month, days, colorOf, labelOf, onMonth, highlight, onPick, compact = false }: {
  month: Date;
  /** server days from gridStart(month), 42 entries */
  days?: CalendarDay[];
  colorOf: (code: string) => string;
  labelOf: (code: string, name: string) => string;
  onMonth?: (m: Date) => void;
  /** dates to mark (live preview of an unsaved schedule) */
  highlight?: Set<string>;
  /** makes today and later days clickable (picking the dates of a count type) */
  onPick?: (date: string) => void;
  compact?: boolean;
}) {
  const start = gridStart(month);
  const today = wibDate();
  const byDate = new Map((days ?? []).map((d) => [d.date, d.counts]));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: "short" }));
  const cells = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{month.toLocaleDateString(locale(), { month: "long", year: "numeric" })}</p>
        {onMonth && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-[3px] p-1.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)]" aria-label={tr("Previous Month")}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => onMonth(wibMonthStart())}
              className="rounded-[3px] px-2 py-1 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]">{tr("Today")}</button>
            <button type="button" onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-[3px] p-1.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)]" aria-label={tr("Next Month")}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-DCDFE4)] text-xs">
        {weekdays.map((w) => <div key={w} className="bg-[color:var(--j-F7F8F9)] px-1.5 py-1 text-center font-semibold uppercase tracking-wide text-[10px] text-[color:var(--j-626F86)]">{w}</div>)}
        {cells.map((d) => {
          const key = iso(d);
          const inMonth = d.getMonth() === month.getMonth();
          const counts = byDate.get(key) ?? [];
          const marked = highlight?.has(key);
          const pickable = !!onPick && key >= today;
          return (
            <div key={key} role={pickable ? "button" : undefined} tabIndex={pickable ? 0 : undefined} aria-pressed={pickable ? !!marked : undefined}
              onClick={pickable ? () => onPick(key) : undefined}
              onKeyDown={pickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(key); } } : undefined}
              className={cx("bg-white px-1 py-1", compact ? "min-h-9" : "min-h-12 sm:min-h-[5.5rem]", !inMonth && "bg-[color:var(--j-F7F8F9)]", marked && "bg-[color:var(--j-E9F2FF)]",
                pickable && "cursor-pointer hover:bg-[color:var(--j-E9F2FF)]", onPick && !pickable && "opacity-50")}>
              <span className={cx("mb-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums",
                key === today ? "bg-[color:var(--j-0C66E4)] font-semibold text-white" : inMonth ? "text-[color:var(--j-44546F)]" : "text-[color:var(--j-8590A2)]",
                marked && key !== today && "bg-[color:var(--j-0C66E4)] font-semibold text-white")}>{d.getDate()}</span>
              {!compact && counts.length > 0 && (
                <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden" aria-label={counts.map((c) => labelOf(c.code, c.name)).join(", ")}>
                  {counts.map((c) => <span key={c.code} className={cx("h-1.5 w-1.5 rounded-full", colorOf(c.code))} />)}
                </span>
              )}
              {!compact && (
                <ul className="hidden space-y-0.5 sm:block">
                  {counts.slice(0, 3).map((c) => (
                    <li key={c.code} className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[10.5px] leading-tight text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]"
                      title={`${labelOf(c.code, c.name)} · ${c.window_start}–${c.window_end} ${TZ_LABEL}`}>
                      <span className={cx("h-1.5 w-1.5 flex-shrink-0 rounded-full", colorOf(c.code))} />
                      <span className="truncate"><span className="tabular-nums text-[color:var(--j-626F86)]">{c.window_start}</span> {labelOf(c.code, c.name)}</span>
                    </li>
                  ))}
                  {counts.length > 3 && <li className="px-1 text-[10px] text-[color:var(--j-626F86)]">{tr("+{0} more", counts.length - 3)}</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

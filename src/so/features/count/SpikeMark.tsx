"use client";

// The x3 mark of a count line explained (2026-11-16, users did not read "x3 vs last count" / "Check"): far above or
// below the last approved count, with both quantities and how many times, so a unit typed wrong (grams as kilograms)
// is seen at once. Used by the crew's count screen and by the review.

import { Badge } from "@/so/ui";
import { tr } from "@/lib/i18n";
import type { CountLine } from "@/so/lib/counts";

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 3 });

export function SpikeMark({ l }: { l: Pick<CountLine, "previous_qty" | "qty_base" | "base_uom"> }) {
  const prev = l.previous_qty == null ? null : Number(l.previous_qty);
  const now = l.qty_base == null ? null : Number(l.qty_base);
  const times = prev && now ? (now > prev ? now / prev : prev / now) : null;
  const above = prev !== null && now !== null ? now > prev : true;
  const help = tr("The quantity is more than 3 times, or less than a third of, the last approved count of this item. Check the unit (e.g. grams typed as kilograms) or the count.");
  return (
    <span className="inline-flex flex-col gap-0.5" title={help}>
      <Badge tone="amber">{above ? tr("Far above the last count") : tr("Far below the last count")}</Badge>
      {prev !== null && now !== null && (
        <span className="text-[11px] text-amber-800">
          {tr("Last count {0} → now {1}", `${fmt(prev)} ${l.base_uom}`, `${fmt(now)} ${l.base_uom}`)}
          {times ? ` (${times.toLocaleString(undefined, { maximumFractionDigits: 1 })}×)` : ""}
        </span>
      )}
    </span>
  );
}

/** "1 item" / "3 items" style counts in the two languages. */
export const plural = (n: number, one: string, many: string) => tr(n === 1 ? one : many, n);

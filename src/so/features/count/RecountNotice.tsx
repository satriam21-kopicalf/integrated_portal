"use client";

// The recounts Cost Control asked for (2026-11-04): an amber notice on Home and on Stock opname today, one row per
// count with the reason, who asked and how much is asked, opening the count. Counts of an earlier day are among them
// (the Today screen only lists today's counts otherwise).

import { ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { type TodayFacility, countTypeLabel } from "@/so/lib/counts";
import { fmtDay } from "@/so/ui";
import { tr } from "@/lib/i18n";

export type RecountRow = NonNullable<TodayFacility["recounts"]>[number] & { facility: string };

export const recountsOf = (rows: TodayFacility[] | null | undefined): RecountRow[] =>
  (rows ?? []).flatMap((f) => (f.recounts ?? []).map((r) => ({ ...r, facility: f.facility.name })));

export default function RecountNotice({ rows, basePath = "", multi }: { rows: RecountRow[]; basePath?: string; multi?: boolean }) {
  if (!rows.length) return null;
  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50" role="status" aria-live="polite">
      <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><RotateCcw size={18} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-900">{rows.length === 1 ? tr("Cost Control asks for a recount") : tr("Cost Control asks for {0} recounts", rows.length)}</p>
          <p className="text-xs text-amber-800">{tr("Count the marked items again, sign and send: the count goes back to Cost Control for review.")}</p>
        </div>
      </div>
      <ul className="divide-y divide-amber-200/70 border-t border-amber-200/70 bg-white/60">
        {rows.map((r) => {
          const asked = [r.items ? tr("{0} items", r.items) : "", r.premixes ? tr("{0} premixes", r.premixes) : ""].filter(Boolean).join(" · ");
          return (
            <li key={r.id}>
              <Link href={`${basePath}/stock-opname/${r.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-amber-100/60 sm:hover:bg-amber-100/40">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{countTypeLabel(r.count_type, r.name)} · {fmtDay(r.business_date)}{multi ? ` · ${r.facility}` : ""}</span>
                  <span className="block truncate text-xs text-neutral-600">{asked || tr("Every Item")}{r.reviewed_by_name ? ` · ${tr("asked by {0}", r.reviewed_by_name)}` : ""}</span>
                  {r.review_note && <span className="mt-0.5 block text-xs text-amber-900">“{r.review_note}”</span>}
                </span>
                <span className="inline-flex h-9 flex-shrink-0 items-center gap-0.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white">{tr("Recount")}<ChevronRight size={14} /></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

// The stock available of a material (Transfer Stock and Waste, 2026-11-07) and the progress of a transfer as a stepper.

import { Check, Clock3, X } from "lucide-react";
import { cx } from "@/so/ui";
import { tr } from "@/lib/i18n";
import { wibDateTime } from "@/so/lib/wib";
import { qtyText } from "./transfer";

/** "Available 1.200 GR", and what is left once `taking` goes out (red below zero). */
export function StockBadge({ available, unit, taking }: { available: number | null | undefined; unit: string; taking?: number | null }) {
  if (available == null) return <span className="inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500">{tr("Stock unknown")}</span>;
  const left = taking ? available - taking : null;
  const empty = available <= 0;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset",
        empty ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200")}>
        <span className={cx("h-1.5 w-1.5 rounded-full", empty ? "bg-red-500" : "bg-emerald-500")} aria-hidden />
        {tr("Available {0} {1}", qtyText(available), unit)}
      </span>
      {left !== null && (
        <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums", left < 0 ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600")}>
          {left < 0 ? tr("{0} over the stock", qtyText(-left)) : tr("{0} left", qtyText(left))}
        </span>
      )}
    </span>
  );
}

export type Step = { label: string; at?: string | null; by?: string | null; note?: string | null; state: "done" | "current" | "todo" | "failed" };

/** The steps of a process: vertical with a line between the dots; done green, current brand, failed red. */
export function Tracker({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const Icon = s.state === "done" ? Check : s.state === "failed" ? X : Clock3;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className={cx("absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5", s.state === "done" ? "bg-emerald-300" : "bg-neutral-200")} aria-hidden />}
            <span className={cx("relative z-[1] flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-4 ring-white",
              s.state === "done" ? "bg-emerald-500 text-white" : s.state === "failed" ? "bg-red-500 text-white"
                : s.state === "current" ? "bg-brand-50 text-brand-700 ring-brand-100" : "bg-neutral-100 text-neutral-400")}>
              {s.state === "todo" ? <span className="text-[11px] font-bold">{i + 1}</span> : <Icon size={14} strokeWidth={2.5} />}
            </span>
            <div className={cx("min-w-0 flex-1 pt-0.5", s.state === "todo" && "opacity-60")}>
              <p className={cx("text-sm font-semibold", s.state === "failed" ? "text-red-700" : "text-neutral-900")}>{s.label}</p>
              <p className="text-xs text-neutral-500">
                {s.at || s.by ? [s.by, s.at ? wibDateTime(s.at) : null].filter(Boolean).join(" · ") : s.state === "current" ? tr("In process") : tr("Not yet")}
              </p>
              {s.note && <p className="mt-1 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-700 ring-1 ring-neutral-100">“{s.note}”</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The four steps of a Transfer Stock from its status and dates. */
export function transferSteps(t: {
  status: string; toName: string; fromName: string; note: string | null; requested: { by: string; at: string };
  source: { note: string | null; by: string | null; at: string | null } | null; costControl: { note: string | null; by: string | null; at: string | null } | null;
  received: { note: string | null; by: string | null; at: string | null } | null;
}, short: (n: string) => string): Step[] {
  const st = t.status;
  const cancelled = st === "cancelled";
  return [
    { label: tr("Requested by {0}", short(t.toName)), by: t.requested.by, at: t.requested.at, note: t.note, state: "done" },
    { label: st === "declined" ? tr("Declined by {0}", short(t.fromName)) : tr("Checked by {0}", short(t.fromName)), ...t.source,
      state: st === "declined" ? "failed" : t.source ? "done" : cancelled ? "failed" : "current" },
    { label: st === "rejected" ? tr("Rejected by Cost Control") : tr("Approved by Cost Control · stock leaves {0}", short(t.fromName)), ...t.costControl,
      state: st === "rejected" ? "failed" : t.costControl ? "done" : st === "accepted" ? "current" : "todo" },
    { label: tr("Received with the ESB GR · stock enters {0}", short(t.toName)), ...t.received,
      state: t.received ? "done" : st === "approved" ? "current" : "todo" },
  ];
}

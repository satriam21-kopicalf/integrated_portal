"use client";

// Category / area switch of the long forms (stock opname, Monitoring Outlet / Product, 2026-10-21). Phones and tablets:
// one button with the current category and its progress, opening a bottom sheet with every category; large screens:
// the chips in one row.

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "@/so/ui";
import { tr } from "@/lib/i18n";

export type SectionOption = { key: string; label: string; done: number; total: number; hint?: string };

function Progress({ done, total }: { done: number; total: number }) {
  const full = total > 0 && done >= total;
  return full
    ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={12} strokeWidth={3} /></span>
    : <span className="text-xs font-semibold tabular-nums text-slate-400">{done}/{total}</span>;
}

export default function SectionPicker({ options, value, onChange, allLabel, title }: {
  options: SectionOption[]; value: string; onChange: (key: string) => void;
  /** a first option for every category ("" key), e.g. "All areas" */ allLabel?: string; title: string;
}) {
  const [open, setOpen] = useState(false);
  const all: SectionOption[] = allLabel
    ? [{ key: "", label: allLabel, done: options.reduce((a, o) => a + o.done, 0), total: options.reduce((a, o) => a + o.total, 0) }, ...options]
    : options;
  const current = all.find((o) => o.key === value) ?? all[0];
  const index = options.findIndex((o) => o.key === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* phones & tablets: one button */}
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="flex h-11 w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left shadow-sm active:bg-slate-50 lg:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {title}{index >= 0 ? ` · ${index + 1}/${options.length}` : ""}
          </span>
          <span className="block truncate text-sm font-semibold leading-tight text-slate-900">{current?.label}</span>
        </span>
        {current && <Progress done={current.done} total={current.total} />}
        <ChevronDown size={18} className="flex-shrink-0 text-slate-400" />
      </button>

      {/* large screens: chips */}
      <div className="hidden flex-wrap gap-1.5 lg:flex">
        {all.map((o) => (
          <button key={o.key || "all"} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key}
            className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
              value === o.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
            {o.label}
            <span className={cx("tabular-nums", o.total && o.done >= o.total ? "text-emerald-600" : "text-slate-400")}>{o.total && o.done >= o.total ? "✓" : `${o.done}/${o.total}`}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} aria-label={tr("Close")} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-white shadow-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <p className="text-base font-semibold text-slate-900">{title}</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Close")}><X size={18} /></button>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 pb-3">
              {all.map((o, i) => {
                const pct = o.total ? Math.round((o.done / o.total) * 100) : 0;
                const on = o.key === value;
                return (
                  <li key={o.key || "all"}>
                    <button type="button" onClick={() => { onChange(o.key); setOpen(false); }}
                      className={cx("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left", on ? "bg-blue-50" : "active:bg-slate-50")}>
                      <span className={cx("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                        on ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>{allLabel && i === 0 ? "∑" : allLabel ? i : i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cx("block truncate text-sm font-semibold", on ? "text-blue-800" : "text-slate-900")}>{o.label}</span>
                        <span className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span className={cx("block h-full rounded-full", pct === 100 ? "bg-emerald-500" : "bg-blue-500")} style={{ width: `${pct}%` }} />
                          </span>
                          <span className="text-[11px] tabular-nums text-slate-500">{o.done}/{o.total}</span>
                        </span>
                        {o.hint && <span className="mt-0.5 block truncate text-[11px] text-slate-400">{o.hint}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

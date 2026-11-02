"use client";

// The outlet of a visit (PIC Check In, Monitoring Product / Outlet forms) when the account has several branches
// (2026-11-02): a searchable list of cards instead of a select — the distance from where the user is (the nearest
// first, marked), the state of each outlet today (checked in / sent, a draft, no coordinates) and a short summary.
// One branch: a plain card. Branches done today stay visible but cannot be picked.

import { Check, MapPin, MapPinOff, Navigation, Search, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { cx, inputClass } from "@/so/ui";
import { type Fix } from "@/so/lib/counts";
import { distanceM } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

export type PickBranch = { code: string; name: string; latitude: number | null; longitude: number | null; radius_m: number | null };
export type BranchState = { label: string; tone: "done" | "draft"; locked?: boolean };

const km = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`);

export default function BranchPicker({ branches, value, onChange, fix, stateOf }: {
  branches: PickBranch[]; value: string; onChange: (code: string) => void; fix?: Fix | null; stateOf?: (code: string) => BranchState | null;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => branches.map((b) => {
    const located = b.latitude !== null && b.longitude !== null;
    const distance = fix && located ? distanceM(fix.lat, fix.lng, b.latitude!, b.longitude!) : null;
    return { ...b, located, distance, state: stateOf?.(b.code) ?? null };
  }), [branches, fix, stateOf]);
  const nearest = useMemo(() => rows.filter((r) => r.distance !== null && !r.state?.locked).sort((a, b) => a.distance! - b.distance!)[0]?.code, [rows]);
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => words.every((w) => `${r.name} ${r.code}`.toLowerCase().includes(w)))
      .sort((a, b) => Number(!!a.state?.locked) - Number(!!b.state?.locked) || (a.distance ?? 1e12) - (b.distance ?? 1e12) || a.name.localeCompare(b.name));
  }, [rows, q]);

  if (branches.length === 1) {
    const r = rows[0];
    return (
      <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/50 px-3.5 py-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><Store size={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">{r.name}</span>
          <span className="block text-xs text-slate-500">{r.code}{r.distance !== null ? ` · ${tr("{0} from you", km(r.distance))}` : ""}</span>
        </span>
      </div>
    );
  }
  const done = rows.filter((r) => r.state?.locked).length;
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{tr("{0} outlets assigned to you", rows.length)}{done ? ` · ${tr("{0} done today", done)}` : ""}</span>
        {fix ? <span className="inline-flex items-center gap-1 text-emerald-700"><Navigation size={12} />{tr("Sorted by distance from you")}</span>
          : <span className="inline-flex items-center gap-1"><MapPinOff size={12} />{tr("Turn on the location to see the nearest outlet")}</span>}
      </div>
      {rows.length > 5 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search outlet name or code")} aria-label={tr("Search outlet name or code")} className={cx(inputClass, "h-10 pl-9")} />
        </div>
      )}
      <ul role="radiogroup" aria-label={tr("Outlet visited")} className="max-h-[22rem] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
        {shown.map((r) => {
          const on = r.code === value;
          const locked = !!r.state?.locked;
          return (
            <li key={r.code}>
              <button type="button" role="radio" aria-checked={on} disabled={locked} onClick={() => onChange(r.code)}
                className={cx("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  on ? "border-blue-600 bg-blue-50 ring-2 ring-blue-600/15" : locked ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
                <span className={cx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl", on ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500")}>
                  {on ? <Check size={18} strokeWidth={2.5} /> : <Store size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cx("truncate text-sm font-semibold", on ? "text-blue-900" : "text-slate-900")}>{r.name}</span>
                    {r.code === nearest && <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[10px] font-semibold uppercase text-emerald-700">{tr("Nearest")}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    <span className="font-mono">{r.code}</span>
                    {r.distance !== null ? <span className="inline-flex items-center gap-0.5"><MapPin size={11} />{tr("{0} from you", km(r.distance))}</span>
                      : !r.located ? <span className="inline-flex items-center gap-0.5 text-amber-700"><MapPinOff size={11} />{tr("No coordinates")}</span> : null}
                  </span>
                </span>
                {r.state && (
                  <span className={cx("flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    r.state.tone === "done" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200")}>{r.state.label}</span>
                )}
              </button>
            </li>
          );
        })}
        {!shown.length && <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">{tr("No outlet matches")}</li>}
      </ul>
    </div>
  );
}

"use client";

// Shared by the steps of the Sales Calculator by Menu (page.tsx, options.tsx): the item picker and the catalog of the
// item master (Pricelist Items) and the WIP / premix recipes.

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx, inputClass } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

export type Item = { code: string; name: string; unit: string; category: string | null; price: number | null };
export type Wip = { code: string; name: string; components: { code: string | null; name: string; unit: string; perGram: number }[] };
export const num = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: d }));
export const rp = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
/** every word of the search in the text, in any order ("es kopi premium" finds "ES KOPI CALF - PREMIUM") */
export const matches = (text: string, q: string) => { const t = text.toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w)); };

/** A searchable picker that renders the first matches only (the item master has thousands of items). */
export function Picker({ value, options, onPick, placeholder }: {
  value: string; options: { value: string; label: string; hint?: string }[]; onPick: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const s = q.trim().toLowerCase();
  const all = s ? options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(s)) : options;
  const shown = all.slice(0, 60);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cx(inputClass, "flex h-9 items-center justify-between gap-2 text-left")}>
        <span className={cx("truncate", !current && "text-neutral-400")}>{current ? current.label : placeholder}</span>
        <ChevronDown size={15} className="flex-shrink-0 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[min(26rem,85vw)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="relative border-b border-neutral-100 p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search name or code")} className={cx(inputClass, "h-9 pl-8")} />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onPick(o.value); setOpen(false); setQ(""); }}
                  className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50", o.value === value && "bg-brand-50 text-brand-800")}>
                  <span className="truncate">{o.label}</span>{o.hint && <span className="flex-shrink-0 text-[11px] text-neutral-400">{o.hint}</span>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("No match")}</li>}
            {all.length > shown.length && <li className="px-3 py-2 text-center text-[11px] text-neutral-400">{tr("{0} more — type to narrow down", all.length - shown.length)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export function useCatalog() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [wips, setWips] = useState<Wip[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    call<{ data: Item[] }>("/api/cost-control/pricelist").then((r) => setItems(r.data)).catch((e: Error) => { setItems([]); setError(e.message); });
    void call<{ data: Wip[] }>("/api/cost-control/sales-calc/wips").then((r) => setWips(r.data)).catch(() => setWips([]));
  }, []);
  return { items: items ?? [], loading: items === null, wips, error };
}


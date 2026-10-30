"use client";

// WIP / premix of the count (D-34): the crew enters each WIP in the unit Cost Control set for it (Premix calculator →
// "unit for stock opname", 2026-10-21): premixes, creams and sauces weighed in grams, a portioned WIP in portions (Base
// Puding: 1 porsi = 115 g), a piece WIP in pieces (Tape Roll, Pisang Roll); another unit of the recipe or grams can be
// picked. The grams of every ingredient follow from the recipe and are filled into the ingredient lines of the count,
// so those items need no manual entry (user decision 2026-10-16); rounded up per ingredient as the calculator. Saved as
// a whole with "Save WIP". In a recount (2026-10-29) only the premixes Cost Control picked open (the same quantity is
// confirmed with "Same ✓"); the others stay as they are, and the grams counted by hand on their materials are not touched.

import { ChevronDown, FlaskConical, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import type { Count } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

const fmtG = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const keyOf = (recipeId: string, uom: string) => `${recipeId}|${uom}`;
const isGram = (uom: string) => uom.toLowerCase() === "gram";

export default function WipSection({ count, open, onSaved, onDirty }: {
  count: Count; open: boolean; onSaved: (c: Count) => void; onDirty: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const wip = count.wip!;
  const saved = useMemo(() => Object.fromEntries(wip.lines.map(l => [keyOf(l.recipe_id, l.uom), String(l.qty)])), [wip.lines]);
  const [values, setValues] = useState<Record<string, string>>(saved);
  const [expanded, setExpanded] = useState(wip.lines.length > 0);
  // unit shown per recipe: the one already entered, else the recipe's count unit (Porsi, Pcs …), else Gram
  const [unitOf, setUnitOf] = useState<Record<string, string>>({});
  const unitFor = (r: { id: string; units: { uom: string }[]; count_uom?: string }) =>
    unitOf[r.id] ?? r.units.find((u) => Number(saved[keyOf(r.id, u.uom)]) > 0)?.uom ?? r.count_uom ?? "Gram";
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(saved), [saved]);
  const recount = count.status === "RECOUNT_REQUESTED";
  const asked = (l: { flags?: string[] }) => !!l.flags?.some((f) => f === "RECOUNT" || f === "RECOUNTED");
  const toConfirm = wip.lines.filter((l) => l.flags?.includes("RECOUNT")).length;

  const clean = (v: Record<string, string>) => JSON.stringify(Object.entries(v).filter(([, x]) => Number(x) > 0).sort());
  const dirty = clean(values) !== clean(saved);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  // grams per ingredient of what is typed (preview; the server rounds the totals per ingredient up)
  const preview = useMemo(() => {
    const out = new Map<string, { name: string; grams: number; stock: boolean }>();
    for (const r of wip.recipes) {
      for (const u of r.units) {
        const q = Number(values[keyOf(r.id, u.uom)] || 0);
        if (!(q > 0)) continue;
        for (const c of r.components) {
          const k = c.item_id ?? `n:${c.name}`;
          const cur = out.get(k) ?? { name: c.name, grams: 0, stock: c.is_stock };
          cur.grams += q * u.grams * c.per_gram;
          out.set(k, cur);
        }
      }
    }
    return [...out.values()].sort((a, b) => Number(b.stock) - Number(a.stock) || a.name.localeCompare(b.name));
  }, [values, wip.recipes]);

  /** `confirm`: the premix whose "Same ✓" was tapped */
  const save = async (confirm?: number) => {
    setBusy(true);
    try {
      // a recount sends the premixes not asked again as they are, and of those asked again the one confirmed and the
      // ones changed (0 = none there); one asked again and not sent stays to confirm
      const entries = recount
        ? wip.lines.filter((l) => !l.flags?.includes("RECOUNT") || l.id === confirm || (values[keyOf(l.recipe_id, l.uom)] ?? "") !== saved[keyOf(l.recipe_id, l.uom)])
          .map((l) => ({ recipe_id: l.recipe_id, uom: l.uom, qty: Number(values[keyOf(l.recipe_id, l.uom)] || 0) }))
        : Object.entries(values).filter(([, v]) => Number(v) > 0).map(([k, v]) => {
          const [recipe_id, uom] = k.split("|");
          return { recipe_id, uom, qty: Number(v) };
        });
      const c = await api<Count>(`/api/so/counts/${count.id}/wip`, { method: "PUT", json: { entries } });
      onSaved(c);
      toast(tr("WIP saved: the grams are added to the ingredient lines"));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const recipes = open && !recount ? wip.recipes : [];
  const entered = wip.lines.length;
  return (
    <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        className="flex w-full items-center gap-3 bg-violet-50/70 px-4 py-3 text-left">
        <FlaskConical size={18} className="flex-shrink-0 text-violet-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{tr("WIP / premix")}</span>
          <span className="block text-xs text-slate-500">{tr("Enter each WIP in its unit (grams, portions or pieces); the ingredients are calculated and filled into the items")}</span>
        </span>
        {toConfirm > 0 && <Badge tone="amber">{tr("{0} to recount", toConfirm)}</Badge>}
        {entered > 0 && <Badge tone="violet">{tr("{0} entered", entered)}</Badge>}
        {dirty && <Badge tone="amber">{tr("Not saved")}</Badge>}
        <ChevronDown size={16} className={cx("text-slate-400 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="space-y-3 p-4">
          {open && recount ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {wip.lines.map((l) => {
                const k = keyOf(l.recipe_id, l.uom);
                const edit = asked(l);
                return (
                  <li key={l.id} className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5", l.flags?.includes("RECOUNT") && "bg-amber-50/50")}>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-sm font-medium text-slate-900">{l.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {l.flags?.includes("RECOUNT") && <Badge tone="amber">{tr("Recount")}</Badge>}
                        {l.flags?.includes("RECOUNTED") && <Badge tone="green">{tr("Recounted")}</Badge>}
                      </span>
                      {l.previous_qty !== null && l.previous_qty !== undefined && <span className="block text-[11px] text-slate-500">{tr("Before the recount: {0} {1}", l.previous_qty, isGram(l.uom) ? "g" : l.uom)}</span>}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {edit && l.flags?.includes("RECOUNT") && (
                        <button type="button" disabled={busy} onClick={() => void save(l.id)}
                          className="h-11 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          aria-label={tr("{0}: the quantity is right", l.name)} title={tr("The quantity is right: confirm the recount")}>{tr("Same ✓")}</button>
                      )}
                      <input inputMode="decimal" disabled={!edit} value={values[k] ?? ""} placeholder="0" aria-label={`${l.name} ${l.uom}`}
                        onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1") }))}
                        className={cx("h-11 w-24 rounded-lg border px-2 text-right text-base tabular-nums disabled:bg-slate-50 disabled:text-slate-500", edit ? "border-violet-400 bg-violet-50/50" : "border-slate-200")} />
                      <span className="text-sm text-slate-600">{isGram(l.uom) ? "g" : l.uom}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : open ? (
            recipes.length === 0 ? <p className="text-sm text-slate-500">{tr("No WIP recipe is active for this location.")}</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {recipes.map(r => {
                  const uom = unitFor(r);
                  const unit = r.units.find((u) => u.uom === uom) ?? { uom, grams: 1 };
                  const k = keyOf(r.id, uom);
                  const others = r.units.filter((u) => u.uom !== uom && Number(values[keyOf(r.id, u.uom)]) > 0);
                  const grams = r.units.reduce((sum, u) => sum + Number(values[keyOf(r.id, u.uom)] || 0) * u.grams, 0);
                  const fixed = r.units.filter((u) => !isGram(u.uom));
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block text-sm font-medium text-slate-900">{r.name}</span>
                        {fixed.length > 0 && <span className="block text-[11px] text-slate-500">{fixed.map((u) => `1 ${u.uom} = ${fmtG(u.grams)} g`).join(" · ")}</span>}
                        {others.map((u) => <span key={u.uom} className="block text-[11px] text-amber-700">{tr("Also entered: {0} {1}", values[keyOf(r.id, u.uom)], u.uom)}</span>)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <input inputMode="decimal" value={values[k] ?? ""} placeholder="0" aria-label={`${r.name} ${uom}`}
                          onChange={e => setValues(v => ({ ...v, [k]: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1") }))}
                          className={cx("h-11 w-24 rounded-lg border px-2 text-right text-base tabular-nums", Number(values[k]) > 0 ? "border-violet-400 bg-violet-50/50" : "border-slate-200")} />
                        {r.units.length > 1 ? (
                          <select value={uom} onChange={(e) => setUnitOf((m) => ({ ...m, [r.id]: e.target.value }))} aria-label={tr("Unit of {0}", r.name)}
                            className="h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                            {r.units.map((u) => <option key={u.uom} value={u.uom}>{isGram(u.uom) ? "g" : u.uom}</option>)}
                          </select>
                        ) : <span className="text-sm text-slate-600">{isGram(unit.uom) ? "g" : unit.uom}</span>}
                      </span>
                      {grams > 0 && !isGram(uom) && <span className="w-full text-right text-[11px] tabular-nums text-violet-700 sm:w-auto">= {fmtG(grams)} g</span>}
                    </li>
                  );
                })}
              </ul>
            )
          ) : entered === 0 ? <p className="text-sm text-slate-500">{tr("No WIP was entered.")}</p> : (
            <ul className="space-y-1 text-sm">
              {wip.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.name} <span className="text-slate-400">v{l.version_no}</span></span><span className="tabular-nums">{l.qty} {l.uom} · {fmtG(l.qty_base)} g</span></li>)}
            </ul>
          )}
          {preview.length > 0 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tr("Filled into the items automatically")}</p>
              <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                {preview.map(p => (
                  <li key={p.name} className={cx("flex justify-between gap-2", !p.stock && "text-slate-400")}>
                    <span className="truncate">{p.name}{!p.stock && ` (${tr("not stock")})`}</span><span className="tabular-nums">{fmtG(Math.ceil(p.grams - 0.001))} g</span>
                  </li>
                ))}
              </ul>
              {dirty && <p className="mt-1.5 text-[11px] text-amber-700">{tr("Save the WIP to fill these grams into the item lines.")}</p>}
            </div>
          )}
          {open && (recipes.length > 0 || (recount && wip.lines.some(asked))) && (
            <div className="flex justify-end">
              <Button loading={busy} disabled={!dirty} onClick={() => void save()}><Save size={16} /> {tr("Save WIP")}</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

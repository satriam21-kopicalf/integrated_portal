"use client";

// WIP of the count (premix, creams, sauces counted in pail / teko / gram, D-34): the crew enters what is there, the
// grams of every ingredient follow from the active recipe (kept as a snapshot) and are added to the ingredient lines
// (rounded up per ingredient, as the Cost Control calculator). Saved as a whole with "Save WIP".

import { ChevronDown, FlaskConical, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import type { Count } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

const fmtG = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const keyOf = (recipeId: string, uom: string) => `${recipeId}|${uom}`;

export default function WipSection({ count, open, onSaved, onDirty }: {
  count: Count; open: boolean; onSaved: (c: Count) => void; onDirty: (dirty: boolean) => void;
}) {
  const toast = useToast();
  const wip = count.wip!;
  const saved = useMemo(() => Object.fromEntries(wip.lines.map(l => [keyOf(l.recipe_id, l.uom), String(l.qty)])), [wip.lines]);
  const [values, setValues] = useState<Record<string, string>>(saved);
  const [expanded, setExpanded] = useState(wip.lines.length > 0);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(saved), [saved]);

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

  const save = async () => {
    setBusy(true);
    try {
      const entries = Object.entries(values).filter(([, v]) => Number(v) > 0).map(([k, v]) => {
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

  const recipes = open ? wip.recipes : [];
  const entered = wip.lines.length;
  return (
    <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
      <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
        className="flex w-full items-center gap-3 bg-violet-50/70 px-4 py-3 text-left">
        <FlaskConical size={18} className="flex-shrink-0 text-violet-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{tr("WIP / premix")}</span>
          <span className="block text-xs text-slate-500">{tr("Pails, teko and grams of premix, creams and sauces; the ingredients are added to the count")}</span>
        </span>
        {entered > 0 && <Badge tone="violet">{tr("{0} entered", entered)}</Badge>}
        {dirty && <Badge tone="amber">{tr("Not saved")}</Badge>}
        <ChevronDown size={16} className={cx("text-slate-400 transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded && (
        <div className="space-y-3 p-4">
          {open ? (
            recipes.length === 0 ? <p className="text-sm text-slate-500">{tr("No WIP recipe is active for this location.")}</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {recipes.map(r => (
                  <li key={r.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-900">{r.name}</span>
                    <span className="flex flex-wrap gap-2">
                      {r.units.map(u => {
                        const k = keyOf(r.id, u.uom);
                        return (
                          <label key={u.uom} className="flex items-center gap-1.5 text-xs text-slate-600" title={`1 ${u.uom} = ${fmtG(u.grams)} g`}>
                            <input inputMode="decimal" value={values[k] ?? ""} placeholder="0" aria-label={`${r.name} ${u.uom}`}
                              onChange={e => setValues(v => ({ ...v, [k]: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") }))}
                              className={cx("h-10 w-20 rounded-lg border px-2 text-right text-base tabular-nums", Number(values[k]) > 0 ? "border-violet-400 bg-violet-50/50" : "border-slate-200")} />
                            {u.uom}
                          </label>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : entered === 0 ? <p className="text-sm text-slate-500">{tr("No WIP was entered.")}</p> : (
            <ul className="space-y-1 text-sm">
              {wip.lines.map(l => <li key={l.id} className="flex justify-between gap-2"><span>{l.name} <span className="text-slate-400">v{l.version_no}</span></span><span className="tabular-nums">{l.qty} {l.uom} · {fmtG(l.qty_base)} g</span></li>)}
            </ul>
          )}
          {preview.length > 0 && (
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tr("Ingredients from the WIP")}</p>
              <ul className="grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                {preview.map(p => (
                  <li key={p.name} className={cx("flex justify-between gap-2", !p.stock && "text-slate-400")}>
                    <span className="truncate">{p.name}{!p.stock && ` (${tr("not stock")})`}</span><span className="tabular-nums">{fmtG(Math.ceil(p.grams - 0.001))} g</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {open && recipes.length > 0 && (
            <div className="flex justify-end">
              <Button loading={busy} disabled={!dirty} onClick={save}><Save size={16} /> {tr("Save WIP")}</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

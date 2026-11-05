"use client";

// Sales Calculator by Menu (2026-11-05, integrated_portal_be app/menu_options.py, migration 071):
// - Variants & Modifiers: the choices sold with the menus (Normal / Less / No / Extra Sugar, Extra Shot …, the ESB
//   packages / extras of a line) and the rule of each: no effect, or a change to the card of the parent menu (a % of
//   its sugar or of one item, or a quantity of an item per choice). The card stays the standard portion.
// - Import from the ESB BOM: a recipe card from an ESB bill of material, its lines matched to the item master and the
//   WIP recipes, with the POS menus of the same name.

import { AlertTriangle, ArrowDownToLine, Check, Database, Plus, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Panel, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Picker, matches, num, rp, useCatalog } from "./parts";

type RuleLine = { target: "sugar" | "item"; code?: string | null; name?: string; mode: "pct" | "qty"; value: number };
type Rule = { name: string; effect: "none" | "adjust"; lines: RuleLine[]; note: string | null; updatedBy?: string | null };
type Choice = { key: string; name: string; qty: number; menus: number; ids: number; withCard: number;
  top: { id: string; name: string; qty: number; hasCard: boolean }[]; rule: Rule | null };
type Choices = { from: string; to: string; data: Choice[]; pendingDays: number };

/** "Gula −50%", "ESPRESSO +18 GR" … */
export function ruleText(r: Rule | null): string {
  if (!r) return tr("Not set");
  if (r.effect === "none") return tr("No effect");
  return r.lines.map((l) => {
    const what = l.target === "sugar" ? tr("Sugar of the card") : (l.name ?? l.code ?? "");
    const v = l.value > 0 ? `+${num(l.value)}` : num(l.value);
    return l.mode === "pct" ? `${what} ${v}%` : `${what} ${v}`;
  }).join(" · ");
}

const PRESETS: { label: () => string; lines: RuleLine[] }[] = [
  { label: () => tr("Sugar −50%"), lines: [{ target: "sugar", mode: "pct", value: -50 }] },
  { label: () => tr("Sugar −100%"), lines: [{ target: "sugar", mode: "pct", value: -100 }] },
  { label: () => tr("Sugar +50%"), lines: [{ target: "sugar", mode: "pct", value: 50 }] },
];

export function OptionsStep() {
  const [res, setRes] = useState<Choices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "todo" | "set">("all");
  const [edit, setEdit] = useState<Choice | null>(null);
  const load = useCallback(() => { setError(null); call<Choices>("/api/cost-control/sales-calc/options").then(setRes).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((c) => (!q || matches(`${c.name} ${c.top.map((t) => t.name).join(" ")}`, q))
    && (only === "all" || (only === "todo" ? !c.rule : !!c.rule))), [res, q, only]);
  const todo = (res?.data ?? []).filter((c) => !c.rule).length;
  return (
    <Panel title={tr("Variants & Modifiers")}
      description={tr("Choices sold with a menu (Less / No Sugar, Extra Shot …). The recipe card stays the standard portion (Normal Sugar); the rule of a choice says what it changes. One rule per name works for every menu.")}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input className={cx(inputClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search choice or menu")} /></div>
          <div role="radiogroup" aria-label={tr("Show")} className="flex rounded-lg bg-neutral-100 p-1">
            {([["all", tr("All")], ["todo", tr("Not set ({0})", todo)], ["set", tr("Set")]] as const).map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={only === k} onClick={() => setOnly(k)}
                className={cx("rounded-md px-3 py-1 text-xs font-semibold", only === k ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500")}>{label}</button>
            ))}
          </div>
        </div>
      }>
      {error ? <ErrorState message={error} onRetry={load} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={4} /></tbody></table> : (
        <>
          {res.pendingDays > 0 && (
            <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
              <Database size={14} className="mt-0.5 flex-shrink-0" />
              {tr("The choices of {0} earlier days are still being prepared from the transactions (a few days every 15 minutes); the numbers grow until then.", res.pendingDays)}
            </p>
          )}
          {rows.length === 0 ? <Empty icon={<SlidersHorizontal size={26} />} title={res.data.length ? tr("No choice matches") : tr("No choice sold in this period")} /> : (
            <div className="overflow-x-auto">
              <table className="m-cards w-full min-w-[820px] text-sm">
                <thead className={theadClass}><tr>
                  <th className="px-4 py-2.5">{tr("Choice")}</th><th className="px-4 py-2.5 text-right">{tr("Sold (90 Days)")}</th>
                  <th className="px-4 py-2.5">{tr("Sold With")}</th><th className="px-4 py-2.5">{tr("Rule")}</th><th className="w-24 px-4 py-2.5" />
                </tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((c) => (
                    <tr key={c.key} className="hover:bg-neutral-50">
                      <td className="px-4 py-2.5"><span className="font-medium text-neutral-900">{c.name}</span>
                        {c.ids > 1 && <span className="block text-[11px] text-neutral-400">{tr("{0} ESB ids with this name", c.ids)}</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" data-label={tr("Sold (90 Days)")}>{num(c.qty, 0)}
                        <span className="block text-[11px] text-neutral-400">{tr("{0} with a card", num(c.withCard, 0))}</span></td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600" data-label={tr("Sold With")}>
                        {c.top.slice(0, 3).map((t) => t.name).join(", ")}{c.menus > 3 ? ` ${tr("+{0} menus", c.menus - 3)}` : ""}</td>
                      <td className="px-4 py-2.5" data-label={tr("Rule")}>
                        <Badge tone={!c.rule ? "amber" : c.rule.effect === "none" ? "slate" : "violet"} wrap>{ruleText(c.rule)}</Badge></td>
                      <td className="px-4 py-2.5 text-right"><Button size="sm" variant={c.rule ? "secondary" : "primary"} onClick={() => setEdit(c)}>{c.rule ? tr("Change") : tr("Set")}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {edit && <RuleDrawer choice={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </Panel>
  );
}

function RuleDrawer({ choice, onClose, onSaved }: { choice: Choice; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { items } = useCatalog();
  const [effect, setEffect] = useState<"none" | "adjust">(choice.rule?.effect ?? "adjust");
  const [lines, setLines] = useState<(RuleLine & { text: string })[]>(() => (choice.rule?.lines ?? []).map((l) => ({ ...l, text: String(l.value) })));
  const [note, setNote] = useState(choice.rule?.note ?? "");
  const [busy, setBusy] = useState(false);
  const itemOpts = useMemo(() => items.map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` })), [items]);
  const set = (i: number, patch: Partial<RuleLine & { text: string }>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try { await call("/api/cost-control/sales-calc/options/rule", { method: "PUT", json: { name: choice.name, ...body } }); toast(tr("Saved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const save = () => void send({ effect, note, lines: effect === "adjust" ? lines.map(({ text, ...l }) => ({ ...l, value: Number(text.replace(",", ".")) })) : [] });
  const unit = (l: RuleLine) => (l.mode === "pct" ? "%" : items.find((i) => i.code === l.code)?.unit ?? "");
  return (
    <Drawer open onClose={onClose} size="lg" icon={<SlidersHorizontal size={18} />} title={choice.name}
      description={tr("{0} sold in 90 days with {1} menus", num(choice.qty, 0), choice.menus)}
      footer={<>
        {choice.rule && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={() => void send({ effect: "clear" })}><Trash2 size={15} /> {tr("Remove Rule")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} onClick={save}><Save size={15} /> {tr("Save")}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr("Effect")}>
          {([["none", tr("No Effect"), tr("The materials of the card do not change (Normal Sugar, Less Ice, a note …)")],
            ["adjust", tr("Change the Materials"), tr("Less or more of a material of the card, or an item added")]] as const).map(([k, label, hint]) => (
            <button key={k} type="button" role="radio" aria-checked={effect === k} onClick={() => setEffect(k)}
              className={cx("rounded-xl border p-3 text-left transition", effect === k ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300")}>
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">{effect === k && <Check size={15} className="text-brand-700" />}{label}</span>
              <span className="mt-0.5 block text-[11px] text-neutral-500">{hint}</span>
            </button>
          ))}
        </div>
        {effect === "adjust" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-500">{tr("Quick:")}</span>
              {PRESETS.map((p) => (
                <button key={p.label()} type="button" onClick={() => setLines(p.lines.map((l) => ({ ...l, text: String(l.value) })))}
                  className="rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-700 hover:border-brand-300">{p.label()}</button>
              ))}
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_9rem_7rem_auto] sm:items-center">
                <select className={cx(inputClass, "h-9")} value={l.target} aria-label={tr("Material")}
                  onChange={(e) => set(i, { target: e.target.value as RuleLine["target"], mode: e.target.value === "sugar" ? "pct" : l.mode, code: null })}>
                  <option value="sugar">{tr("Sugar of the card")}</option><option value="item">{tr("An item")}</option>
                </select>
                {l.target === "item" ? <Picker value={l.code ?? ""} options={itemOpts} placeholder={tr("Pick an item")}
                  onPick={(v) => set(i, { code: v, name: items.find((x) => x.code === v)?.name })} />
                  : <span className="text-xs text-neutral-500">{tr("Every sugar / syrup item of the card of the menu")}</span>}
                <select className={cx(inputClass, "h-9")} value={l.mode} disabled={l.target === "sugar"} aria-label={tr("How")}
                  onChange={(e) => set(i, { mode: e.target.value as RuleLine["mode"] })}>
                  <option value="pct">{tr("% of the card")}</option><option value="qty">{tr("Qty per choice")}</option>
                </select>
                <div className="relative">
                  <input inputMode="decimal" className={cx(inputClass, "h-9 pr-12 text-right tabular-nums")} value={l.text} placeholder={l.mode === "pct" ? "-50" : "18"}
                    onChange={(e) => set(i, { text: e.target.value.replace(/[^0-9,.-]/g, "") })} aria-label={tr("Value")} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">{unit(l)}</span>
                </div>
                <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="justify-self-end rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-red-600" aria-label={tr("Remove")}><X size={16} /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setLines((ls) => [...ls, { target: "item", mode: "qty", value: 0, text: "" }])}><Plus size={14} /> {tr("Add Adjustment")}</Button>
            <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
              {tr("Negative = less, positive = more. Example: Less Sugar = sugar of the card −50%; Extra Shot = espresso +18 (grams per choice sold).")}</p>
          </div>
        )}
        <label className="block text-xs font-medium text-neutral-700">{tr("Note")}
          <textarea rows={2} className={cx(inputClass, "mt-1 h-auto py-2")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Optional")} /></label>
        {choice.top.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-neutral-700">{tr("Sold most with")}</p>
            <ul className="mt-1 space-y-1 text-xs text-neutral-600">
              {choice.top.map((t) => <li key={t.id} className="flex justify-between gap-3"><span>{t.name}{!t.hasCard && <span className="ml-1 text-amber-700">({tr("no card yet")})</span>}</span><span className="tabular-nums">{num(t.qty, 0)}</span></li>)}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}

/* ---------------------------------------------------------------- import from the ESB BOM */

type Bom = { id: string; code: string | null; name: string; product: string; type: string | null; lines: number; menus: { id: string; name: string; qty: number; recipe: string | null }[] };
type BomCard = { bom: { id: string; code: string | null; name: string }; lines: { type: "item" | "wip" | "other"; code: string; name: string; qty: number; unit: string; price?: number | null; from: string }[]; notes: string[] };

export function BomImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [list, setList] = useState<Bom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<Bom | null>(null);
  const [card, setCard] = useState<BomCard | null>(null);
  const [menus, setMenus] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      call<{ data: Bom[] }>(`/api/cost-control/sales-calc/esb-boms?search=${encodeURIComponent(q)}`).then((r) => { setList(r.data); setError(null); }).catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const open = (b: Bom) => {
    setPick(b); setCard(null);
    setMenus(new Set(b.menus.filter((m) => !m.recipe).map((m) => m.id)));
    call<BomCard>(`/api/cost-control/sales-calc/esb-boms/${encodeURIComponent(b.id)}`).then(setCard).catch((e: Error) => toast(e.message, "error"));
  };
  const save = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      const chosen = pick.menus.filter((m) => menus.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
      const r = await call<{ code: string }>(`/api/cost-control/sales-calc/esb-boms/${encodeURIComponent(pick.id)}/import`, { method: "POST", json: { menus: chosen } });
      toast(tr("Card {0} made from the ESB BOM", r.code)); onDone();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} size="xl" icon={<ArrowDownToLine size={18} />} title={tr("Import from the ESB BOM")}
      description={tr("Recipe cards from the bills of material of ESB: the lines are matched to the item master and the WIP recipes")}
      footer={pick ? <><Button variant="secondary" onClick={() => setPick(null)}>{tr("Back")}</Button>
        <Button loading={busy} disabled={!card?.lines.length} onClick={() => void save()}><ArrowDownToLine size={15} /> {tr("Make the Card")}</Button></> : undefined}>
      {!pick ? (
        <div className="space-y-3">
          <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input autoFocus className={cx(inputClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search BOM or product, e.g. Es Kopi Calf")} /></div>
          {error ? <ErrorState message={error} /> : !list ? <table className="w-full"><tbody><SkeletonRows cols={3} /></tbody></table> : list.length === 0 ? <Empty title={tr("No BOM matches")} /> : (
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {list.slice(0, 80).map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => open(b)} className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-neutral-50">
                    <span className="min-w-0"><span className="block font-medium text-neutral-900">{b.name}</span>
                      <span className="block text-[11px] text-neutral-500">{[b.code, b.type, tr("{0} lines", b.lines)].filter(Boolean).join(" · ")}</span></span>
                    {b.menus.length > 0 ? <Badge tone={b.menus.every((m) => m.recipe) ? "slate" : "green"}>{tr("{0} POS menus", b.menus.length)}</Badge> : <Badge tone="slate">{tr("No POS menu of this name")}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : !card ? <table className="w-full"><tbody><SkeletonRows cols={3} /></tbody></table> : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{card.bom.name}</p>
            <p className="text-xs text-neutral-500">{tr("One portion, from BOM {0}", card.bom.code ?? card.bom.id)}</p>
          </div>
          <table className="w-full text-sm">
            <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Material")}</th><th className="px-3 py-2 text-right">{tr("Qty")}</th><th className="px-3 py-2">{tr("In ESB")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {card.lines.map((l, i) => (
                <tr key={i}><td className="px-3 py-2"><Badge tone={l.type === "item" ? "blue" : l.type === "wip" ? "violet" : "amber"}>{l.type === "item" ? tr("Item") : l.type === "wip" ? "WIP" : tr("Other")}</Badge> <span className="ml-1">{l.name}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{num(l.qty, 4)} {l.unit}{l.price != null && <span className="block text-[11px] text-neutral-400">{rp(l.price)}</span>}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{l.from}</td></tr>
              ))}
            </tbody>
          </table>
          {card.notes.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {card.notes.map((n, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />{n}</li>)}
            </ul>
          )}
          <div>
            <p className="text-xs font-semibold text-neutral-700">{tr("POS menus that use this card")}</p>
            {pick.menus.length === 0 ? <p className="mt-1 text-xs text-neutral-500">{tr("No POS menu has this name; assign the menus in step 2 after the card is made.")}</p> : (
              <ul className="mt-1 space-y-1">
                {pick.menus.map((m) => (
                  <li key={m.id}><label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-brand-700" checked={menus.has(m.id)}
                      onChange={() => setMenus((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
                    {m.name} <span className="text-[11px] text-neutral-400">{tr("{0} sold in 90 days", num(m.qty, 0))}{m.recipe ? ` · ${tr("now on card {0}", m.recipe)}` : ""}</span>
                  </label></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

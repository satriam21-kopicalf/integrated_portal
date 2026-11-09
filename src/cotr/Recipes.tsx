'use client';

// Monitoring COTR → Storage & Production: the items of COTR, the recipe cards on the standard of the premix calculator
// of Cost Control (a premix = a batch in grams of raw materials, taken by Pail / Teko / Gram; a menu card = what one
// cup or can uses: premix, packaging, ice), the calculator (recipe × unit × quantity → grams of every raw material,
// rounded up as the sheet does) and the theoretical usage of the drivers' sales, waste and cupping (backend 051).

import { Segmented } from '@/so/ui/Simple';
import { Building2, CalendarRange, Calculator, Coffee, FlaskConical, Package, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Empty, ErrorState, Field, Input, Panel, Select, cx, theadClass, useToast } from '@/so/ui';
import { call } from '@/so/features/checkin/checkin';
import { Bom, BomLine, Item, ItemCategory, Menu, Pool } from '@/cotr/types';
import { MasterTable, SearchSelect, rupiah, useMaster } from '@/cotr/ui';
import { locale, tr } from '@/lib/i18n';
import { StatCard, StatGrid, ValueSkeleton, kcTable } from '@/components/kc';
import { SkeletonRows } from '@/components/kc/Skeleton';
import { ScopeBar, dmyOf } from '@/components/kc/ScopeBar';
import { ComboFilter, FilterRow, MonitorFilterSheet, Segments } from '@/so/ui/MonitorFilters';

export const CATEGORY: Record<ItemCategory, { label: () => string; tone: 'amber' | 'violet' | 'blue' | 'cyan' | 'slate' | 'green' }> = {
  raw: { label: () => tr('Raw Material'), tone: 'amber' }, premix: { label: () => tr('Premix'), tone: 'violet' },
  packaging: { label: () => tr('Packaging'), tone: 'blue' }, supply: { label: () => tr('Supplies'), tone: 'cyan' },
  tools: { label: () => tr('Tools'), tone: 'slate' }, other: { label: () => tr('Other'), tone: 'green' },
};
const num = (n: number, d = 0) => n.toLocaleString(locale(), { maximumFractionDigits: d });

/** Materials of `qty` outputs of a recipe; a line that is the output of another recipe (a premix) is exploded by it. */
export function explode(boms: Bom[], code: string, qty: number, out: Map<string, number>, depth = 0) {
  const bom = boms.find((b) => b.code === code);
  if (!bom || depth > 5) return;
  for (const l of bom.lines) {
    const need = (l.qty * qty) / bom.yield_qty;
    const sub = boms.find((b) => b.output === l.item && b.code !== bom.code);
    if (sub) explode(boms, sub.code, need, out, depth + 1);
    else out.set(l.item, (out.get(l.item) ?? 0) + need);
  }
}

/** HPP of one output of a recipe (premix exploded), null while an item has no cost. */
function costOf(boms: Bom[], items: Item[], code: string): number | null {
  const m = new Map<string, number>();
  explode(boms, code, 1, m);
  let total = 0;
  for (const [k, q] of m) {
    const it = items.find((i) => i.code === k);
    if (!it || it.cost === null) { if (it?.is_stock !== false) return null; continue; }
    total += q * it.cost;
  }
  return total;
}

export function ItemsTab() {
  const master = useMaster<Item>('items');
  return (
    <MasterTable noun={tr('item')} title={tr('Items of COTR')} master={master}
      description={tr('Raw materials, premix, packaging, supplies and tools; the cost per base unit gives the HPP of the recipe cards')}
      blank={(): Partial<Item> => ({ code: '', name: '', category: 'raw', unit: 'g', pack_unit: null, pack_qty: null, cost: null, is_stock: true, is_active: true })}
      columns={[
        { label: tr('Item'), render: (i) => <><span className="block font-medium text-neutral-900">{i.name}</span><span className="text-[11px] text-neutral-400">{i.code}</span></> },
        { label: tr('Category'), render: (i) => <Badge tone={CATEGORY[i.category].tone}>{CATEGORY[i.category].label()}</Badge> },
        { label: tr('Unit'), render: (i) => <span className="text-xs">{i.unit}{i.pack_unit ? ` · ${i.pack_unit}${i.pack_qty ? ` = ${num(i.pack_qty)} ${i.unit}` : ''}` : ''}</span> },
        { label: tr('Cost / Unit'), className: 'text-right', render: (i) => i.cost !== null ? <span className="tabular-nums">{rupiah(i.cost)}</span> : <span className="text-neutral-400">—</span> },
        { label: tr('Stock'), render: (i) => i.is_stock ? <Badge tone="green" dot>{tr('Counted')}</Badge> : <Badge tone="slate">{tr('Not counted')}</Badge> },
      ]}
      fields={[
        { key: 'code', label: tr('Code'), required: true, placeholder: 'RM-XXX' },
        { key: 'name', label: tr('Name'), required: true },
        { key: 'category', label: tr('Category'), type: 'select', required: true, options: (Object.keys(CATEGORY) as ItemCategory[]).map((c) => ({ value: c, label: CATEGORY[c].label() })) },
        { key: 'unit', label: tr('Base Unit'), type: 'select', required: true, options: ['g', 'ml', 'pcs', 'pack'].map((u) => ({ value: u, label: u })) },
        { key: 'pack_unit', label: tr('Pack'), placeholder: tr('e.g. Dus (20 Pack), Pail'), hint: tr('How it is bought or counted') },
        { key: 'pack_qty', label: tr('Base Units per Pack'), type: 'number' },
        { key: 'cost', label: tr('Cost per base unit (Rp)'), type: 'number' },
        { key: 'is_stock', label: tr('Counted in Stock'), type: 'bool', hint: tr('No for water and the like') },
        { key: 'is_active', label: tr('Active'), type: 'bool' },
        { key: 'note', label: tr('Note'), type: 'textarea' },
      ]} />
  );
}

/** The recipe cards: premix batches and menu cards, edited line by line with the ratio per gram and the HPP. */
export function RecipesTab() {
  const toast = useToast();
  // one view at a time (2026-11-09): the menus and their cards, the card editor, the list of recipes
  const [view, setView] = useState<'menus' | 'cards' | 'list'>('menus');
  const boms = useMaster<Bom>('boms');
  const items = useMaster<Item>('items');
  const menus = useMaster<Menu>('menus');
  const rows = boms.rows ?? [];
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Bom | null>(null);
  const [busy, setBusy] = useState(false);
  const [making, setMaking] = useState<string | null>(null);
  const current = code ?? rows[0]?.code ?? null;
  useEffect(() => { setDraft(rows.find((b) => b.code === current) ? { ...rows.find((b) => b.code === current)! } : null); }, [current, boms.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemList = items.rows ?? [];
  const itemOptions = itemList.map((i) => ({ value: i.code, label: i.name, hint: `${CATEGORY[i.category].label()} · ${i.unit}` }));
  const total = draft ? draft.lines.reduce((a, l) => a + (itemList.find((i) => i.code === l.item)?.unit === 'g' || l.unit === 'g' ? l.qty : 0), 0) : 0;
  const hpp = draft ? costOf(rows.map((b) => (b.code === draft.code ? draft : b)), itemList, draft.code) : null;
  const setLines = (lines: BomLine[]) => draft && setDraft({ ...draft, lines });
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try { await boms.save(draft, draft.code); toast(tr('Saved')); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  if (boms.error) return <Panel><ErrorState message={boms.error} onRetry={() => void boms.load()} /></Panel>;
  const group = (k: Bom['kind']) => rows.filter((b) => b.kind === k);
  const usedBy = (b: Bom) => (menus.rows ?? []).filter((m) => m.bom_code === b.code).map((m) => m.name);
  // a menu without a card: its card is made (one cup / can, linked to the menu) and opened in the editor
  const makeCard = async (m: Menu) => {
    setMaking(m.code);
    try {
      const card = `BOM-${m.code.replace(/^COTR-/, '')}`;
      const unit = /\bcan\b/i.test(m.name) ? 'can' : 'cup';
      if (!rows.some((b) => b.code === card)) {
        await boms.save({ code: card, name: m.name, output: m.code, yield_qty: 1, yield_unit: unit, kind: 'menu', units: [], lines: [] }, null);
      }
      await menus.save({ ...m, bom_code: card }, m.code);
      setCode(card);
      toast(tr('Recipe card of {0} made: add its components', m.name));
    } catch (e) { toast((e as Error).message, 'error'); } finally { setMaking(null); }
  };
  const active = (menus.rows ?? []).filter((m) => m.is_active);
  const covered = active.filter((m) => m.bom_code && rows.some((b) => b.code === m.bom_code)).length;
  return (
    <>
      <Segmented label={tr('View')} value={view} onChange={setView} options={[
        { value: 'menus', label: tr('Per Menu ({0}/{1})', covered, active.length) }, { value: 'cards', label: tr('Edit Recipe Card') }, { value: 'list', label: tr('Recipes ({0})', rows.length) }]} />
      {view === 'menus' && <Panel title={tr('Recipe Card per Menu')} description={tr('Every product the drivers sell needs its card: the sales become the usage of the raw materials, the production plan and the HPP')}
        actions={<Badge tone={covered === active.length ? 'green' : 'amber'}>{tr('{0} of {1} menus', covered, active.length)}</Badge>}>
        {active.length === 0 ? <Empty title={tr('No active menu yet')} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr('Menu')}</th><th className="px-4 py-2.5 text-right">{tr('Price')}</th><th className="px-4 py-2.5">{tr('Recipe Card')}</th>
              <th className="px-4 py-2.5 text-right">HPP</th><th className="px-4 py-2.5 text-right">{tr('Margin')}</th><th className="w-32 px-4 py-2.5" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {active.map((m) => {
                const card = rows.find((b) => b.code === m.bom_code);
                const hpp = card ? costOf(rows, itemList, card.code) : null;
                const margin = hpp !== null ? m.price - hpp : null;
                return (
                  <tr key={m.code} className={card ? '' : 'bg-amber-50/40'}>
                    <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{m.name}</span><span className="text-[11px] text-neutral-400">{m.code}</span></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(m.price)}</td>
                    <td className="px-4 py-2.5">{card ? <Badge tone="green" dot>{tr('{0} components', card.lines.length)}</Badge> : <Badge tone="amber">{tr('No card yet')}</Badge>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{hpp === null ? '—' : rupiah(hpp)}</td>
                    <td className={cx('px-4 py-2.5 text-right tabular-nums', margin === null ? 'text-neutral-400' : margin < 0 ? 'text-red-700' : 'text-emerald-700')}>
                      {margin === null ? '—' : `${rupiah(margin)} · ${Math.round((margin / (m.price || 1)) * 100)}%`}</td>
                    <td className="px-4 py-2.5 text-right">{card
                      ? <Button size="sm" variant="secondary" onClick={() => { setCode(card.code); setView('cards'); }}>{tr('Edit card')}</Button>
                      : <Button size="sm" loading={making === m.code} onClick={() => void makeCard(m)}><Plus size={14} /> {tr('Make Card')}</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </Panel>}
      {view === 'cards' && <Panel title={tr('Recipe Cards')} description={tr('Premix per batch (Pail / Teko / Gram) as the premix calculator of Cost Control; menu cards per cup or can')}
        actions={draft && <Button size="sm" loading={busy} onClick={() => void save()}><Save size={14} /> {tr('Save Recipe')}</Button>}>
        <div className="grid lg:grid-cols-[17rem_1fr]">
          {/* phones and tablets: the recipe to edit from a list, the editor right under it */}
          <div className="border-b border-neutral-100 p-4 lg:hidden">
            <Field label={tr('Recipe to Edit')}>
              <Select value={current ?? ''} onChange={(e) => setCode(e.target.value)} className="h-11">
                {(['premix', 'menu'] as const).map((k) => (
                  <optgroup key={k} label={k === 'premix' ? tr('Premix') : tr('Menu cards')}>
                    {group(k).map((b) => <option key={b.code} value={b.code}>{b.name} · {num(b.yield_qty, 3)} {b.yield_unit}</option>)}
                  </optgroup>
                ))}
              </Select>
            </Field>
          </div>
          <div className="hidden border-b border-neutral-100 lg:block lg:max-h-[70vh] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            {(['premix', 'menu'] as const).map((k) => (
              <div key={k}>
                <p className="flex items-center gap-1.5 bg-neutral-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {k === 'premix' ? <FlaskConical size={12} /> : <Package size={12} />}{k === 'premix' ? tr('Premix') : tr('Menu cards')}
                </p>
                <ul className="divide-y divide-neutral-100">
                  {group(k).map((b) => (
                    <li key={b.code}>
                      <button type="button" onClick={() => setCode(b.code)} className={cx('w-full px-4 py-2.5 text-left text-sm', b.code === current ? 'bg-brand-50 text-brand-800' : 'hover:bg-neutral-50')}>
                        <span className="block font-medium">{b.name}</span>
                        <span className="text-[11px] text-neutral-400">{b.code} · {tr('yields {0} {1}', num(b.yield_qty, 3), b.yield_unit)}</span>
                      </button>
                    </li>
                  ))}
                  {group(k).length === 0 && <li className="px-4 py-3 text-xs text-neutral-400">{k === 'menu' ? tr('No menu card yet: add one below') : '—'}</li>}
                </ul>
              </div>
            ))}
          </div>
          {draft ? (
            <div className="space-y-4 p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label={tr('Name')} className="sm:col-span-2"><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
                <Field label={tr('Yield')}><Input type="number" value={draft.yield_qty} onChange={(e) => setDraft({ ...draft, yield_qty: Number(e.target.value) })} /></Field>
                <Field label={tr('Unit')}>
                  <Select value={draft.yield_unit} onChange={(e) => setDraft({ ...draft, yield_unit: e.target.value })}>{['g', 'cup', 'can', 'pcs'].map((u) => <option key={u}>{u}</option>)}</Select>
                </Field>
              </div>
              {draft.kind === 'premix' && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-neutral-700">{tr('Units of the premix')}</p>
                  <div className="flex flex-wrap gap-2">
                    {draft.units.map((u, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1">
                        <input value={u.name} onChange={(e) => setDraft({ ...draft, units: draft.units.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="w-28 text-xs outline-none" />
                        <input type="number" value={u.grams} onChange={(e) => setDraft({ ...draft, units: draft.units.map((x, j) => (j === i ? { ...x, grams: Number(e.target.value) } : x)) })} className="w-20 text-right text-xs tabular-nums outline-none" />
                        <span className="text-[11px] text-neutral-400">g</span>
                        <button type="button" aria-label={tr('Delete')} onClick={() => setDraft({ ...draft, units: draft.units.filter((_, j) => j !== i) })} className="text-neutral-400 hover:text-red-600"><Trash2 size={12} /></button>
                      </span>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setDraft({ ...draft, units: [...draft.units, { name: 'Teko', grams: Math.round(draft.yield_qty / 3) }] })}><Plus size={13} /> {tr('Unit')}</Button>
                  </div>
                </div>
              )}
              <table className="m-cards w-full text-sm">
                <thead className={theadClass}>
                  <tr><th className="px-3 py-2">{tr('Component')}</th><th className="px-3 py-2 text-right">{tr('Qty')}</th><th className="px-3 py-2">{tr('Unit')}</th>
                    {draft.kind === 'premix' && <th className="px-3 py-2 text-right">{tr('Per Gram')}</th>}<th className="px-3 py-2 text-right">{tr('Cost')}</th><th className="w-8" /></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {draft.lines.map((l, i) => {
                    const it = itemList.find((x) => x.code === l.item);
                    return (
                      <tr key={i}>
                        <td className="min-w-[14rem] px-3 py-1.5">
                          <SearchSelect value={l.item} options={itemOptions} required placeholder={tr('Choose an item')}
                            onChange={(x) => setLines(draft.lines.map((y, j) => (j === i ? { ...y, item: x ?? '', unit: itemList.find((z) => z.code === x)?.unit ?? y.unit } : y)))} />
                        </td>
                        <td className="w-28 px-3 py-1.5"><Input type="number" value={l.qty} onChange={(e) => setLines(draft.lines.map((y, j) => (j === i ? { ...y, qty: Number(e.target.value) } : y)))} className="h-9 text-right" /></td>
                        <td className="w-16 px-3 py-1.5 text-xs text-neutral-500">{it?.unit ?? l.unit}</td>
                        {draft.kind === 'premix' && <td className="px-3 py-1.5 text-right text-xs tabular-nums text-neutral-500">{draft.yield_qty ? num(l.qty / draft.yield_qty, 4) : '—'}</td>}
                        <td className="px-3 py-1.5 text-right text-xs tabular-nums text-neutral-500">{it?.cost != null ? rupiah(l.qty * it.cost) : '—'}</td>
                        <td className="px-1"><button type="button" aria-label={tr('Delete')} onClick={() => setLines(draft.lines.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button size="sm" variant="secondary" onClick={() => setLines([...draft.lines, { item: '', qty: 0, unit: 'g' }])}><Plus size={14} /> {tr('Add component')}</Button>
                <p className="text-xs text-neutral-500">
                  {draft.kind === 'premix' && <>{tr('Total {0} g of {1} g', num(total), num(draft.yield_qty))}{Math.round(total) !== Math.round(draft.yield_qty) && <span className="ml-1 text-amber-700">· {tr('the lines do not add up to the batch')}</span>} · </>}
                  {tr('HPP per {0}', draft.yield_unit === 'g' ? 'g' : draft.yield_unit)}: <span className="font-semibold text-neutral-900">{hpp === null ? tr('fill the cost of the items') : rupiah(hpp)}</span>
                </p>
              </div>
              {draft.kind === 'menu' && usedBy(draft).length > 0 && <p className="text-xs text-neutral-500">{tr('Used by')}: {usedBy(draft).join(', ')}</p>}
              <Button className="h-11 w-full lg:hidden" loading={busy} onClick={() => void save()}><Save size={16} /> {tr('Save Recipe')}</Button>
            </div>
          ) : <Empty title={tr('No recipe yet')} />}
        </div>
      </Panel>}
      {view === 'list' && <MasterTable noun={tr('recipe')} title={tr('Recipes')} master={boms}
        blank={(): Partial<Bom> => ({ code: 'BOM-', name: '', output: '', yield_qty: 1, yield_unit: 'cup', kind: 'menu', units: [], lines: [] })}
        columns={[
          { label: tr('Recipe'), render: (b) => <><span className="block font-medium text-neutral-900">{b.name}</span><span className="text-[11px] text-neutral-400">{b.code}</span></> },
          { label: tr('Kind'), render: (b) => <Badge tone={b.kind === 'premix' ? 'violet' : 'blue'}>{b.kind === 'premix' ? tr('Premix') : tr('Menu card')}</Badge> },
          { label: tr('Output'), render: (b) => itemList.find((i) => i.code === b.output)?.name ?? b.output },
          { label: tr('Yield'), render: (b) => `${num(b.yield_qty, 3)} ${b.yield_unit}` },
          { label: tr('HPP'), className: 'text-right', render: (b) => { const c = costOf(rows, itemList, b.code); return c === null ? <span className="text-neutral-400">—</span> : <span className="tabular-nums">{rupiah(c)}</span>; } },
        ]}
        fields={[
          { key: 'code', label: tr('Code'), required: true, placeholder: 'BOM-XXX' },
          { key: 'name', label: tr('Name'), required: true },
          { key: 'kind', label: tr('Kind'), type: 'select', required: true, options: [{ value: 'menu', label: tr('Menu card (per cup / can)') }, { value: 'premix', label: tr('Premix (Per Batch)') }] },
          { key: 'output', label: tr('Output'), type: 'search', required: true, hint: tr('A premix: its premix item; a menu card: the menu'),
            options: [...itemList.filter((i) => i.category === 'premix').map((i) => ({ value: i.code, label: i.name, hint: tr('Premix') })),
                      ...(menus.rows ?? []).map((m) => ({ value: m.code, label: m.name, hint: tr('Menu') }))] },
          { key: 'yield_qty', label: tr('Yield'), type: 'number', required: true },
          { key: 'yield_unit', label: tr('Unit'), type: 'select', required: true, options: ['cup', 'can', 'g', 'pcs'].map((u) => ({ value: u, label: u })) },
          { key: 'note', label: tr('Note'), type: 'textarea' },
        ]} />}
    </>
  );
}

/** The premix calculator: rows of recipe × unit × quantity → the grams of every raw material, rounded up per material. */
export function CalculatorTab() {
  const boms = useMaster<Bom>('boms');
  const items = useMaster<Item>('items');
  const premix = (boms.rows ?? []).filter((b) => b.kind === 'premix');
  const [rows, setRows] = useState<{ bom: string; unit: string; qty: number }[]>([]);
  useEffect(() => { if (!rows.length && premix.length) setRows([{ bom: premix[0].code, unit: premix[0].units[0]?.name ?? 'Gram', qty: 1 }]); }, [premix.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = useMemo(() => {
    const out = new Map<string, number>();
    for (const r of rows) {
      const b = premix.find((x) => x.code === r.bom);
      if (!b) continue;
      const grams = (b.units.find((u) => u.name === r.unit)?.grams ?? 1) * r.qty;
      explode(boms.rows ?? [], b.code, grams, out);
    }
    return [...out.entries()].map(([k, q]) => ({ item: items.rows?.find((i) => i.code === k), code: k, qty: Math.ceil(Math.round(q * 1e6) / 1e6) }))
      .sort((a, b) => b.qty - a.qty);
  }, [rows, premix, boms.rows, items.rows]);
  return (
    <>
      <Panel title={tr('Premix Calculator')} description={tr('Choose the premix, its unit and how many: the grams of every raw material, rounded up as the Cost Control calculator')}
        actions={<Button size="sm" variant="secondary" onClick={() => setRows([...rows, { bom: premix[0]?.code ?? '', unit: premix[0]?.units[0]?.name ?? 'Gram', qty: 1 }])}><Plus size={14} /> {tr('Row')}</Button>}>
        <table className="m-cards w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2">{tr('Premix')}</th><th className="px-4 py-2">{tr('Unit')}</th><th className="px-4 py-2 text-right">{tr('Qty')}</th><th className="px-4 py-2 text-right">{tr('Grams')}</th><th className="w-8" /></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r, i) => {
              const b = premix.find((x) => x.code === r.bom);
              const g = (b?.units.find((u) => u.name === r.unit)?.grams ?? 1) * r.qty;
              return (
                <tr key={i}>
                  <td className="px-4 py-1.5"><Select value={r.bom} onChange={(e) => { const nb = premix.find((x) => x.code === e.target.value); setRows(rows.map((x, j) => (j === i ? { ...x, bom: e.target.value, unit: nb?.units[0]?.name ?? 'Gram' } : x))); }} className="h-9">{premix.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></td>
                  <td className="px-4 py-1.5"><Select value={r.unit} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="h-9">{(b?.units.length ? b.units : [{ name: 'Gram', grams: 1 }]).map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}</Select></td>
                  <td className="w-28 px-4 py-1.5"><Input type="number" value={r.qty} min={0} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="h-9 text-right" /></td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{num(g)} g</td>
                  <td className="px-1"><button type="button" aria-label={tr('Delete')} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
      <Panel title={tr('Raw Materials Needed')} description={tr('Total per material, rounded up')}>
        {result.length === 0 ? <Empty icon={<Calculator size={26} />} title={tr('Add a Row Above')} /> : (
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr('Material')}</th><th className="px-4 py-2.5 text-right">{tr('Qty')}</th><th className="px-4 py-2.5 text-right">{tr('Packs')}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {result.map((r) => (
                <tr key={r.code}>
                  <td className="px-4 py-2">{r.item?.name ?? r.code}{r.item && !r.item.is_stock && <span className="ml-1 text-[11px] text-neutral-400">({tr('not counted')})</span>}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{num(r.qty)} {r.item?.unit ?? 'g'}</td>
                  <td className="px-4 py-2 text-right text-xs text-neutral-500">{r.item?.pack_qty ? `${num(r.qty / r.item.pack_qty, 2)} × ${r.item.pack_unit ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

type Usage = { from: string; to: string; menus: { code: string; name: string; sold: number; waste: number; cupping: number; bom: string | null }[];
  items: { item: string; name: string; unit: string; category: ItemCategory | null; sold: number; waste: number; cupping: number; total: number; value: number | null }[]; noRecipe: string[] };

/** The theoretical usage of the drivers: cups sold, wasted and given for tasting, exploded through the recipe cards. */
export function UsageTab() {
  const pools = useMaster<Pool>('pools');
  const [today] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [from, setFrom] = useState(() => new Date(Date.now() + 7 * 3600e3 - 6 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [pool, setPool] = useState('');
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ from: '', to: '', pool: '' });
  useEffect(() => {
    let alive = true;
    setError(null);
    call<Usage>(`/api/cotr/usage?dateFrom=${from}&dateTo=${to}${pool ? `&pool=${encodeURIComponent(pool)}` : ''}`)
      .then((d) => { if (alive) setData(d); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [from, to, pool, tick]);
  const value = data?.items.reduce((a, r) => a + (r.value ?? 0), 0) ?? 0;
  const poolList = (pools.rows ?? []).filter((p) => p.kind !== 'storage');
  const daysBack = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
  const quick = [{ value: '0', label: tr('Today') }, { value: '6', label: tr('Last {0} days', 7) }, { value: '13', label: tr('Last {0} days', 14) }, { value: '29', label: tr('Last {0} days', 30) }];
  const quickOf = (f: string, t: string) => (t === today ? quick.find((q) => daysBack(Number(q.value)) === f)?.value ?? '' : '');
  const total = (k: 'sold' | 'waste' | 'cupping') => data?.menus.reduce((a, m) => a + m[k], 0) ?? 0;
  return (
    <>
      <ScopeBar onOpen={() => { setDraft({ from, to, pool }); setSheet(true); }}
        scopes={[
          { key: 'period', icon: <CalendarRange />, label: tr('Period'), value: from === to ? dmyOf(from) : `${dmyOf(from)} – ${dmyOf(to)}`, active: quickOf(from, to) !== '6' },
          { key: 'pool', icon: <Building2 />, label: tr('Pool / HUB'), value: poolList.find((p) => p.code === pool)?.name ?? tr('All pools'), active: !!pool },
        ]} />
      <StatGrid label={tr('Theoretical Usage')} cols={4}>
        <StatCard label={tr('Cups Sold')} icon={<Coffee />} value={data ? num(total('sold')) : <ValueSkeleton />} />
        <StatCard label={tr('Waste')} icon={<Trash2 />} tone={total('waste') ? 'warn' : 'default'} value={data ? num(total('waste')) : <ValueSkeleton />} />
        <StatCard label={tr('Cupping')} icon={<FlaskConical />} value={data ? num(total('cupping')) : <ValueSkeleton />} />
        <StatCard label={tr('Value')} tone="brand" icon={<Wallet />} value={data ? rupiah(value) : <ValueSkeleton />} sub={data && tr('{0} items', data.items.length)} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={(quickOf(draft.from, draft.to) !== '6' ? 1 : 0) + (draft.pool ? 1 : 0)} onClose={() => setSheet(false)}
          onReset={() => setDraft({ from: daysBack(6), to: today, pool: '' })} applyDisabled={!draft.from || !draft.to || draft.from > draft.to}
          onApply={() => { setFrom(draft.from); setTo(draft.to); setPool(draft.pool); setSheet(false); }}>
          <FilterRow icon={<CalendarRange size={15} />} label={tr('Period')} value={`${dmyOf(draft.from)} – ${dmyOf(draft.to)}`}>
            <div className="space-y-2">
              <Segments value={quickOf(draft.from, draft.to)} onChange={(v) => setDraft({ ...draft, from: daysBack(Number(v)), to: today })} choices={quick} />
              <div className="grid grid-cols-2 gap-2">
                <Field label={tr('From')}><Input type="date" value={draft.from} max={draft.to || today} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
                <Field label={tr('To')}><Input type="date" value={draft.to} min={draft.from} max={today} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
              </div>
            </div>
          </FilterRow>
          <FilterRow icon={<Building2 size={15} />} label={tr('Pool / HUB')} value={poolList.find((p) => p.code === draft.pool)?.name ?? null} onClear={() => setDraft({ ...draft, pool: '' })}>
            <ComboFilter value={draft.pool} onChange={(v) => setDraft({ ...draft, pool: v })} allLabel={tr('All pools')} placeholder={tr('Search pool')}
              options={poolList.map((p) => ({ value: p.code, label: p.name, hint: p.city }))} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <Panel title={tr('Theoretical Usage')} description={tr('Cups sold, wasted and given for tasting by the drivers, exploded through the recipe cards')}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <SkeletonRows cols={4} /> : (
          <>
            {data.noRecipe.length > 0 && (
              <p className="mx-4 mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr('Menus without a recipe card are not exploded: {0}', data.menus.filter((m) => !m.bom).map((m) => m.name).join(', '))}
              </p>
            )}
            <table className="m-cards w-full text-sm">
              <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr('Menu')}</th><th className="px-4 py-2.5 text-right">{tr('Sold')}</th><th className="px-4 py-2.5 text-right">{tr('Waste')}</th><th className="px-4 py-2.5 text-right">{tr('Cupping')}</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {data.menus.map((m) => (
                  <tr key={m.code}><td className="px-4 py-2">{m.name} {!m.bom && <Badge tone="amber">{tr('No recipe yet')}</Badge>}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.sold}</td><td className="px-4 py-2 text-right tabular-nums">{m.waste}</td><td className="px-4 py-2 text-right tabular-nums">{m.cupping}</td></tr>
                ))}
                {data.menus.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">{tr('No sales in this period')}</td></tr>}
              </tbody>
            </table>
          </>
        )}
      </Panel>
      {data && data.items.length > 0 && (
        <Panel title={tr('Items Used')} description={value ? `${tr('Value')}: ${rupiah(value)}` : undefined}>
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr('Item')}</th><th className="px-4 py-2.5 text-right">{tr('Sold')}</th><th className="px-4 py-2.5 text-right">{tr('Waste')}</th><th className="px-4 py-2.5 text-right">{tr('Cupping')}</th><th className="px-4 py-2.5 text-right">{tr('Total')}</th><th className="px-4 py-2.5 text-right">{tr('Value')}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.items.map((r) => (
                <tr key={r.item}>
                  <td className="px-4 py-2"><span className="block">{r.name}</span>{r.category && <span className="text-[11px] text-neutral-400">{CATEGORY[r.category].label()}</span>}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{num(r.sold)}</td><td className="px-4 py-2 text-right tabular-nums">{num(r.waste)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{num(r.cupping)}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{num(r.total)} {r.unit}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-neutral-500">{r.value !== null ? rupiah(r.value) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

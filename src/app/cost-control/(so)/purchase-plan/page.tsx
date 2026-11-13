'use client';

// Estimasi Belanja per outlet (Cost Control · Analytics, page cc.purchase-plan; integrated_portal_be app/purchase_plan.py,
// 2026-11-13). Every outlet planned on its own — never the stock of outlets together — with a buffer recommended from
// its own data and split in its parts: cover days (the gaps between its goods receipts), loss % (its approved waste
// against its system usage; what was ordered too much left out) and safety % (the swing of its daily sales). Cost
// Control may set any part with a note. Tabs: Buffer per outlet · Estimate · Accuracy (the plan of 4 weeks ago against
// what was then used).

import { AlertTriangle, CalendarDays, Info, Package, Percent, RotateCcw, ShoppingCart, SlidersHorizontal, Store, Target } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/kc';
import ExcelIconButton from '@/components/ExcelIconButton';
import Dialog from '@/so/ui/Dialog';
import { Badge, Button, cx, Empty, ErrorState, Field, Input, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from '@/so/ui';
import { Note } from '@/so/ui/Simple';
import { Stat, StatSkeleton, StatStrip } from '@/so/ui/StatStrip';
import { dmy } from '@/so/ui/Filters';
import { ComboFilter, FilterRow, MonitorFilterSheet } from '@/so/ui/MonitorFilters';
import { SortTh, useSort } from '@/so/ui/Sort';
import { call } from '@/so/features/checkin/checkin';
import { downloadXlsx } from '@/lib/xlsx';
import { numberLocale, tr } from '@/lib/i18n';
import { DataSources } from '@/so/features/health/DataHealth';

type Parts = { coverDays: number; lossPct: number | null; safetyPct: number | null; bufferPct: number };
type Buffer = {
  branchCode: string; branchName: string; recommended: Parts; used: Parts & { lossPct: number; safetyPct: number };
  override: { coverDays: number | null; lossPct: number | null; safetyPct: number | null; note: string; by: string | null; at: string | null } | null;
  notes: string[];
  basis: { cover: 'gr' | 'default'; grDays: string[]; medianGap: number | null; wasteValue: number; wasteExcluded: number; wasteEntries: number;
    wasteUnpriced: number; wasteCategories: Record<string, number>; usageValue: number; openDays: number; salesMean: number | null; salesStdev: number | null };
};
type Settings = { window: number; grDays: number; minGr: number; defaultCover: number; coverMin: number; coverMax: number; z: number;
  capLoss: number; capSafety: number; suppliers: string[]; excludedCategories: string[] };
type Buffers = { window: { from: string; to: string; days: number; grDays: number }; data: Buffer[]; settings: Settings };
type SoRef = { date: string; refs: string[]; final: boolean; statuses: string[]; cutoff: string | null } | null;
type Line = { code: string; name: string | null; unit: string; perDay: number; required: number; stock: number | null; stockKnown: boolean; toOrder: number;
  packs: number | null; packUom: string | null; packFactor: number | null; price: number | null; priceSource: 'pricelist' | 'esb' | null; value: number | null };
type Plan = { branchCode: string; branchName: string; window: { from: string; to: string; openDays: number }; coverDays: number; bufferPct: number;
  buffer: Buffer; so: SoRef; data: Line[];
  total: { items: number; toOrder: number; value: number; unpriced: number; esbPriced: number; noStock: number; packs: number } };
type Summary = { window: Buffers['window']; data: { branchCode: string; branchName: string; coverDays: number; bufferPct: number; value: number; items: number; unpriced: number; so: SoRef }[]; total: number };
type Score = { wape: number; covered: number; items: number } | null;
type Backtest = { branchCode: string; base: { from: string; to: string; openDays: number }; test: { from: string; to: string; openDays: number }; bufferPct: number;
  vsSystem: Score; vsActual: Score; hasCounts: boolean; data: { code: string; name: string | null; unit: string; forecast: number; system: number; actual: number | null; price: number | null }[] };

const PAGE = 10;
const rp = (n: number | null | undefined) => (n == null ? '—' : `Rp ${Math.round(n).toLocaleString('id-ID')}`);
const num = (n: number | null | undefined, d = 2) => (n == null ? '—' : n.toLocaleString(numberLocale(), { maximumFractionDigits: d }));
const pct = (n: number | null | undefined) => (n == null ? '—' : `${num(n, 1)}%`);
const NOTE: Record<string, () => string> = {
  fewGr: () => tr('fewer than {0} goods receipts: default cover days', 3),
  noUsage: () => tr('no system usage (recipe cards / prices): no loss %'),
  fewSalesDays: () => tr('fewer than 7 days with sales: no safety %'),
  wasteUnpriced: () => tr('waste without a price left out'),
};

export default function PurchasePlanPage() {
  const [tab, setTab] = useState<'buffer' | 'plan' | 'accuracy'>('buffer');
  const [branch, setBranch] = useState('');
  const [buffers, setBuffers] = useState<Buffers | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setBuffers(await call<Buffers>('/api/cost-control/purchase-plan/buffers')); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const open = (code: string, to: 'plan' | 'accuracy' = 'plan') => { setBranch(code); setTab(to); };
  const outlets = useMemo(() => (buffers?.data ?? []).map((b) => ({ value: b.branchCode, label: b.branchName, hint: b.branchCode })), [buffers]);
  const changed = (buffers?.data ?? []).filter((b) => b.override).length;
  const avg = (k: 'coverDays' | 'bufferPct') => (buffers?.data.length ? buffers.data.reduce((s, b) => s + b.used[k], 0) / buffers.data.length : null);
  return (
    <Page title={tr('Purchase Estimate')} subtitle={buffers ? tr('Per outlet, from its own sales, waste and goods receipts · {0} – {1}', dmy(buffers.window.from), dmy(buffers.window.to)) : tr('Per outlet, from its own sales, waste and goods receipts')}
      stats={
        <StatStrip label={tr('Summary')} columns={4}>
          <Stat label={tr('Outlets')} emphasis icon={<Store size={13} />} value={buffers ? num(buffers.data.length, 0) : <StatSkeleton />}>
            {buffers && <p>{tr('{0} set by Cost Control', changed)}</p>}</Stat>
          <Stat label={tr('Average cover days')} icon={<CalendarDays size={13} />} value={buffers ? num(avg('coverDays'), 1) : <StatSkeleton />}>
            {buffers && <p>{tr('the median gap between goods receipts')}</p>}</Stat>
          <Stat label={tr('Average buffer')} icon={<Percent size={13} />} value={buffers ? pct(avg('bufferPct')) : <StatSkeleton />}>
            {buffers && <p>{tr('loss % + safety %')}</p>}</Stat>
          <Stat label={tr('Without enough data')} icon={<AlertTriangle size={13} />} value={buffers ? num(buffers.data.filter((b) => b.notes.length).length, 0) : <StatSkeleton />}>
            {buffers && <p>{tr('outlets with a default or an empty part')}</p>}</Stat>
        </StatStrip>
      }>
      <DataSources keys={['esbSales', 'esbIntegrity', 'so', 'waste', 'prices', 'recipes']} />
      <Tabs label={tr('Purchase Estimate')} value={tab} onChange={(k) => setTab(k as typeof tab)} className="mb-4"
        tabs={[{ key: 'buffer', label: tr('Buffer per outlet'), count: buffers?.data.length }, { key: 'plan', label: tr('Estimate') }, { key: 'accuracy', label: tr('Accuracy') }]} />
      {error ? <ErrorState message={error} onRetry={() => void load()} />
        : tab === 'buffer' ? <BufferTab data={buffers} onSaved={(row) => setBuffers((b) => b && { ...b, data: b.data.map((x) => (x.branchCode === row.branchCode ? row : x)) })} onOpen={open} />
          : tab === 'plan' ? <PlanTab branch={branch} setBranch={setBranch} outlets={outlets} />
            : <AccuracyTab branch={branch} setBranch={setBranch} outlets={outlets} />}
      <Sources settings={buffers?.settings} />
    </Page>
  );
}

/* ---------------------------------------------------------------- buffer per outlet */

type BKey = 'outlet' | 'cover' | 'loss' | 'safety' | 'buffer';
const bValue = (r: Buffer, k: BKey) => ({ outlet: r.branchName, cover: r.used.coverDays, loss: r.used.lossPct, safety: r.used.safetyPct, buffer: r.used.bufferPct }[k]);

function BufferTab({ data, onSaved, onOpen }: { data: Buffers | null; onSaved: (r: Buffer) => void; onOpen: (code: string, to?: 'plan' | 'accuracy') => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Buffer | null>(null);
  const rows = useMemo(() => (data?.data ?? []).filter((r) => !q || `${r.branchName} ${r.branchCode}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const { rows: sorted, sort, toggle } = useSort<Buffer, BKey>(rows, bValue, { key: 'outlet', dir: 'asc' });
  const paged = usePaged(sorted, q + JSON.stringify(sort), PAGE);
  const exportRows = () => downloadXlsx({ fileName: `Buffer per outlet ${data?.window.to ?? ''}`, sheet: 'Buffer', title: `Buffer per outlet ${dmy(data?.window.from ?? '')} – ${dmy(data?.window.to ?? '')}`,
    header: ['Outlet', 'Kode', 'Buffer hari', 'Susut %', 'Pengaman %', 'Buffer %', 'Rekomendasi hari', 'Rekomendasi susut %', 'Rekomendasi pengaman %', 'Diubah Cost Control', 'Alasan',
      'Tanggal GR', 'Median jarak GR', 'Nilai waste', 'Waste dikecualikan', 'Nilai pemakaian sistem', 'Hari buka', 'Rata-rata penjualan', 'Simpangan penjualan', 'Catatan'],
    rows: sorted.map((r) => [r.branchName, r.branchCode, r.used.coverDays, r.used.lossPct, r.used.safetyPct, r.used.bufferPct, r.recommended.coverDays, r.recommended.lossPct,
      r.recommended.safetyPct, r.override ? 'Ya' : 'Tidak', r.override?.note ?? null, r.basis.grDays.join(', '), r.basis.medianGap, r.basis.wasteValue, r.basis.wasteExcluded,
      r.basis.usageValue, r.basis.openDays, r.basis.salesMean, r.basis.salesStdev, r.notes.map((n) => NOTE[n]?.() ?? n).join('; ')]) });
  return (
    <Panel toolbar={
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Search outlet')} className="max-w-xs" />
        <ExcelIconButton boxed className="ml-auto" label={tr('Export to Excel')} disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, 'error'))} />
      </div>}
      footer={data ? <><span>{tr('{0} outlets', num(rows.length, 0))}</span><PageNav paged={paged} /></> : undefined}>
      {!data ? <table className="w-full"><tbody><SkeletonRows cols={6} /></tbody></table>
        : !rows.length ? <Empty icon={<Store size={26} />} title={tr('No outlet with POS sales in the last 28 days')} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead className={theadClass}><tr>
              <SortTh k="outlet" sort={sort} onSort={toggle} className="pl-5">{tr('Outlet')}</SortTh>
              <SortTh k="cover" sort={sort} onSort={toggle} align="right" first="desc">{tr('Cover days')}</SortTh>
              <SortTh k="loss" sort={sort} onSort={toggle} align="right" first="desc">{tr('Loss %')}</SortTh>
              <SortTh k="safety" sort={sort} onSort={toggle} align="right" first="desc">{tr('Safety %')}</SortTh>
              <SortTh k="buffer" sort={sort} onSort={toggle} align="right" first="desc">{tr('Buffer %')}</SortTh>
              <th className="py-2.5 pl-2 pr-5 text-right"><span className="sr-only">{tr('Actions')}</span></th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">{paged.rows.map((r) => {
              const o = r.override;
              const mark = (set: boolean) => set && <span className="ml-1 text-[10px] font-semibold uppercase text-brand-700">{tr('set')}</span>;
              return (
                <tr key={r.branchCode} className="align-top hover:bg-neutral-50/70">
                  <td className="w-[17rem] max-w-[17rem] py-2.5 pl-5 pr-3">
                    <button type="button" onClick={() => onOpen(r.branchCode)} className="block max-w-full truncate text-left font-medium text-neutral-900 hover:text-brand-700">{r.branchName}</button>
                    <span className="text-[11px] text-neutral-400">{r.branchCode}</span>
                    {o ? <Badge tone="blue">{tr('Set by Cost Control')}</Badge> : <Badge tone="slate">{tr('Recommended')}</Badge>}
                    {r.notes.map((n) => <span key={n} className="mt-1 flex items-start gap-1 text-[11px] leading-snug text-amber-700"><AlertTriangle size={11} className="mt-0.5 flex-shrink-0" aria-hidden /><span>{NOTE[n]?.() ?? n}</span></span>)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-semibold">{r.used.coverDays}</span>{mark(!!o?.coverDays)}
                    <span className="block text-[11px] text-neutral-400">{r.basis.cover === 'gr' ? tr('{0} GR days · median {1}', r.basis.grDays.length, num(r.basis.medianGap, 1)) : tr('default')}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-semibold">{pct(r.used.lossPct)}</span>{mark(o?.lossPct != null)}
                    <span className="block text-[11px] text-neutral-400" title={tr('waste {0} of {1}', rp(r.basis.wasteValue), rp(r.basis.usageValue))}>{tr('waste {0}', rp(r.basis.wasteValue))}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-semibold">{pct(r.used.safetyPct)}</span>{mark(o?.safetyPct != null)}
                    <span className="block text-[11px] text-neutral-400" title={r.basis.salesMean ? tr('swing {0} of {1} a day', pct((r.basis.salesStdev ?? 0) / r.basis.salesMean * 100), rp(r.basis.salesMean)) : undefined}>
                      {r.basis.salesMean ? tr('sales swing {0}', pct((r.basis.salesStdev ?? 0) / r.basis.salesMean * 100)) : '—'}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-base font-semibold tabular-nums text-neutral-900">{pct(r.used.bufferPct)}
                    {o && <span className="block text-[11px] font-normal text-neutral-400">{tr('recommended {0}', pct(r.recommended.bufferPct))}</span>}</td>
                  <td className="whitespace-nowrap py-2.5 pl-2 pr-5 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEdit(r)} title={tr('Set')} aria-label={`${tr('Set')} ${r.branchName}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-brand-700"><SlidersHorizontal size={14} /></button>
                      <button type="button" onClick={() => onOpen(r.branchCode)} title={tr('Estimate')} aria-label={`${tr('Estimate')} ${r.branchName}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-brand-700"><ShoppingCart size={14} /></button>
                    </div>
                  </td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
      {edit && data && <BufferDialog row={edit} settings={data.settings} onClose={() => setEdit(null)} onSaved={(r) => { onSaved(r); setEdit(null); toast(tr('Buffer saved'), 'ok'); }} />}
    </Panel>
  );
}

function BufferDialog({ row, settings, onClose, onSaved }: { row: Buffer; settings: Settings; onClose: () => void; onSaved: (r: Buffer) => void }) {
  const o = row.override;
  const [cover, setCover] = useState(o?.coverDays != null ? String(o.coverDays) : '');
  const [loss, setLoss] = useState(o?.lossPct != null ? String(o.lossPct) : '');
  const [safety, setSafety] = useState(o?.safetyPct != null ? String(o.safetyPct) : '');
  const [note, setNote] = useState(o?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const val = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));
  const save = async (reset: boolean) => {
    setBusy(true); setErr(null);
    try {
      const body = reset ? { coverDays: null, lossPct: null, safetyPct: null, note: '' } : { coverDays: val(cover), lossPct: val(loss), safetyPct: val(safety), note };
      onSaved(await call<Buffer>(`/api/cost-control/purchase-plan/buffers/${encodeURIComponent(row.branchCode)}`, { method: 'PUT', json: body }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const b = row.basis;
  const cats = Object.entries(b.wasteCategories).sort((x, y) => y[1] - x[1]);
  return (
    <Dialog open title={tr('Buffer of {0}', row.branchName)} onClose={onClose} size="lg"
      description={tr('An empty field keeps the recommendation. A reason is needed to change it.')}
      footer={<>
        {o && <Button variant="secondary" onClick={() => void save(true)} disabled={busy}><RotateCcw size={14} /> {tr('Back to the recommendation')}</Button>}
        <Button variant="secondary" onClick={onClose} disabled={busy}>{tr('Cancel')}</Button>
        <Button onClick={() => void save(false)} loading={busy} disabled={!note.trim() || (val(cover) == null && val(loss) == null && val(safety) == null)}>{tr('Save')}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={tr('Cover days')} hint={tr('recommended {0}', row.recommended.coverDays)}>
            <Input inputMode="numeric" value={cover} onChange={(e) => setCover(e.target.value.replace(/[^\d]/g, ''))} placeholder={String(row.recommended.coverDays)} /></Field>
          <Field label={tr('Loss %')} hint={tr('recommended {0}', pct(row.recommended.lossPct))}>
            <Input inputMode="decimal" value={loss} onChange={(e) => setLoss(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={row.recommended.lossPct == null ? '0' : String(row.recommended.lossPct)} /></Field>
          <Field label={tr('Safety %')} hint={tr('recommended {0}', pct(row.recommended.safetyPct))}>
            <Input inputMode="decimal" value={safety} onChange={(e) => setSafety(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={row.recommended.safetyPct == null ? '0' : String(row.recommended.safetyPct)} /></Field>
        </div>
        <Field label={tr('Reason')} required><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder={tr('e.g. delivery on Monday and Thursday')} /></Field>
        {o?.by && <p className="text-xs text-neutral-500">{tr('Last set by {0}', o.by)}{o.at ? ` · ${dmy(o.at.slice(0, 10))}` : ''}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
        <div className="grid gap-3 text-xs text-neutral-600 sm:grid-cols-3">
          <div className="rounded-lg border border-neutral-200 p-3"><p className="mb-1 font-semibold text-neutral-800">{tr('Cover days')}</p>
            <p>{b.cover === 'gr' ? tr('Median gap {0} days between {1} receipt days from {2}.', num(b.medianGap, 1), b.grDays.length, settings.suppliers.join(', ')) : tr('Fewer than {0} receipt days in {1} days: {2} days.', settings.minGr, settings.grDays, settings.defaultCover)}</p>
            {b.grDays.length > 0 && <p className="mt-1 text-neutral-400">{b.grDays.slice(-8).map(dmy).join(' · ')}</p>}</div>
          <div className="rounded-lg border border-neutral-200 p-3"><p className="mb-1 font-semibold text-neutral-800">{tr('Loss %')}</p>
            <p>{tr('Approved portal waste {0} ÷ system usage {1} (capped at {2}%).', rp(b.wasteValue), rp(b.usageValue), settings.capLoss)}</p>
            {b.wasteExcluded > 0 && <p className="mt-1">{tr('{0} of "{1}" left out: ordered too much.', rp(b.wasteExcluded), settings.excludedCategories.join(', '))}</p>}
            {cats.length > 0 && <p className="mt-1 text-neutral-400">{cats.slice(0, 4).map(([c, v]) => `${c} ${rp(v)}`).join(' · ')}</p>}</div>
          <div className="rounded-lg border border-neutral-200 p-3"><p className="mb-1 font-semibold text-neutral-800">{tr('Safety %')}</p>
            <p>{tr('{0} × swing of the daily sales ÷ √cover days, {1} open days (capped at {2}%).', settings.z, b.openDays, settings.capSafety)}</p>
            {b.salesMean != null && <p className="mt-1 text-neutral-400">{tr('average {0} · deviation {1}', rp(b.salesMean), rp(b.salesStdev))}</p>}</div>
        </div>
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- estimate of an outlet */

type LKey = 'name' | 'perDay' | 'required' | 'stock' | 'toOrder' | 'value';
const lValue = (r: Line, k: LKey) => ({ name: r.name ?? r.code, perDay: r.perDay, required: r.required, stock: r.stock, toOrder: r.toOrder, value: r.value }[k]);
type Option = { value: string; label: string; hint?: string };

function OutletSheet({ branch, outlets, cover, buffer, onApply, onClose, withBuffer }: {
  branch: string; outlets: Option[]; cover?: string; buffer?: string; withBuffer?: boolean;
  onApply: (v: { branch: string; cover: string; buffer: string }) => void; onClose: () => void;
}) {
  const [d, setD] = useState({ branch, cover: cover ?? '', buffer: buffer ?? '' });
  return (
    <MonitorFilterSheet active={[d.branch, d.cover, d.buffer].filter(Boolean).length} onClose={onClose} onReset={() => setD({ branch: '', cover: '', buffer: '' })}
      onApply={() => onApply(d)} applyDisabled={!d.branch}>
      <FilterRow icon={<Store size={15} />} label={tr('Outlet')} value={outlets.find((o) => o.value === d.branch)?.label ?? null}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} options={outlets} allLabel={tr('Choose an outlet')} placeholder={tr('Search outlet')} />
      </FilterRow>
      {withBuffer && <>
        <FilterRow icon={<CalendarDays size={15} />} label={tr('Cover days')} value={d.cover || null} onClear={() => setD({ ...d, cover: '' })}>
          <Input inputMode="numeric" value={d.cover} onChange={(e) => setD({ ...d, cover: e.target.value.replace(/[^\d]/g, '') })} placeholder={tr('The outlet\'s buffer')} />
        </FilterRow>
        <FilterRow icon={<Percent size={15} />} label={tr('Buffer %')} value={d.buffer || null} onClear={() => setD({ ...d, buffer: '' })}>
          <Input inputMode="decimal" value={d.buffer} onChange={(e) => setD({ ...d, buffer: e.target.value.replace(/[^\d.]/g, '') })} placeholder={tr('The outlet\'s buffer')} />
          <p className="mt-2 text-xs text-neutral-500">{tr('For this view only; set the buffer of the outlet in the Buffer per outlet tab.')}</p>
        </FilterRow>
      </>}
    </MonitorFilterSheet>
  );
}

function PlanTab({ branch, setBranch, outlets }: { branch: string; setBranch: (b: string) => void; outlets: Option[] }) {
  const toast = useToast();
  const [cover, setCover] = useState('');
  const [buffer, setBuffer] = useState('');
  const [sheet, setSheet] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyOrder, setOnlyOrder] = useState(true);
  useEffect(() => {
    setError(null); setPlan(null);
    if (!branch) {
      if (!summary) void call<Summary>('/api/cost-control/purchase-plan/summary').then(setSummary).catch((e) => setError((e as Error).message));
      return;
    }
    const qs = `branch=${encodeURIComponent(branch)}${cover ? `&cover=${cover}` : ''}${buffer ? `&buffer=${buffer}` : ''}`;
    void call<Plan>(`/api/cost-control/purchase-plan?${qs}`).then(setPlan).catch((e) => setError((e as Error).message));
  }, [branch, cover, buffer, summary]);
  const lines = useMemo(() => (plan?.data ?? []).filter((r) => !onlyOrder || r.toOrder > 0), [plan, onlyOrder]);
  const { rows: sorted, sort, toggle } = useSort<Line, LKey>(lines, lValue, { key: 'value', dir: 'desc' });
  const paged = usePaged(sorted, `${branch}|${onlyOrder}|${JSON.stringify(sort)}`, PAGE);
  const sumPaged = usePaged(summary?.data ?? [], summary?.data.length ?? 0, PAGE);
  const exportPlan = () => plan && downloadXlsx({ fileName: `Estimasi Belanja ${plan.branchName}`, sheet: 'Estimasi', title: `Estimasi Belanja ${plan.branchName} · ${plan.coverDays} hari · buffer ${plan.bufferPct}%`,
    header: ['Kode', 'Bahan', 'Satuan', 'Pemakaian / hari', 'Kebutuhan', 'Stok', 'Pesan', 'Kemasan', 'Jumlah kemasan', 'Harga', 'Sumber harga', 'Nilai'],
    rows: sorted.map((r) => [r.code, r.name, r.unit, r.perDay, r.required, r.stock, r.toOrder, r.packUom, r.packs, r.price, r.priceSource, r.value]) });
  const chips = (
    <button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50 sm:h-9">
      <SlidersHorizontal size={15} /> {tr('Filters')}
      {branch && <span className="max-w-[14rem] truncate font-normal text-neutral-500">· {outlets.find((o) => o.value === branch)?.label ?? branch}</span>}
    </button>
  );
  const sheetEl = sheet && <OutletSheet withBuffer branch={branch} outlets={outlets} cover={cover} buffer={buffer} onClose={() => setSheet(false)}
    onApply={(v) => { setBranch(v.branch); setCover(v.cover); setBuffer(v.buffer); setSheet(false); }} />;
  if (!branch) return (
    <Panel toolbar={chips} footer={summary ? <><span>{tr('{0} outlets · total {1}', summary.data.length, rp(summary.total))}</span><PageNav paged={sumPaged} /></> : undefined}>
      {error ? <ErrorState message={error} /> : !summary ? <table className="w-full"><tbody><SkeletonRows cols={5} /></tbody></table>
        : !summary.data.length ? <Empty icon={<ShoppingCart size={26} />} title={tr('No estimate yet')} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead className={theadClass}><tr><th className="py-2.5 pl-5 pr-3">{tr('Outlet')}</th><th className="px-4 py-2.5 text-right">{tr('Cover days')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Buffer %')}</th><th className="px-4 py-2.5 text-right">{tr('Materials to order')}</th>
              <th className="px-4 py-2.5 text-right">{tr('Estimate')}</th><th className="px-4 py-2.5">{tr('Stock from')}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">{sumPaged.rows.map((r) => (
              <tr key={r.branchCode} className="hover:bg-neutral-50/70">
                <td className="max-w-[18rem] py-2.5 pl-5 pr-3"><button type="button" onClick={() => setBranch(r.branchCode)} className="block max-w-full truncate text-left font-medium text-neutral-900 hover:text-brand-700">{r.branchName}</button></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.coverDays}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{pct(r.bufferPct)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.items}{r.unpriced > 0 && <span className="block text-[11px] text-amber-700">{tr('{0} no price', r.unpriced)}</span>}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{rp(r.value)}</td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">{r.so ? <>{tr('SO {0}', dmy(r.so.date))}{!r.so.final && <Badge tone="amber">{tr('SO not approved')}</Badge>}</> : <Badge tone="amber">{tr('No portal SO')}</Badge>}</td>
              </tr>))}</tbody>
          </table></div>)}
      {sheetEl}
    </Panel>
  );
  const t = plan?.total;
  return (
    <>
      {plan && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <MiniStat icon={<CalendarDays size={14} />} label={tr('Cover days')} value={String(plan.coverDays)} hint={cover ? tr('this view') : plan.buffer.override?.coverDays ? tr('set by Cost Control') : tr('recommended')} />
          <MiniStat icon={<Percent size={14} />} label={tr('Buffer %')} value={pct(plan.bufferPct)} hint={buffer ? tr('this view') : tr('loss {0} + safety {1}', pct(plan.buffer.used.lossPct), pct(plan.buffer.used.safetyPct))} />
          <MiniStat icon={<ShoppingCart size={14} />} label={tr('Estimate')} value={rp(t?.value)} hint={tr('{0} of {1} materials to order', t?.toOrder ?? 0, t?.items ?? 0)} />
          <MiniStat icon={<Package size={14} />} label={tr('Stock from')} value={plan.so ? tr('SO {0}', dmy(plan.so.date)) : tr('No portal SO')}
            hint={plan.so ? (plan.so.final ? tr('approved by Cost Control') : tr('not approved yet')) : tr('To Order = Required')} warn={!plan.so || !plan.so.final} />
        </div>
      )}
      {plan && (t?.unpriced || t?.esbPriced || t?.noStock) ? (
        <Note tone="warn" icon={<AlertTriangle />} className="mb-4">
          {[t.unpriced ? tr('{0} materials to order have no price (value left out)', t.unpriced) : null, t.esbPriced ? tr('{0} priced by the ESB HPP (no Pricelist price)', t.esbPriced) : null,
            t.noStock ? tr('{0} materials not in the stock of the latest SO (stock counted 0)', t.noStock) : null].filter(Boolean).join(' · ')}
        </Note>
      ) : null}
      <Panel toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {chips}
          <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={onlyOrder} onChange={(e) => setOnlyOrder(e.target.checked)} /> {tr('Only what to order')}</label>
          <Button size="sm" variant="secondary" onClick={() => setBranch('')}>{tr('All outlets')}</Button>
          <ExcelIconButton boxed className="ml-auto" label={tr('Export to Excel')} disabled={!lines.length} onClick={() => void exportPlan()?.catch((e) => toast((e as Error).message, 'error'))} />
        </div>}
        footer={plan ? <><span>{tr('{0} materials', lines.length)} · {tr('per day = system usage {0} – {1} ÷ {2} open days', dmy(plan.window.from), dmy(plan.window.to), plan.window.openDays)}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} /> : !plan ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !lines.length ? <Empty icon={<ShoppingCart size={26} />} title={tr('Nothing to order: the stock covers the cover days')} /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
              <thead className={theadClass}><tr>
                <SortTh k="name" sort={sort} onSort={toggle} className="pl-5">{tr('Material')}</SortTh>
                <SortTh k="perDay" sort={sort} onSort={toggle} align="right" first="desc">{tr('Per day')}</SortTh>
                <SortTh k="required" sort={sort} onSort={toggle} align="right" first="desc">{tr('Required')}</SortTh>
                <SortTh k="stock" sort={sort} onSort={toggle} align="right" first="desc">{tr('Stock')}</SortTh>
                <SortTh k="toOrder" sort={sort} onSort={toggle} align="right" first="desc">{tr('To Order')}</SortTh>
                <SortTh k="value" sort={sort} onSort={toggle} align="right" first="desc">{tr('Value')}</SortTh>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">{paged.rows.map((r) => (
                <tr key={r.code} className="hover:bg-neutral-50/70">
                  <td className="max-w-[18rem] py-2.5 pl-5 pr-3"><span className="block truncate font-medium text-neutral-900">{r.name ?? r.code}</span><span className="text-[11px] text-neutral-400">{r.code} · {r.unit}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{num(r.perDay)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{num(r.required)}</td>
                  <td className={cx('whitespace-nowrap px-4 py-2.5 text-right tabular-nums', !r.stockKnown && 'text-amber-700')}>{r.stockKnown ? num(r.stock) : tr('not in the SO')}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{num(r.toOrder)}
                    {r.packs != null && r.packUom && <span className="block text-[11px] font-normal text-neutral-500">{tr('{0} × {1}', r.packs, r.packUom)}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{rp(r.value)}
                    {r.priceSource === 'esb' && <span className="block text-[11px] text-amber-700">{tr('ESB HPP')}</span>}</td>
                </tr>))}</tbody>
            </table></div>)}
        {sheetEl}
      </Panel>
    </>
  );
}

function MiniStat({ icon, label, value, hint, warn }: { icon: React.ReactNode; label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{icon}{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-neutral-900">{value}</p>
      {hint && <p className={cx('text-xs', warn ? 'text-amber-700' : 'text-neutral-500')}>{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- accuracy */

function AccuracyTab({ branch, setBranch, outlets }: { branch: string; setBranch: (b: string) => void; outlets: Option[] }) {
  const [sheet, setSheet] = useState(!branch);
  const [res, setRes] = useState<Backtest | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRes(null); setError(null);
    if (branch) void call<Backtest>(`/api/cost-control/purchase-plan/backtest?branch=${encodeURIComponent(branch)}`).then(setRes).catch((e) => setError((e as Error).message));
  }, [branch]);
  const paged = usePaged(res?.data ?? [], branch, PAGE);
  const score = (s: Score, label: string, hint: string) => (
    <MiniStat icon={<Target size={14} />} label={label} value={s ? tr('{0} off', pct(s.wape)) : '—'} warn={!!s && s.wape > 20}
      hint={s ? tr('{0} of {1} materials covered with the buffer', pct(s.covered), s.items) : hint} />
  );
  return (
    <>
      <Note tone="info" icon={<Info />} className="mb-4">
        {tr('The estimate of 4 weeks ago (its average of the 4 weeks before) against what the outlet then used. "Off" = the difference in value ÷ what was used; below 10 % is good, above 20 % the average does not fit the outlet (promotions, a new menu, a closed day).')}
      </Note>
      <Panel toolbar={<button type="button" onClick={() => setSheet(true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-semibold text-neutral-800 shadow-sm hover:bg-neutral-50 sm:h-9">
        <SlidersHorizontal size={15} /> {tr('Filters')}{branch && <span className="max-w-[14rem] truncate font-normal text-neutral-500">· {outlets.find((o) => o.value === branch)?.label ?? branch}</span>}</button>}
        footer={res ? <><span>{tr('base {0} – {1} · test {2} – {3}', dmy(res.base.from), dmy(res.base.to), dmy(res.test.from), dmy(res.test.to))}</span><PageNav paged={paged} /></> : undefined}>
        {!branch ? <Empty icon={<Target size={26} />} title={tr('Choose an outlet in Filters')} />
          : error ? <ErrorState message={error} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={5} /></tbody></table> : (
            <>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {score(res.vsSystem, tr('Against the system usage'), tr('no usage in the test weeks'))}
                {score(res.vsActual, tr('Against the actual usage'), res.hasCounts ? tr('no priced material') : tr('needs an SO at both ends of the test weeks'))}
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
                <thead className={theadClass}><tr><th className="py-2.5 pl-5 pr-3">{tr('Material')}</th><th className="px-4 py-2.5 text-right">{tr('Estimate')}</th>
                  <th className="px-4 py-2.5 text-right">{tr('System usage')}</th><th className="px-4 py-2.5 text-right">{tr('Actual usage')}</th><th className="px-4 py-2.5 text-right">{tr('Difference')}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">{paged.rows.map((r) => (
                  <tr key={r.code}><td className="py-2.5 pl-5 pr-3"><span className="block font-medium text-neutral-900">{r.name ?? r.code}</span><span className="text-[11px] text-neutral-400">{r.code} · {r.unit}</span></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{num(r.forecast)}</td><td className="px-4 py-2.5 text-right tabular-nums">{num(r.system)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{num(r.actual)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.price ? rp((r.forecast - r.system) * r.price) : '—'}</td></tr>))}</tbody>
              </table></div>
            </>)}
      </Panel>
      {sheet && <OutletSheet branch={branch} outlets={outlets} onClose={() => setSheet(false)} onApply={(v) => { setBranch(v.branch); setSheet(false); }} />}
    </>
  );
}

/* ---------------------------------------------------------------- where the figures come from */

function Sources({ settings }: { settings?: Settings }) {
  const s = settings;
  return (
    <Note tone="muted" icon={<Info />} title={tr('Where the figures come from')} className="mt-4">
      <ul className="list-disc space-y-0.5 pl-4">
        <li>{tr('Usage per day: ESB POS sales of the last {0} days × the recipe cards (Sales Calculator), the ESB cupping / waste bills included.', s?.window ?? 28)}</li>
        <li>{tr('Cover days: ESB goods receipts from {0}, the last {1} days.', s?.suppliers.join(', ') ?? 'Calf Warehouse', s?.grDays ?? 56)}</li>
        <li>{tr('Loss %: Portal waste approved by Cost Control, valued at the Pricelist (else the ESB HPP).')}</li>
        <li>{tr('Stock: the running stock of the Stock List (latest Portal SO + ESB moves + Transfer Stock − waste − usage since).')}</li>
        <li>{tr('Packs: the unit the outlet receives the material in most (ESB goods receipts) and its factor in the item master.')}</li>
      </ul>
    </Note>
  );
}

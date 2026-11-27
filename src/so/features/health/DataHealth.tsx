'use client';

// The data checks of Cost Control (integrated_portal_be app/data_health.py, 2026-11-13): the cards of the Information
// Center and the "Sources" line every Cost Control page shows under its title — where its figures come from (ESB /
// Portal), how fresh they are and what is missing, with a link to the Information Center.

import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/so/ui';
import { call } from '@/so/features/checkin/checkin';
import { numberLocale, tr } from '@/lib/i18n';

export type Status = 'ok' | 'warn' | 'high' | 'error';
export type Card = {
  key: string; status: Status; value: string; detail: string; source: string; link: string | null;
  syncedAt?: string | null; dataTo?: string | null; hours?: number | null;
  items?: { code?: string; id?: string; name: string; level?: string; qty?: number; module?: string; status?: Status; syncedAt?: string | null; hours?: number | null; lastDoc?: string | null; week?: number; drafts?: number;
    esb?: number; db?: number; diff?: number; failed?: number; waiting?: number; failedRun?: boolean }[];
  diffs?: number; details?: number; failedRuns?: number;
  missing?: number; total?: number; waiting?: number; recount?: number; pending?: number; day?: string; new?: number; open?: number; unusual?: number;
  none?: number; esb?: number; menus?: number; share?: number; byStatus?: Record<string, number>;
};
export type Health = { at: string; cards: Card[]; counts: Record<Status, number> };

export const STATUS: Record<Status, { icon: ReactNode; label: () => string; tone: string; dot: string }> = {
  ok: { icon: <CheckCircle2 aria-hidden />, label: () => tr('Good'), tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'text-emerald-600' },
  warn: { icon: <AlertTriangle aria-hidden />, label: () => tr('Check'), tone: 'text-amber-800 bg-amber-50 border-amber-200', dot: 'text-amber-600' },
  high: { icon: <AlertOctagon aria-hidden />, label: () => tr('Figures affected'), tone: 'text-red-700 bg-red-50 border-red-200', dot: 'text-red-600' },
  error: { icon: <XCircle aria-hidden />, label: () => tr('Check failed'), tone: 'text-[color:var(--j-44546F)] bg-[color:var(--j-091E420F)] border-[color:var(--j-DCDFE4)]', dot: 'text-[color:var(--j-626F86)]' },
};

const num = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toLocaleString(numberLocale(), { maximumFractionDigits: d }));
const dmy = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const ago = (h?: number | null) => (h == null ? tr('never') : h < 1 ? tr('{0} min ago', Math.max(1, Math.round(h * 60))) : h < 48 ? tr('{0} h ago', num(h, h < 10 ? 1 : 0)) : tr('{0} days ago', Math.round(h / 24)));

/** Name, what it means and its figures in the language of the portal (the backend text is for the notifications). */
export function describe(c: Card): { title: string; source: string; value: string; text: string } {
  switch (c.key) {
    case 'esbSales': return { title: tr('ESB sales'), source: tr('ESB POS'), value: ago(c.hours),
      text: tr('POS sales up to {0}. Used for the sales, the recipe cards × the menus sold and the purchase estimate.', dmy(c.dataTo)) };
    case 'esbDocs': {
      const late = (c.items ?? []).filter((i) => i.status !== 'ok');
      return { title: tr('ESB documents'), source: tr('ESB ERP'), value: `${num((c.items?.length ?? 0) - late.length)}/${num(c.items?.length ?? 0)}`,
        text: late.length ? tr('Behind: {0}. Goods receipts, stock opname and invoices feed the COGS and the stock.', late.map((i) => i.name).join(', '))
          : tr('Every module of the ESB documents is synced.') };
    }
    case 'esbIntegrity': return { title: tr('ESB data in the portal'), source: tr('ESB ↔ Portal'), value: num((c.diffs ?? 0) + (c.details ?? 0) + (c.failedRuns ?? 0)),
      text: (c.diffs || c.details || c.failedRuns)
        ? tr('{0} modules / periods whose count differs from ESB · {1} documents without their lines (out of the COGS and the stock) · {2} last syncs failed. The engine reads them again every 30 minutes and every night for 62 days.', num(c.diffs), num(c.details), num(c.failedRuns))
        : tr('Every ESB document count matches the portal, every document has its lines and every sync succeeded.') };
    case 'so': return { title: tr('Portal stock opname'), source: tr('Portal SO'), value: `${num((c.total ?? 0) - (c.missing ?? 0))}/${num(c.total ?? 0)}`,
      text: (c.missing ? tr('{0} outlets with sales have no portal SO in 8 days: their actual usage and running stock cannot be counted.', num(c.missing))
        : tr('Every outlet with sales has a portal SO in 8 days.')) + ' ' + tr('{0} SO waiting for review, {1} asked to recount.', num(c.waiting), num(c.recount)) };
    case 'waste': return { title: tr('Portal waste'), source: tr('Portal Waste'), value: `${num((c.total ?? 0) - (c.missing ?? 0))}/${num(c.total ?? 0)}`,
      text: (c.missing ? tr('{0} outlets did not report waste on {1}.', num(c.missing), dmy(c.day)) : tr('Every outlet reported its waste on {0}.', dmy(c.day)))
        + ' ' + tr('{0} entries waiting for review (waste counts once approved).', num(c.pending)) };
    case 'gr': return { title: tr('Good Receipts'), source: tr('ESB GR + Portal corrections'), value: num((c.new ?? 0) + (c.open ?? 0)),
      text: tr('{0} GRs still New after 2 days (not in the Stock List and the COGS) · {1} corrected GRs not Finished · {2} unusual lines in 7 days.', num(c.new), num(c.open), num(c.unusual)) };
    case 'prices': return { title: tr('Prices of the materials'), source: tr('Portal Pricelist'), value: num((c.none ?? 0) + (c.esb ?? 0)),
      text: tr('{0} materials used without any price (empty menu HPP and waste value) · {1} priced only by the ESB HPP (not checked by Cost Control).', num(c.none), num(c.esb)) };
    case 'recipes': return { title: tr('Recipe cards'), source: tr('ESB POS + Portal recipe cards'), value: `${num((c.share ?? 0) * 100, 1)}%`,
      text: tr('{0} menus sold in 7 days without a recipe card ({1}% of the portions): their materials are not in the system usage and the purchase estimate.', num(c.menus), num((c.share ?? 0) * 100, 1)) };
    case 'transfers': {
      const b = c.byStatus ?? {};
      return { title: tr('Transfer Stock'), source: tr('Portal Transfer Stock'), value: num(Object.values(b).reduce((s, n) => s + n, 0)),
        text: tr('{0} requested · {1} waiting for Cost Control · {2} on the way (goods not received are in the stock of neither outlet).', num(b.submitted ?? 0), num(b.accepted ?? 0), num(b.approved ?? 0)) };
    }
    default: return { title: c.key, source: c.source, value: c.value, text: c.detail };
  }
}

export function useHealth(keys?: string[]) {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const k = keys?.join(',') ?? '';
  useEffect(() => {
    let live = true;
    call<Health>(`/api/cost-control/health${k ? `?keys=${k}` : ''}`).then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError((e as Error).message); });
    return () => { live = false; };
  }, [k, tick]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}

/** The data sources of a page, simple (2026-11-18): one small chip with the worst state ("Data: Good" / "Data: 2 to
 *  check"); a tap shows each source in a small popover with a link to the Information Center. */
export function DataSources({ keys, className }: { keys: string[]; className?: string }) {
  const { data } = useHealth(keys);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!data) return null;
  const cards = keys.map((k) => data.cards.find((c) => c.key === k)).filter((c): c is Card => !!c);
  if (!cards.length) return null;
  const order: Status[] = ['high', 'error', 'warn', 'ok'];
  const worst = order.find((st) => cards.some((c) => c.status === st)) ?? 'ok';
  const bad = cards.filter((c) => c.status !== 'ok').length;
  const w = STATUS[worst];
  return (
    <div ref={box} className={cx('relative mb-3 inline-block', className)}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cx('inline-flex h-7 items-center gap-1.5 rounded-[4px] border px-2 text-xs font-medium transition-colors', w.tone, 'hover:brightness-95')}>
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{w.icon}</span>
        {tr('Data')}: {bad ? tr('{0} to check', bad) : tr('Good')}
        <ChevronDown size={12} className={cx('transition', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white py-1 shadow-xl">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--j-626F86)]">{tr('Data sources')}</p>
          <ul>
            {cards.map((c) => {
              const d = describe(c);
              const st = STATUS[c.status];
              return (
                <li key={c.key} className="flex items-start gap-2 px-3 py-1.5" title={d.text}>
                  <span className={cx('mt-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5', st.dot)}>{st.icon}</span>
                  <span className="min-w-0 flex-1 text-xs"><span className="block text-[color:var(--j-172B4D)]">{d.title}</span>
                    <span className="block text-[11px] text-[color:var(--j-626F86)]">{d.source}</span></span>
                  <span className="text-xs font-semibold tabular-nums text-[color:var(--j-172B4D)]">{d.value}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/cost-control/info" className="mt-1 flex items-center justify-between border-t border-[color:var(--j-F1F2F4)] px-3 py-2 text-xs font-medium text-[color:var(--j-0C66E4)] hover:bg-[color:var(--j-F7F8F9)]">
            {tr('Information Center')} <ChevronRight size={13} aria-hidden /></Link>
        </div>
      )}
    </div>
  );
}

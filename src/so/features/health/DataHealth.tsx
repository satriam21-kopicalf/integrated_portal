'use client';

// The data checks of Cost Control (integrated_portal_be app/data_health.py, 2026-11-13): the cards of the Information
// Center and the "Sources" line every Cost Control page shows under its title — where its figures come from (ESB /
// Portal), how fresh they are and what is missing, with a link to the Information Center.

import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronRight, Database, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
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
  error: { icon: <XCircle aria-hidden />, label: () => tr('Check failed'), tone: 'text-neutral-700 bg-neutral-100 border-neutral-200', dot: 'text-neutral-500' },
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

/** One quiet line under a page title: the sources of its figures and their state; a tap opens the Information Center. */
export function DataSources({ keys, className }: { keys: string[]; className?: string }) {
  const { data } = useHealth(keys);
  if (!data) return null;
  const cards = keys.map((k) => data.cards.find((c) => c.key === k)).filter((c): c is Card => !!c);
  if (!cards.length) return null;
  return (
    <Link href="/cost-control/info" className={cx('mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs text-neutral-600 shadow-sm hover:border-brand-200 hover:bg-brand-50/40', className)}>
      <span className="flex items-center gap-1.5 font-semibold text-neutral-800"><Database size={13} aria-hidden /> {tr('Data sources')}</span>
      {cards.map((c) => {
        const d = describe(c);
        const s = STATUS[c.status];
        return (
          <span key={c.key} className="inline-flex items-center gap-1" title={d.text}>
            <span className={cx('[&>svg]:h-3.5 [&>svg]:w-3.5', s.dot)}>{s.icon}</span>
            <span className="text-neutral-500">{d.source}</span>
            <span className="font-semibold tabular-nums text-neutral-800">{d.value}</span>
            <span className="sr-only">{s.label()}</span>
          </span>
        );
      })}
      <span className="ml-auto flex items-center gap-0.5 font-medium text-brand-700">{tr('Information Center')} <ChevronRight size={13} aria-hidden /></span>
    </Link>
  );
}

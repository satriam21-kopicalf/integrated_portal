'use client';

// Information Center of Cost Control (page cc.info; integrated_portal_be app/data_health.py, 2026-11-13): how complete
// and fresh the data behind the COGS, the Usage Ratio and the Purchase Estimate is — one card per source (ESB / Portal)
// with its status (icon + label, never colour alone), its figures, what it means for the numbers and the page that
// fixes it; the lists behind a card fold open. The same checks ring the notification bell once a day.

import { ChevronDown, ExternalLink, Gauge, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, cx, ErrorState, Page } from '@/so/ui';
import { Stat, StatSkeleton, StatStrip } from '@/so/ui/StatStrip';
import { Note } from '@/so/ui/Simple';
import { type Card, describe, STATUS, type Status, useHealth } from '@/so/features/health/DataHealth';
import { numberLocale, tr } from '@/lib/i18n';

const ORDER: Status[] = ['high', 'error', 'warn', 'ok'];
const time = (iso: string) => new Date(iso).toLocaleTimeString(numberLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

export default function InfoPage() {
  const { data, error, reload } = useHealth();
  const cards = [...(data?.cards ?? [])].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const c = data?.counts;
  return (
    <Page title={tr('Information Center')} subtitle={tr('How complete and fresh the ESB and Portal data behind the Cost Control figures is')}
      actions={<button type="button" onClick={reload} className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">
        <RefreshCw size={14} /> {tr('Refresh')}</button>}
      stats={
        <StatStrip label={tr('Summary')} columns={4}>
          <Stat label={STATUS.high.label()} emphasis icon={<span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{STATUS.high.icon}</span>} value={c ? <span className={c.high ? 'text-red-700' : undefined}>{c.high}</span> : <StatSkeleton />}>
            {c && <p>{tr('wrong until fixed')}</p>}</Stat>
          <Stat label={STATUS.warn.label()} icon={<span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{STATUS.warn.icon}</span>} value={c ? c.warn : <StatSkeleton />}>
            {c && <p>{tr('to look at today')}</p>}</Stat>
          <Stat label={STATUS.ok.label()} icon={<span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{STATUS.ok.icon}</span>} value={c ? c.ok : <StatSkeleton />}>
            {c && <p>{tr('complete and fresh')}</p>}</Stat>
          <Stat label={tr('Checked at')} icon={<Gauge size={13} />} value={data ? time(data.at) : <StatSkeleton />}>
            {data && <p>{tr('again every 5 minutes')}</p>}</Stat>
        </StatStrip>
      }>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {!data ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-36 rounded-xl" aria-hidden />) : cards.map((card) => <HealthCard key={card.key} card={card} />)}
        </div>
      )}
      <Note tone="muted" className="mt-4" title={tr('How to read it')}>
        {tr('Figures affected: the COGS, Usage Ratio or Purchase Estimate of the outlets concerned are wrong until it is fixed. Check: the figures still hold, but something waits for the team. The bell sends the ones not good once a day from 09:00.')}
      </Note>
    </Page>
  );
}

function HealthCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  const d = describe(card);
  const s = STATUS[card.status];
  const items = card.items ?? [];
  return (
    <section className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span className={cx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border [&>svg]:h-4.5 [&>svg]:w-4.5', s.tone)}>{s.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">{d.title}</h2>
            <Badge tone={card.status === 'ok' ? 'green' : card.status === 'warn' ? 'amber' : card.status === 'high' ? 'red' : 'slate'}>{s.label()}</Badge>
          </div>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{tr('Source')}: {d.source}</p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">{card.status === 'error' ? card.detail : d.text}</p>
        </div>
        <span className="flex-shrink-0 text-right text-xl font-semibold tabular-nums text-neutral-900">{d.value}</span>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-neutral-100 px-4 py-2">
        {items.length > 0 && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900">
            <ChevronDown size={14} className={cx('transition-transform', open && 'rotate-180')} /> {open ? tr('Hide the list') : tr('Show the list ({0})', items.length)}
          </button>
        )}
        {card.link && <Link href={card.link} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">{tr('Open')} <ExternalLink size={12} /></Link>}
      </div>
      {open && items.length > 0 && (
        <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto border-t border-neutral-100 text-xs">
          {items.map((it, i) => (
            <li key={`${it.code ?? it.id ?? it.module ?? i}`} className="flex items-center gap-2 px-4 py-1.5">
              {it.status && <span className={cx('[&>svg]:h-3.5 [&>svg]:w-3.5', STATUS[it.status].dot)}>{STATUS[it.status].icon}</span>}
              <span className="min-w-0 flex-1 truncate text-neutral-800">{it.name}</span>
              {it.module ? <span className="tabular-nums text-neutral-500">{tr('doc {0} · {1} in 7 days{2}', it.lastDoc ? it.lastDoc.split('-').reverse().join('/') : '—', it.week ?? 0, it.drafts ? ` · ${tr('{0} drafts', it.drafts)}` : '')}</span>
                : it.level ? <span className={it.level === 'none' ? 'text-red-700' : 'text-amber-700'}>{it.level === 'none' ? tr('no price') : tr('ESB HPP')}</span>
                  : it.qty != null ? <span className="tabular-nums text-neutral-500">{tr('{0} sold', it.qty.toLocaleString(numberLocale()))}</span>
                    : <span className="text-neutral-400">{it.code}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

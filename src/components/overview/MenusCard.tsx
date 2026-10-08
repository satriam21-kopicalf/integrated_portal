'use client';

import { useState } from 'react';
import HBarChart from '@/components/charts/HBarChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, deltaText, MenusResponse, useOverview } from '@/lib/overview';
import { Card, Segmented } from './Card';
import { useDrill } from './drill/DrillContext';

type Tab = 'top' | 'categories' | 'addons';

/** Category colours for the sub-category bars (identity, fixed order). */
const CATEGORY_COLORS: Record<string, string> = { BEVERAGE: '#2a78d6', FOOD: '#eb6834', OTHER: '#a8a29e' };

export default function MenusCard({ query }: { query: string }) {
  const [tab, setTab] = useState<Tab>('top');
  const [sort, setSort] = useState<'subtotal' | 'qty'>('subtotal');
  const resource = useOverview<MenusResponse>('menus', `${query}&limit=10&sort=${sort}`);
  const drill = useDrill();

  return (
    <Card
      title="Menus"
      info="menus"
      subtitle="What sells: ordered menus (add-ons counted separately) · click a menu for its details"
      resource={resource}
      minHeight={420}
      onOpen={() => drill.open({ kind: 'menus' })}
      actions={
        <Segmented
          label="Menu view"
          value={tab}
          options={[{ value: 'top', label: 'Top 10' }, { value: 'categories', label: 'Categories' }, { value: 'addons', label: 'Add-ons' }]}
          onChange={setTab}
        />
      }
    >
      {data => {
        if (tab === 'categories') {
          const details = data.categories
            .flatMap(c => c.details.map(d => ({ ...d, category: c.category })))
            .sort((a, b) => b.subtotal - a.subtotal)
            .slice(0, 10);
          return (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.categories.map(c => (
                  <div key={c.category} className="min-w-[7rem] flex-1 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORY_COLORS[c.category] ?? '#a8a29e' }} />
                      {c.category}
                    </p>
                    <p className="text-base font-semibold text-slate-900">{c.share === null ? '-' : `${c.share.toFixed(1)}%`}</p>
                    <p className="text-[11px] text-slate-500">{compactRupiah(c.subtotal)}
                      {c.deltaPct !== undefined && c.deltaPct !== null && <span className={c.deltaPct >= 0 ? ' text-emerald-700' : ' text-red-700'}> {deltaText(c.deltaPct)}</span>}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-slate-500">Top sub-categories</p>
              <HBarChart
                ariaLabel="Gross sales per menu sub-category"
                items={details.map(d => ({
                  key: `${d.category}-${d.name}`,
                  label: d.name,
                  value: d.subtotal,
                  display: compactRupiah(d.subtotal),
                  color: CATEGORY_COLORS[d.category] ?? '#a8a29e',
                  tip: { rows: [[formatCurrency(d.subtotal), 'sales'], [`${formatNumber(d.qty)} pcs`, d.category]] },
                }))}
                rowHeight={26}
              />
            </div>
          );
        }
        if (tab === 'addons') {
          if (!data.addons.length) return <p className="py-6 text-center text-sm text-slate-400">No add-ons in this period</p>;
          return (
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {data.addons.slice(0, 4).map(g => (
                <div key={g.group} className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">{g.group}</span>
                    <span className="tabular-nums text-slate-400">{formatNumber(g.qty)} pcs</span>
                  </div>
                  <HBarChart
                    ariaLabel={`${g.group} choices`}
                    max={100}
                    labelWidth={110}
                    rowHeight={26}
                    items={g.options.slice(0, 5).map(o => ({
                      key: `${g.group}-${o.menuId}`,
                      label: o.name,
                      value: o.share ?? 0,
                      display: o.share === null ? '-' : `${o.share.toFixed(1)}%`,
                      tip: { rows: [[`${formatNumber(o.qty)} pcs`, 'ordered'], ...(o.subtotal ? [[formatCurrency(o.subtotal), 'sales'] as [string, string]] : [])] },
                    }))}
                  />
                </div>
              ))}
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {compactRupiah(data.totals.subtotal)} · {formatNumber(data.totals.qty)} pcs ordered
                {data.totals.previousSubtotal !== undefined && (
                  <> · vs {compactRupiah(data.totals.previousSubtotal)}{' '}
                    <span className={(data.totals.deltaPct ?? 0) >= 0 ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{deltaText(data.totals.deltaPct)}</span></>
                )}
              </p>
              <Segmented label="Rank by" value={sort} options={[{ value: 'subtotal', label: 'Gross sales' }, { value: 'qty', label: 'Qty' }]} onChange={setSort} />
            </div>
            <HBarChart
              ariaLabel={`Top 10 menus by ${sort === 'qty' ? 'quantity' : 'sales'}`}
              items={data.top.map((m, i) => ({
                key: m.menuId,
                label: `${i + 1}. ${m.name}`,
                value: sort === 'qty' ? m.qty : m.subtotal,
                display: (sort === 'qty' ? `${formatNumber(m.qty)} pcs` : `${compactRupiah(m.subtotal)} · ${m.share?.toFixed(1) ?? '-'}%`)
                  + (m.deltaPct !== undefined ? ` · ${deltaText(sort === 'qty' ? m.qtyDeltaPct : m.deltaPct) || 'new'}` : ''),
                tip: {
                  rows: [[formatCurrency(m.subtotal), 'sales'], [`${formatNumber(m.qty)} pcs`, 'ordered'], [formatNumber(m.bills), 'bills'],
                    ...(m.previousSubtotal !== undefined ? [[formatCurrency(m.previousSubtotal), 'comparison period'] as [string, string],
                      [`${formatNumber(m.previousQty ?? 0)} pcs`, 'comparison period'] as [string, string]] : [])],
                  footer: `${m.category} · ${m.categoryDetail}`,
                },
              }))}
              labelWidth={190}
              onSelect={key => {
                const m = data.top.find(x => x.menuId === key);
                if (m) drill.open({ kind: 'menu', menuId: m.menuId, menuKind: 'menu', name: m.name });
              }}
            />
          </div>
        );
      }}
    </Card>
  );
}

'use client';

import { useState } from 'react';
import BarList from '@/components/charts/BarList';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, MenusResponse, useOverview } from '@/lib/overview';
import { Card, Segmented } from './Card';

type Tab = 'top' | 'categories' | 'addons';

export default function MenusCard({ query }: { query: string }) {
  const [tab, setTab] = useState<Tab>('top');
  const [sort, setSort] = useState<'subtotal' | 'qty'>('subtotal');
  const resource = useOverview<MenusResponse>('menus', `${query}&limit=10&sort=${sort}`);

  return (
    <Card
      title="Menus"
      subtitle="Ordered menus of ESB sales (packages and extras separately)"
      resource={resource}
      minHeight={380}
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
          return (
            <div className="space-y-4">
              {data.categories.map(c => (
                <div key={c.category}>
                  <div className="mb-2 flex items-baseline justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">{c.category}</span>
                    <span className="tabular-nums text-slate-500">
                      {compactRupiah(c.subtotal)} · {c.share === null ? '-' : `${c.share.toFixed(1)}%`}
                    </span>
                  </div>
                  <BarList
                    max={data.categories[0]?.details[0]?.subtotal}
                    items={c.details.slice(0, 6).map(d => ({
                      key: `${c.category}-${d.name}`,
                      label: d.name,
                      value: d.subtotal,
                      display: compactRupiah(d.subtotal),
                      detail: `${formatCurrency(d.subtotal)} · ${formatNumber(d.qty)} pcs`,
                    }))}
                  />
                </div>
              ))}
            </div>
          );
        }
        if (tab === 'addons') {
          return (
            <div className="space-y-4">
              {data.addons.slice(0, 4).map(g => (
                <div key={g.group}>
                  <div className="mb-2 flex items-baseline justify-between text-xs">
                    <span className="font-semibold uppercase tracking-wide text-slate-500">{g.group}</span>
                    <span className="tabular-nums text-slate-500">{formatNumber(g.qty)} pcs</span>
                  </div>
                  <BarList
                    max={100}
                    items={g.options.slice(0, 5).map(o => ({
                      key: `${g.group}-${o.menuId}`,
                      label: o.name,
                      value: o.share ?? 0,
                      display: o.share === null ? '-' : `${o.share.toFixed(1)}%`,
                      detail: `${formatNumber(o.qty)} pcs${o.subtotal ? ` · ${formatCurrency(o.subtotal)}` : ''}`,
                    }))}
                  />
                </div>
              ))}
              {!data.addons.length && <p className="py-6 text-center text-sm text-slate-400">No add-ons in this period</p>}
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {compactRupiah(data.totals.subtotal)} · {formatNumber(data.totals.qty)} pcs ordered
              </p>
              <Segmented label="Rank by" value={sort} options={[{ value: 'subtotal', label: 'Sales' }, { value: 'qty', label: 'Qty' }]} onChange={setSort} />
            </div>
            <BarList
              items={data.top.map(m => ({
                key: m.menuId,
                label: m.name,
                sublabel: m.categoryDetail,
                value: sort === 'qty' ? m.qty : m.subtotal,
                display: sort === 'qty' ? `${formatNumber(m.qty)} pcs` : `${compactRupiah(m.subtotal)} · ${m.share === null ? '-' : `${m.share.toFixed(1)}%`}`,
                detail: `${formatCurrency(m.subtotal)} · ${formatNumber(m.qty)} pcs · ${formatNumber(m.bills)} bills`,
              }))}
              leading={(_, i) => <span className="w-4 flex-shrink-0 text-xs tabular-nums text-slate-400">{i + 1}</span>}
            />
          </div>
        );
      }}
    </Card>
  );
}

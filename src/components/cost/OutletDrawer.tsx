'use client';

import { useMemo, useState } from 'react';
import { Store } from 'lucide-react';
import CostTrendCard from '@/components/cost/CostTrendCard';
import StatusBadge from '@/components/cost/StatusBadge';
import { ReliabilityPill } from '@/components/cost/ReliabilityBanner';
import InfoTip from '@/components/ui/InfoTip';
import { Segmented } from '@/components/overview/Card';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import {
  Basis, cogsPct, cogsStatus, CostSettings, ForecastResponse, ItemsResponse, OutletCost, pctText, sales, useCostControl,
} from '@/lib/costControl';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { Resource } from '@/lib/overview';
import { OutletReliability, RELIABILITY } from '@/lib/costReliability';
import type { InfoKey } from '@/lib/metricInfo';

const qty = (v: number) => formatNumber(Math.round(v * 100) / 100);

/** One outlet: headline figures, trend, item usage & variance, purchase forecast per item. */
export default function OutletDrawer({ outlet, basis, query, settings, reliability, defaultGrain, onClose }: {
  outlet: OutletCost;
  basis: Basis;
  query: string;
  settings: CostSettings | undefined;
  reliability?: OutletReliability;
  defaultGrain?: 'period' | 'month';
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'items' | 'forecast'>('items');
  const branchQ = `${query}&branch=${encodeURIComponent(outlet.branchCode)}&limit=500`;
  const items = useCostControl<ItemsResponse>('items', branchQ);
  const forecast = useCostControl<ForecastResponse>('forecast', `branch=${encodeURIComponent(outlet.branchCode)}`, tab === 'forecast');
  const excess = outlet.actualCogs - outlet.theoreticalCogs;
  const s = sales(outlet, basis);

  return (
    <Drawer open onClose={onClose} size="lg" icon={<Store size={18} />} title={outlet.branchName}
      description={`${outlet.branchCode} · ${outlet.periods} opname period(s)`}
      titleExtra={reliability ? <ReliabilityPill level={reliability.level} /> : undefined}>
      <div className="space-y-6">
        {reliability && reliability.reasons.length > 0 && (
          <div className={`rounded-lg border px-3 py-2.5 text-xs ${reliability.level === 'check' ? 'border-red-200 bg-red-50/60 text-red-900' : 'border-amber-200 bg-amber-50/70 text-amber-900'}`}>
            <p className="flex items-center gap-1.5 font-semibold">
              {reliability.level === 'check' ? 'Check these figures — data errors in ESB' : 'Provisional figures'}
              <InfoTip info="costReliability" />
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {reliability.reasons.map(r => <li key={r.text} className={r.level === 'check' ? RELIABILITY.check.text : ''}>{r.text}</li>)}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3">
          <Figure label={basis === 'net' ? 'Net sales' : 'Subtotal'} info="costSales" value={formatCurrency(Math.round(s))}>
            <span className="text-xs text-slate-500">{formatNumber(outlet.bills)} bills</span>
          </Figure>
          <Figure label="Actual COGS" info="costActual" value={formatCurrency(Math.round(outlet.actualCogs))}>
            <StatusBadge status={cogsStatus(outlet, basis)} value={pctText(cogsPct(outlet, basis, 'actual'))} />
          </Figure>
          <Figure label="Recipes (theoretical)" info="costTheoretical" value={formatCurrency(Math.round(outlet.theoreticalCogs))}>
            <span className="text-xs text-slate-500">{pctText(cogsPct(outlet, basis, 'theoretical'))} of sales</span>
          </Figure>
          <Figure label="Excess vs recipes" info="costExcess" value={outlet.hasOpname ? `${excess > 0 ? '+' : ''}${formatCurrency(Math.round(excess))}` : 'no opname'}
            tone={!outlet.hasOpname ? undefined : excess > 0.5 ? 'bad' : 'good'}>
            {outlet.hasOpname && <StatusBadge status={outlet.status.usage} value={`usage ${pctText(outlet.usageRatio)}`} />}
          </Figure>
          <Figure label="Stock variance" info="costVariance" value={formatCurrency(Math.round(outlet.variance))} tone={outlet.variance < -0.5 ? 'bad' : undefined}>
            <span className="text-xs text-slate-500">
              posted {formatCurrency(Math.round(outlet.postedVariance))}{outlet.pendingVariance ? ` · pending ${formatCurrency(Math.round(outlet.pendingVariance))}` : ''}
            </span>
          </Figure>
          <Figure label="Other usage" info="costOther" value={formatCurrency(Math.round(outlet.otherUsage))}>
            <StatusBadge status={outlet.status.waste} value={pctText(basis === 'net' ? outlet.wastePctNet : outlet.wastePctSubtotal)} />
          </Figure>
          <Figure label="Purchases" info="costPurchases" value={formatCurrency(Math.round(outlet.purchases))}>
            <span className="text-xs text-slate-500">{pctText(s ? (outlet.purchases / s) * 100 : null)} of sales</span>
          </Figure>
          <Figure label="Stock (book)" value={formatCurrency(Math.round(outlet.endValue))}>
            <span className="text-xs text-slate-500">from {formatCurrency(Math.round(outlet.beginValue))}</span>
          </Figure>
          <Figure label="Stock opname" value={outlet.opnameCount ? `${outlet.opnameCount}×` : 'none'}>
            <span className="text-xs text-slate-500">
              {outlet.lastOpnameDate ? `last ${formatDate(outlet.lastOpnameDate)}` : 'no count in this range'}
              {outlet.pendingOpnameCount ? ` · ${outlet.pendingOpnameCount} not posted` : ''}
            </span>
          </Figure>
        </dl>

        <CostTrendCard query={query} basis={basis} settings={settings} branch={outlet.branchCode} defaultGrain={defaultGrain} />

        <DrawerSection title="Items" description="Usage vs recipes and stock variance per item, or the purchase need for the coming weeks.">
          <Segmented label="Item view" value={tab} options={[{ value: 'items', label: 'Usage & variance' }, { value: 'forecast', label: 'Purchase forecast' }]} onChange={setTab} />
          {tab === 'items' ? <ItemsTable resource={items} /> : <ForecastItems resource={forecast} />}
        </DrawerSection>
      </div>
    </Drawer>
  );
}

function Figure({ label, value, children, info, tone }: {
  label: string; value: string; children?: React.ReactNode; info?: InfoKey; tone?: 'good' | 'bad';
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}{info && <InfoTip info={info} />}</dt>
      <dd className={`mt-1 truncate text-base font-semibold tabular-nums ${tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900'}`} title={value}>{value}</dd>
      {children && <dd className="mt-1">{children}</dd>}
    </div>
  );
}

function ItemsTable({ resource }: { resource: Resource<ItemsResponse> }) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (resource.data?.items ?? []).filter(i => !s || i.productName.toLowerCase().includes(s) || (i.productCode ?? '').toLowerCase().includes(s));
  }, [resource.data, q]);
  if (resource.error) return <p className="text-sm text-red-600">{resource.error}</p>;
  if (!resource.data) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />;
  return (
    <div className="space-y-2">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search item"
        className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Search item" />
      <div className="custom-scrollbar max-h-[420px] overflow-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium" title="Recipe usage from sold menus">Theoretical</th>
              <th className="px-3 py-2 text-right font-medium">Actual</th>
              <th className="px-3 py-2 text-right font-medium">Usage</th>
              <th className="px-3 py-2 text-right font-medium" title="Physical minus system stock; negative = loss">Variance</th>
              <th className="px-3 py-2 text-right font-medium">Other usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(i => (
              <tr key={i.productId} className="hover:bg-slate-50/60">
                <td className="max-w-[14rem] px-3 py-1.5">
                  <span className="block truncate font-medium text-slate-800" title={i.productName}>{i.productName}</span>
                  <span className="text-[11px] text-slate-400">{i.productCode ?? ''}{i.category ? ` · ${i.category}` : ''}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.theoreticalQty)} {i.unit ?? ''}<span className="block text-[11px] text-slate-400">{formatCurrency(Math.round(i.theoreticalValue))}</span></td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.actualQty)} {i.unit ?? ''}<span className="block text-[11px] text-slate-400">{formatCurrency(Math.round(i.actualValue))}</span></td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right"><StatusBadge status={i.status} value={pctText(i.usageRatio)} /></td>
                <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${i.varianceValue < -0.5 ? 'text-red-700' : 'text-slate-600'}`}>
                  {qty(i.varianceQty)} {i.unit ?? ''}<span className="block text-[11px]">{formatCurrency(Math.round(i.varianceValue))}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-600">{formatCurrency(Math.round(i.otherValue))}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No items</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">Sorted by largest loss first. Quantities in the item&apos;s base unit; values at ESB HPP.</p>
    </div>
  );
}

function ForecastItems({ resource }: { resource: Resource<ForecastResponse> }) {
  if (resource.error) return <p className="text-sm text-red-600">{resource.error}</p>;
  if (!resource.data) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />;
  const d = resource.data;
  const o = d.outlets[0];
  if (!d.items.length) return <p className="py-8 text-center text-sm text-slate-400">No usage in the last {d.settings.lookback_days} days to plan from yet</p>;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200">
        {([['1 week', d.totals.spend7], ['2 weeks', d.totals.spend14], ['1 month', d.totals.spend30]] as const).map(([l, v]) => (
          <div key={l} className="bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{l}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(Math.round(v))}</p>
          </div>
        ))}
      </div>
      {o && (
        <p className="text-[11px] text-slate-500">
          Usage of the last {o.lookbackDays} days × sales trend {((o.trendFactor - 1) * 100).toFixed(1)}% + {d.settings.safety_days} days safety stock − current stock.
          Average purchases so far: {formatCurrency(Math.round(o.avgWeeklyPurchases))} per week.
        </p>
      )}
      <div className="custom-scrollbar max-h-[420px] overflow-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Per day</th>
              <th className="px-3 py-2 text-right font-medium">Stock</th>
              <th className="px-3 py-2 text-right font-medium">Need 1 wk</th>
              <th className="px-3 py-2 text-right font-medium">Need 2 wk</th>
              <th className="px-3 py-2 text-right font-medium">Need 1 mo</th>
              <th className="px-3 py-2 text-right font-medium">Spend 1 mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.items.map(i => (
              <tr key={i.productId} className="hover:bg-slate-50/60">
                <td className="max-w-[13rem] px-3 py-1.5">
                  <span className="block truncate font-medium text-slate-800" title={i.productName}>{i.productName}</span>
                  <span className="text-[11px] text-slate-400">{i.basedOn === 'actual' ? 'actual usage' : 'recipe usage'} · {formatCurrency(Math.round(i.unitCost * 100) / 100)}/{i.unit ?? 'unit'}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.dailyUsage)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.stock)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.need7)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.need14)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{qty(i.need30)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-medium text-slate-800">{formatCurrency(Math.round(i.spend30))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

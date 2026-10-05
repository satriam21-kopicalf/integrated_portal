'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, Info, RotateCw, SlidersHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangePicker, { DatePreset } from '@/components/DateRangePicker';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { Segmented } from '@/components/overview/Card';
import CostTrendCard from '@/components/cost/CostTrendCard';
import ForecastCard from '@/components/cost/ForecastCard';
import OutletDrawer from '@/components/cost/OutletDrawer';
import OutletTable from '@/components/cost/OutletTable';
import SettingsDrawer from '@/components/cost/SettingsDrawer';
import StatusBadge from '@/components/cost/StatusBadge';
import { useAuth } from '@/lib/auth';
import {
  Basis, bandText, cogsPct, cogsStatus, CostSettings, MetaResponse, OutletCost, pctText, sales, STATUS,
  STATUS_ORDER, SummaryResponse, useCostControl,
} from '@/lib/costControl';
import { formatCurrency, formatDate, formatDateTime, formatNumber, toIsoDate } from '@/lib/format';

function presets(): DatePreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return [
    { label: 'This month', from: toIsoDate(new Date(y, m, 1)), to: toIsoDate(yesterday) },
    { label: 'Last month', from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'Last 3 months', from: toIsoDate(new Date(y, m - 3, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'Last 6 months', from: toIsoDate(new Date(y, m - 6, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'This year', from: toIsoDate(new Date(y, 0, 1)), to: toIsoDate(yesterday) },
  ];
}

interface Filters { from: string; to: string; basis: Basis }

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return { from: p.get('from') ?? '', to: p.get('to') ?? '', basis: p.get('basis') === 'subtotal' ? 'subtotal' : 'net' };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.basis !== 'net') p.set('basis', f.basis);
  const qs = p.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

export default function CostControlPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [settingsOverride, setSettingsOverride] = useState<CostSettings | null>(null);
  const meta = useCostControl<MetaResponse>('meta', '');

  useEffect(() => setFilters(readUrl()), []);

  const update = (patch: Partial<Filters>) => setFilters(f => {
    const next = { ...(f ?? { from: '', to: '', basis: 'net' as Basis }), ...patch };
    writeUrl(next);
    return next;
  });

  const from = filters?.from ?? '';
  const to = filters?.to ?? '';
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('dateFrom', from);
    if (to) p.set('dateTo', to);
    return p.toString();
  }, [from, to]);

  const summary = useCostControl<SummaryResponse>('summary', query, filters !== null);
  const settings = settingsOverride ?? summary.data?.settings ?? meta.data?.settings;
  const basis = filters?.basis ?? 'net';
  const outlet = selected ? summary.data?.outlets.find(o => o.branchCode === selected) ?? null : null;
  const fresh = meta.data?.freshness;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl"><Calculator size={20} className="text-blue-700" /> Cost Control</h1>
              <p className="text-xs text-slate-500 sm:text-sm">COGS, usage &amp; purchase planning per outlet</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Segmented label="Ratio basis" value={basis} options={[{ value: 'net', label: 'Net sales' }, { value: 'subtotal', label: 'Subtotal' }]} onChange={b => update({ basis: b })} />
              <DateRangePicker dateFrom={filters?.from ?? ''} dateTo={filters?.to ?? ''} onChange={(from, to) => update({ from, to })} presets={presets} defaultLabel="this month" />
              {user?.role === 'superadmin' && settings && (
                <button type="button" onClick={() => setEditing(true)} title="Thresholds & forecast settings"
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <SlidersHorizontal size={16} /><span className="hidden sm:inline">Settings</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <p className="text-xs text-slate-500 sm:text-sm">
            {summary.data ? (
              <>
                <span className="font-medium text-slate-900">{formatDate(summary.data.filters.dateFrom)} – {formatDate(summary.data.filters.dateTo)}</span>
                {' '}· {summary.data.periods.length} opname period(s) · ratios on {basis === 'net' ? 'net sales' : 'subtotal'}
                {fresh?.refreshedAt && <> · updated {formatDateTime(fresh.refreshedAt)}</>}
              </>
            ) : <span className="inline-block h-4 w-72 animate-pulse rounded bg-slate-200 align-middle" />}
          </p>

          {summary.error && !summary.loading ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
              <AlertTriangle className="text-amber-500" />
              <p className="text-sm text-slate-600">{summary.error}</p>
              <button type="button" onClick={summary.retry} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><RotateCw size={13} /> Try again</button>
            </div>
          ) : (
            <Headline data={summary.data} basis={basis} />
          )}

          {settings && summary.data && <StatusScale data={summary.data} settings={settings} basis={basis} />}

          <div className="grid gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-7"><CostTrendCard query={query} basis={basis} settings={settings} /></div>
            <div className="min-w-0 xl:col-span-5"><ForecastCard onSelect={setSelected} /></div>
          </div>

          <section className="space-y-3">
            <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Outlets<span className="h-px flex-1 bg-slate-200" aria-hidden />
            </h2>
            {summary.data ? (
              <OutletTable outlets={summary.data.outlets} basis={basis} onSelect={(o: OutletCost) => setSelected(o.branchCode)} />
            ) : <div className="h-64 animate-pulse rounded-xl bg-slate-100" />}
          </section>

          <HowToRead />
        </div>
      </div>

      {outlet && <OutletDrawer outlet={outlet} basis={basis} query={query} settings={settings} onClose={() => setSelected(null)} />}
      {editing && settings && (
        <SettingsDrawer settings={settings} onClose={() => setEditing(false)}
          onSaved={s => { setSettingsOverride(s); setEditing(false); summary.retry(); }} />
      )}
    </DashboardLayout>
  );
}

function Headline({ data, basis }: { data: SummaryResponse | null; basis: Basis }) {
  if (!data) {
    return (
      <StatStrip label="Cost summary" columns={5}>
        {Array.from({ length: 5 }).map((_, i) => <Stat key={i} label="…" value={<StatSkeleton />} />)}
      </StatStrip>
    );
  }
  const t = data.total;
  const med = basis === 'net' ? data.medians.actualPctNet : data.medians.actualPctSubtotal;
  const gap = basis === 'net' ? t.gapPpNet : t.gapPpSubtotal;
  return (
    <StatStrip label="Cost summary" columns={5}>
      <Stat label={basis === 'net' ? 'Net sales' : 'Subtotal'} value={formatCurrency(Math.round(sales(t, basis)))}>
        <p>{formatNumber(t.bills)} bills · {data.outlets.filter(o => sales(o, basis) > 0).length} outlets</p>
      </Stat>
      <Stat label="Actual COGS" value={formatCurrency(Math.round(t.actualCogs))} emphasis>
        <p className="flex flex-wrap items-center gap-1.5"><StatusBadge status={cogsStatus(t, basis)} value={pctText(cogsPct(t, basis, 'actual'))} /> of sales</p>
        <p>Outlet median {pctText(med)}</p>
      </Stat>
      <Stat label="Theoretical COGS" value={formatCurrency(Math.round(t.theoreticalCogs))}>
        <p>{pctText(cogsPct(t, basis, 'theoretical'))} of sales · sold menus × recipes</p>
      </Stat>
      <Stat label="Usage ratio" value={t.hasOpname ? pctText(t.usageRatio) : '–'}>
        <p className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={t.status.gapNet} value={gap === null ? '–' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`} /> vs recipes
        </p>
        <p>Outlet median {pctText(data.medians.usageRatio)}</p>
      </Stat>
      <Stat label="Stock variance" value={formatCurrency(Math.round(t.variance))}>
        <p>{t.pendingVariance ? `incl. ${formatCurrency(Math.round(t.pendingVariance))} not posted · ` : ''}{t.opnameCount} opname(s)</p>
        <p>Other usage {formatCurrency(Math.round(t.otherUsage))} ({pctText(basis === 'net' ? t.wastePctNet : t.wastePctSubtotal)})</p>
      </Stat>
    </StatStrip>
  );
}

function StatusScale({ data, settings, basis }: { data: SummaryResponse; settings: CostSettings; basis: Basis }) {
  const counts: Record<string, number> = {};
  for (const o of data.outlets) {
    const s = cogsStatus(o, basis);
    if (s && sales(o, basis) > 0) counts[s] = (counts[s] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const ranges = bandText(settings.cogs_bands);
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5" aria-label="Outlets by COGS status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Outlets by actual COGS</h2>
        <p className="text-xs text-slate-500">% of {basis === 'net' ? 'net sales' : 'subtotal'} · thresholds editable in Settings</p>
      </div>
      <div className="mt-2.5 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {STATUS_ORDER.map(s => counts[s] ? <div key={s} style={{ width: `${(counts[s] / total) * 100}%`, background: STATUS[s].dot }} className="border-r-2 border-white last:border-r-0" /> : null)}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {STATUS_ORDER.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <StatusBadge status={s} />
            <span className="tabular-nums text-slate-700">{counts[s] ?? 0} outlets</span>
            <span className="text-slate-400">{ranges[i]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowToRead() {
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:px-5">
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-slate-900"><Info size={16} className="text-blue-700" /> How the figures are calculated</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs leading-relaxed">
        <li><b>Theoretical COGS</b>: every sold menu × its recipe (ESB BOM) at the outlet&apos;s HPP — what the outlet should have used.</li>
        <li><b>Actual COGS</b>: theoretical + other usage (item journal: waste, R&amp;D, marketing) − stock variance found at the stock opname.</li>
        <li><b>Stock variance</b>: physical minus system stock at opname, valued at HPP; negative is a loss. Opnames not yet posted in ESB (Draft/New) are counted as <i>pending</i>.</li>
        <li><b>Usage ratio</b>: actual ÷ theoretical usage; 100% means exactly as the recipes say. Only meaningful when an opname was taken in the period.</li>
        <li><b>Periods</b> follow the opname rhythm (1–7, 8–14, 15–21, 22–end of month); a date range covers every period starting in it. Weekly figures swing with the opname timing — compare months for a stable view.</li>
        <li><b>Ratio basis</b>: net sales (after discounts) is the standard; subtotal (before discounts) shows the effect of promotions.</li>
        <li>Data comes from ESB (inventory valuation, stock opname, POS sales) and is refreshed every night.</li>
      </ul>
    </details>
  );
}


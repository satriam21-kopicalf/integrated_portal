'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpen, RotateCw, SlidersHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BranchFilter, { Branch, branchesLabel } from '@/components/BranchFilter';
import DateRangePicker, { DatePreset } from '@/components/DateRangePicker';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { Segmented } from '@/components/overview/Card';
import CostGuide from '@/components/cost/CostGuide';
import CostTrendCard from '@/components/cost/CostTrendCard';
import DataIssues from '@/components/cost/DataIssues';
import ForecastCard from '@/components/cost/ForecastCard';
import OutletDrawer from '@/components/cost/OutletDrawer';
import OutletTable, { outletStatus, StatusMetric } from '@/components/cost/OutletTable';
import ReliabilityBanner from '@/components/cost/ReliabilityBanner';
import SettingsDrawer from '@/components/cost/SettingsDrawer';
import StatusBadge from '@/components/cost/StatusBadge';
import InfoTip from '@/components/ui/InfoTip';
import { useAuth } from '@/lib/auth';
import {
  Basis, bandText, Bands, cogsPct, cogsStatus, CostSettings, IssuesResponse, MetaResponse, OutletCost, pctText, sales, Status,
  STATUS, STATUS_ORDER, SummaryResponse, useCostControl,
} from '@/lib/costControl';
import { networkReliability } from '@/lib/costReliability';
import { formatCurrency, formatDate, formatNumber, toIsoDate, fixed } from '@/lib/format';
import type { InfoKey } from '@/lib/metricInfo';
import { tr } from '@/lib/i18n';

function presets(): DatePreset[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return [
    { label: tr('This month'), from: toIsoDate(new Date(y, m, 1)), to: toIsoDate(yesterday) },
    { label: tr('Last month'), from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: tr('Last 3 months'), from: toIsoDate(new Date(y, m - 3, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: tr('Last 6 months'), from: toIsoDate(new Date(y, m - 6, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: tr('This year'), from: toIsoDate(new Date(y, 0, 1)), to: toIsoDate(yesterday) },
  ];
}

interface Filters { from: string; to: string; branch: string; basis: Basis }

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return { from: p.get('from') ?? '', to: p.get('to') ?? '', branch: p.get('branch') ?? '', basis: p.get('basis') === 'subtotal' ? 'subtotal' : 'net' };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.branch) p.set('branch', f.branch);
  if (f.basis !== 'net') p.set('basis', f.basis);
  const qs = p.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

const days = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

export default function CostControlPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [guide, setGuide] = useState(false);
  const [metric, setMetric] = useState<StatusMetric>('usage');
  const [status, setStatus] = useState<Status | ''>('');
  const [settingsOverride, setSettingsOverride] = useState<CostSettings | null>(null);
  const meta = useCostControl<MetaResponse>('meta', '');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const issuesRef = useRef<HTMLElement>(null);
  const outletsRef = useRef<HTMLElement>(null);

  useEffect(() => setFilters(readUrl()), []);
  useEffect(() => {
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, []);

  const update = (patch: Partial<Filters>) => setFilters(f => {
    const next = { ...(f ?? { from: '', to: '', branch: '', basis: 'net' as Basis }), ...patch };
    writeUrl(next);
    return next;
  });

  const from = filters?.from ?? '';
  const to = filters?.to ?? '';
  const branch = filters?.branch ?? '';
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set('dateFrom', from);
    if (to) p.set('dateTo', to);
    if (branch) p.set('branch', branch);
    return p.toString();
  }, [from, to, branch]);

  const summary = useCostControl<SummaryResponse>('summary', query, filters !== null);
  const issues = useCostControl<IssuesResponse>('issues', query, filters !== null);
  const settings = settingsOverride ?? summary.data?.settings ?? meta.data?.settings;
  const basis = filters?.basis ?? 'net';
  const outlet = selected ? summary.data?.outlets.find(o => o.branchCode === selected) ?? null : null;
  const fresh = meta.data?.freshness;
  const network = useMemo(() => (summary.data ? networkReliability(summary.data.outlets, issues.data) : null), [summary.data, issues.data]);
  const range = summary.data?.filters;
  // months are one or two points on short ranges: show opname periods there
  const grain: 'period' | 'month' = range && days(range.dateFrom, range.dateTo) > 70 ? 'month' : 'period';
  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{tr('Cost Control')}</h1>
              <p className="text-xs text-slate-500 sm:text-sm">{tr('COGS, usage vs recipes & purchase planning per outlet')}</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Segmented label={tr('Ratio basis')} value={basis} options={[{ value: 'net', label: tr('Net sales') }, { value: 'subtotal', label: tr('Subtotal') }]} onChange={b => update({ basis: b })} />
              <DateRangePicker dateFrom={from} dateTo={to} onChange={(f, t) => update({ from: f, to: t })} presets={presets} defaultLabel={tr('this month')} />
              <BranchFilter branches={branches} loading={branchesLoading} value={branch} onChange={b => update({ branch: b })} />
              <button type="button" onClick={() => setGuide(true)} title={tr('Terms, formulas and how reliable the figures are')}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <BookOpen size={16} /><span className="hidden sm:inline">{tr('Guide')}</span>
              </button>
              {user?.role === 'superadmin' && settings && (
                <button type="button" onClick={() => setEditing(true)} title={tr('Thresholds & forecast settings')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <SlidersHorizontal size={16} /><span className="hidden sm:inline">{tr('Settings')}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          <p className="text-xs text-slate-500 sm:text-sm">
            {summary.data ? (
              <>
                <span className="font-medium text-slate-900">{formatDate(summary.data.filters.dateFrom)} – {formatDate(summary.data.filters.dateTo)}</span>
                {' '}· {branchesLabel(branch, branches)} · {summary.data.periods.length} {tr('opname period(s) · ratios on')} {basis === 'net' ? tr('net sales') : tr('subtotal')}
              </>
            ) : <span className="inline-block h-4 w-72 animate-pulse rounded bg-slate-200 align-middle" />}
          </p>

          {summary.error && !summary.loading ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-12 text-center">
              <AlertTriangle className="text-amber-500" />
              <p className="text-sm text-slate-600">{summary.error}</p>
              <button type="button" onClick={summary.retry} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"><RotateCw size={13} /> {tr('Try again')}</button>
            </div>
          ) : (
            <>
              {summary.data && network ? (
                <ReliabilityBanner summary={summary.data} issues={issues.data} network={network} freshness={fresh}
                  onShowIssues={() => scrollTo(issuesRef.current)} onShowGuide={() => setGuide(true)} />
              ) : <div className="h-36 animate-pulse rounded-xl bg-slate-100" />}
              {summary.data && issues.loading && !issues.data && (
                <p className="-mt-3 text-[11px] text-slate-400">{tr('Running the data quality checks… the data status may still change.')}</p>
              )}

              <section className="space-y-3" aria-label={tr('Summary')}>
                <SectionTitle title={tr('Summary')} description={tr('Where the money goes: what the recipes allow, what was really used, and the difference.')} />
                <Headline data={summary.data} basis={basis} />
                {summary.data && <Secondary data={summary.data} basis={basis} issues={issues.data} onShowIssues={() => scrollTo(issuesRef.current)} />}
              </section>
            </>
          )}

          {settings && summary.data && (
            <section className="space-y-3" aria-label={tr('Outlet status')}>
              <SectionTitle title={tr('How the outlets are doing')} info="costStatus"
                description={metric === 'usage' ? tr('Usage vs recipes: the part each outlet controls. Click a status to list those outlets.') : tr('Actual COGS % against the target in Settings. Click a status to list those outlets.')} />
              <StatusScale data={summary.data} settings={settings} basis={basis} metric={metric} onMetric={m => { setMetric(m); setStatus(''); }}
                onPick={s => { setStatus(s); scrollTo(outletsRef.current); }} />
            </section>
          )}

          <section className="space-y-3" aria-label={tr('Trend and purchase forecast')}>
            <SectionTitle title={tr('Trend & purchase plan')} />
            <div className="grid gap-4 xl:grid-cols-12">
              <div className="min-w-0 xl:col-span-7"><CostTrendCard key={grain} query={query} basis={basis} settings={settings} defaultGrain={grain} /></div>
              <div className="min-w-0 xl:col-span-5"><ForecastCard branch={branch} onSelect={setSelected} /></div>
            </div>
          </section>

          <section ref={outletsRef} className="scroll-mt-4 space-y-3" aria-label={tr('Outlets')}>
            <SectionTitle title={tr('Outlets')} description={tr('Biggest excess vs recipes first. Status follows the measure chosen above; data status shows whether the figures are final.')} />
            {summary.data && network ? (
              <OutletTable outlets={summary.data.outlets} basis={basis} metric={metric} status={status} onStatus={setStatus}
                reliability={network.byOutlet} onSelect={(o: OutletCost) => setSelected(o.branchCode)} />
            ) : <div className="h-64 animate-pulse rounded-xl bg-slate-100" />}
          </section>

          <section ref={issuesRef} className="scroll-mt-4 space-y-3" aria-label={tr('Data quality')}>
            <SectionTitle title={tr('Data quality — what to fix in ESB')} info="costIssues"
              description={tr('Each item names the ESB document to correct. After the nightly sync the figures update automatically.')} />
            <DataIssues resource={issues} />
          </section>

          <button type="button" onClick={() => setGuide(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-200 hover:bg-blue-50/40 sm:px-5">
            <span className="flex items-center gap-3">
              <BookOpen size={18} className="text-blue-700" />
              <span>
                <span className="block text-sm font-medium text-slate-900">{tr('How the figures are calculated')}</span>
                <span className="block text-xs text-slate-500">{tr('Terms with examples, formulas, thresholds, data reliability and the cost control workbook terms')}</span>
              </span>
            </span>
            <ArrowRight size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {outlet && (
        <OutletDrawer outlet={outlet} basis={basis} query={query} settings={settings} reliability={network?.byOutlet.get(outlet.branchCode)}
          defaultGrain={grain} onClose={() => setSelected(null)} />
      )}
      {guide && <CostGuide summary={summary.data} settings={settings} basis={basis} onClose={() => setGuide(false)} />}
      {editing && settings && (
        <SettingsDrawer settings={settings} onClose={() => setEditing(false)}
          onSaved={s => { setSettingsOverride(s); setEditing(false); summary.retry(); }} />
      )}
    </DashboardLayout>
  );
}

function SectionTitle({ title, description, info }: { title: string; description?: string; info?: InfoKey }) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}{info && <InfoTip info={info} />}<span className="h-px flex-1 bg-slate-200" aria-hidden />
      </h2>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

/**
 * Full rupiah figures, never cut: 2 columns on tablets, 3 on laptops (1024-1535 px, next to the
 * sidebar), 5 from 1536 px; one line, the size follows the column width.
 */
const GRID = 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5';
const FULL = 'whitespace-nowrap text-xl sm:text-2xl lg:text-xl xl:text-2xl 2xl:text-xl min-[1800px]:text-2xl';
const per100 = (v: number, s: number) => (s ? `Rp ${fixed((v / s * 100), 1).replace('.', ',')}` : '–');

function Headline({ data, basis }: { data: SummaryResponse | null; basis: Basis }) {
  if (!data) {
    return (
      <StatStrip label={tr('Cost summary')} columns={5} gridClassName={GRID}>
        {Array.from({ length: 5 }).map((_, i) => <Stat key={i} label="…" value={<StatSkeleton />} />)}
      </StatStrip>
    );
  }
  const t = data.total;
  const s = sales(t, basis);
  const med = basis === 'net' ? data.medians.actualPctNet : data.medians.actualPctSubtotal;
  const excess = t.actualCogs - t.theoreticalCogs;
  const posted = t.opnameCount - t.pendingOpnameCount;
  return (
    <StatStrip label={tr('Cost summary')} columns={5} gridClassName={GRID}>
      <Stat label={basis === 'net' ? tr('Net sales') : tr('Subtotal')} info={<InfoTip info="costSales" />} value={formatCurrency(Math.round(s))} valueClassName={FULL}>
        <p>{formatNumber(t.bills)} {tr('bills ·')} {data.outlets.filter(o => sales(o, basis) > 0).length} {tr('outlets')}</p>
        <p>{tr('Every % on this page is of this amount')}</p>
      </Stat>
      <Stat label={tr('Recipes (theoretical)')} info={<InfoTip info="costTheoretical" />} value={formatCurrency(Math.round(t.theoreticalCogs))} valueClassName={FULL}>
        <p className="font-medium text-slate-700">{pctText(cogsPct(t, basis, 'theoretical'))} {tr('of sales')}</p>
        <p>{tr('What the recipes allow:')} {per100(t.theoreticalCogs, s)} {tr('of every Rp 100')}</p>
      </Stat>
      <Stat label={tr('Actual COGS')} info={<InfoTip info="costActual" />} value={formatCurrency(Math.round(t.actualCogs))} emphasis valueClassName={FULL}>
        <p className="flex flex-wrap items-center gap-1.5"><StatusBadge status={cogsStatus(t, basis)} value={pctText(cogsPct(t, basis, 'actual'))} /> {tr('of sales · outlet median')} {pctText(med)}</p>
        <p>{tr('Really used:')} {per100(t.actualCogs, s)} {tr('of every Rp 100')}</p>
      </Stat>
      <Stat label={tr('Excess vs recipes')} info={<InfoTip info="costExcess" />}
        value={t.hasOpname ? <span className={excess > 0.5 ? 'text-red-700' : 'text-emerald-700'}>{excess > 0 ? '+' : ''}{formatCurrency(Math.round(excess))}</span> : '–'} valueClassName={FULL}>
        {t.hasOpname ? (
          <>
            <p className="flex flex-wrap items-center gap-1.5"><StatusBadge status={t.status.usage} value={tr('usage {0}', pctText(t.usageRatio))} /> {tr('outlet median')} {pctText(data.medians.usageRatio)}</p>
            <p>{excess >= 0 ? tr('Used {0} more than the recipes', pctText((t.usageRatio ?? 100) - 100)) : tr('Used {0} less than the recipes', pctText(100 - (t.usageRatio ?? 100)))}</p>
          </>
        ) : <p>{tr('Needs a stock opname in the range')}</p>}
      </Stat>
      <Stat label={tr('Stock variance')} info={<InfoTip info="costVariance" />}
        value={<span className={t.variance < -0.5 ? 'text-red-700' : ''}>{formatCurrency(Math.round(t.variance))}</span>} valueClassName={FULL} className="lg:col-span-2 2xl:col-span-1">
        <p>{tr('posted')} {formatCurrency(Math.round(t.postedVariance))}{t.pendingVariance ? <> · <span className="text-amber-700">{tr('pending')} {formatCurrency(Math.round(t.pendingVariance))}</span></> : null}</p>
        <p>{formatNumber(t.opnameCount)} {tr('opname(s):')} {formatNumber(posted)} {tr('posted,')} {formatNumber(t.pendingOpnameCount)} {tr('not posted yet')}</p>
      </Stat>
    </StatStrip>
  );
}

/** Also in this range: other usage, purchases (the workbook's "COGS Ratio"), book stock. */
function Secondary({ data, basis, issues, onShowIssues }: {
  data: SummaryResponse; basis: Basis; issues: IssuesResponse | null; onShowIssues: () => void;
}) {
  const t = data.total;
  const s = sales(t, basis);
  const book = issues?.bookStock;
  const items: { label: string; info?: InfoKey; value: ReactNode; note: ReactNode }[] = [
    {
      label: tr('Other usage'), info: 'costOther', value: formatCurrency(Math.round(t.otherUsage)),
      note: <span className="inline-flex items-center gap-1.5"><StatusBadge status={t.status.waste} value={pctText(basis === 'net' ? t.wastePctNet : t.wastePctSubtotal)} /> {tr('waste, R&D, marketing (item journals)')}</span>,
    },
    {
      label: tr('Purchases'), info: 'costPurchases', value: formatCurrency(Math.round(t.purchases)),
      note: <>{pctText(s ? (t.purchases / s) * 100 : null)} {tr('of sales — the workbook\'s "COGS Ratio"')}</>,
    },
    {
      label: tr('Book stock'), value: <span className={t.endValue < 0 ? 'text-red-700' : ''}>{formatCurrency(Math.round(t.endValue))}</span>,
      note: book && book.negative < -0.5 ? (
        <>
          {formatCurrency(Math.round(book.positive))} {tr('in stock ·')} {formatCurrency(Math.round(book.negative))} {tr('negative balances')}
          {book.items[0] && <> {tr('(largest')} {book.items[0].productName} {formatCurrency(Math.round(book.items[0].value))})</>} ·{' '}
          <button type="button" onClick={onShowIssues} className="font-medium text-blue-700 hover:underline">{tr('see Data quality')}</button>
        </>
      ) : <>{tr('from')} {formatCurrency(Math.round(t.beginValue))} {tr('at the start · ESB system stock at HPP')}</>,
    },
  ];
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
      {items.map(i => (
        <div key={i.label} className="min-w-0 bg-white px-4 py-3">
          <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{i.label}{i.info && <InfoTip info={i.info} />}</dt>
          <dd className="mt-1 whitespace-nowrap text-base font-semibold tabular-nums text-slate-900">{i.value}</dd>
          <dd className="mt-0.5 text-xs text-slate-500">{i.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function usageText(b: Bands): string[] {
  return [tr('within ±{0}%', b.good), `±${b.good}–${b.warning}%`, `±${b.warning}–${b.serious}%`, tr('beyond ±{0}%', b.serious)];
}

function StatusScale({ data, settings, basis, metric, onMetric, onPick }: {
  data: SummaryResponse; settings: CostSettings; basis: Basis; metric: StatusMetric;
  onMetric: (m: StatusMetric) => void; onPick: (s: Status) => void;
}) {
  const selling = data.outlets.filter(o => sales(o, basis) > 0);
  const counts: Partial<Record<Status, number>> = {};
  let none = 0;
  for (const o of selling) {
    const s = outletStatus(o, basis, metric);
    if (s) counts[s] = (counts[s] ?? 0) + 1;
    else none += 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const ranges = metric === 'usage' ? usageText(settings.usage_bands) : bandText(settings.cogs_bands);
  const theo = cogsPct(data.total, basis, 'theoretical') ?? 0;
  const targetBelowRecipes = metric === 'cogs' && theo > settings.cogs_bands.good;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label={tr('Status measure')} value={metric}
          options={[{ value: 'usage', label: tr('Usage vs recipes') }, { value: 'cogs', label: tr('Actual COGS %') }]} onChange={onMetric} />
        <p className="text-xs text-slate-500">
          {metric === 'usage' ? tr('Actual ÷ recipe usage, distance from 100%') : tr('% of {0}', basis === 'net' ? tr('net sales') : tr('subtotal'))} {tr('· thresholds in Settings')}
        </p>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {STATUS_ORDER.map(s => counts[s] ? <div key={s} style={{ width: `${(counts[s]! / total) * 100}%`, background: STATUS[s].dot }} className="border-r-2 border-white last:border-r-0" /> : null)}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        {STATUS_ORDER.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => onPick(s)} disabled={!counts[s]}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-left hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:opacity-60 disabled:hover:border-slate-100 disabled:hover:bg-transparent">
              <StatusBadge status={s} />
              <span className="font-semibold tabular-nums text-slate-800">{counts[s] ?? 0}</span>
              <span className="text-slate-500">{tr('outlets')}</span>
              <span className="ml-auto text-slate-400">{ranges[i]}</span>
            </button>
          </li>
        ))}
      </ul>
      {metric === 'usage' && none > 0 && (
        <p className="mt-2 text-xs text-slate-500">{none} {tr('outlet(s) without a stock opname in this range have no usage status.')}</p>
      )}
      {targetBelowRecipes && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900">
          {tr('The recipes alone cost')} {pctText(theo)} {tr('of sales — above the COGS target of ≤')} {settings.cogs_bands.good}{tr('%. Outlets cannot reach the target by running better; it needs recipe or price changes, or a target that fits the menu. Use')} <b>{tr('Usage vs recipes')}</b> {tr('to find the outlets that lose money.')}
        </p>
      )}
    </div>
  );
}

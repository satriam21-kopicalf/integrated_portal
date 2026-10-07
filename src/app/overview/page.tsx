'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, SlidersHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Branch, branchesLabel } from '@/components/BranchFilter';
import { CompareMode, compareRange } from '@/components/overview/CompareFilter';
import OverviewFilterDrawer, { isDayVsDay } from '@/components/overview/OverviewFilterDrawer';
import HealthCard from '@/components/overview/HealthCard';
import KpiTiles from '@/components/overview/KpiTiles';
import TrendCard from '@/components/overview/TrendCard';
import ChannelMixCard from '@/components/overview/ChannelMixCard';
import BranchLeaderboard from '@/components/overview/BranchLeaderboard';
import BusyHoursCard from '@/components/overview/BusyHoursCard';
import MenusCard from '@/components/overview/MenusCard';
import DeductionsCard from '@/components/overview/DeductionsCard';
import PaymentsCard from '@/components/overview/PaymentsCard';
import BasketCard from '@/components/overview/BasketCard';
import SalesGrowthCard from '@/components/overview/SalesGrowth';
import LiveSalesCard from '@/components/overview/LiveSalesCard';
import { useFilterLog } from '@/lib/activity';
import { DrillProvider } from '@/components/overview/drill/DrillContext';
import DrillHost from '@/components/overview/drill/DrillHost';
import { useLive } from '@/lib/live';
import { formatDate } from '@/lib/format';
import { RealtimeIndicator } from '@/lib/realtime';
import {
  BasketResponse, BranchesResponse, ChannelsResponse, DeductionsResponse, HourlyResponse, KpisResponse, MetaResponse,
  PaymentsResponse, channelLabel, useOverview,
} from '@/lib/overview';

interface Filters {
  from: string; // '' = default period (last 30 complete days)
  to: string;
  branch: string; // branch codes separated by commas, '' = all
  channels: string[]; // [] = all
  cmp: CompareMode; // comparison period: auto (previous period) | month | year | custom
  cmpFrom: string; // custom only
  cmpTo: string;
}

const EMPTY: Filters = { from: '', to: '', branch: '', channels: [], cmp: 'auto', cmpFrom: '', cmpTo: '' };
const CMP_MODES: CompareMode[] = ['auto', 'month', 'year', 'custom'];

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return {
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    branch: p.get('branch') ?? '',
    channels: (p.get('channel') ?? '').split(',').map(c => c.trim()).filter(Boolean),
    cmp: (CMP_MODES as string[]).includes(p.get('cmp') ?? '') ? (p.get('cmp') as CompareMode) : 'auto',
    cmpFrom: p.get('cmpFrom') ?? '',
    cmpTo: p.get('cmpTo') ?? '',
  };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.branch) p.set('branch', f.branch);
  if (f.channels.length) p.set('channel', f.channels.join(','));
  if (f.cmp !== 'auto') p.set('cmp', f.cmp);
  if (f.cmp === 'custom' && f.cmpFrom) {
    p.set('cmpFrom', f.cmpFrom);
    p.set('cmpTo', f.cmpTo || f.cmpFrom);
  }
  const qs = p.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

export default function OverviewPage() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const meta = useOverview<MetaResponse>('meta', '');

  // filters live in the URL so a view can be shared
  useEffect(() => {
    setFilters(readUrl());
  }, []);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error));
  }, []);

  useFilterLog(
    '/overview',
    filters ? { dateFrom: filters.from || null, dateTo: filters.to || null, branches: filters.branch ? filters.branch.split(',') : [], channels: filters.channels,
      compare: filters.cmp, compareFrom: filters.cmpFrom || null, compareTo: filters.cmpTo || null } : null,
    `Filter Overview: ${filters?.from ? `${formatDate(filters.from)} – ${formatDate(filters.to || filters.from)}` : 'default'} · ${branchesLabel(filters?.branch ?? '', branches)}`
      + (filters?.channels.length ? ` · ${filters.channels.join(', ')}` : ''),
  );

  const update = (patch: Partial<Filters>) => {
    setFilters(f => {
      const next = { ...(f ?? EMPTY), ...patch };
      writeUrl(next);
      return next;
    });
  };

  const f = filters ?? EMPTY;
  const dayVsDay = isDayVsDay(f);
  const period = f.from ? { from: f.from, to: f.to || f.from } : meta.data?.defaultPeriod ?? null;
  const cmp = compareRange({ mode: f.cmp, from: f.cmpFrom, to: f.cmpTo }, period);
  const activeCount = (f.from ? 1 : 0) + (f.cmp !== 'auto' ? 1 : 0) + (f.branch ? 1 : 0) + (f.channels.length ? 1 : 0);
  const weekday = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const chips: string[] = [
    dayVsDay ? `${weekday(f.from)} vs ${weekday(f.cmpFrom)}`
      : period ? `${formatDate(period.from)} – ${formatDate(period.to)}${f.from ? '' : ' (last 30 days)'}` : 'Last 30 days',
    ...(!dayVsDay ? [cmp ? `vs ${formatDate(cmp.from)} – ${formatDate(cmp.to)}` : 'vs previous period'] : []),
    branchesLabel(f.branch, branches),
    f.channels.length ? f.channels.map(channelLabel).join(', ') : 'All channels',
  ];

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Overview</h1>
              <p className="text-xs text-slate-500 sm:text-sm">Sales Analytics</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen(true)} aria-label="Filters"
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  activeCount ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                <SlidersHorizontal size={16} /> Filters
                {activeCount > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{activeCount}</span>}
              </button>
              <RealtimeIndicator className="h-10" />
            </div>
          </div>
          {/* what is applied: one line, opens the filters */}
          <button type="button" onClick={() => setFiltersOpen(true)} className="mt-3 flex w-full flex-wrap items-center gap-1.5 text-left" title="Change filters">
            {dayVsDay && <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"><GitCompareArrows size={12} /> Day vs day</span>}
            {chips.map((c, i) => (
              <span key={i} className={`max-w-full truncate rounded-full px-2.5 py-1 text-xs font-medium ${i === 0 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{c}</span>
            ))}
          </button>
        </header>

        {filters && <OverviewContent filters={filters} branches={branches} defaultPeriod={meta.data?.defaultPeriod ?? null} />}
      </div>
      {filtersOpen && (
        <OverviewFilterDrawer value={f} branches={branches} channels={(meta.data?.channels ?? []).map(c => c.channel)}
          defaultPeriod={meta.data?.defaultPeriod ?? null} onClose={() => setFiltersOpen(false)}
          onApply={v => { update(v); setFiltersOpen(false); }} />
      )}
    </DashboardLayout>
  );
}

function OverviewContent({ filters, branches, defaultPeriod }: {
  filters: Filters; branches: Branch[]; defaultPeriod: { from: string; to: string } | null;
}) {
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set('dateFrom', filters.from);
    if (filters.to) p.set('dateTo', filters.to || filters.from);
    if (filters.branch) p.set('branch', filters.branch);
    if (filters.channels.length) p.set('channel', filters.channels.join(','));
    // comparison period: every "vs previous" figure of every endpoint follows it
    const cmp = compareRange({ mode: filters.cmp, from: filters.cmpFrom, to: filters.cmpTo },
      filters.from ? { from: filters.from, to: filters.to || filters.from } : defaultPeriod);
    if (cmp) {
      p.set('compareFrom', cmp.from);
      p.set('compareTo', cmp.to);
    }
    return p.toString();
  }, [filters, defaultPeriod]);

  const kpis = useOverview<KpisResponse>('kpis', query);
  const channels = useOverview<ChannelsResponse>('channels', query);
  const branchBoard = useOverview<BranchesResponse>('branches', query);
  const hourly = useOverview<HourlyResponse>('hourly', query);
  const deductions = useOverview<DeductionsResponse>('deductions', query);
  const payments = useOverview<PaymentsResponse>('payments', query);
  const basket = useOverview<BasketResponse>('basket', query);

  // live feed: always today, follows the branch / channel filters
  const liveQuery = useMemo(() => {
    const p = new URLSearchParams({ limit: '30' });
    if (filters.branch) p.set('branch', filters.branch);
    if (filters.channels.length) p.set('channel', filters.channels.join(','));
    return p.toString();
  }, [filters.branch, filters.channels]);
  const live = useLive(liveQuery);

  const f = kpis.data?.filters;
  const branchName = branchesLabel(filters.branch, branches);
  const channelText = filters.channels.length ? filters.channels.map(channelLabel).join(', ') : 'All channels';

  return (
    <DrillProvider baseQuery={query} filters={filters} branches={branches}>
    <div className="space-y-5 p-4 sm:p-6">
      {/* Today first: live, independent of the date and comparison filters (only branch & channel apply) */}
      <LiveSalesCard key={liveQuery} data={live.data} error={live.error} />

      {/* the whole history, network level: independent of the filters */}
      <HealthCard />

      <div className="space-y-0">
        <p className="pb-2 text-xs text-slate-500 sm:text-sm">
          {f ? (
            <>
              <span className="font-medium text-slate-900">{formatDate(f.from)} – {formatDate(f.to)}</span> · {branchName} · {channelText}
              {f.previous.complete ? (
                <>
                  {' · vs '}
                  <span className={f.previous.custom ? 'rounded bg-slate-900 px-1.5 py-0.5 font-medium text-white' : ''}>
                    {formatDate(f.previous.from)} – {formatDate(f.previous.to)}
                  </span>
                  {f.previous.days !== undefined && f.previous.days !== f.days && (
                    <span className="ml-1.5 text-amber-700">({f.previous.days} vs {f.days} days: totals are not like for like, compare per-day figures)</span>
                  )}
                </>
              ) : <> · no comparison before Aug 2025</>}
            </>
          ) : (
            <span className="skeleton inline-block h-4 w-72 rounded align-middle" />
          )}
        </p>
        <KpiTiles resource={kpis} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8"><TrendCard query={query} /></div>
        <div className="min-w-0 xl:col-span-4"><ChannelMixCard resource={channels} /></div>
      </div>

      <SalesGrowthCard query={query} />

      {/* Cost Control is left off the Overview until its figures are final (see the Cost Control page) */}

      <Section title="Branches">
        <BranchLeaderboard resource={branchBoard} />
      </Section>

      <Section title="When & what sells">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0"><BusyHoursCard resource={hourly} query={query} /></div>
          <div className="min-w-0"><MenusCard query={query} /></div>
        </div>
      </Section>

      <Section title="Payments, basket & deductions">
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <div className="min-w-0"><PaymentsCard resource={payments} /></div>
          <div className="min-w-0"><BasketCard resource={basket} /></div>
          <div className="min-w-0 lg:col-span-2 2xl:col-span-1"><DeductionsCard resource={deductions} /></div>
        </div>
      </Section>

    </div>
    <DrillHost />
    </DrillProvider>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
        <span className="h-px flex-1 bg-slate-200" aria-hidden />
      </h2>
      {children}
    </section>
  );
}

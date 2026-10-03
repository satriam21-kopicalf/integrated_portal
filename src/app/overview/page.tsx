'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangePicker, { DatePreset } from '@/components/DateRangePicker';
import BranchFilter, { Branch } from '@/components/BranchFilter';
import ChannelFilter from '@/components/overview/ChannelFilter';
import KpiTiles from '@/components/overview/KpiTiles';
import TrendCard from '@/components/overview/TrendCard';
import ChannelMixCard from '@/components/overview/ChannelMixCard';
import BranchLeaderboard from '@/components/overview/BranchLeaderboard';
import BusyHoursCard from '@/components/overview/BusyHoursCard';
import MenusCard from '@/components/overview/MenusCard';
import DeductionsCard from '@/components/overview/DeductionsCard';
import MonthlyCard from '@/components/overview/MonthlyCard';
import PaymentsCard from '@/components/overview/PaymentsCard';
import BasketCard from '@/components/overview/BasketCard';
import { formatDate, formatDateTime, toIsoDate } from '@/lib/format';
import {
  BasketResponse, BranchesResponse, ChannelsResponse, DeductionsResponse, HourlyResponse, KpisResponse, MetaResponse,
  MonthlyResponse, PaymentsResponse, useOverview,
} from '@/lib/overview';

interface Filters {
  from: string; // '' = default period (last 30 complete days)
  to: string;
  branch: string; // branch_code, '' = all
  channels: string[]; // [] = all
}

const EMPTY: Filters = { from: '', to: '', branch: '', channels: [] };

/** Complete days end yesterday; "Today" is still being synced. */
function overviewPresets(): DatePreset[] {
  const now = new Date();
  const d = (offset: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + offset);
    return toIsoDate(x);
  };
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { label: 'Today', from: d(0), to: d(0) },
    { label: 'Yesterday', from: d(-1), to: d(-1) },
    { label: 'Last 7 days', from: d(-7), to: d(-1) },
    { label: 'Last 30 days', from: d(-30), to: d(-1) },
    { label: 'Last 90 days', from: d(-90), to: d(-1) },
    { label: 'This month', from: toIsoDate(new Date(y, m, 1)), to: d(0) },
    { label: 'Last month', from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'This year', from: toIsoDate(new Date(y, 0, 1)), to: d(0) },
  ];
}

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return {
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    branch: p.get('branch') ?? '',
    channels: (p.get('channel') ?? '').split(',').map(c => c.trim()).filter(Boolean),
  };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.branch) p.set('branch', f.branch);
  if (f.channels.length) p.set('channel', f.channels.join(','));
  const qs = p.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

export default function OverviewPage() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const meta = useOverview<MetaResponse>('meta', `r=${refreshKey}`);

  // filters live in the URL so a view can be shared
  useEffect(() => {
    setFilters(readUrl());
  }, []);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, []);

  const update = (patch: Partial<Filters>) => {
    setFilters(f => {
      const next = { ...(f ?? EMPTY), ...patch };
      writeUrl(next);
      return next;
    });
  };

  const freshness = meta.data?.freshness;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Overview</h1>
              <p className="text-xs text-slate-500 sm:text-sm">
                ESB sales analytics
                {freshness?.lastSyncedAt && <> · data synced {formatDateTime(freshness.lastSyncedAt)}</>}
              </p>
            </div>
            {/* stays right-aligned when wrapped: the popovers open towards the left */}
            <div className="ml-auto flex items-center gap-2">
              <DateRangePicker
                dateFrom={filters?.from ?? ''}
                dateTo={filters?.to ?? ''}
                onChange={(from, to) => update({ from, to })}
                presets={overviewPresets}
                defaultLabel="last 30 days to yesterday"
              />
              <BranchFilter branches={branches} loading={branchesLoading} value={filters?.branch ?? ''} onChange={branch => update({ branch })} />
              <ChannelFilter channels={meta.data?.channels ?? []} value={filters?.channels ?? []} onChange={channels => update({ channels })} />
              <button
                type="button"
                onClick={() => setRefreshKey(k => k + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
                title="Refresh data"
                aria-label="Refresh data"
              >
                <RefreshCw size={17} strokeWidth={1.75} className={meta.loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {filters && <OverviewContent filters={filters} branches={branches} refreshKey={refreshKey} />}
      </div>
    </DashboardLayout>
  );
}

function OverviewContent({ filters, branches, refreshKey }: { filters: Filters; branches: Branch[]; refreshKey: number }) {
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.from) p.set('dateFrom', filters.from);
    if (filters.to) p.set('dateTo', filters.to || filters.from);
    if (filters.branch) p.set('branch', filters.branch);
    if (filters.channels.length) p.set('channel', filters.channels.join(','));
    p.set('r', String(refreshKey)); // refetch on Refresh (ignored by the API)
    return p.toString();
  }, [filters, refreshKey]);

  const kpis = useOverview<KpisResponse>('kpis', query);
  const channels = useOverview<ChannelsResponse>('channels', query);
  const branchBoard = useOverview<BranchesResponse>('branches', query);
  const hourly = useOverview<HourlyResponse>('hourly', query);
  const deductions = useOverview<DeductionsResponse>('deductions', query);
  const monthly = useOverview<MonthlyResponse>('monthly', query);
  const payments = useOverview<PaymentsResponse>('payments', query);
  const basket = useOverview<BasketResponse>('basket', query);

  const f = kpis.data?.filters;
  const branchName = filters.branch ? branches.find(b => b.branch_code === filters.branch)?.branch_name ?? filters.branch : 'All branches';
  const channelLabel = filters.channels.length ? filters.channels.join(', ') : 'All channels';

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <p className="text-xs text-slate-500 sm:text-sm">
        {f ? (
          <>
            <span className="font-medium text-slate-900">{formatDate(f.from)} – {formatDate(f.to)}</span> · {branchName} · {channelLabel}
            {f.previous.complete ? <> · vs {formatDate(f.previous.from)} – {formatDate(f.previous.to)}</> : <> · no comparison before Aug 2025</>}
          </>
        ) : (
          <span className="inline-block h-4 w-72 animate-pulse rounded bg-slate-200 align-middle" />
        )}
      </p>

      <KpiTiles resource={kpis} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2"><TrendCard query={query} /></div>
        <div className="min-w-0"><ChannelMixCard resource={channels} /></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2"><BranchLeaderboard resource={branchBoard} /></div>
        <div className="min-w-0"><BusyHoursCard resource={hourly} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0"><MenusCard query={query} /></div>
        <div className="min-w-0"><DeductionsCard resource={deductions} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="min-w-0"><MonthlyCard resource={monthly} /></div>
        <div className="min-w-0"><PaymentsCard resource={payments} /></div>
        <div className="min-w-0 lg:col-span-2 2xl:col-span-1"><BasketCard resource={basket} /></div>
      </div>
    </div>
  );
}

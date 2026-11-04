'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bike, SlidersHorizontal } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CompanySwitch, useCompany, withCompany } from '@/lib/company';
import { Branch, branchesLabel } from '@/components/BranchFilter';
import { CompareMode, compareRange } from '@/components/overview/CompareFilter';
import OverviewFilterDrawer from '@/components/overview/OverviewFilterDrawer';
import KpiTiles from '@/components/overview/KpiTiles';
import TrendCard from '@/components/overview/TrendCard';
import ChannelMixCard from '@/components/overview/ChannelMixCard';
import BranchLeaderboard from '@/components/overview/BranchLeaderboard';
import BusyHoursCard from '@/components/overview/BusyHoursCard';
import MenusCard from '@/components/overview/MenusCard';
import DeductionsCard from '@/components/overview/DeductionsCard';
import PaymentsCard from '@/components/overview/PaymentsCard';
import BasketCard from '@/components/overview/BasketCard';
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
import { locale, tr } from '@/lib/i18n';

interface Filters {
  from: string; // '' = default period (last 30 complete days)
  to: string;
  branch: string; // branch codes separated by commas, '' = all
  channels: string[]; // [] = all
  cmp: CompareMode; // comparison period: auto (previous period) | month | year | custom
  cmpFrom: string; // custom only
  cmpTo: string;
}

const COTR = 'COTR';
const EXTRA_TABS = [{ code: COTR, get name() { return 'Calf On The Road'; } }];

/** channels the POS reports that the filter cannot narrow (user decision 2026-11-04): not offered, dropped from old links */
const NO_FILTER_CHANNELS = new Set(['TAKEAWAY', 'GRABFOOD', 'GOFOOD', 'SHOPEEFOOD', 'ONLINE ORDER']);
const filterable = (c: string) => !NO_FILTER_CHANNELS.has(c.trim().toUpperCase());

const EMPTY: Filters = { from: '', to: '', branch: '', channels: [], cmp: 'auto', cmpFrom: '', cmpTo: '' };
const CMP_MODES: CompareMode[] = ['auto', 'month', 'year', 'custom'];

function readUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  return {
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
    branch: p.get('branch') ?? '',
    channels: (p.get('channel') ?? '').split(',').map(c => c.trim()).filter(Boolean).filter(filterable),
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
  // the brand of the view (Kopi Calf | Wasgee Tea): every figure of the page is of that brand only (lib/company.tsx)
  const { company, setCompany } = useCompany();
  // Calf On The Road: a tab of its own (not an ESB company yet), empty until its sales exist (prototype 2026-11-01)
  const [cotr, setCotr] = useState(false);
  const pickTab = (code: string) => { if (code === COTR) { setCotr(true); return; } setCotr(false); setCompany(code); };
  const meta = useOverview<MetaResponse>('meta', `company=${company}`);

  // filters live in the URL so a view can be shared
  useEffect(() => {
    setFilters(readUrl());
  }, []);

  useEffect(() => {
    fetch(withCompany('/api/branches', company))
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error));
  }, [company]);

  // another brand: its own branches, the chosen branches of the previous brand no longer apply
  const shownCompany = useRef(company);
  useEffect(() => {
    if (shownCompany.current === company) return;
    shownCompany.current = company;
    setFilters(f => {
      if (!f || !f.branch) return f;
      const next = { ...f, branch: '' };
      writeUrl(next);
      return next;
    });
  }, [company]);

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
  const activeCount = (f.from ? 1 : 0) + (f.cmp !== 'auto' ? 1 : 0) + (f.branch ? 1 : 0) + (f.channels.length ? 1 : 0);

  return (
    <DashboardLayout>
      <div className="min-h-full bg-neutral-50">
        <header className="px-4 pt-4 sm:px-6 lg:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{tr('Dashboard')}</h1>
              <p className="text-xs text-neutral-500 sm:text-sm">{tr('Sales Analytics')}</p>
            </div>
            <CompanySwitch className="order-last w-full sm:order-none sm:w-auto" extra={EXTRA_TABS}
              value={cotr ? COTR : company} onChange={pickTab} />
            {!cotr && <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setFiltersOpen(true)}
                className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors sm:h-9 ${
                  activeCount ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100' : 'border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50'}`}>
                <SlidersHorizontal size={16} /> {tr('Filters')}
                {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold tabular-nums text-white">{activeCount}</span>}
              </button>
              <RealtimeIndicator className="h-10 sm:h-9" />
            </div>}
          </div>
        </header>

        {cotr ? <CotrEmpty /> : filters && <OverviewContent filters={filters} branches={branches} company={company} defaultPeriod={meta.data?.defaultPeriod ?? null} />}
      </div>
      {filtersOpen && (
        <OverviewFilterDrawer value={f} branches={branches} channels={(meta.data?.channels ?? []).map(c => c.channel).filter(filterable)}
          defaultPeriod={meta.data?.defaultPeriod ?? null} onClose={() => setFiltersOpen(false)}
          onApply={v => { update(v); setFiltersOpen(false); }} />
      )}
    </DashboardLayout>
  );
}

/** The Calf On The Road tab: empty for now (no sales of the drivers yet). */
function CotrEmpty() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-20 text-center">
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400"><Bike size={24} /></span>
        <p className="text-sm font-semibold text-neutral-800">Calf On The Road</p>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">{tr('The dashboard of the COTR drivers appears here once their sales are recorded.')}</p>
      </div>
    </div>
  );
}

function OverviewContent({ filters, branches, company, defaultPeriod }: {
  filters: Filters; branches: Branch[]; company: string; defaultPeriod: { from: string; to: string } | null;
}) {
  const query = useMemo(() => {
    const p = new URLSearchParams({ company });
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
  }, [filters, defaultPeriod, company]);

  const kpis = useOverview<KpisResponse>('kpis', query);
  const channels = useOverview<ChannelsResponse>('channels', query);
  const branchBoard = useOverview<BranchesResponse>('branches', query);
  const hourly = useOverview<HourlyResponse>('hourly', query);
  const deductions = useOverview<DeductionsResponse>('deductions', query);
  const payments = useOverview<PaymentsResponse>('payments', query);
  const basket = useOverview<BasketResponse>('basket', query);

  // live feed: always today, follows the branch / channel filters
  const liveQuery = useMemo(() => {
    const p = new URLSearchParams({ limit: '30', company });
    if (filters.branch) p.set('branch', filters.branch);
    if (filters.channels.length) p.set('channel', filters.channels.join(','));
    return p.toString();
  }, [filters.branch, filters.channels, company]);
  const live = useLive(liveQuery);

  const f = kpis.data?.filters;
  const branchName = branchesLabel(filters.branch, branches);
  const channelText = filters.channels.length ? filters.channels.map(channelLabel).join(', ') : tr('All Channels');

  return (
    <DrillProvider baseQuery={query} filters={filters} branches={branches}>
    <div className="space-y-5 p-4 sm:p-6">
      {/* Today first: live, independent of the date and comparison filters (only branch & channel apply) */}
      <LiveSalesCard key={liveQuery} data={live.data} error={live.error} />

      {/* Company health (components/overview/HealthCard.tsx) is hidden for now */}

      <div className="space-y-0">
        <p className="pb-2 text-xs text-neutral-500 sm:text-sm">
          {f ? (
            <>
              <span className="font-medium text-neutral-900">{periodText(f.from, f.to)}</span> · {branchName} · {channelText}
              {f.previous.complete ? (
                <>
                  {tr(' · vs ')}
                  <span className={f.previous.custom ? 'rounded bg-neutral-900 px-1.5 py-0.5 font-medium text-white' : ''}>
                    {periodText(f.previous.from, f.previous.to)}{f.previous.until ? ` ${tr('until {0} WIB', f.previous.until)}` : ''}
                  </span>
                  {f.previous.days !== undefined && f.previous.days !== f.days && (
                    <span className="ml-1.5 text-amber-700">({f.previous.days} {tr('vs')} {f.days} {tr('days: totals are not like for like, compare per-day figures)')}</span>
                  )}
                </>
              ) : <> {tr('· no comparison before Aug 2025')}</>}
            </>
          ) : (
            <span className="skeleton inline-block h-4 w-72 rounded align-middle" />
          )}
        </p>
        <KpiTiles resource={kpis} />
      </div>

      {/* what happened over time: trend, per day, growth %, monthly (one card, one comparison) */}
      <TrendCard query={query} />

      {/* Cost Control is left off the Overview until its figures are final (see the Cost Control page) */}

      <Section title={tr('How Customers Buy')}>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0"><ChannelMixCard resource={channels} /></div>
          <div className="min-w-0"><PaymentsCard resource={payments} /></div>
        </div>
      </Section>

      <Section title={tr('Branches')}>
        <BranchLeaderboard resource={branchBoard} query={query} />
      </Section>

      <Section title={tr('When & What Sells')}>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="min-w-0"><BusyHoursCard resource={hourly} query={query} /></div>
          <div className="min-w-0"><MenusCard query={query} /></div>
        </div>
      </Section>

      <Section title={tr('Basket & Deductions')}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0"><BasketCard resource={basket} /></div>
          <div className="min-w-0"><DeductionsCard resource={deductions} /></div>
        </div>
      </Section>

    </div>
    <DrillHost />
    </DrillProvider>
  );
}

/** "Today · Fri, 17 Oct 2026" for one day (the weekday matters: Friday vs Friday), else "1 Oct – 17 Oct 2026". */
function periodText(from: string, to: string): string {
  if (from !== to) return `${formatDate(from)} – ${formatDate(to)}`;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const day = new Date(`${from}T12:00:00+07:00`).toLocaleDateString(locale(), { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return from === today ? `${tr('Today')} · ${day}` : day;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {title}
        <span className="h-px flex-1 bg-neutral-200" aria-hidden />
      </h2>
      {children}
    </section>
  );
}

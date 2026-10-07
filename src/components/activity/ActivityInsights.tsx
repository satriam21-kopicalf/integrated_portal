'use client';

import { useMemo } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { base, categoryAxis, INK, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { formatNumber } from '@/lib/format';

export interface ActivityInsightsData {
  byDay: { day: string; count: number; issues: number; exports: number; users: number }[];
  byHour: { hour: number; count: number }[];
  topPages: { page: string; count: number; users: number }[];
  byStatus: Record<string, number>;
}

const OK = '#2a78d6';
const ISSUE = '#dc2626';
const PAGES: Record<string, string> = {
  '/overview': 'Dashboard', '/sales': 'Sales Transactions', '/cost-control': 'Cost Control', '/users': 'User Accounts',
  '/activity': 'Activity Logs', '/login': 'Sign-in', '/profile': 'Profile', '/': 'Home',
};
const pageName = (p: string) => PAGES[p] ?? p;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** What the period looks like at a glance: activity per day (failed/denied in red), busiest hours, top pages. */
export default function ActivityInsights({ data, onPickDay }: { data: ActivityInsightsData | null; onPickDay: (day: string) => void }) {
  return (
    <section aria-label="Activity insights" className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-12">
      <Panel title="Activity per day" note="Failed or denied in red · click a day to see only that day" className="lg:col-span-2 2xl:col-span-6">
        {data ? <DayChart data={data} onPickDay={onPickDay} /> : <Skeleton />}
      </Panel>
      <Panel title="Busiest hours" note="All activity in the period, WIB" className="2xl:col-span-3">
        {data ? <HourChart data={data} /> : <Skeleton />}
      </Panel>
      <Panel title="Most visited pages" note="Page views and other activity per page" className="2xl:col-span-3">
        {data ? <TopPages data={data} /> : <Skeleton />}
      </Panel>
    </section>
  );
}

function Panel({ title, note, className = '', children }: { title: string; note: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">{note}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-[180px] animate-pulse rounded-lg bg-slate-100" />;
}

function DayChart({ data, onPickDay }: { data: ActivityInsightsData; onPickDay: (day: string) => void }) {
  const days = data.byDay;
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const d = days[items[0]?.dataIndex ?? 0];
        return tipTitle(shortDay(d.day)) + tipRow(OK, formatNumber(d.count - d.issues), 'succeeded')
          + tipRow(ISSUE, formatNumber(d.issues), 'failed or denied')
          + `<div style="color:${INK.secondary};margin-top:4px">${formatNumber(d.users)} users · ${formatNumber(d.exports)} export activities</div>`;
      },
    }),
    xAxis: categoryAxis(days.map(d => shortDay(d.day))),
    yAxis: valueAxis(v => formatNumber(v), { minInterval: 1 }),
    series: [
      { name: 'Succeeded', type: 'bar', stack: 'a', data: days.map(d => d.count - d.issues), barMaxWidth: 28,
        itemStyle: { color: OK, borderRadius: [0, 0, 0, 0], borderColor: '#fff', borderWidth: 1 } },
      { name: 'Failed or denied', type: 'bar', stack: 'a', data: days.map(d => d.issues), barMaxWidth: 28,
        itemStyle: { color: ISSUE, borderRadius: [4, 4, 0, 0], borderColor: '#fff', borderWidth: 1 } },
    ],
  }), [days]);
  if (!days.length) return <p className="py-16 text-center text-sm text-slate-400">No activity in this period</p>;
  return (
    <>
      <EChart option={option} height={180} ariaLabel="Activity per day" onClick={p => days[p.dataIndex] && onPickDay(days[p.dataIndex].day)} />
      <div className="mt-1 flex gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: OK }} />Succeeded</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ISSUE }} />Failed or denied</span>
      </div>
    </>
  );
}

function HourChart({ data }: { data: ActivityInsightsData }) {
  const counts = useMemo(() => {
    const m = new Map(data.byHour.map(h => [h.hour, h.count]));
    return Array.from({ length: 24 }, (_, h) => m.get(h) ?? 0);
  }, [data.byHour]);
  const peak = counts.indexOf(Math.max(...counts));
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const h = items[0]?.dataIndex ?? 0;
        return tipTitle(`${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59`) + tipRow(OK, formatNumber(counts[h]), 'activities');
      },
    }),
    xAxis: categoryAxis(counts.map((_, h) => String(h).padStart(2, '0')), { axisLabel: { color: INK.muted, fontSize: 10, interval: 2 } }),
    yAxis: valueAxis(v => formatNumber(v), { minInterval: 1 }),
    series: [{ type: 'bar', data: counts.map((v, h) => ({ value: v, itemStyle: { color: h === peak && v ? '#1d4ed8' : '#93c5fd', borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 14 }],
  }), [counts, peak]);
  if (!counts.some(Boolean)) return <p className="py-16 text-center text-sm text-slate-400">No activity</p>;
  return (
    <>
      <EChart option={option} height={180} ariaLabel="Activity per hour of the day" />
      <p className="mt-1 text-[11px] text-slate-500">Busiest: <b className="text-slate-700">{String(peak).padStart(2, '0')}:00</b> ({formatNumber(counts[peak])} activities)</p>
    </>
  );
}

function TopPages({ data }: { data: ActivityInsightsData }) {
  const max = Math.max(1, ...data.topPages.map(p => p.count));
  if (!data.topPages.length) return <p className="py-16 text-center text-sm text-slate-400">No page activity</p>;
  return (
    <ul className="space-y-2.5 pt-1">
      {data.topPages.map(p => (
        <li key={p.page}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-medium text-slate-700">{pageName(p.page)}</span>
            <span className="flex-shrink-0 tabular-nums text-slate-500"><b className="text-slate-800">{formatNumber(p.count)}</b> · {formatNumber(p.users)} users</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(3, (p.count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

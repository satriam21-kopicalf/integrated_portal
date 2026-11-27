'use client';

// Activity Logs → what the period looks like (2026-11-27, the Jira look): activity per day (succeeded / failed or denied,
// a day opens the log of that day) with its total, average and busiest day; the busiest hours with the average; the most
// visited pages ranked. Colours of the Atlassian palette, light and dark (the charts follow html.dark).

import { useEffect, useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { FONT, esc } from '@/lib/chartTheme';
import { formatNumber } from '@/lib/format';
import { locale, tr } from '@/lib/i18n';

export interface ActivityInsightsData {
  byDay: { day: string; count: number; issues: number; exports: number; users: number }[];
  byHour: { hour: number; count: number }[];
  topPages: { page: string; count: number; users: number }[];
  byStatus: Record<string, number>;
}

/** The colours of the charts: ADS light / dark. */
const PAL = {
  light: { ok: '#1D7AFC', okSoft: '#85B8FF', issue: '#E2483D', surface: '#FFFFFF', ink: '#172B4D', subtle: '#44546F', muted: '#626F86', grid: '#F1F2F4', axis: '#DCDFE4', tip: '#FFFFFF', tipLine: '#DCDFE4' },
  dark: { ok: '#579DFF', okSoft: '#0055CC', issue: '#F87168', surface: '#22272B', ink: '#B6C2CF', subtle: '#9FADBC', muted: '#8C9BAB', grid: '#2C333A', axis: '#38414A', tip: '#282E33', tipLine: '#38414A' },
};
function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains('dark'));
    read();
    const o = new MutationObserver(read);
    o.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => o.disconnect();
  }, []);
  return dark ? PAL.dark : PAL.light;
}

const PAGES: Record<string, string> = {
  get '/overview'() { return tr('Dashboard'); }, get '/sales'() { return tr('Sales Transactions'); }, get '/cost-control'() { return tr('Cost Control'); }, get '/users'() { return tr('User Accounts'); },
  get '/activity'() { return tr('Activity Logs'); }, get '/login'() { return tr('Sign-in'); }, get '/profile'() { return tr('Profile'); }, get '/'() { return tr('Home'); },
};
const pageName = (p: string) => PAGES[p] ?? p;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
const hh = (h: number) => String(h).padStart(2, '0');

function tip(c: typeof PAL.light, extra: Record<string, unknown>) {
  return { backgroundColor: c.tip, borderColor: c.tipLine, borderWidth: 1, padding: [8, 12], confine: true, textStyle: { color: c.ink, fontSize: 12, fontFamily: FONT },
    extraCssText: 'box-shadow:0 8px 12px rgba(9,30,66,.15),0 0 1px rgba(9,30,66,.31);border-radius:3px;', ...extra };
}
const row = (c: typeof PAL.light, color: string, value: string, label: string) =>
  `<div style="line-height:20px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color};margin-right:8px;vertical-align:middle"></span><b style="font-variant-numeric:tabular-nums;margin-right:6px">${esc(value)}</b><span style="color:${c.subtle}">${esc(label)}</span></div>`;
const axisX = (c: typeof PAL.light, data: string[], extra: Record<string, unknown> = {}) =>
  ({ type: 'category', data, axisLine: { lineStyle: { color: c.axis } }, axisTick: { show: false }, axisLabel: { color: c.muted, fontSize: 11, hideOverlap: true }, ...extra });
const axisY = (c: typeof PAL.light) =>
  ({ type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.muted, fontSize: 11, formatter: (v: number) => formatNumber(v) } });

/** What the period looks like at a glance. */
export default function ActivityInsights({ data, onPickDay }: { data: ActivityInsightsData | null; onPickDay: (day: string) => void }) {
  return (
    <section aria-label={tr('Activity Insights')} className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-12">
      <Panel title={tr('Activity per Day')} note={tr('Click a day to see only that day')} className="lg:col-span-2 2xl:col-span-6">
        {data ? <DayChart data={data} onPickDay={onPickDay} /> : <Skeleton />}
      </Panel>
      <Panel title={tr('Busiest Hours')} note={tr('All activity in the period, WIB')} className="2xl:col-span-3">
        {data ? <HourChart data={data} /> : <Skeleton />}
      </Panel>
      <Panel title={tr('Most Visited Pages')} note={tr('Page views and other activity per page')} className="2xl:col-span-3">
        {data ? <TopPages data={data} /> : <Skeleton />}
      </Panel>
    </section>
  );
}

function Panel({ title, note, className = '', children }: { title: string; note: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-[color:var(--j-172B4D)]">{title}</h2>
      <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{note}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="skeleton h-[200px] rounded-[3px]" />;
}

/** A figure over a chart: label, value, its line. */
function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-[color:var(--j-626F86)]">{label}</p>
      <p className="text-lg font-semibold leading-6 tabular-nums text-[color:var(--j-172B4D)]">{value}</p>
      {sub && <p className="truncate text-xs text-[color:var(--j-626F86)]">{sub}</p>}
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--j-44546F)]">
      {items.map(([color, label]) => <span key={label} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />{label}</span>)}
    </div>
  );
}

function DayChart({ data, onPickDay }: { data: ActivityInsightsData; onPickDay: (day: string) => void }) {
  const c = useDark();
  const days = data.byDay;
  const total = days.reduce((a, d) => a + d.count, 0);
  const issues = days.reduce((a, d) => a + d.issues, 0);
  const peak = days.reduce((m, d) => (d.count > (m?.count ?? -1) ? d : m), days[0]);
  const option = useMemo<ChartOption>(() => ({
    textStyle: { fontFamily: FONT, color: c.subtle }, animationDuration: 500,
    grid: { left: 4, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: tip(c, {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: c.grid, opacity: 0.6 } },
      formatter: (items: { dataIndex: number }[]) => {
        const d = days[items[0]?.dataIndex ?? 0];
        return `<div style="color:${c.subtle};margin-bottom:4px;font-weight:600">${esc(shortDay(d.day))}</div>`
          + row(c, c.ok, formatNumber(d.count - d.issues), tr('succeeded')) + row(c, c.issue, formatNumber(d.issues), tr('failed or denied'))
          + `<div style="color:${c.subtle};margin-top:6px;padding-top:6px;border-top:1px solid ${c.tipLine}">${formatNumber(d.users)} ${esc(tr('users'))} · ${formatNumber(d.exports)} ${esc(tr('exports'))}</div>`;
      },
    }),
    xAxis: axisX(c, days.map((d) => shortDay(d.day))),
    yAxis: axisY(c),
    series: [
      { name: tr('Succeeded'), type: 'bar', stack: 'a', data: days.map((d) => d.count - d.issues), barMaxWidth: 32,
        itemStyle: { color: c.ok, borderRadius: [0, 0, 0, 0], borderColor: c.surface, borderWidth: 1 }, emphasis: { itemStyle: { opacity: 0.85 } } },
      { name: tr('Failed or denied'), type: 'bar', stack: 'a', data: days.map((d) => d.issues), barMaxWidth: 32,
        itemStyle: { color: c.issue, borderRadius: [4, 4, 0, 0], borderColor: c.surface, borderWidth: 1 } },
    ],
  }), [days, c]);
  if (!days.length) return <p className="py-16 text-center text-sm text-[color:var(--j-626F86)]">{tr('No activity in this period')}</p>;
  return (
    <>
      <div className="mb-2 grid grid-cols-3 gap-3 border-b border-[color:var(--j-F1F2F4)] pb-3">
        <Figure label={tr('Total')} value={formatNumber(total)} sub={tr('{0} failed or denied', formatNumber(issues))} />
        <Figure label={tr('Average per day')} value={formatNumber(Math.round(total / days.length))} />
        <Figure label={tr('Busiest day')} value={peak ? shortDay(peak.day) : '—'} sub={peak ? tr('{0} activities', formatNumber(peak.count)) : undefined} />
      </div>
      <EChart option={option} height={200} ariaLabel={tr('Activity per Day')} onClick={(p) => days[p.dataIndex] && onPickDay(days[p.dataIndex].day)} />
      <Legend items={[[c.ok, tr('Succeeded')], [c.issue, tr('Failed or denied')]]} />
    </>
  );
}

function HourChart({ data }: { data: ActivityInsightsData }) {
  const c = useDark();
  const counts = useMemo(() => {
    const m = new Map(data.byHour.map((h) => [h.hour, h.count]));
    return Array.from({ length: 24 }, (_, h) => m.get(h) ?? 0);
  }, [data.byHour]);
  const peak = counts.indexOf(Math.max(...counts));
  const avg = counts.reduce((a, v) => a + v, 0) / 24;
  const option = useMemo<ChartOption>(() => ({
    textStyle: { fontFamily: FONT, color: c.subtle }, animationDuration: 500,
    grid: { left: 4, right: 8, top: 16, bottom: 4, containLabel: true },
    tooltip: tip(c, {
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: c.grid, opacity: 0.6 } },
      formatter: (items: { dataIndex: number }[]) => {
        const h = items[0]?.dataIndex ?? 0;
        return `<div style="color:${c.subtle};margin-bottom:4px;font-weight:600">${hh(h)}:00–${hh(h)}:59 WIB</div>` + row(c, h === peak ? c.ok : c.okSoft, formatNumber(counts[h]), tr('activities'));
      },
    }),
    xAxis: axisX(c, counts.map((_, h) => hh(h)), { axisLabel: { color: c.muted, fontSize: 10, interval: 2 } }),
    yAxis: axisY(c),
    series: [{
      type: 'bar', barMaxWidth: 12,
      data: counts.map((v, h) => ({ value: v, itemStyle: { color: h === peak && v ? c.ok : c.okSoft, borderRadius: [4, 4, 0, 0] } })),
      markLine: { silent: true, symbol: 'none', label: { show: true, position: 'insideEndTop', color: c.muted, fontSize: 10, formatter: () => tr('average') },
        lineStyle: { color: c.muted, type: 'dashed', width: 1 }, data: [{ yAxis: Math.round(avg) }] },
    }],
  }), [counts, peak, avg, c]);
  if (!counts.some(Boolean)) return <p className="py-16 text-center text-sm text-[color:var(--j-626F86)]">{tr('No activity')}</p>;
  return (
    <>
      <div className="mb-2 grid grid-cols-2 gap-3 border-b border-[color:var(--j-F1F2F4)] pb-3">
        <Figure label={tr('Busiest hour')} value={`${hh(peak)}:00`} sub={tr('{0} activities', formatNumber(counts[peak]))} />
        <Figure label={tr('Average per hour')} value={formatNumber(Math.round(avg))} />
      </div>
      <EChart option={option} height={200} ariaLabel={tr('Activity per hour of the day')} />
      <Legend items={[[c.ok, tr('Busiest hour')], [c.okSoft, tr('Other hours')]]} />
    </>
  );
}

function TopPages({ data }: { data: ActivityInsightsData }) {
  const max = Math.max(1, ...data.topPages.map((p) => p.count));
  const total = data.topPages.reduce((a, p) => a + p.count, 0) || 1;
  if (!data.topPages.length) return <p className="py-16 text-center text-sm text-[color:var(--j-626F86)]">{tr('No page activity')}</p>;
  return (
    <ol className="divide-y divide-[color:var(--j-F1F2F4)]">
      {data.topPages.map((p, i) => (
        <li key={p.page} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 py-2">
          <span className="pt-0.5 text-xs font-semibold tabular-nums text-[color:var(--j-626F86)]">{i + 1}</span>
          <span className="min-w-0">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-[color:var(--j-172B4D)]">{pageName(p.page)}</span>
              <span className="flex-shrink-0 font-semibold tabular-nums text-[color:var(--j-172B4D)]">{formatNumber(p.count)}</span>
            </span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-[2px] bg-[color:var(--j-091E420F)]">
              <span className="block h-full rounded-[2px] bg-[color:var(--j-0C66E4)]" style={{ width: `${Math.max(3, (p.count / max) * 100)}%` }} />
            </span>
            <span className="mt-0.5 block text-xs text-[color:var(--j-626F86)]">{tr('{0} users · {1}% of the activity', formatNumber(p.users), Math.round((p.count / total) * 100))}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

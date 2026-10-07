'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, HeartPulse, Info, Maximize2, XCircle } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import InfoTip from '@/components/ui/InfoTip';
import { base, categoryAxis, INK, rupiahAxis, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { compactRupiah, useOverview } from '@/lib/overview';

type HealthStatus = 'good' | 'watch' | 'risk' | 'info';

interface Indicator {
  key: string; group: string; label: string; value: number | null; unit: '%' | 'Rp' | string;
  status: HealthStatus; target: string; detail: string;
}

interface HealthResponse {
  asOf: string;
  window: { from: string; to: string; days: number; lastYear: { from: string; to: string } | null; previous: { from: string; to: string } };
  dataFrom: string;
  score: number | null;
  grade: 'healthy' | 'watch' | 'risk' | null;
  counts: Record<HealthStatus, number>;
  strengths: string[];
  concerns: string[];
  indicators: Indicator[];
  months: { month: string; subtotal: number; bills: number; outlets: number; days: number; perOutletDay: number | null; avgTicket: number | null }[];
  excluded: string;
}

const SIGNED = new Set(['salesYoY', 'sssg', 'sssTraffic', 'ticketYoY', 'sales28', 'weekendUplift']);
const STATUS: Record<HealthStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  good: { label: 'Good', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 },
  watch: { label: 'Watch', cls: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: AlertTriangle },
  risk: { label: 'At risk', cls: 'bg-red-50 text-red-700 ring-red-200', Icon: XCircle },
  info: { label: 'Context', cls: 'bg-slate-100 text-slate-600 ring-slate-200', Icon: Info },
};
const GRADE: Record<string, { label: string; cls: string; ring: string; text: string }> = {
  healthy: { label: 'Healthy', cls: 'bg-emerald-600', ring: '#16a34a', text: 'text-emerald-700' },
  watch: { label: 'Needs attention', cls: 'bg-amber-500', ring: '#d97706', text: 'text-amber-700' },
  risk: { label: 'At risk', cls: 'bg-red-600', ring: '#dc2626', text: 'text-red-700' },
};
const GROUPS = ['Growth', 'Outlets', 'Sales quality', 'Menu & basket', 'Demand'];
const month = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

function value(i: Indicator): string {
  if (i.value === null) return '–';
  if (i.unit === 'Rp') return formatCurrency(Math.round(i.value));
  const v = i.value.toFixed(1);
  return SIGNED.has(i.key) && i.value > 0 ? `+${v}%` : `${v}%`;
}

export function StatusPill({ status }: { status: HealthStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${s.cls}`}>
      <s.Icon size={11} aria-hidden />{s.label}
    </span>
  );
}

/** Company health: coffee-chain KPIs over the whole ESB history, network level (not filtered). */
export default function HealthCard() {
  const res = useOverview<HealthResponse>('health', '');
  const [open, setOpen] = useState(false);
  const d = res.data;
  return (
    <section aria-label="Company health" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <HeartPulse size={16} className="text-rose-600" /> Company health <InfoTip info="health" />
          </h2>
          <p className="text-xs text-slate-500">
            {d ? <>Coffee-chain KPIs · last 28 days ({formatDate(d.window.from)} – {formatDate(d.window.to)}){d.window.lastYear ? ' vs the same weekdays last year' : ''} · all outlets · since {formatDate(d.dataFrom)} · not affected by the filters</>
              : 'Coffee-chain KPIs over all ESB data'}
          </p>
        </div>
        {d && (
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
            <Maximize2 size={12} /> Full report
          </button>
        )}
      </header>

      {!d ? (
        res.error ? <p className="px-5 py-8 text-sm text-slate-500">Could not load the health summary ({res.error}).</p>
          : <div className="m-4 h-64 animate-pulse rounded-lg bg-slate-100" />
      ) : (
        <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-3">
            <Score d={d} />
            <List title="Strengths" items={d.strengths} tone="text-emerald-700" Icon={CheckCircle2} />
            <List title="Needs attention" items={d.concerns} tone="text-amber-700" Icon={AlertTriangle} />
          </div>
          <div className="min-w-0 xl:col-span-5">
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {d.indicators.filter(i => i.status !== 'info').map(i => <IndicatorRow key={i.key} i={i} />)}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Targets are common coffee / quick-service chain rules of thumb. {d.excluded}</p>
          </div>
          <div className="min-w-0 space-y-3 xl:col-span-4">
            <MonthChart d={d} kind="sales" />
            <MonthChart d={d} kind="perOutlet" />
          </div>
        </div>
      )}
      {open && d && <HealthDrawer d={d} onClose={() => setOpen(false)} />}
    </section>
  );
}

function Score({ d }: { d: HealthResponse }) {
  const g = GRADE[d.grade ?? 'watch'];
  const score = d.score ?? 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-24 flex-shrink-0" role="img" aria-label={`Health score ${score} of 100`}>
        <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={g.ring} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-slate-900">{d.score ?? '–'}</span>
          <span className="text-[10px] text-slate-400">of 100</span>
        </span>
      </div>
      <div>
        <p className={`text-base font-semibold ${g.text}`}>{g.label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {d.counts.good} good · {d.counts.watch} watch · {d.counts.risk} at risk
        </p>
        <p className="mt-0.5 text-[11px] text-slate-400">{d.counts.info} context indicators not scored</p>
      </div>
    </div>
  );
}

function List({ title, items, tone, Icon }: { title: string; items: string[]; tone: string; Icon: typeof CheckCircle2 }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      {items.length ? (
        <ul className="mt-1.5 space-y-1">
          {items.map(t => <li key={t} className="flex gap-1.5 text-xs text-slate-700"><Icon size={13} className={`mt-px flex-shrink-0 ${tone}`} />{t}</li>)}
        </ul>
      ) : <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400"><CircleDashed size={13} /> None</p>}
    </div>
  );
}

function IndicatorRow({ i }: { i: Indicator }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-b-0" title={i.detail}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs text-slate-600">{i.label}</p>
        <StatusPill status={i.status} />
      </div>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${i.status === 'risk' ? 'text-red-700' : 'text-slate-900'}`}>{value(i)}</p>
      <p className="text-[11px] leading-snug text-slate-400">Target {i.target}</p>
    </div>
  );
}

function MonthChart({ d, kind }: { d: HealthResponse; kind: 'sales' | 'perOutlet' }) {
  const ms = d.months;
  const last = ms[ms.length - 1];
  const option = useMemo<ChartOption>(() => {
    const vals = ms.map(m => (kind === 'sales' ? m.subtotal : m.perOutletDay));
    return {
      ...base,
      grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: kind === 'sales' ? 'shadow' : 'line' },
        formatter: (items: { dataIndex: number }[]) => {
          const m = ms[items[0]?.dataIndex ?? 0];
          const partial = m === last && m.days < 28 ? ` (${m.days} days so far)` : '';
          return tipTitle(`${new Date(`${m.month}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}${partial}`)
            + tipRow('#2a78d6', formatCurrency(Math.round(m.subtotal)), 'sales')
            + tipRow('#0f766e', formatCurrency(m.perOutletDay ?? 0), 'per outlet per day')
            + `<div style="color:${INK.secondary};margin-top:4px">${formatNumber(m.outlets)} outlets · ${formatNumber(m.bills)} bills · avg ticket ${formatCurrency(m.avgTicket ?? 0)}</div>`;
        },
      }),
      xAxis: categoryAxis(ms.map(m => month(m.month)), { boundaryGap: kind === 'sales' }),
      yAxis: valueAxis(rupiahAxis, { scale: kind !== 'sales', splitNumber: 3 }),
      series: [kind === 'sales'
        ? { type: 'bar', data: vals.map((v, k) => ({ value: v, itemStyle: { color: k === ms.length - 1 && last.days < 28 ? '#bfdbfe' : '#2a78d6', borderRadius: [3, 3, 0, 0] } })), barMaxWidth: 22 }
        : { type: 'line', data: vals, symbol: 'circle', symbolSize: 5, lineStyle: { color: '#0f766e', width: 2 }, itemStyle: { color: '#0f766e' },
            areaStyle: { color: 'rgba(15,118,110,0.08)' } }],
    };
  }, [ms, kind, last]);
  const first = ms[0];
  const growth = first && last && kind === 'perOutlet' && first.perOutletDay ? ((last.perOutletDay ?? 0) / first.perOutletDay - 1) * 100 : null;
  return (
    <div>
      <p className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800">{kind === 'sales' ? 'Sales per month' : 'Sales per outlet per day'}</span>
        <span className="text-slate-500">
          {kind === 'sales' ? `${first ? month(first.month) : ''} – now · ${compactRupiah(ms.reduce((a, m) => a + m.subtotal, 0))} in total`
            : growth !== null ? `${growth >= 0 ? '+' : ''}${growth.toFixed(0)}% since ${month(first.month)}` : ''}
        </span>
      </p>
      <EChart option={option} height={120} ariaLabel={kind === 'sales' ? 'Sales per month since the ESB roll-out' : 'Sales per outlet per day, per month'} />
    </div>
  );
}

function HealthDrawer({ d, onClose }: { d: HealthResponse; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} size="xl" icon={<HeartPulse size={18} />} title="Company health report"
      description={`Last 28 days ${formatDate(d.window.from)} – ${formatDate(d.window.to)}${d.window.lastYear ? ` vs ${formatDate(d.window.lastYear.from)} – ${formatDate(d.window.lastYear.to)}` : ''} · all outlets`}>
      <div className="space-y-2">
        <DrawerSection title="Score">
          <div className="flex flex-wrap items-start gap-6">
            <Score d={d} />
            <p className="max-w-xl text-xs leading-relaxed text-slate-500">
              Each scored indicator counts 100 when good, 50 on watch and 0 at risk; the score is their average. Context indicators describe
              the business without a common target. Targets are rules of thumb used by coffee and quick-service chains, guides rather than
              certifications. {d.excluded}
            </p>
          </div>
        </DrawerSection>
        {GROUPS.map(g => {
          const items = d.indicators.filter(i => i.group === g);
          if (!items.length) return null;
          return (
            <DrawerSection key={g} title={g}>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-3 py-2">Indicator</th><th className="px-3 py-2 text-right">Value</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Target</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map(i => (
                      <tr key={i.key} className="align-top">
                        <td className="px-3 py-2"><p className="font-medium text-slate-800">{i.label}</p><p className="mt-0.5 text-xs leading-relaxed text-slate-500">{i.detail}</p></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{value(i)}</td>
                        <td className="px-3 py-2"><StatusPill status={i.status} /></td>
                        <td className="px-3 py-2 text-xs text-slate-500">{i.target}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DrawerSection>
          );
        })}
        <DrawerSection title="Month by month since the ESB roll-out">
          <div className="custom-scrollbar overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>{['Month', 'Sales', 'Bills', 'Outlets', 'Per outlet per day', 'Avg ticket'].map(h => <th key={h} className="whitespace-nowrap px-3 py-2 text-right first:text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {[...d.months].reverse().map(m => (
                  <tr key={m.month}>
                    <td className="whitespace-nowrap px-3 py-1.5">{new Date(`${m.month}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}{m.days < 28 ? <span className="text-xs text-slate-400"> · {m.days} days</span> : null}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(Math.round(m.subtotal))}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(m.bills)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(m.outlets)}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(m.perOutletDay ?? 0)}</td>
                    <td className="px-3 py-1.5 text-right">{formatCurrency(m.avgTicket ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DrawerSection>
      </div>
    </Drawer>
  );
}

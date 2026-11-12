'use client';

// COGS & Usage per outlet (Cost Control · Analytics, page cc.cogs; integrated_portal_be app/outlet_cogs.py, 2026-11-07):
// one row per branch with SO awal and SO akhir in the period — nett sales, COGS by the recipe cards (system) and by the
// stock (SO awal + moves − SO akhir), the usage ratio (actual ÷ system on the same materials), the approved waste and
// what stays unexplained, with the checks of the data: SO approved, coverage of the materials, SO anomalies, prices.
// The period starts on the day of a stock opname and ends the day before the next one (that count is the SO akhir).

import CostControlBrand from '@/components/CostControlBrand';
import ExcelIconButton from '@/components/ExcelIconButton';
import { AlertTriangle, BarChart3, CalendarDays, CheckCircle2, Store } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DocChecks from '@/so/features/cogs/DocChecks';
import { Badge, cx, Empty, ErrorState, fmtNumber, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from '@/so/ui';
import { Stat, StatSkeleton, StatStrip } from '@/so/ui/StatStrip';
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from '@/so/ui/Filters';
import { FilterRow, MonitorFilterSheet, QuickPeriod, periodLabel } from '@/so/ui/MonitorFilters';
import { SortTh, useSort } from '@/so/ui/Sort';
import { call } from '@/so/features/checkin/checkin';
import { downloadXlsx } from '@/lib/xlsx';
import { tr } from '@/lib/i18n';

type Row = {
  branch: string; branchName: string; gross: number; nett: number; bills: number; systemCogs: number; actualCogs: number;
  systemRatio: number | null; actualRatio: number | null; usageRatio: number | null; likeSystem: number; likeActual: number;
  difference: number; waste: number; unexplained: number; coverage: { materials: number; counted: number };
  anomalies: number; anomalyValue: number; unpriced: string[]; final: boolean;
  so: { start: { date: string; refs: string[]; source: string }; end: { date: string; refs: string[]; source: string } };
};
type Total = { branches: number; final: number; gross: number; nett: number; systemCogs: number; actualCogs: number; difference: number; waste: number;
  unexplained: number; anomalies: number; anomalyValue: number; systemRatio: number | null; actualRatio: number | null; usageRatio: number | null };
type Result = { period: { from: string; to: string }; data: Row[]; total: Total | null; counts: { start: number; end: number } };
type Key = 'outlet' | 'nett' | 'system' | 'actual' | 'usage' | 'difference' | 'unexplained' | 'anomalies';

const rp = (n: number | null | undefined) => (n == null ? '—' : `Rp ${Math.round(n).toLocaleString('id-ID')}`);
const pct = (n: number | null | undefined, d = 1) => (n == null ? '—' : `${(n * 100).toFixed(d)}%`);
/** usage ratio: within ±5 % of the cards good, within ±15 % to watch, else wrong (stock, cards or the counts) */
const usageTone = (u: number | null) => (u == null ? 'text-neutral-400' : Math.abs(u - 1) <= 0.05 ? 'text-emerald-700' : Math.abs(u - 1) <= 0.15 ? 'text-amber-700' : 'text-red-700');
const DEF = (): Period => ({ from: wibDay(-7), to: wibDay(-1) });
const sortValue = (r: Row, k: Key) => ({ outlet: r.branchName, nett: r.nett, system: r.systemRatio, actual: r.actualRatio,
  usage: r.usageRatio == null ? null : Math.abs(r.usageRatio - 1), difference: r.difference, unexplained: r.unexplained, anomalies: r.anomalies }[k]);

export default function CogsPage() {
  return <DashboardLayout><CostControlBrand><Cogs /></CostControlBrand></DashboardLayout>;
}

function Cogs() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>(DEF);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sheet, setSheet] = useState(false);
  const load = useCallback(async () => {
    setError(null); setRes(null);
    try { setRes(await call<Result>(`/api/cost-control/cogs/outlets?dateFrom=${period.from}&dateTo=${period.to}`)); } catch (e) { setError((e as Error).message); }
  }, [period]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (res?.data ?? []).filter((r) => r.coverage.materials > 0 && (!q || r.branchName.toLowerCase().includes(q.toLowerCase()))), [res, q]);
  const { rows: sorted, sort, toggle } = useSort<Row, Key>(rows, sortValue, { key: 'usage', dir: 'desc' });
  const paged = usePaged(sorted, q + JSON.stringify(sort) + rows.length, 25);
  const t = res?.total;
  const noCards = (res?.data ?? []).filter((r) => r.coverage.materials === 0);
  const def = DEF();
  const chips: ActiveFilter[] = periodLabel(period, def) ? [{ key: 'p', label: periodLabel(period, def)!, onRemove: () => setPeriod(def) }] : [];
  const exportRows = () => downloadXlsx({ fileName: `COGS & Usage ${period.from} - ${period.to}`, sheet: 'Outlet', title: `COGS & Usage per outlet ${dmy(period.from)} – ${dmy(period.to)}`,
    header: ['Outlet', 'Kode', 'SO Awal', 'SO Akhir', 'SO Final', 'Gross Sales', 'Nett Sales', 'COGS Sistem', 'COGS Sistem %', 'COGS Aktual', 'COGS Aktual %', 'Usage Ratio',
      'Selisih Aktual − Sistem', 'Waste Approved', 'Tak Terjelaskan', 'Bahan Dihitung SO', 'Bahan di Resep', 'Anomali SO', 'Dampak Anomali', 'Bahan Tanpa Harga'],
    rows: sorted.map((r) => [r.branchName, r.branch, `${r.so.start.date} (${r.so.start.refs.join(', ')})`, `${r.so.end.date} (${r.so.end.refs.join(', ')})`, r.final ? 'Ya' : 'Belum',
      r.gross, r.nett, r.systemCogs, r.systemRatio, r.actualCogs, r.actualRatio, r.usageRatio, r.difference, r.waste, r.unexplained,
      r.coverage.counted, r.coverage.materials, r.anomalies, r.anomalyValue, r.unpriced.join(', ')]) });
  return (
    <Page title={tr('COGS & Usage')} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr('per outlet, between the SO awal and the SO akhir')}`}
      stats={
        <StatStrip label={tr('Summary')} columns={5}>
          <Stat label={tr('Outlets')} emphasis icon={<Store size={13} />} value={res ? fmtNumber(t?.branches ?? 0) : <StatSkeleton />}>
            {res && <p>{t ? tr('{0} with both SO approved', fmtNumber(t.final)) : tr('no outlet with SO awal & akhir')}</p>}</Stat>
          <Stat label={tr('Nett Sales')} icon={<BarChart3 size={13} />} value={res ? rp(t?.nett) : <StatSkeleton />} />
          <Stat label={tr('COGS System / Actual')} icon={<CheckCircle2 size={13} />} value={res ? `${pct(t?.systemRatio)} / ${pct(t?.actualRatio)}` : <StatSkeleton />}>
            {res && t && <p>{rp(t.systemCogs)} · {rp(t.actualCogs)}</p>}</Stat>
          <Stat label={tr('Usage Ratio')} icon={<BarChart3 size={13} />} value={res ? <span className={usageTone(t?.usageRatio ?? null)}>{pct(t?.usageRatio)}</span> : <StatSkeleton />}>
            {res && t && <p>{tr('waste {0} · unexplained {1}', rp(t.waste), rp(t.unexplained))}</p>}</Stat>
          <Stat label={tr('SO Anomalies')} icon={<AlertTriangle size={13} />} value={res ? <span className={t?.anomalies ? 'text-red-700' : undefined}>{fmtNumber(t?.anomalies ?? 0)}</span> : <StatSkeleton />}>
            {res && t && <p>{tr('{0} of impact: correct them first', rp(t.anomalyValue))}</p>}</Stat>
        </StatStrip>
      }>
      {res && !t && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {tr('No outlet has an SO awal on {0} and an SO akhir the day after {1}: choose a period that starts on a stock opname day and ends the day before the next one.', dmy(period.from), dmy(period.to))}
          <span className="block text-xs">{tr('{0} outlets with an SO awal · {1} with an SO akhir', res.counts.start, res.counts.end)}</span>
        </div>
      )}
      <Panel className="mt-4" toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr('Search outlet')} filters={chips} onOpen={() => setSheet(true)} onClear={() => setPeriod(def)}
        extra={<ExcelIconButton boxed className="ml-auto" label={tr('Export to Excel')} disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, 'error'))} />} />}
        footer={res ? <><span>{tr('{0} outlets', fmtNumber(rows.length))}{noCards.length ? ` · ${tr('{0} without recipe cards left out', noCards.length)}` : ''}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={9} /></tbody></table>
          : !rows.length ? <Empty icon={<BarChart3 size={26} />} title={tr('No outlet to show for this period')} /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm">
              <thead className={theadClass}><tr>
                <SortTh k="outlet" sort={sort} onSort={toggle} className="pl-5">{tr('Outlet')}</SortTh>
                <SortTh k="nett" sort={sort} onSort={toggle} align="right" first="desc">{tr('Nett Sales')}</SortTh>
                <SortTh k="system" sort={sort} onSort={toggle} align="right" first="desc">{tr('COGS System')}</SortTh>
                <SortTh k="actual" sort={sort} onSort={toggle} align="right" first="desc">{tr('COGS Actual')}</SortTh>
                <SortTh k="usage" sort={sort} onSort={toggle} align="right" first="desc">{tr('Usage Ratio')}</SortTh>
                <SortTh k="difference" sort={sort} onSort={toggle} align="right" first="desc">{tr('Actual − System')}</SortTh>
                <SortTh k="unexplained" sort={sort} onSort={toggle} align="right" first="desc">{tr('Unexplained')}</SortTh>
                <SortTh k="anomalies" sort={sort} onSort={toggle} align="right" first="desc">{tr('Data')}</SortTh>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">{paged.rows.map((r) => (
                <tr key={r.branch} className="hover:bg-neutral-50/70">
                  <td className="max-w-[16rem] py-2.5 pl-5 pr-3">
                    <Link href={`/cost-control/sales-calculator?branch=${encodeURIComponent(r.branch)}&dateFrom=${period.from}&dateTo=${period.to}`} className="block truncate font-medium text-neutral-900 hover:text-brand-700">{r.branchName}</Link>
                    <span className="text-[11px] text-neutral-400">{tr('SO {0} → {1}', dmy(r.so.start.date), dmy(r.so.end.date))}</span>
                    {!r.final && <Badge tone="amber">{tr('SO not approved')}</Badge>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{rp(r.nett)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-medium">{pct(r.systemRatio)}</span><span className="block text-[11px] text-neutral-400">{rp(r.systemCogs)}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums"><span className="font-medium">{pct(r.actualRatio)}</span><span className="block text-[11px] text-neutral-400">{rp(r.actualCogs)}</span></td>
                  <td className={cx('whitespace-nowrap px-4 py-2.5 text-right text-base font-semibold tabular-nums', usageTone(r.usageRatio))}>{pct(r.usageRatio, 0)}</td>
                  <td className={cx('whitespace-nowrap px-4 py-2.5 text-right tabular-nums', r.difference > 0 ? 'text-red-700' : 'text-emerald-700')}>{rp(r.difference)}
                    {r.waste ? <span className="block text-[11px] text-neutral-400">{tr('waste {0}', rp(r.waste))}</span> : null}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{rp(r.unexplained)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs">
                    <span className={r.coverage.counted < r.coverage.materials ? 'text-amber-700' : 'text-neutral-500'}>{tr('SO {0}/{1}', r.coverage.counted, r.coverage.materials)}</span>
                    {r.anomalies > 0 && <span className="block text-red-700">{tr('{0} anomalies', r.anomalies)}</span>}
                    {r.unpriced.length > 0 && <span className="block text-amber-700" title={r.unpriced.join(', ')}>{tr('{0} no price', r.unpriced.length)}</span>}
                  </td>
                </tr>))}</tbody>
            </table>
            <p className="px-5 py-2 text-[11px] text-neutral-500">{tr('Usage ratio = actual ÷ system on the materials counted at both ends; green within ±5 %, amber within ±15 %. Open an outlet for its materials in the Sales Calculator.')}</p></div>
          )}
      </Panel>
      <DocChecks from={period.from} to={period.to} onChanged={() => void load()} />
      {sheet && <PeriodSheet value={period} onClose={() => setSheet(false)} onApply={(p) => { setPeriod(p); setSheet(false); }} />}
    </Page>
  );
}

function PeriodSheet({ value, onApply, onClose }: { value: Period; onApply: (p: Period) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  const def = DEF();
  const days = Math.round((Date.parse(d.to) - Date.parse(d.from)) / 864e5) + 1;
  return (
    <MonitorFilterSheet active={periodLabel(d, def) ? 1 : 0} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)} applyDisabled={days > 93}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr('Period')} value={periodLabel(d, def) ?? tr('Last 7 Days')} onClear={() => setD(def)}>
        <QuickPeriod value={d} onChange={setD} maxDays={93} />
        <p className="mt-2 text-xs text-neutral-500">{tr('Start on the day of a stock opname, end the day before the next one.')}</p>
      </FilterRow>
    </MonitorFilterSheet>
  );
}

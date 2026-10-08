'use client';

import { ReactNode, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarRange, Check, GitCompareArrows, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import Drawer from '@/components/ui/Drawer';
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import { Branch } from '@/components/BranchFilter';
import { compareRange, CompareMode } from '@/components/overview/CompareFilter';
import { channelLabel } from '@/lib/overview';
import { formatDate, formatNumber, toIsoDate } from '@/lib/format';
import { locale, tr } from '@/lib/i18n';

export interface OverviewFilterValue {
  from: string; // '' = default period
  to: string;
  branch: string; // codes separated by commas, '' = all
  channels: string[]; // [] = all
  cmp: CompareMode;
  cmpFrom: string;
  cmpTo: string;
}

type View = 'period' | 'day';

export const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 864e5) + 1;
const weekdayDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** A day-vs-day view = one day compared with one other day. */
export function isDayVsDay(v: OverviewFilterValue): boolean {
  return Boolean(v.from && v.from === (v.to || v.from) && v.cmp === 'custom' && v.cmpFrom && v.cmpFrom === (v.cmpTo || v.cmpFrom));
}

/** The comparison actually used, also for "previous period" (the same number of days just before). */
export function effectiveCompare(mode: CompareMode, cmpFrom: string, cmpTo: string, period: { from: string; to: string } | null) {
  const r = compareRange({ mode, from: cmpFrom, to: cmpTo }, period);
  if (r || !period || mode !== 'auto') return r;
  const n = dayCount(period.from, period.to);
  return { from: shiftDay(period.from, -n), to: shiftDay(period.from, -1) };
}

function presets(): { label: string; from: string; to: string }[] {
  const today = toIsoDate(new Date());
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { label: tr('Today'), from: today, to: today },
    { label: tr('Yesterday'), from: shiftDay(today, -1), to: shiftDay(today, -1) },
    { label: tr('Last 7 days'), from: shiftDay(today, -7), to: shiftDay(today, -1) },
    { label: tr('Last 30 days'), from: shiftDay(today, -30), to: shiftDay(today, -1) },
    { label: tr('Last 90 days'), from: shiftDay(today, -90), to: shiftDay(today, -1) },
    { label: tr('This month'), from: toIsoDate(new Date(y, m, 1)), to: today },
    { label: tr('Last month'), from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: tr('This year'), from: toIsoDate(new Date(y, 0, 1)), to: today },
  ];
}

const COMPARE: { mode: CompareMode; label: string }[] = [
  { mode: 'auto', get label() { return tr('Previous period'); } },
  { mode: 'month', get label() { return tr('Same dates last month'); } },
  { mode: 'year', get label() { return tr('Same dates last year'); } },
  { mode: 'custom', get label() { return tr('Custom dates'); } },
];

const DAY_PICKS: [string, number][] = [['Last week', -7], ['4 weeks ago', -28], ['Day before', -1], ['Last year', -364]];

const choice = (on: boolean) =>
  `inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 ${
    on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}`;

/** All Overview filters in one drawer: date range (or two days), comparison, branches, channels. */
export default function OverviewFilterDrawer({ value, branches, channels, defaultPeriod, onApply, onClose }: {
  value: OverviewFilterValue;
  branches: Branch[];
  channels: string[];
  defaultPeriod: { from: string; to: string } | null;
  onApply: (v: OverviewFilterValue) => void;
  onClose: () => void;
}) {
  const today = toIsoDate(new Date());
  const yesterday = shiftDay(today, -1);
  const [draft, setDraft] = useState<OverviewFilterValue>(value);
  const [view, setView] = useState<View>(isDayVsDay(value) ? 'day' : 'period');
  const [dayA, setDayA] = useState(isDayVsDay(value) ? value.from : yesterday);
  const [dayB, setDayB] = useState(isDayVsDay(value) ? value.cmpFrom : shiftDay(yesterday, -7));
  const [branchQuery, setBranchQuery] = useState('');
  const set = (patch: Partial<OverviewFilterValue>) => setDraft(d => ({ ...d, ...patch }));

  // leaving day-vs-day: its single-day custom comparison is not a period choice
  const periodCmp = isDayVsDay(value) && draft.cmp === 'custom' && draft.cmpFrom === value.cmpFrom
    ? { cmp: 'auto' as CompareMode, cmpFrom: '', cmpTo: '' } : {};
  const pd = { ...draft, ...periodCmp };
  const period = pd.from ? { from: pd.from, to: pd.to || pd.from } : defaultPeriod;
  const cmp = effectiveCompare(pd.cmp, pd.cmpFrom, pd.cmpTo, period);
  const activePreset = period ? presets().find(p => p.from === period.from && p.to === period.to)?.label : undefined;

  const codes = draft.branch ? draft.branch.split(',').filter(Boolean) : [];
  const shown = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    return branches.filter(b => !q || b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q));
  }, [branches, branchQuery]);
  const nameOf = (code: string) => branches.find(b => b.branch_code === code)?.branch_name ?? code;
  const toggleBranch = (code: string) => set({ branch: (codes.includes(code) ? codes.filter(c => c !== code) : [...codes, code]).join(',') });
  const selectShown = () => set({ branch: [...new Set([...codes, ...shown.map(b => b.branch_code)])].join(',') });
  const toggleChannel = (ch: string) => set({ channels: draft.channels.includes(ch) ? draft.channels.filter(c => c !== ch) : [...draft.channels, ch] });

  const sameWeekday = dayA && dayB && new Date(`${dayA}T00:00:00`).getDay() === new Date(`${dayB}T00:00:00`).getDay();
  const invalid = view === 'day' ? !dayA || !dayB : pd.cmp === 'custom' && !pd.cmpFrom;

  const apply = () => {
    if (view === 'day') onApply({ ...draft, from: dayA, to: dayA, cmp: 'custom', cmpFrom: dayB, cmpTo: dayB });
    else onApply(pd);
  };
  const reset = () => {
    setDraft({ from: '', to: '', branch: '', channels: [], cmp: 'auto', cmpFrom: '', cmpTo: '' });
    setView('period');
    setBranchQuery('');
  };

  return (
    <Drawer open onClose={onClose} size="md" focusFirstField={false} icon={<SlidersHorizontal size={18} />} title={tr('Filters')}
      description={tr('Applies to every chart on this page.')}
      footer={
        <>
          <button type="button" onClick={reset}
            className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <RotateCcw size={14} /> {tr('Reset')}
          </button>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Cancel')}</button>
          <button type="button" className={buttonPrimary} onClick={apply} disabled={invalid}>{tr('Apply')}</button>
        </>
      }>
      <div className="space-y-7">
        {/* ---------------------------------------------------------------- dates */}
        <Group title={tr('Dates')}>
          <div role="radiogroup" aria-label={tr('Date view')} className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {([['period', tr('Date range'), CalendarRange], ['day', tr('Compare two days'), GitCompareArrows]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                  view === v ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                <Icon size={15} />{l}
              </button>
            ))}
          </div>

          {view === 'period' ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {presets().map(p => (
                  <button key={p.label} type="button" onClick={() => set({ from: p.from, to: p.to })}
                    aria-pressed={activePreset === p.label} className={`${choice(activePreset === p.label)} h-9 px-2 text-xs`}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div>
                <Label>{tr('Custom range')}</Label>
                <div className="flex items-center gap-2">
                  <input type="date" aria-label={tr('From')} value={period?.from ?? ''} max={period?.to || today}
                    onChange={e => e.target.value && set({ from: e.target.value, to: period && period.to >= e.target.value ? period.to : e.target.value })} className={inputClass} />
                  <span className="text-slate-400">–</span>
                  <input type="date" aria-label={tr('To')} value={period?.to ?? ''} min={period?.from || undefined} max={today}
                    onChange={e => e.target.value && set({ to: e.target.value, from: period && period.from <= e.target.value ? period.from : e.target.value })} className={inputClass} />
                </div>
              </div>

              <div>
                <Label htmlFor="compare">{tr('Compare with')}</Label>
                <select id="compare" value={pd.cmp} className={inputClass}
                  onChange={e => { const mode = e.target.value as CompareMode; set({ cmp: mode, ...(mode === 'custom' ? {} : { cmpFrom: '', cmpTo: '' }) }); }}>
                  {COMPARE.map(o => <option key={o.mode} value={o.mode}>{o.label}</option>)}
                </select>
                {pd.cmp === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="date" aria-label={tr('Compare from')} value={pd.cmpFrom} max={today}
                      onChange={e => set({ cmpFrom: e.target.value, cmpTo: pd.cmpTo && pd.cmpTo >= e.target.value ? pd.cmpTo : e.target.value })} className={inputClass} />
                    <span className="text-slate-400">–</span>
                    <input type="date" aria-label={tr('Compare to')} value={pd.cmpTo || pd.cmpFrom} min={pd.cmpFrom || undefined} max={today}
                      onChange={e => set({ cmpTo: e.target.value })} className={inputClass} />
                  </div>
                )}
              </div>

              {/* what will be shown, in plain dates */}
              <dl className="grid gap-x-4 gap-y-0.5 rounded-lg bg-slate-50 px-3.5 py-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-y-1.5">
                <dt className="text-slate-500">{tr('Showing')}</dt>
                <dd className="mb-1.5 font-medium text-slate-900 sm:mb-0 sm:text-right">
                  {period ? <>{formatDate(period.from)} – {formatDate(period.to)} <span className="font-normal text-slate-500">· {formatNumber(dayCount(period.from, period.to))} {tr('days')}</span></> : tr('Last 30 days')}
                </dd>
                <dt className="text-slate-500">{tr('Compared with')}</dt>
                <dd className="font-medium text-slate-900 sm:text-right">
                  {cmp ? <>{formatDate(cmp.from)} – {formatDate(cmp.to)} <span className="font-normal text-slate-500">· {formatNumber(dayCount(cmp.from, cmp.to))} {tr('days')}</span></> : tr('Pick the dates')}
                </dd>
              </dl>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <DayField id="dayA" label={tr('Day')} value={dayA} max={today} onChange={setDayA} />
                <span className="mt-8 text-xs font-semibold text-slate-400">{tr('vs')}</span>
                <DayField id="dayB" label={tr('Compared with')} value={dayB} max={today} onChange={setDayB} />
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {DAY_PICKS.map(([key, d]) => {
                  const label = tr(key);
                  const on = !!dayA && dayB === shiftDay(dayA, d);
                  return (
                    <button key={label} type="button" disabled={!dayA} onClick={() => setDayB(shiftDay(dayA, d))}
                      aria-pressed={on} className={`${choice(on)} h-9 px-2 text-xs`}>{label}</button>
                  );
                })}
              </div>
              {dayA && dayB && !sameWeekday && (
                <p className="flex items-start gap-2 text-xs text-amber-800">
                  <AlertTriangle size={14} className="mt-px flex-shrink-0" /> {tr('Different weekdays. Pick the same weekday for a fair comparison.')}
                </p>
              )}
            </div>
          )}
        </Group>

        {/* ---------------------------------------------------------------- branches */}
        <Group title={tr('Branches')} status={codes.length ? tr('{0} selected', codes.length) : tr('All branches')}
          action={codes.length > 0 && <TextButton onClick={() => set({ branch: '' })}>{tr('Clear')}</TextButton>}>
          {codes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {codes.map(c => (
                <span key={c} className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-50 py-1 pl-2 pr-1 text-xs font-medium text-blue-800">
                  <span className="truncate">{nameOf(c)}</span>
                  <button type="button" onClick={() => toggleBranch(c)} aria-label={tr('Remove {0}', nameOf(c))} className="rounded p-0.5 hover:bg-blue-100"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={branchQuery} onChange={e => setBranchQuery(e.target.value)} placeholder={tr('Search branch name or code')}
              className={`${inputClass} pl-9`} aria-label={tr('Search branch')} />
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            {branchQuery.trim() && shown.length > 0 && (
              <button type="button" onClick={selectShown}
                className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
                {tr('Select all')} {formatNumber(shown.length)} {tr('results')} <Check size={13} />
              </button>
            )}
            <ul className="custom-scrollbar max-h-64 divide-y divide-slate-100 overflow-auto">
              {shown.map(b => {
                const on = codes.includes(b.branch_code);
                return (
                  <li key={b.branch_code}>
                    <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm ${on ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggleBranch(b.branch_code)} className="h-4 w-4 accent-blue-700" />
                      <span className={`min-w-0 flex-1 truncate ${on ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{b.branch_name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{b.branch_code}</span>
                    </label>
                  </li>
                );
              })}
              {!shown.length && <li className="px-3 py-6 text-center text-sm text-slate-400">{tr('No branch matches “')}{branchQuery}”</li>}
            </ul>
          </div>
        </Group>

        {/* ---------------------------------------------------------------- channels */}
        <Group title={tr('Channels')} status={draft.channels.length ? tr('{0} selected', draft.channels.length) : tr('All channels')}
          action={draft.channels.length > 0 && <TextButton onClick={() => set({ channels: [] })}>{tr('Clear')}</TextButton>}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {channels.map(ch => {
              const on = draft.channels.includes(ch);
              return (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)} aria-pressed={on} className={`${choice(on)} h-9 justify-start px-3`}>
                  <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate">{channelLabel(ch)}</span>
                </button>
              );
            })}
          </div>
          {!draft.channels.length && <p className="text-xs text-slate-500">{tr('No channel ticked = all channels.')}</p>}
        </Group>
      </div>
    </Drawer>
  );
}

function Group({ title, status, action, children }: { title: string; status?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">
          {title}{status && <span className="ml-2 font-normal text-slate-500">{status}</span>}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>;
}

function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline">{children}</button>;
}

function DayField({ id, label, value, max, onChange }: { id: string; label: string; value: string; max: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} type="date" value={value} max={max} onChange={e => onChange(e.target.value)} className={inputClass} />
      <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-slate-600"><CalendarDays size={12} className="flex-shrink-0 text-slate-400" />{weekdayDate(value)}</p>
    </div>
  );
}

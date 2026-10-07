'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Check, GitCompareArrows, Search, SlidersHorizontal, Store, Waypoints } from 'lucide-react';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import { Branch } from '@/components/BranchFilter';
import { compareRange, CompareMode } from '@/components/overview/CompareFilter';
import { channelLabel } from '@/lib/overview';
import { formatDate, toIsoDate } from '@/lib/format';

export interface OverviewFilterValue {
  from: string; // '' = default period
  to: string;
  branch: string; // codes separated by commas, '' = all
  channels: string[]; // [] = all
  cmp: CompareMode;
  cmpFrom: string;
  cmpTo: string;
}

type Analysis = 'period' | 'day';

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
const longDay = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—');

/** A day-vs-day view = one day compared with one other day. */
export function isDayVsDay(v: OverviewFilterValue): boolean {
  return Boolean(v.from && v.from === (v.to || v.from) && v.cmp === 'custom' && v.cmpFrom && v.cmpFrom === (v.cmpTo || v.cmpFrom));
}

function presets(): { label: string; from: string; to: string }[] {
  const today = toIsoDate(new Date());
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { label: 'Today', from: today, to: today },
    { label: 'Yesterday', from: shift(today, -1), to: shift(today, -1) },
    { label: 'Last 7 days', from: shift(today, -7), to: shift(today, -1) },
    { label: 'Last 30 days', from: shift(today, -30), to: shift(today, -1) },
    { label: 'Last 90 days', from: shift(today, -90), to: shift(today, -1) },
    { label: 'Month to date', from: toIsoDate(new Date(y, m, 1)), to: today },
    { label: 'Last month', from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'Year to date', from: toIsoDate(new Date(y, 0, 1)), to: today },
  ];
}

const COMPARE: { mode: CompareMode; label: string; hint: string }[] = [
  { mode: 'auto', label: 'Previous period', hint: 'The same number of days just before' },
  { mode: 'month', label: 'Same dates last month', hint: 'e.g. 1–10 Sep vs 1–10 Aug' },
  { mode: 'year', label: 'Same dates last year', hint: 'e.g. Sep 2026 vs Sep 2025' },
  { mode: 'custom', label: 'Custom period', hint: 'Any period, also of another length' },
];

/** All Overview filters in one drawer: analysis (period or day vs day) with its comparison, branches, channels. */
export default function OverviewFilterDrawer({ value, branches, channels, defaultPeriod, onApply, onClose }: {
  value: OverviewFilterValue;
  branches: Branch[];
  channels: string[];
  defaultPeriod: { from: string; to: string } | null;
  onApply: (v: OverviewFilterValue) => void;
  onClose: () => void;
}) {
  const yesterday = shift(toIsoDate(new Date()), -1);
  const [draft, setDraft] = useState<OverviewFilterValue>(value);
  const [analysis, setAnalysis] = useState<Analysis>(isDayVsDay(value) ? 'day' : 'period');
  const [dayA, setDayA] = useState(isDayVsDay(value) ? value.from : yesterday);
  const [dayB, setDayB] = useState(isDayVsDay(value) ? value.cmpFrom : shift(yesterday, -7));
  const [branchQuery, setBranchQuery] = useState('');
  const set = (patch: Partial<OverviewFilterValue>) => setDraft(d => ({ ...d, ...patch }));

  const period = draft.from ? { from: draft.from, to: draft.to || draft.from } : defaultPeriod;
  const cmp = compareRange({ mode: draft.cmp, from: draft.cmpFrom, to: draft.cmpTo }, period);
  const codes = draft.branch ? draft.branch.split(',').filter(Boolean) : [];
  const shown = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    return branches.filter(b => !q || b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q));
  }, [branches, branchQuery]);
  const toggleBranch = (code: string) => set({ branch: (codes.includes(code) ? codes.filter(c => c !== code) : [...codes, code]).join(',') });
  const toggleChannel = (ch: string) => set({ channels: draft.channels.includes(ch) ? draft.channels.filter(c => c !== ch) : [...draft.channels, ch] });
  const weekdayA = dayA ? new Date(`${dayA}T00:00:00`).getDay() : null;
  const weekdayB = dayB ? new Date(`${dayB}T00:00:00`).getDay() : null;

  const apply = () => {
    if (analysis === 'day') {
      onApply({ ...draft, from: dayA, to: dayA, cmp: 'custom', cmpFrom: dayB, cmpTo: dayB });
    } else {
      // leaving day-vs-day: its single-day custom comparison is not a period choice
      const wasDay = isDayVsDay(value) && draft.cmp === 'custom' && draft.cmpFrom === value.cmpFrom;
      onApply(wasDay ? { ...draft, cmp: 'auto', cmpFrom: '', cmpTo: '' } : draft);
    }
  };

  const activePreset = presets().find(p => p.from === draft.from && p.to === (draft.to || draft.from))?.label ?? (draft.from ? 'Custom' : 'Default');

  return (
    <Drawer open onClose={onClose} size="md" icon={<SlidersHorizontal size={18} />} title="Filters"
      description="Every analytic on the Overview follows these filters, including the comparison."
      footer={
        <>
          <button type="button" className={`${buttonSecondary} mr-auto`}
            onClick={() => { setDraft({ from: '', to: '', branch: '', channels: [], cmp: 'auto', cmpFrom: '', cmpTo: '' }); setAnalysis('period'); }}>
            Reset all
          </button>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={buttonPrimary} onClick={apply} disabled={analysis === 'day' && (!dayA || !dayB)}>Apply filters</button>
        </>
      }>
      <div className="space-y-2">
        <DrawerSection title="Analysis">
          <div role="radiogroup" aria-label="Analysis" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            {([['period', 'Period', CalendarDays], ['day', 'Day vs day', GitCompareArrows]] as const).map(([v, l, Icon]) => (
              <button key={v} type="button" role="radio" aria-checked={analysis === v} onClick={() => setAnalysis(v)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium ${analysis === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                <Icon size={15} />{l}
              </button>
            ))}
          </div>

          {analysis === 'period' ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Period · <span className="text-slate-800">{activePreset}</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {presets().map(p => {
                    const on = p.from === draft.from && p.to === (draft.to || draft.from);
                    return (
                      <button key={p.label} type="button" onClick={() => set({ from: p.from, to: p.to })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500">From
                    <input type="date" value={draft.from} max={draft.to || undefined} onChange={e => set({ from: e.target.value, to: draft.to && draft.to >= e.target.value ? draft.to : e.target.value })} className={`${inputClass} mt-1`} />
                  </label>
                  <label className="text-xs text-slate-500">To
                    <input type="date" value={draft.to || draft.from} min={draft.from || undefined} onChange={e => set({ to: e.target.value, from: draft.from || e.target.value })} className={`${inputClass} mt-1`} />
                  </label>
                </div>
                {!draft.from && defaultPeriod && <p className="mt-1.5 text-[11px] text-slate-400">Default: {formatDate(defaultPeriod.from)} – {formatDate(defaultPeriod.to)} (last 30 complete days)</p>}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Compare with</p>
                <div className="space-y-1">
                  {COMPARE.map(o => {
                    const on = draft.cmp === o.mode;
                    const r = o.mode === 'month' || o.mode === 'year' ? compareRange({ mode: o.mode, from: '', to: '' }, period) : null;
                    return (
                      <button key={o.mode} type="button" onClick={() => set({ cmp: o.mode, ...(o.mode === 'custom' ? {} : { cmpFrom: '', cmpTo: '' }) })}
                        className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left ${on ? 'border-slate-900 bg-slate-900/[0.03]' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>{on && <Check size={10} strokeWidth={3} />}</span>
                        <span>
                          <span className="block text-sm font-medium text-slate-800">{o.label}</span>
                          <span className="block text-xs text-slate-500">{r ? `${formatDate(r.from)} – ${formatDate(r.to)}` : o.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {draft.cmp === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-500">Compare from
                      <input type="date" value={draft.cmpFrom} onChange={e => set({ cmpFrom: e.target.value, cmpTo: draft.cmpTo && draft.cmpTo >= e.target.value ? draft.cmpTo : e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                    <label className="text-xs text-slate-500">to
                      <input type="date" value={draft.cmpTo || draft.cmpFrom} min={draft.cmpFrom || undefined} onChange={e => set({ cmpTo: e.target.value })} className={`${inputClass} mt-1`} />
                    </label>
                  </div>
                )}
                {cmp && <p className="mt-2 text-[11px] text-slate-500">Comparing {period ? `${formatDate(period.from)} – ${formatDate(period.to)}` : 'the period'} with {formatDate(cmp.from)} – {formatDate(cmp.to)}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500">Day
                  <input type="date" value={dayA} max={toIsoDate(new Date())} onChange={e => setDayA(e.target.value)} className={`${inputClass} mt-1`} />
                  <span className="mt-1 block font-normal text-slate-700">{longDay(dayA)}</span>
                </label>
                <label className="text-xs font-medium text-slate-500">Compared with
                  <input type="date" value={dayB} max={toIsoDate(new Date())} onChange={e => setDayB(e.target.value)} className={`${inputClass} mt-1`} />
                  <span className="mt-1 block font-normal text-slate-700">{longDay(dayB)}</span>
                </label>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Quick pick for {longDay(dayA)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {([['Same weekday last week', -7], ['Same weekday 4 weeks ago', -28], ['Day before', -1], ['Same weekday last year', -364]] as const).map(([label, d]) => (
                    <button key={label} type="button" onClick={() => setDayB(shift(dayA, d))}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${dayB === shift(dayA, d) ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {weekdayA !== null && weekdayB !== null && weekdayA !== weekdayB && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Different weekdays: sales differ by weekday by nature (weekends are busier). Compare the same weekday for a fair view.
                </p>
              )}
              <p className="text-xs leading-relaxed text-slate-500">
                Every analytic shows {longDay(dayA)} against {longDay(dayB)}: key figures with the difference in rupiah and %, the sales trend per hour,
                channels, growth, branches, busy hours, menus, payment methods, basket and deductions.
              </p>
            </div>
          )}
        </DrawerSection>

        <DrawerSection title={`Branches${codes.length ? ` · ${codes.length} selected` : ' · all'}`}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={branchQuery} onChange={e => setBranchQuery(e.target.value)} placeholder="Search branch or code" className={`${inputClass} pl-9`} aria-label="Search branch" />
            </div>
            {codes.length > 0 && <button type="button" className={buttonSecondary} onClick={() => set({ branch: '' })}>All</button>}
          </div>
          <ul className="custom-scrollbar max-h-60 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
            {shown.map(b => {
              const on = codes.includes(b.branch_code);
              return (
                <li key={b.branch_code}>
                  <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm ${on ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleBranch(b.branch_code)} className="accent-slate-900" />
                    <Store size={14} className="text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{b.branch_name}</span>
                    <span className="text-[11px] text-slate-400">{b.branch_code}</span>
                  </label>
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-4 text-center text-sm text-slate-400">No branch matches</li>}
          </ul>
        </DrawerSection>

        <DrawerSection title={`Channels${draft.channels.length ? ` · ${draft.channels.length} selected` : ' · all'}`}>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set({ channels: [] })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${!draft.channels.length ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              <Waypoints size={12} /> All channels
            </button>
            {channels.map(ch => {
              const on = draft.channels.includes(ch);
              return (
                <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {channelLabel(ch)}
                </button>
              );
            })}
          </div>
        </DrawerSection>
      </div>
    </Drawer>
  );
}

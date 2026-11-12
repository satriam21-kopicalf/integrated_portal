'use client';

// User Accounts → Calf On The Road (2026-11-12): an account of the COTR team is made from its employee in Master Driver
// (name, phone, position and department filled from it; the account is tied to the employee) and a kind of account that
// sets the role and the COTR pages: Driver (the driver app), Storage / Stockist HUB, Pool Leader, COTR Management, or
// Custom (the page access by hand). No ESB branches: the COTR team works with pools.

import { Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';

export type CotrKind = 'driver' | 'storage' | 'leader' | 'management' | 'custom';
export type CotrEmployee = { code: string; name: string; nickname: string | null; phone: string | null; pool: string | null; poolName: string | null;
  department: string | null; position: string | null; username?: string | null };

/** the COTR pages each kind opens (on top of none of the role user's own pages) */
export const COTR_KIND_PAGES: Record<Exclude<CotrKind, 'driver' | 'custom'>, string[]> = {
  storage: ['cotr.storage', 'guide'],
  leader: ['cotr.storage', 'cotr.check-in', 'guide'],
  management: ['cotr.check-in', 'cotr.storage', 'cotr.production', 'cotr.drivers', 'cotr.fleet', 'cotr.pools', 'cotr.menu', 'cotr.schedule',
    'cotr.incentive', 'cotr.management', 'guide'],
};
export const COTR_KINDS: { key: CotrKind; label: () => string; hint: () => string; prefix: string }[] = [
  { key: 'driver', label: () => tr('Driver'), hint: () => tr('Signs in to the Calf On The Road app only'), prefix: 'drv.' },
  { key: 'storage', label: () => tr('Storage / Stockist HUB'), hint: () => tr('Portal: Storage & Assignment of the pools (assign, receive, physical leftover, waste & cupping)'), prefix: 'cotr.' },
  { key: 'leader', label: () => tr('Pool Leader'), hint: () => tr('Portal: Storage & Assignment and Driver Check In'), prefix: 'cotr.' },
  { key: 'management', label: () => tr('COTR Management'), hint: () => tr('Portal: every COTR menu, the salaries and bank accounts included'), prefix: 'cotr.' },
  { key: 'custom', label: () => tr('Custom'), hint: () => tr('Choose the pages by hand below'), prefix: 'cotr.' },
];

/** the page exceptions of a kind: every page of the role user off, the COTR pages of the kind on */
export function cotrOverrides(kind: CotrKind, userRolePages: string[]): Record<string, boolean> {
  if (kind === 'driver' || kind === 'custom') return {};
  const on = new Set(COTR_KIND_PAGES[kind]);
  const out: Record<string, boolean> = {};
  for (const p of userRolePages) if (!on.has(p)) out[p] = false;
  for (const p of on) if (!userRolePages.includes(p)) out[p] = true;
  return out;
}

/** the kind an existing account is, from its role and pages */
export function kindOf(role: string, pages: string[] | undefined): CotrKind {
  if (role === 'driver') return 'driver';
  const has = new Set(pages ?? []);
  const match = (k: keyof typeof COTR_KIND_PAGES) => COTR_KIND_PAGES[k].filter(p => p.startsWith('cotr.')).every(p => has.has(p))
    && [...has].filter(p => p.startsWith('cotr.')).every(p => COTR_KIND_PAGES[k].includes(p));
  return match('management') ? 'management' : match('leader') ? 'leader' : match('storage') ? 'storage' : 'custom';
}

export const usernameOf = (kind: CotrKind, e: CotrEmployee) =>
  (COTR_KINDS.find(k => k.key === kind)?.prefix ?? 'cotr.') + ((e.nickname || e.name.split(' ')[0] || e.code).toLowerCase().replace(/[^a-z0-9]/g, '') || e.code.toLowerCase());

export function EmployeePicker({ value, onPick, inputClass }: { value: CotrEmployee | null; onPick: (e: CotrEmployee) => void; inputClass: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CotrEmployee[] | null>(null);
  const [open, setOpen] = useState(!value);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      fetch(`/api/cotr/employees${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { data: [] })).then(r => { if (alive) setRows(r.data); }).catch(() => { if (alive) setRows([]); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, open]);
  if (value && !open) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
        <UserRound size={18} className="text-neutral-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-neutral-900">{value.name}{value.nickname ? ` (${value.nickname})` : ''}</span>
          <span className="block text-xs text-neutral-500">{[value.code, value.poolName, value.department, value.position].filter(Boolean).join(' · ')}</span>
        </span>
        <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setOpen(true)}>{tr('Change')}</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input className={`${inputClass} pl-8`} value={q} autoFocus onChange={e => setQ(e.target.value)} placeholder={tr('Search name, nickname or employee code')} />
      </label>
      <ul className="max-h-64 divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-200">
        {rows === null ? <li className="px-3 py-3 text-sm text-neutral-400">{tr('Loading…')}</li> : rows.length === 0 ? (
          <li className="px-3 py-3 text-sm text-neutral-400">{tr('No employee found: add them in Master Driver first')}</li>
        ) : rows.map(e => (
          <li key={e.code}>
            <button type="button" onClick={() => { onPick(e); setOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-900">{e.name}{e.nickname ? ` (${e.nickname})` : ''}</span>
                <span className="block text-xs text-neutral-500">{[e.code, e.poolName, e.department].filter(Boolean).join(' · ')}</span>
              </span>
              {e.username && <span className="flex-shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">{tr('has {0}', e.username)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

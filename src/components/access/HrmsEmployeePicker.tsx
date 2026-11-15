'use client';

// The HRMS employee of a person account (backend migration 110): the profile (name, employee no., gender, birth date,
// phone, address, work location, job title, department) follows HRMS; the User Accounts form shows those read-only. Search by name, email or employee number.

import { Link2Off, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { buttonSecondary, inputClass } from '@/components/ui/Dialog';
import type { Role } from '@/lib/auth';
import { serverMsg, tr } from '@/lib/i18n';

export type HrmsEmployee = {
  id: string; employeeNo: string | null; name: string; email: string | null; status: string | null;
  jobTitle: string | null; department: string | null; gender?: 'male' | 'female' | null; birthDate?: string | null;
  phone?: string | null; address?: string | null; workBranchCode?: string | null; site?: string | null; joinDate?: string | null;
};

/** Profile keys that follow HRMS (backend app/hrms_sync.py SYNCED). */
export const HRMS_FIELDS = ['fullName', 'employeeNumber', 'gender', 'birthDate', 'phoneNumber', 'address', 'workBranchCode', 'jobTitle', 'department'] as const;
export function hrmsValue(e: HrmsEmployee, key: (typeof HRMS_FIELDS)[number]): string {
  const v = { fullName: e.name, employeeNumber: e.employeeNo, gender: e.gender, birthDate: e.birthDate, phoneNumber: e.phone,
    address: e.address, workBranchCode: e.workBranchCode, jobTitle: e.jobTitle, department: e.department }[key];
  return (v ?? '').trim();
}

/** Roles whose job title / department follow HRMS (app/hrms_sync.py SCOPE_ROLES); outlet / hub stay manual. */
export const HRMS_ROLES: Role[] = ['user', 'cost_control', 'admin', 'driver', 'cotr_admin'];
export const followsHrms = (role: Role) => HRMS_ROLES.includes(role);

export default function HrmsEmployeePicker({ linked, picked, onPick, onUnlink, initialQuery, error }: {
  /** the account is linked already (edit) */
  linked: boolean;
  picked: HrmsEmployee | null;
  onPick: (e: HrmsEmployee) => void;
  onUnlink: () => void;
  initialQuery?: string;
  error?: string | null;
}) {
  const [q, setQ] = useState(initialQuery ?? '');
  const [hits, setHits] = useState<HrmsEmployee[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const find = async () => {
    if (q.trim().length < 2) return;
    setBusy(true); setProblem('');
    try {
      const res = await fetch(`/api/hrms-sync/employees?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
      const body = await res.json().catch(() => []);
      if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
      setHits(body);
    } catch (e) { setProblem((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      {(picked || linked) && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs">
          <span className="min-w-0">
            <span className="font-medium text-neutral-900">{picked ? `${picked.name} (${picked.employeeNo ?? '-'})` : tr('Linked to HRMS')}</span>
            {picked && <span className="block text-neutral-600">{picked.jobTitle || '—'} · {picked.department || '—'}{picked.site ? ` · ${picked.site}` : ''}</span>}
            {picked?.joinDate && <span className="block text-neutral-500">{tr('Joined {0}', picked.joinDate)} · {picked.status ?? ''}</span>}
          </span>
          <button type="button" className="text-neutral-500 hover:text-red-600" onClick={onUnlink} aria-label={tr('Unlink HRMS employee')}><Link2Off size={14} /></button>
        </div>
      )}
      <div className="flex gap-2">
        <input className={inputClass} value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Name, email or employee no.')} aria-label={tr('Search HRMS employee')}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void find(); } }} />
        <button type="button" className={buttonSecondary} onClick={find} disabled={busy} aria-label={tr('Search')}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </div>
      {(problem || error) && <p className="text-xs text-red-600">{problem || error}</p>}
      {hits && (
        <ul className="max-h-52 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200">
          {hits.map(e => (
            <li key={e.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-xs hover:bg-neutral-50" onClick={() => { onPick(e); setHits(null); }}>
                <span className="font-medium text-neutral-800">{e.name}</span> <span className="text-neutral-400">{e.employeeNo ?? ''} · {e.status ?? ''}</span>
                <span className="block truncate text-neutral-500">{e.jobTitle || '—'} · {e.department || '—'}</span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="px-3 py-2 text-xs text-neutral-400">{tr('No employee found')}</li>}
        </ul>
      )}
    </div>
  );
}

'use client';

// Job title & department of the person accounts (User / Cost Control / Admin) from HRMS (backend migration 110,
// superadmin only). Preview first: current values next to HRMS; apply all matched accounts or one; a name shared by
// several employees, or no match, is linked by hand. Outlet / hub accounts are not listed. Login is not affected.

import { Link2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pill, type PillTone } from '@/jira/kc';
import { buttonPrimary, buttonSecondary, inputClass } from '@/jira/kc';
import Drawer from '@/jira';
import { serverMsg, tr } from '@/lib/i18n';

type Emp = { id: string; employeeNo: string | null; name: string; email: string | null; status: string | null; jobTitle: string | null; department: string | null };
type Row = {
  id: string; username: string; name: string | null; role: string; businessLine: string | null; isActive: boolean; jobTitle: string | null; department: string | null;
  match: 'linked' | 'name' | 'email' | 'employee_no' | 'ambiguous' | 'none'; employee: Emp | null; candidates: Emp[];
  changes: boolean; employeeLeft: boolean;
};
type Filter = 'changes' | 'manual' | 'left' | 'all';

const MATCH: Record<Row['match'], [string, PillTone]> = {
  linked: ['Linked', 'brand'], name: ['By name', 'teal'], email: ['By email', 'teal'], employee_no: ['By employee no.', 'teal'],
  ambiguous: ['Several employees', 'amber'], none: ['Not found', 'red'],
};

const LINE: Record<string, string> = { kopicalf: 'Kopi Calf', wasgee: 'Wasgee', cotr: 'COTR' };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  return body as T;
}

const same = (a: string | null, b: string | null) => (a ?? '') === (b ?? '');

function Values({ title, dept, other }: { title: string | null; dept: string | null; other?: Row }) {
  const cls = (changed: boolean) => (changed ? 'font-medium text-[#0C66E4]' : 'text-[#44546F]');
  return (
    <div className="text-xs leading-5">
      <p className={cls(!!other && !same(title, other.jobTitle))}>{title || '—'}</p>
      <p className={`${cls(!!other && !same(dept, other.department))} text-[#626F86]`}>{dept || '—'}</p>
    </div>
  );
}

function LinkPicker({ row, onLinked }: { row: Row; onLinked: (msg: string) => void }) {
  const [q, setQ] = useState(row.name ?? '');
  const [hits, setHits] = useState<Emp[]>(row.candidates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const find = async () => {
    if (q.trim().length < 2) return;
    setBusy(true); setError('');
    try { setHits(await call<Emp[]>(`/api/hrms-sync/employees?q=${encodeURIComponent(q.trim())}`)); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const link = async (emp: Emp) => {
    setBusy(true); setError('');
    try {
      await call(`/api/hrms-sync/link/${row.id}`, { method: 'PUT', body: JSON.stringify({ employeeId: emp.id }) });
      onLinked(tr('{0} linked to {1}', row.username, emp.name));
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  return (
    <div className="mt-2 space-y-2 rounded-[3px] border border-[#DCDFE4] bg-[#F7F8F9] p-2">
      <div className="flex gap-2">
        <input className={`${inputClass} h-8 text-xs`} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void find(); }}
          placeholder={tr('Name, email or employee no.')} aria-label={tr('Search HRMS employee')} />
        <button type="button" className={buttonSecondary} onClick={find} disabled={busy} aria-label={tr('Search')}><Search size={14} /></button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="max-h-48 divide-y divide-[#DCDFE4] overflow-y-auto">
        {hits.map(e => (
          <li key={e.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
            <span className="min-w-0">
              <span className="font-medium text-[#172B4D]">{e.name}</span> <span className="text-[#626F86]">{e.employeeNo ?? ''} · {e.status ?? ''}</span>
              <span className="block truncate text-[#626F86]">{e.jobTitle || '—'} · {e.department || '—'}</span>
            </span>
            <button type="button" className={buttonSecondary} disabled={busy} onClick={() => link(e)}>{tr('Link')}</button>
          </li>
        ))}
        {!hits.length && <li className="py-1.5 text-xs text-[#626F86]">{tr('Search an employee to link')}</li>}
      </ul>
    </div>
  );
}

function SyncRow({ row, onApply, onLinked, busy }: { row: Row; onApply: () => void; onLinked: (m: string) => void; busy: boolean }) {
  const [picking, setPicking] = useState(false);
  const [label, tone] = MATCH[row.match];
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[#172B4D]">{row.name || row.username}</p>
          <p className="truncate text-xs text-[#626F86]">{row.username}{row.employee && ` → ${row.employee.name} (${row.employee.employeeNo ?? '-'})`}</p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap justify-end gap-1">
          {row.businessLine && <Pill tone="gray">{LINE[row.businessLine] ?? row.businessLine}</Pill>}
          <Pill tone={tone}>{tr(label)}</Pill>
          {row.employeeLeft && <Pill tone="red">{tr('Left in HRMS')}</Pill>}
        </div>
      </div>
      {row.employee && (
        <div className="mt-2 grid grid-cols-2 gap-3 rounded-[3px] bg-[#F7F8F9] p-2">
          <div><p className="text-xs capitalize text-[#626F86]">{tr('Portal now')}</p><Values title={row.jobTitle} dept={row.department} /></div>
          <div><p className="text-xs capitalize text-[#626F86]">{tr('HRMS')}</p><Values title={row.employee.jobTitle} dept={row.employee.department} other={row} /></div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {row.employee && row.changes && <button type="button" className={buttonSecondary} disabled={busy} onClick={onApply}>{tr('Apply HRMS values')}</button>}
        <button type="button" className={buttonSecondary} onClick={() => setPicking(p => !p)}><Link2 size={14} /> {row.employee ? tr('Change link') : tr('Link employee')}</button>
      </div>
      {picking && <LinkPicker row={row} onLinked={m => { setPicking(false); onLinked(m); }} />}
    </li>
  );
}

export default function HrmsSyncDrawer({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('changes');

  const load = useCallback(async () => {
    setError('');
    try { setRows((await call<{ rows: Row[] }>('/api/hrms-sync/preview')).rows); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const apply = async (ids?: string[]) => {
    setBusy(true); setError('');
    try {
      const r = await call<{ updated: number; skipped: number }>('/api/hrms-sync/apply', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) });
      setNote(tr('{0} accounts updated from HRMS', r.updated));
      onChanged(); await load();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const counts = useMemo(() => ({
    changes: rows?.filter(r => r.changes).length ?? 0,
    manual: rows?.filter(r => !r.employee).length ?? 0,
    left: rows?.filter(r => r.employeeLeft).length ?? 0,
    all: rows?.length ?? 0,
  }), [rows]);
  const shown = (rows ?? []).filter(r => filter === 'all' || (filter === 'changes' ? r.changes : filter === 'manual' ? !r.employee : r.employeeLeft));
  const tabs: [Filter, string][] = [['changes', 'To update'], ['manual', 'Link by hand'], ['left', 'Left in HRMS'], ['all', 'All']];

  return (
    <Drawer open size="lg" icon={<RefreshCw size={18} />} title={tr('Sync with HRMS')} onClose={onClose}
      description={tr('Job title and department of User, Inventory Surveyor, Admin and COTR driver accounts follow HRMS. Outlet/HUB accounts, sign-in, role and pages stay as they are.')}
      footer={<>
        <button type="button" className={buttonSecondary} onClick={() => void load()} disabled={busy}><RefreshCw size={14} /> {tr('Refresh')}</button>
        <button type="button" className={buttonPrimary} disabled={busy || !counts.changes} onClick={() => void apply()}>
          {busy && <Loader2 size={14} className="animate-spin" />} {tr('Apply all ({0})', counts.changes)}
        </button>
      </>}>
      <div role="tablist" aria-label={tr('Filter')} className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === k ? 'border-[#0C66E4] bg-[#E9F2FF] text-[#0C66E4]' : 'border-[#DCDFE4] text-[#44546F]'}`}>
            {tr(l)} · {counts[k]}
          </button>
        ))}
      </div>
      {note && <p className="mb-2 rounded-[3px] bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{note}</p>}
      {error && <p className="mb-2 rounded-[3px] bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {!rows && !error && <p className="flex items-center gap-2 text-sm text-[#626F86]"><Loader2 size={14} className="animate-spin" /> {tr('Loading')}</p>}
      <ul className="divide-y divide-[#F1F2F4]">
        {shown.map(r => <SyncRow key={r.id} row={r} busy={busy} onApply={() => void apply([r.id])} onLinked={m => { setNote(m); onChanged(); void load(); }} />)}
      </ul>
      {rows && !shown.length && <p className="py-6 text-center text-sm text-[#626F86]">{tr('Nothing here')}</p>}
    </Drawer>
  );
}

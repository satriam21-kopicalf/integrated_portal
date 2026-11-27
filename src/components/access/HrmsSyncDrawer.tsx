'use client';

// Job title & department of the person accounts (User / Cost Control / Admin) from HRMS (backend migration 110,
// superadmin only). Preview first: current values next to HRMS; apply all matched accounts or one; a name shared by
// several employees, or no match, is linked by hand. Outlet / hub accounts are not listed. Login is not affected.

import { Link2, Loader2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pill, type PillTone } from '@/jira/kc';
import { buttonPrimary, buttonSecondary, inputClass } from '@/jira/kc';
import Drawer, { QuickChips, SectionMessage } from '@/jira';
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
  const cls = (changed: boolean) => (changed ? 'font-medium text-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-44546F)]');
  return (
    <div className="text-xs leading-5">
      <p className={cls(!!other && !same(title, other.jobTitle))}>{title || '—'}</p>
      <p className={`${cls(!!other && !same(dept, other.department))} text-[color:var(--j-626F86)]`}>{dept || '—'}</p>
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
    <div className="mt-2 space-y-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] p-2">
      <div className="flex gap-2">
        <input className={inputClass} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void find(); }}
          placeholder={tr('Name, email or employee no.')} aria-label={tr('Search HRMS employee')} />
        <button type="button" className={buttonSecondary} onClick={find} disabled={busy} aria-label={tr('Search')}><Search size={14} /></button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="max-h-48 divide-y divide-[color:var(--j-DCDFE4)] overflow-y-auto">
        {hits.map(e => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="font-medium text-[color:var(--j-172B4D)]">{e.name}</span> <span className="text-[color:var(--j-626F86)]">{e.employeeNo ?? ''} · {e.status ?? ''}</span>
              <span className="block truncate text-[color:var(--j-626F86)]">{e.jobTitle || '—'} · {e.department || '—'}</span>
            </span>
            <button type="button" className={buttonSecondary} disabled={busy} onClick={() => link(e)}>{tr('Link')}</button>
          </li>
        ))}
        {!hits.length && <li className="py-1.5 text-xs text-[color:var(--j-626F86)]">{tr('Search an employee to link')}</li>}
      </ul>
    </div>
  );
}

function SyncRow({ row, onApply, onLinked, busy }: { row: Row; onApply: () => void; onLinked: (m: string) => void; busy: boolean }) {
  const [picking, setPicking] = useState(false);
  const [label, tone] = MATCH[row.match];
  return (
    <li className="rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3">
      {/* 2026-11-27 phones: the name over the whole width, the labels on their own line */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-[color:var(--j-172B4D)]">{row.name || row.username}</p>
          <p className="break-words text-xs text-[color:var(--j-626F86)]">@{row.username}{row.employee && <> → <span className="text-[color:var(--j-44546F)]">{row.employee.name}</span> ({row.employee.employeeNo ?? '-'})</>}</p>
        </div>
        <div className="flex flex-wrap gap-1 sm:flex-shrink-0 sm:justify-end">
          {row.businessLine && <Pill tone="gray">{LINE[row.businessLine] ?? row.businessLine}</Pill>}
          <Pill tone={tone}>{tr(label)}</Pill>
          {row.employeeLeft && <Pill tone="red">{tr('Left in HRMS')}</Pill>}
        </div>
      </div>
      {row.employee && (
        <div className="mt-2.5 grid grid-cols-2 gap-3 rounded-[3px] bg-[color:var(--j-F7F8F9)] p-2.5">
          <div><p className="text-xs font-semibold text-[color:var(--j-626F86)]">{tr('Portal now')}</p><Values title={row.jobTitle} dept={row.department} /></div>
          <div><p className="text-xs font-semibold text-[color:var(--j-626F86)]">{tr('HRMS')}</p><Values title={row.employee.jobTitle} dept={row.employee.department} other={row} /></div>
        </div>
      )}
      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {row.employee && row.changes && <button type="button" className={buttonPrimary} disabled={busy} onClick={onApply}>{tr('Apply HRMS values')}</button>}
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
      <div className="mb-3"><QuickChips<Filter> value={filter} onChange={setFilter} label={tr('Filter')} items={tabs.map(([k, l]) => ({ key: k, label: tr(l), count: rows ? counts[k] : null }))} /></div>
      {note && <div className="mb-3"><SectionMessage tone="success">{note}</SectionMessage></div>}
      {error && <div className="mb-3"><SectionMessage tone="error">{error}</SectionMessage></div>}
      {!rows && !error && <p className="flex items-center gap-2 text-sm text-[color:var(--j-626F86)]"><Loader2 size={14} className="animate-spin" /> {tr('Loading')}</p>}
      <ul className="space-y-2">
        {shown.map(r => <SyncRow key={r.id} row={r} busy={busy} onApply={() => void apply([r.id])} onLinked={m => { setNote(m); onChanged(); void load(); }} />)}
      </ul>
      {rows && !shown.length && <p className="py-6 text-center text-sm text-[color:var(--j-626F86)]">{tr('Nothing here')}</p>}
    </Drawer>
  );
}

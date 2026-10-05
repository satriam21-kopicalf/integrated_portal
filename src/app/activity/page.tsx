'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet, Filter, History, KeyRound, LogIn, LogOut, Monitor,
  RefreshCw, Search, ShieldAlert, SlidersHorizontal, UserCog, UserRound, X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangePicker from '@/components/DateRangePicker';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { inputClass, buttonSecondary } from '@/components/ui/Dialog';
import UserAvatar from '@/components/UserAvatar';
import { AuthUser, ROLE_LABELS, Role } from '@/lib/auth';
import { formatBytes, formatDate, formatDateTime, formatNumber, toIsoDate } from '@/lib/format';

// Activity log (superadmin only; the page guard and the API both enforce it).

interface Entry {
  id: number;
  at: string;
  user: { id: string | null; username: string | null; fullName: string | null; role: Role | null; avatarUrl: string | null };
  category: string;
  action: string;
  status: 'ok' | 'failed' | 'denied';
  page: string | null;
  summary: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
}

interface Summary {
  totals: { total: number; users: number; exports: number; downloads: number; failedLogins: number; denied: number };
  byCategory: Record<string, number>;
  topUsers: { id: string; username: string; role: Role; count: number; exports: number; lastAt: string }[];
}

const PAGE_SIZE = 50;
const REFRESH_MS = 30_000;

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'export', label: 'Exports' },
  { value: 'auth', label: 'Sign-in' },
  { value: 'page,filter', label: 'Pages & filters' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'user,profile', label: 'Accounts' },
  { value: 'access', label: 'Access denied' },
];

const ACTIONS: Record<string, { label: string; icon: ReactNode }> = {
  'auth.login': { label: 'Signed in', icon: <LogIn size={15} /> },
  'auth.login_failed': { label: 'Failed sign-in', icon: <KeyRound size={15} /> },
  'auth.logout': { label: 'Signed out', icon: <LogOut size={15} /> },
  'auth.password_change': { label: 'Changed own password', icon: <KeyRound size={15} /> },
  'profile.update': { label: 'Updated own profile', icon: <UserRound size={15} /> },
  'page.view': { label: 'Opened page', icon: <Monitor size={15} /> },
  'filter.change': { label: 'Changed filters', icon: <SlidersHorizontal size={15} /> },
  'transaction.view': { label: 'Opened transaction', icon: <Eye size={15} /> },
  'export.create': { label: 'Requested export', icon: <FileSpreadsheet size={15} /> },
  'export.done': { label: 'Export finished', icon: <FileSpreadsheet size={15} /> },
  'export.failed': { label: 'Export failed', icon: <FileSpreadsheet size={15} /> },
  'export.download': { label: 'Downloaded export', icon: <Download size={15} /> },
  'user.create': { label: 'Created user', icon: <UserCog size={15} /> },
  'user.update': { label: 'Updated user', icon: <UserCog size={15} /> },
  'user.delete': { label: 'Deleted user', icon: <UserCog size={15} /> },
  'user.unlock': { label: 'Unlocked user', icon: <UserCog size={15} /> },
  'access.denied': { label: 'Access denied', icon: <ShieldAlert size={15} /> },
};

const PAGES: Record<string, string> = {
  '/overview': 'Dashboard', '/sales': 'Sales Transactions', '/cost-control': 'Cost Control', '/users': 'User Accounts', '/activity': 'Activity Logs',
};

const TONES: Record<string, string> = {
  export: 'bg-emerald-50 text-emerald-700', auth: 'bg-blue-50 text-blue-700', page: 'bg-slate-100 text-slate-600',
  filter: 'bg-slate-100 text-slate-600', transaction: 'bg-violet-50 text-violet-700', user: 'bg-amber-50 text-amber-700',
  profile: 'bg-amber-50 text-amber-700', access: 'bg-red-50 text-red-700',
};

const REPORT_LABELS: Record<string, string> = { detail: 'Sales Recapitulation Detail', daily: 'Daily Sales Recapitulation' };
const TYPE_LABELS: Record<string, string> = { sales: 'Sales', void: 'Void & Cancelled', other_cost: 'Other Cost', all: 'All' };

function lastDays(n: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (n - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** "Chrome · Windows" from a user agent */
function device(ua: string | null): string {
  if (!ua) return '—';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}

function pageLabel(page: string | null): string {
  return page ? PAGES[page] ?? page : '—';
}

export default function ActivityPage() {
  const initial = useMemo(() => lastDays(7), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [category, setCategory] = useState('');
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/users?pageSize=100')
      .then(res => (res.ok ? res.json() : { data: [] }))
      .then(body => setUsers(body.data ?? []))
      .catch(() => {});
  }, []);

  const params = useMemo(() => {
    const p = new URLSearchParams({ dateFrom, dateTo });
    if (userId) p.set('user', userId);
    return p;
  }, [dateFrom, dateTo, userId]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const list = new URLSearchParams(params);
      if (category) list.set('category', category);
      if (status) list.set('status', status);
      if (query) list.set('search', query);
      list.set('limit', String(PAGE_SIZE));
      list.set('offset', String((page - 1) * PAGE_SIZE));
      const [a, b] = await Promise.all([fetch(`/api/activity?${list}`), fetch(`/api/activity/summary?${params}`)]);
      const body = await a.json();
      if (!a.ok) throw new Error(body.error || `HTTP ${a.status}`);
      setRows(body.data);
      setTotal(body.total);
      if (b.ok) setSummary(await b.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params, category, status, query, page]);

  useEffect(() => { load(); }, [load]);

  // new activity shows up by itself while the first page is open
  useEffect(() => {
    if (page !== 1) return;
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [page, load]);

  const onSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setQuery(value.trim()); setPage(1); }, 400);
  };
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const t = summary?.totals;
  const filtered = Boolean(category || userId || status || query);

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl"><History size={20} className="text-blue-700" /> Activity Logs</h1>
              <p className="text-xs text-slate-500 sm:text-sm">Who did what in the dashboard — sign-ins, pages, filters, transactions opened and every export</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} defaultLabel="last 7 days"
                onChange={(from, to) => {
                  const d = lastDays(7);
                  setDateFrom(from || to || d.from);
                  setDateTo(to || from || d.to);
                  setPage(1);
                }} />
              <button type="button" onClick={() => load()} className={`${buttonSecondary} h-10`} aria-label="Refresh" title="Refresh">
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        <StatStrip label="Activity summary" columns={5}>
          <Stat label="Activities" value={t ? formatNumber(t.total) : <StatSkeleton />}>
            {t && <p>{formatDate(dateFrom)} – {formatDate(dateTo)}</p>}
          </Stat>
          <Stat label="Active users" value={t ? formatNumber(t.users) : <StatSkeleton />} />
          <Stat label="Exports" emphasis value={t ? formatNumber(t.exports) : <StatSkeleton />}>
            {t && <p>{formatNumber(t.downloads)} downloads</p>}
          </Stat>
          <Stat label="Failed sign-ins" value={t ? formatNumber(t.failedLogins) : <StatSkeleton />} />
          <Stat label="Access denied" value={t ? formatNumber(t.denied) : <StatSkeleton />}>
            {t && <p>pages or data outside the user&apos;s access</p>}
          </Stat>
        </StatStrip>

        <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-12">
          <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-9">
            {/* filters */}
            <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search user, activity, file name, sales no."
                    className={`${inputClass} pl-9`} aria-label="Search activity" />
                </div>
                <select value={userId} onChange={e => resetPage(setUserId)(e.target.value)} className={`${inputClass} sm:w-52`} aria-label="User">
                  <option value="">All users</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.username})</option>)}
                </select>
                <select value={status} onChange={e => resetPage(setStatus)(e.target.value)} className={`${inputClass} sm:w-36`} aria-label="Result">
                  <option value="">All results</option>
                  <option value="ok">Succeeded</option>
                  <option value="failed">Failed</option>
                  <option value="denied">Denied</option>
                </select>
              </div>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Category">
                {CATEGORIES.map(c => {
                  const active = c.value === category;
                  const n = c.value ? c.value.split(',').reduce((s, k) => s + (summary?.byCategory[k] ?? 0), 0) : summary?.totals.total;
                  return (
                    <button key={c.label} type="button" role="tab" aria-selected={active} onClick={() => resetPage(setCategory)(c.value)}
                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {c.label}
                      {n !== undefined && <span className={`tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{formatNumber(n)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <AlertCircle className="text-red-500" />
                <p className="text-sm text-slate-700">{error}</p>
                <button type="button" className={buttonSecondary} onClick={() => load()}>Try again</button>
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-14 text-center">
                <Filter className="mb-2 text-slate-300" size={28} />
                <p className="text-sm font-medium text-slate-700">{filtered ? 'No activity matches the filters' : 'No activity in this period'}</p>
              </div>
            ) : (
              <ul className={`divide-y divide-slate-100 ${loading && rows.length ? 'opacity-60' : ''}`}>
                {(loading && !rows.length ? Array.from({ length: 8 }) : rows).map((r, i) => r ? (
                  <EntryRow key={(r as Entry).id} entry={r as Entry} onOpen={() => setSelected(r as Entry)} />
                ) : (
                  <li key={i} className="px-4 py-3"><div className="h-9 animate-pulse rounded bg-slate-100" /></li>
                ))}
              </ul>
            )}

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row">
              <span>{formatNumber(total)} activities{filtered ? ' match' : ''}{page === 1 ? ' · refreshes every 30 s' : ''}</span>
              <div className="flex items-center gap-2">
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span>Page {page} of {pages}</span>
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>

          <aside className="min-w-0 xl:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Most active users</h2>
              {!summary ? (
                <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />)}</div>
              ) : summary.topUsers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No activity</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {summary.topUsers.map(u => (
                    <li key={u.id}>
                      <button type="button" onClick={() => resetPage(setUserId)(userId === u.id ? '' : u.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${userId === u.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                        title={userId === u.id ? 'Show all users' : `Only ${u.username}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">{u.username}</p>
                          <p className="truncate text-[11px] text-slate-500">{ROLE_LABELS[u.role] ?? u.role} · last {formatDateTime(u.lastAt)}</p>
                        </div>
                        <div className="text-right text-xs tabular-nums">
                          <p className="font-semibold text-slate-800">{formatNumber(u.count)}</p>
                          <p className="text-slate-400">{formatNumber(u.exports)} export</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {selected && <EntryDrawer entry={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

function StatusBadge({ status }: { status: Entry['status'] }) {
  if (status === 'ok') return null;
  const tone = status === 'denied' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status === 'denied' ? 'Denied' : 'Failed'}</span>;
}

function EntryRow({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  const action = ACTIONS[entry.action];
  const name = entry.user.fullName || entry.user.username || 'Unknown';
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50">
        <UserAvatar name={name} src={entry.user.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-slate-900">{name}</span>
            {entry.user.username && entry.user.fullName && <span className="text-xs text-slate-400">{entry.user.username}</span>}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONES[entry.category] ?? TONES.page}`}>
              {action?.icon}{action?.label ?? entry.action}
            </span>
            <StatusBadge status={entry.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600">{entry.summary || pageLabel(entry.page)}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {formatDateTime(entry.at)} · {pageLabel(entry.page)}{entry.ip ? ` · ${entry.ip}` : ''} · {device(entry.userAgent)}
          </p>
        </div>
      </button>
    </li>
  );
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100">
      {rows.filter(([, v]) => v !== undefined).map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="min-w-0 break-words text-slate-800">{v === null || v === '' ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function value(v: unknown): ReactNode {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return <pre className="whitespace-pre-wrap break-all font-mono text-xs text-slate-700">{JSON.stringify(v, null, 2)}</pre>;
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function ExportDetails({ d }: { d: Record<string, unknown> }) {
  const s = (k: string) => (d[k] === null || d[k] === undefined ? null : String(d[k]));
  const branches = d.branches === 'all' ? 'All branches' : value(d.branches);
  return (
    <Rows rows={[
      ['Report', REPORT_LABELS[s('report') ?? ''] ?? s('report')],
      ['Transaction type', TYPE_LABELS[s('type') ?? ''] ?? s('type')],
      ['Period', d.dateFrom ? `${formatDate(s('dateFrom'))} – ${formatDate(s('dateTo'))} (${value(d.totalDays)} days)` : '—'],
      ['Branches', branches],
      ['Requested branch', d.requestedBranch !== undefined ? value(d.requestedBranch) : undefined],
      ['File', s('fileName')],
      ['Rows', d.rows !== undefined && d.rows !== null ? formatNumber(Number(d.rows)) : null],
      ['Transactions', d.headers !== undefined && d.headers !== null ? formatNumber(Number(d.headers)) : null],
      ['File size', d.fileSize ? formatBytes(Number(d.fileSize)) : null],
      ['Started', d.createdAt ? formatDateTime(s('createdAt')) : null],
      ['Finished', d.finishedAt ? formatDateTime(s('finishedAt')) : null],
      ['Error', d.error ? s('error') : undefined],
      ['Owner', d.ownerName !== undefined ? value(d.ownerName) : undefined],
      ['Job id', <span key="id" className="font-mono text-xs">{s('id')}</span>],
    ]} />
  );
}

function EntryDrawer({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const action = ACTIONS[entry.action];
  const name = entry.user.fullName || entry.user.username || 'Unknown';
  const details = Object.entries(entry.details ?? {});
  return (
    <Drawer open onClose={onClose} size="md" icon={<History size={18} />} title={action?.label ?? entry.action}
      description={formatDateTime(entry.at)}
      footer={<button type="button" className={buttonSecondary} onClick={onClose}><X size={16} /> Close</button>}>
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <UserAvatar name={name} src={entry.user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{name}</p>
          <p className="truncate text-sm text-slate-500">
            {entry.user.username ?? '—'}{entry.user.role ? ` · ${ROLE_LABELS[entry.user.role] ?? entry.user.role}` : ''}
          </p>
        </div>
        <div className="ml-auto"><StatusBadge status={entry.status} /></div>
      </div>

      <DrawerSection title="Activity">
        <Rows rows={[
          ['What', entry.summary],
          ['Activity', <span key="a" className="font-mono text-xs">{entry.action}</span>],
          ['Result', entry.status === 'ok' ? 'Succeeded' : entry.status === 'denied' ? 'Denied' : 'Failed'],
          ['Page', pageLabel(entry.page)],
          ['Time', formatDateTime(entry.at)],
        ]} />
      </DrawerSection>

      {details.length > 0 && (
        <DrawerSection title={entry.category === 'export' ? 'Export' : 'Details'}>
          {entry.category === 'export' ? <ExportDetails d={entry.details} /> : <Rows rows={details.map(([k, v]) => [k, value(v)])} />}
        </DrawerSection>
      )}

      <DrawerSection title="Device">
        <Rows rows={[
          ['IP address', entry.ip],
          ['Browser', device(entry.userAgent)],
          ['User agent', entry.userAgent ? <span key="ua" className="text-xs text-slate-500">{entry.userAgent}</span> : null],
        ]} />
      </DrawerSection>
    </Drawer>
  );
}

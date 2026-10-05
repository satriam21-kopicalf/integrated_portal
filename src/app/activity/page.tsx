'use client';

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ChevronRight, Download, Eye, FileSpreadsheet, Filter, History, KeyRound, Loader2, LogIn, LogOut, Monitor,
  Search, ShieldAlert, SlidersHorizontal, UserCog, UserRound, X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import DateRangePicker from '@/components/DateRangePicker';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { buttonPrimary, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { ActiveFilter, ActiveFilters, ChoiceGroup, FilterButton, SearchChoice } from '@/components/ui/FilterControls';
import UserAvatar from '@/components/UserAvatar';
import { AuthUser, ROLE_LABELS, Role } from '@/lib/auth';
import { formatBytes, formatDate, formatDateTime, formatNumber, toIsoDate } from '@/lib/format';

// Activity log (superadmin only; the page guard and the API both enforce it).
// Updates by itself: the newest entries are fetched every few seconds (and when the
// tab becomes visible again) and slide in at the top, highlighted.

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

interface Filters {
  user: string;
  status: string;
  role: string;
}

const PAGE_SIZE = 50;
const POLL_MS = 10_000;
const HIGHLIGHT_MS = 6_000;
const NO_FILTERS: Filters = { user: '', status: '', role: '' };

const CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'export', label: 'Exports' },
  { value: 'auth', label: 'Sign-in' },
  { value: 'page,filter', label: 'Pages & filters' },
  { value: 'transaction', label: 'Transactions' },
  { value: 'user,profile', label: 'Accounts' },
  { value: 'access', label: 'Access denied' },
];

/** label = title in the detail panel, verb = how the timeline sentence reads */
const ACTIONS: Record<string, { label: string; verb: string; icon: ReactNode }> = {
  'auth.login': { label: 'Signed in', verb: 'signed in', icon: <LogIn size={15} /> },
  'auth.login_failed': { label: 'Failed sign-in', verb: 'failed to sign in', icon: <KeyRound size={15} /> },
  'auth.logout': { label: 'Signed out', verb: 'signed out', icon: <LogOut size={15} /> },
  'auth.password_change': { label: 'Changed own password', verb: 'changed their password', icon: <KeyRound size={15} /> },
  'profile.update': { label: 'Updated own profile', verb: 'updated their profile', icon: <UserRound size={15} /> },
  'page.view': { label: 'Opened page', verb: 'opened', icon: <Monitor size={15} /> },
  'filter.change': { label: 'Changed filters', verb: 'changed filters', icon: <SlidersHorizontal size={15} /> },
  'transaction.view': { label: 'Opened transaction', verb: 'opened a transaction', icon: <Eye size={15} /> },
  'export.create': { label: 'Requested export', verb: 'requested an export', icon: <FileSpreadsheet size={15} /> },
  'export.done': { label: 'Export finished', verb: "'s export finished", icon: <FileSpreadsheet size={15} /> },
  'export.failed': { label: 'Export failed', verb: "'s export failed", icon: <FileSpreadsheet size={15} /> },
  'export.download': { label: 'Downloaded export', verb: 'downloaded an export', icon: <Download size={15} /> },
  'user.create': { label: 'Created user', verb: 'created a user', icon: <UserCog size={15} /> },
  'user.update': { label: 'Updated user', verb: 'updated a user', icon: <UserCog size={15} /> },
  'user.delete': { label: 'Deleted user', verb: 'deleted a user', icon: <UserCog size={15} /> },
  'user.unlock': { label: 'Unlocked user', verb: 'unlocked a user', icon: <UserCog size={15} /> },
  'access.denied': { label: 'Access denied', verb: 'was denied access', icon: <ShieldAlert size={15} /> },
};

const PAGES: Record<string, string> = {
  '/overview': 'Dashboard', '/sales': 'Sales Transactions', '/cost-control': 'Cost Control', '/users': 'User Accounts', '/activity': 'Activity Logs',
};

/** category -> icon tile + bar colour */
const TONES: Record<string, { tile: string; bar: string; label: string }> = {
  export: { tile: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', label: 'Exports' },
  auth: { tile: 'bg-blue-50 text-blue-700', bar: 'bg-blue-500', label: 'Sign-in' },
  page: { tile: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400', label: 'Pages' },
  filter: { tile: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300', label: 'Filters' },
  transaction: { tile: 'bg-violet-50 text-violet-700', bar: 'bg-violet-500', label: 'Transactions' },
  user: { tile: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', label: 'User accounts' },
  profile: { tile: 'bg-amber-50 text-amber-700', bar: 'bg-amber-300', label: 'Own profile' },
  access: { tile: 'bg-red-50 text-red-700', bar: 'bg-red-500', label: 'Access denied' },
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

function displayName(e: Entry): string {
  return e.user.fullName || e.user.username || 'Unknown';
}

/** "Today", "Yesterday" or "Monday, 5 October 2026" (browser time zone = WIB for the team) */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = toIsoDate(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const key = toIsoDate(d);
  const long = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return key === today ? `Today · ${long}` : key === toIsoDate(y) ? `Yesterday · ${long}` : long;
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function ActivityPage() {
  const initial = useMemo(() => lastDays(7), []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [category, setCategory] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ ok: boolean; at: number | null }>({ ok: true, at: null });
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Entry | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  // ?user=<id> from the User Accounts page
  useEffect(() => {
    const user = new URLSearchParams(window.location.search).get('user');
    if (user) setFilters(f => ({ ...f, user }));
  }, []);

  useEffect(() => {
    fetch('/api/users?pageSize=100')
      .then(res => (res.ok ? res.json() : { data: [] }))
      .then(body => setUsers(body.data ?? []))
      .catch(() => {});
  }, []);

  const base = useMemo(() => {
    const p = new URLSearchParams({ dateFrom, dateTo });
    if (filters.user) p.set('user', filters.user);
    if (filters.role) p.set('role', filters.role);
    return p;
  }, [dateFrom, dateTo, filters.user, filters.role]);

  const listUrl = useCallback((offset: number) => {
    const p = new URLSearchParams(base);
    if (category) p.set('category', category);
    if (filters.status) p.set('status', filters.status);
    if (query) p.set('search', query);
    p.set('limit', String(PAGE_SIZE));
    p.set('offset', String(offset));
    return `/api/activity?${p}`;
  }, [base, category, filters.status, query]);

  const fetchSummary = useCallback(() => {
    fetch(`/api/activity/summary?${base}`)
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (s) setSummary(s); })
      .catch(() => {});
  }, [base]);

  // first page whenever the filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(listUrl(0))
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body;
      })
      .then(body => {
        if (cancelled) return;
        setEntries(body.data);
        setTotal(body.total);
        setFresh(new Set());
        setLive({ ok: true, at: Date.now() });
      })
      .catch(err => { if (!cancelled) setError((err as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetchSummary();
    return () => { cancelled = true; };
  }, [listUrl, fetchSummary]);

  // live: newest entries every POLL_MS and when the tab is shown again
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(listUrl(0), { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const body: { data: Entry[]; total: number } = await r.json();
        if (stopped) return;
        const top = entriesRef.current[0]?.id ?? 0;
        const added = body.data.filter(e => e.id > top);
        if (added.length) {
          // a full page of news: there may be a gap, start over from the newest
          setEntries(prev => (added.length >= PAGE_SIZE ? body.data : [...added, ...prev]));
          setFresh(new Set(added.map(e => e.id)));
          setTimeout(() => setFresh(new Set()), HIGHLIGHT_MS);
          fetchSummary();
        }
        setTotal(body.total);
        setLive({ ok: true, at: Date.now() });
      } catch {
        if (!stopped) setLive(l => ({ ...l, ok: false }));
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [listUrl, fetchSummary]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await fetch(listUrl(entries.length));
      const body = await r.json();
      if (r.ok) {
        setEntries(prev => {
          const seen = new Set(prev.map(e => e.id));
          return [...prev, ...(body.data as Entry[]).filter(e => !seen.has(e.id))];
        });
        setTotal(body.total);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const onSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setQuery(value.trim()), 400);
  };

  const userName = (id: string) => {
    const u = users.find(x => x.id === id) ?? null;
    return u ? `${u.displayName} (${u.username})` : summary?.topUsers.find(t => t.id === id)?.username ?? 'Selected user';
  };
  const activeFilters: ActiveFilter[] = [
    ...(filters.user ? [{ key: 'user', label: `User: ${userName(filters.user)}`, onRemove: () => setFilters(f => ({ ...f, user: '' })) }] : []),
    ...(filters.status ? [{ key: 'status', label: `Result: ${filters.status === 'ok' ? 'Succeeded' : filters.status === 'denied' ? 'Denied' : 'Failed'}`, onRemove: () => setFilters(f => ({ ...f, status: '' })) }] : []),
    ...(filters.role ? [{ key: 'role', label: `Role: ${ROLE_LABELS[filters.role as Role]}`, onRemove: () => setFilters(f => ({ ...f, role: '' })) }] : []),
  ];

  // timeline grouped by day
  const days = useMemo(() => {
    const out: { key: string; label: string; items: Entry[] }[] = [];
    for (const e of entries) {
      const key = toIsoDate(new Date(e.at));
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, label: dayLabel(e.at), items: [e] });
    }
    return out;
  }, [entries]);

  const t = summary?.totals;
  const filtered = Boolean(category || query || activeFilters.length);
  const categoryTotal = summary ? Object.values(summary.byCategory).reduce((a, b) => a + b, 0) : 0;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Activity Logs</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">{formatDate(dateFrom)} – {formatDate(dateTo)} · sign-ins, pages, filters, transactions and exports</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} defaultLabel="last 7 days"
                onChange={(from, to) => {
                  const d = lastDays(7);
                  setDateFrom(from || to || d.from);
                  setDateTo(to || from || d.to);
                }} />
              <LiveBadge ok={live.ok} at={live.at} />
            </div>
          </div>
        </header>

        <StatStrip label="Activity summary" columns={5}>
          <Stat label="Activities" value={t ? formatNumber(t.total) : <StatSkeleton />}>
            {t && <p>{formatNumber(t.users)} active users</p>}
          </Stat>
          <Stat label="Exports" emphasis value={t ? formatNumber(t.exports) : <StatSkeleton />}>
            {t && <p>{formatNumber(t.downloads)} downloads</p>}
          </Stat>
          <Stat label="Transactions opened" value={summary ? formatNumber(summary.byCategory.transaction ?? 0) : <StatSkeleton />} />
          <Stat label="Failed sign-ins" value={t ? formatNumber(t.failedLogins) : <StatSkeleton />} />
          <Stat label="Access denied" value={t ? formatNumber(t.denied) : <StatSkeleton />}>
            {t && <p>pages or data outside the user&apos;s access</p>}
          </Stat>
        </StatStrip>

        <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-12">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-8 2xl:col-span-9">
            <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search user, activity, file name, sales no."
                    className={`${inputClass} pl-9 pr-9`} aria-label="Search activity" />
                  {search && (
                    <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <FilterButton count={activeFilters.length} onClick={() => setFiltersOpen(true)} />
              </div>
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1" role="tablist" aria-label="Category">
                {CATEGORIES.map(c => {
                  const active = c.value === category;
                  const n = c.value ? c.value.split(',').reduce((s, k) => s + (summary?.byCategory[k] ?? 0), 0) : summary?.totals.total;
                  return (
                    <button key={c.label} type="button" role="tab" aria-selected={active} onClick={() => setCategory(c.value)}
                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {c.label}
                      {n !== undefined && <span className={`tabular-nums ${active ? 'text-slate-300' : 'text-slate-400'}`}>{formatNumber(n)}</span>}
                    </button>
                  );
                })}
              </div>
              <ActiveFilters filters={activeFilters} onClear={() => setFilters(NO_FILTERS)} />
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <AlertCircle className="text-red-500" />
                <p className="text-sm text-slate-700">{error}</p>
                <p className="text-xs text-slate-400">Retrying automatically…</p>
              </div>
            ) : loading && !entries.length ? (
              <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}</div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-14 text-center">
                <Filter className="mb-2 text-slate-300" size={28} />
                <p className="text-sm font-medium text-slate-700">{filtered ? 'No activity matches the search or filters' : 'No activity in this period yet'}</p>
                <p className="mt-1 text-xs text-slate-400">New activity appears here automatically.</p>
              </div>
            ) : (
              <div className={loading ? 'opacity-60 transition-opacity' : ''}>
                {days.map(day => (
                  <section key={day.key} aria-label={day.label}>
                    <h2 className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-slate-50/95 px-4 py-2 text-xs font-semibold text-slate-600 backdrop-blur">
                      <span>{day.label}</span>
                      <span className="font-normal text-slate-400">{formatNumber(day.items.length)} shown</span>
                    </h2>
                    <ol className="divide-y divide-slate-100">
                      {day.items.map(e => <TimelineRow key={e.id} entry={e} isNew={fresh.has(e.id)} onOpen={() => setSelected(e)} />)}
                    </ol>
                  </section>
                ))}
              </div>
            )}

            <div className="flex flex-col items-center justify-between gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row">
              <span>{formatNumber(entries.length)} of {formatNumber(total)} activities{filtered ? ' matching' : ''}</span>
              {entries.length < total && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className={`${buttonSecondary} h-8`}>
                  {loadingMore && <Loader2 size={14} className="animate-spin" />} Load older activity
                </button>
              )}
            </div>
          </section>

          <aside className="min-w-0 space-y-4 xl:col-span-4 2xl:col-span-3">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Most active users</h2>
              {!summary ? (
                <div className="space-y-2 p-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />)}</div>
              ) : summary.topUsers.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">No activity</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {summary.topUsers.map((u, i) => {
                    const on = filters.user === u.id;
                    return (
                      <li key={u.id}>
                        <button type="button" onClick={() => setFilters(f => ({ ...f, user: on ? '' : u.id }))}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${on ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                          title={on ? 'Show all users' : `Only ${u.username}`}>
                          <span className="w-4 text-xs tabular-nums text-slate-400">{i + 1}</span>
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
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">By type</h2>
              {!summary ? (
                <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
              ) : !categoryTotal ? (
                <p className="text-sm text-slate-400">No activity</p>
              ) : (
                <ul className="space-y-2.5">
                  {Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => (
                    <li key={cat}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{TONES[cat]?.label ?? cat}</span>
                        <span className="tabular-nums text-slate-800">{formatNumber(n)}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${TONES[cat]?.bar ?? 'bg-slate-400'}`} style={{ width: `${Math.max(2, (n / categoryTotal) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>

      {filtersOpen && <ActivityFiltersDrawer value={filters} users={users} onApply={f => { setFilters(f); setFiltersOpen(false); }} onClose={() => setFiltersOpen(false)} />}
      {selected && <EntryDrawer entry={selected} onClose={() => setSelected(null)} />}
    </DashboardLayout>
  );
}

/** Updates arrive by themselves; shows when the list was last checked. */
function LiveBadge({ ok, at }: { ok: boolean; at: number | null }) {
  const time = at ? new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : null;
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs"
      title={ok ? 'New activity appears automatically (checked every 10 seconds)' : 'Connection problem — retrying automatically'}>
      <span className="relative flex h-2 w-2">
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      </span>
      <span className={`font-semibold ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{ok ? 'Live' : 'Reconnecting'}</span>
      {time && <span className="hidden text-slate-500 sm:inline">· updated {time}</span>}
    </span>
  );
}

function StatusBadge({ status }: { status: Entry['status'] }) {
  if (status === 'ok') return null;
  const tone = status === 'denied' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{status === 'denied' ? 'Denied' : 'Failed'}</span>;
}

/** One line of the timeline: time · type icon · "<who> <did what>" · what exactly · where/from. */
function TimelineRow({ entry, isNew, onOpen }: { entry: Entry; isNew: boolean; onOpen: () => void }) {
  const action = ACTIONS[entry.action];
  const tone = TONES[entry.category] ?? TONES.page;
  const verb = action?.verb ?? entry.action;
  const accent = entry.status === 'denied' ? 'border-l-red-500' : entry.status === 'failed' ? 'border-l-amber-500' : 'border-l-transparent';
  return (
    <li>
      <button type="button" onClick={onOpen}
        className={`group grid w-full grid-cols-[3.75rem_2rem_minmax(0,1fr)_1rem] items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors duration-700 hover:bg-slate-50 ${accent} ${isNew ? 'bg-blue-50/70' : ''}`}>
        <span className="pt-1.5 text-xs tabular-nums text-slate-500">{clock(entry.at)}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone.tile}`}>{action?.icon ?? <History size={15} />}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <span className="font-semibold text-slate-900">{displayName(entry)}</span>
            <span className="text-slate-600">{verb.startsWith("'") ? verb.slice(1) : verb}</span>
            {entry.action === 'page.view' && <span className="font-medium text-slate-800">{pageLabel(entry.page)}</span>}
            <StatusBadge status={entry.status} />
            {isNew && <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">New</span>}
          </span>
          {entry.summary && entry.action !== 'page.view' && <span className="mt-0.5 block truncate text-sm text-slate-600">{entry.summary}</span>}
          <span className="mt-0.5 block truncate text-[11px] text-slate-400">
            {entry.user.username && entry.user.fullName ? `@${entry.user.username} · ` : ''}
            {pageLabel(entry.page)} · {device(entry.userAgent)}{entry.ip ? ` · ${entry.ip}` : ''}
          </span>
        </span>
        <ChevronRight size={16} className="mt-1.5 text-slate-300 group-hover:text-slate-500" />
      </button>
    </li>
  );
}

function ActivityFiltersDrawer({ value, users, onApply, onClose }: {
  value: Filters; users: AuthUser[]; onApply: (f: Filters) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(value);
  const set = (key: keyof Filters) => (v: string) => setDraft(d => ({ ...d, [key]: v }));
  const options = useMemo(() => [...users].sort((a, b) => a.displayName.localeCompare(b.displayName)).map(u => ({
    value: u.id, label: `${u.displayName} (${u.username})`,
    meta: <span className="text-[11px] text-slate-400">{ROLE_LABELS[u.role]}</span>,
  })), [users]);
  return (
    <Drawer open onClose={onClose} size="sm" icon={<SlidersHorizontal size={18} />} title="Filter activity"
      description="Narrow the log by user, result and role. The type tabs and search stay on the page."
      footer={
        <>
          <button type="button" className={`${buttonSecondary} mr-auto`} onClick={() => setDraft(NO_FILTERS)}>Reset</button>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={buttonPrimary} onClick={() => onApply(draft)}>Apply filters</button>
        </>
      }>
      <div className="space-y-6">
        <ChoiceGroup label="Result" value={draft.status} onChange={set('status')} choices={[
          { value: '', label: 'All' }, { value: 'ok', label: 'Succeeded' }, { value: 'failed', label: 'Failed' }, { value: 'denied', label: 'Denied' },
        ]} />
        <ChoiceGroup label="Role" value={draft.role} onChange={set('role')} choices={[
          { value: '', label: 'All roles' }, { value: 'user', label: 'User' }, { value: 'superadmin', label: 'Super Admin' },
        ]} />
        <SearchChoice label="User" anyLabel="All users" options={options} value={draft.user} onChange={set('user')} placeholder="Search name or username" />
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ detail */

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
  const name = displayName(entry);
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

'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Copy, Eye, EyeOff, History, Info, KeyRound, Loader2, Lock, Pencil, Plus,
  Search, ShieldCheck, SlidersHorizontal, Store, Trash2, Unlock, UserPlus, UserRound, UserRoundPen, Wand2, X,
} from 'lucide-react';
import BranchAssign from '@/components/BranchAssign';
import type { Branch } from '@/components/BranchFilter';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ProfileFields, { PROFILE_KEYS, ProfileValues, profileValues } from '@/components/ProfileFields';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import ActionMenu, { ActionItem } from '@/components/ui/ActionMenu';
import Dialog, { buttonDanger, buttonPrimary, buttonSecondary, Field, inputClass } from '@/components/ui/Dialog';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { ActiveFilter, ActiveFilters, ChoiceGroup, FilterButton, SearchChoice } from '@/components/ui/FilterControls';
import UserAvatar, { AvatarEditor } from '@/components/UserAvatar';
import { AuthUser, GENDER_LABELS, Role, ROLE_LABELS, useAuth } from '@/lib/auth';
import { formatDateTime, formatNumber, parseLocalDate, toIsoDate } from '@/lib/format';
import { locale, tr, serverMsg } from '@/lib/i18n';

const PAGE_SIZE = 20;

interface UsersSummary {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  superadmins: number;
  users: number;
  withoutBranch: number;
  neverSignedIn: number;
  active7d: number;
  branchesCovered: number;
}

interface ListResponse {
  data: AuthUser[];
  total: number;
  page: number;
  pageSize: number;
}

class ApiError extends Error {
  constructor(message: string, public field?: string | null) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(serverMsg(body.error) || `HTTP ${res.status}`, body.field);
  return body as T;
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  const pw = Array.from(values, v => alphabet[v % alphabet.length]).join('');
  return /[A-Za-z]/.test(pw) && /\d/.test(pw) ? pw : generatePassword();
}

const JOB_TITLES = ['PIC Outlet', 'Store Leader', 'Area Manager', 'Operation Manager', 'Staff'];
const DEPARTMENTS = ['Operations', 'Finance', 'Purchasing', 'Marketing', 'Human Resources', 'IT'];

/** "Okta Fajri Ramadhan" -> "okta.fajri" (same rule as the accounts imported from user-accounts.xlsx) */
function suggestUsername(fullName: string): string {
  const words = fullName.normalize('NFKD').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).join('.').slice(0, 32);
}

/** Credentials of an account that was just created or got a new password (kept in memory only). */
interface IssuedLogin {
  user: AuthUser;
  password: string;
  created: boolean;
}

export default function UsersPage() {
  const router = useRouter();
  const { user: me, setUser: setMe } = useAuth();
  const [rows, setRows] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<UsersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<UserFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedLogin | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AuthUser | 'new' | null>(null);
  const [viewing, setViewing] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState<AuthUser | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  const allowed = me?.role === 'superadmin';
  useEffect(() => {
    if (!allowed) return;
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, [allowed]);
  const branchName = useCallback((code: string) => branches.find(b => b.branch_code === code)?.branch_name ?? code, [branches]);
  useEffect(() => {
    if (me && !allowed) router.replace('/overview');
  }, [me, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (query) params.set('search', query);
      if (filters.role) params.set('role', filters.role);
      if (filters.status) params.set('status', filters.status);
      if (filters.branch) params.set('branch', filters.branch);
      const [body, counts] = await Promise.all([
        api<ListResponse>(`/api/users?${params}`),
        api<UsersSummary>('/api/users/summary').catch(() => null),
      ]);
      setRows(body.data);
      setTotal(body.total);
      if (counts) setSummary(counts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, query, filters]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const onSearch = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); setQuery(value.trim()); }, 350);
  };
  const applyFilters = (next: UserFilters) => {
    setFilters(next);
    setPage(1);
  };

  const saved = (u: AuthUser, created: boolean, password?: string) => {
    setEditing(null);
    if (password) setIssued({ user: u, password, created });
    if (u.id === me?.id) setMe(u);
    setToast({ tone: 'ok', text: created ? tr('User {0} created', u.username) : tr('User {0} updated', u.username) });
    if (viewing?.id === u.id) setViewing(u);
    load();
  };

  const unlock = async (u: AuthUser) => {
    try {
      const body = await api<{ user: AuthUser }>(`/api/users/${u.id}/unlock`, { method: 'POST' });
      setToast({ tone: 'ok', text: tr('{0} unlocked', u.username) });
      if (viewing?.id === u.id) setViewing(body.user);
      load();
    } catch (err) {
      setToast({ tone: 'error', text: (err as Error).message });
    }
  };

  const actionsFor = (u: AuthUser): ActionItem[] => {
    const isMe = u.id === me?.id;
    return [
      { label: tr('View details'), icon: <Eye size={16} />, onSelect: () => setViewing(u) },
      { label: tr('Edit'), icon: <Pencil size={16} />, onSelect: () => setEditing(u) },
      ...(u.isLocked ? [{ label: tr('Unlock'), icon: <Unlock size={16} />, onSelect: () => unlock(u) }] : []),
      { label: tr('Activity log'), icon: <History size={16} />, onSelect: () => router.push(`/activity?user=${u.id}`) },
      {
        label: tr('Delete'), icon: <Trash2 size={16} />, onSelect: () => setDeleting(u), danger: true, separated: true,
        disabled: isMe, hint: isMe ? tr('You cannot delete your own account') : undefined,
      },
    ];
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilters: ActiveFilter[] = [
    ...(filters.role ? [{ key: 'role', label: tr('Role: {0}', ROLE_LABELS[filters.role as Role]), onRemove: () => applyFilters({ ...filters, role: '' }) }] : []),
    ...(filters.status ? [{ key: 'status', label: tr('Status: {0}', STATUS_LABELS[filters.status]), onRemove: () => applyFilters({ ...filters, status: '' }) }] : []),
    ...(filters.branch ? [{ key: 'branch', label: tr('Branch: {0}', branchName(filters.branch)), onRemove: () => applyFilters({ ...filters, branch: '' }) }] : []),
  ];
  const filtersActive = Boolean(query || activeFilters.length);

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
      </DashboardLayout>
    );
  }

  const s = summary;
  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{tr('User Accounts')}</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">{tr('Sign-in, role and branch access of every dashboard user')}</p>
            </div>
            <button type="button" className={buttonPrimary} onClick={() => setEditing('new')}>
              <Plus size={16} /> {tr('New user')}
            </button>
          </div>
        </header>

        <StatStrip label={tr('User summary')} columns={5}>
          <Stat label={tr('Users')} value={s ? formatNumber(s.total) : <StatSkeleton />}>
            {s && <p>{formatNumber(s.superadmins)} {tr('super admin ·')} {formatNumber(s.users)} {tr('user')}</p>}
          </Stat>
          <Stat label={tr('Active')} emphasis value={s ? formatNumber(s.active) : <StatSkeleton />}>
            {s && <p>{formatNumber(s.inactive)} {tr('inactive ·')} {formatNumber(s.locked)} {tr('locked')}</p>}
          </Stat>
          <Stat label={tr('Signed in, 7 days')} value={s ? formatNumber(s.active7d) : <StatSkeleton />}>
            {s && <p>{formatNumber(s.neverSignedIn)} {tr('never signed in')}</p>}
          </Stat>
          <Stat label={tr('Branches covered')} value={s ? formatNumber(s.branchesCovered) : <StatSkeleton />}>
            {s && <p>{tr('of')} {formatNumber(branches.filter(b => b.count > 0).length)} {tr('branches with recent sales')}</p>}
          </Stat>
          <Stat label={tr('Without branch')} value={s ? formatNumber(s.withoutBranch) : <StatSkeleton />}>
            {s && <p>{s.withoutBranch ? tr('role User sees no data until assigned') : tr('every User has a branch')}</p>}
          </Stat>
        </StatStrip>

        <div className="space-y-4 p-4 sm:p-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={e => onSearch(e.target.value)} placeholder={tr('Search name, username, email, phone or job title')}
                    className={`${inputClass} pl-9 pr-9`} aria-label={tr('Search users')} />
                  {search && (
                    <button type="button" onClick={() => onSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={tr('Clear search')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <FilterButton count={activeFilters.length} onClick={() => setFiltersOpen(true)} />
              </div>
              <ActiveFilters filters={activeFilters} onClear={() => applyFilters(NO_FILTERS)} />
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <AlertCircle className="text-red-500" />
                <p className="text-sm text-slate-700">{error}</p>
                <button type="button" className={buttonSecondary} onClick={load}>{tr('Try again')}</button>
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-14 text-center">
                <UserRound className="mb-2 text-slate-300" size={28} />
                <p className="text-sm font-medium text-slate-700">{filtersActive ? tr('No users match the search or filters') : tr('No users yet')}</p>
              </div>
            ) : (
              <div className={loading && rows.length ? 'opacity-60' : ''}>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-4 py-2.5">{tr('User')}</th>
                        <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">{tr('Contact')}</th>
                        <th scope="col" className="px-4 py-2.5">{tr('Role')}</th>
                        <th scope="col" className="px-4 py-2.5">{tr('Branch access')}</th>
                        <th scope="col" className="px-4 py-2.5">{tr('Status')}</th>
                        <th scope="col" className="hidden px-4 py-2.5 xl:table-cell">{tr('Last sign-in')}</th>
                        <th scope="col" className="w-14 px-3 py-2.5"><span className="sr-only">{tr('Actions')}</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(loading && !rows.length ? Array.from({ length: 6 }) : rows).map((u, i) => u ? (
                        <UserRow key={(u as AuthUser).id} user={u as AuthUser} isMe={(u as AuthUser).id === me?.id} branchName={branchName}
                          onView={() => setViewing(u as AuthUser)} actions={actionsFor(u as AuthUser)} />
                      ) : (
                        <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-9 animate-pulse rounded bg-slate-100" /></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="divide-y divide-slate-100 md:hidden">
                  {rows.map(u => (
                    <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                      <Avatar user={u} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(u)}>
                        <p className="truncate text-sm font-medium text-slate-900">{u.displayName}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-slate-400">{tr('(you)')}</span>}</p>
                        <p className="truncate text-xs text-slate-500">{u.username} · {u.email}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5"><RoleBadge role={u.role} /><BranchesBadge user={u} branchName={branchName} /><StatusBadge user={u} /></div>
                      </button>
                      <ActionMenu items={actionsFor(u)} label={tr('Actions for {0}', u.username)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row">
              <span>{formatNumber(total)} {total === 1 ? tr('user') : tr('users')}{filtersActive ? tr(' match') : ''}</span>
              <div className="flex items-center gap-2">
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label={tr('Previous page')}><ChevronLeft size={16} /></button>
                <span>{tr('Page')} {page} {tr('of')} {pages}</span>
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label={tr('Next page')}><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {filtersOpen && <UserFiltersDrawer value={filters} branches={branches} branchesLoading={branchesLoading}
        onApply={next => { applyFilters(next); setFiltersOpen(false); }} onClose={() => setFiltersOpen(false)} />}
      {editing && <UserFormDrawer user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me?.id}
        branches={branches} branchesLoading={branchesLoading}
        onClose={() => setEditing(null)} onSaved={saved} />}
      {viewing && <UserDetailDrawer user={viewing} isMe={viewing.id === me?.id} branchName={branchName} onClose={() => setViewing(null)}
        onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => { setDeleting(viewing); setViewing(null); }} onUnlock={() => unlock(viewing)} />}
      {deleting && <DeleteDialog user={deleting} onClose={() => setDeleting(null)}
        onDeleted={() => { setToast({ tone: 'ok', text: tr('User {0} deleted', deleting.username) }); setDeleting(null); load(); }}
        onError={text => setToast({ tone: 'error', text })} />}
      {issued && <IssuedLoginDrawer issued={issued} branchName={branchName} onClose={() => setIssued(null)} />}

      {toast && (
        <div className={`fixed left-1/2 top-4 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === 'ok' ? 'bg-slate-900' : 'bg-red-600'}`} role="status">
          {toast.tone === 'ok' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} />}
          {toast.text}
          <button type="button" onClick={() => setToast(null)} className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label={tr('Dismiss')}><X size={14} /></button>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ------------------------------------------------------------------ filters */

interface UserFilters {
  role: string;
  status: string;
  branch: string;
}

const NO_FILTERS: UserFilters = { role: '', status: '', branch: '' };
const STATUS_LABELS: Record<string, string> = { get active() { return tr('Active'); }, get inactive() { return tr('Inactive'); }, get locked() { return tr('Locked'); } };

/** Role, status and branch in one drawer; applied together. */
function UserFiltersDrawer({ value, branches, branchesLoading, onApply, onClose }: {
  value: UserFilters; branches: Branch[]; branchesLoading: boolean; onApply: (f: UserFilters) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<UserFilters>(value);
  const set = (key: keyof UserFilters) => (v: string) => setDraft(d => ({ ...d, [key]: v }));
  const options = useMemo(() => [...branches].sort((a, b) => a.branch_name.localeCompare(b.branch_name)).map(b => ({
    value: b.branch_code, label: b.branch_name, meta: <span className="font-mono text-[11px] text-slate-400">{b.branch_code}</span>,
  })), [branches]);
  return (
    <Drawer open onClose={onClose} size="sm" icon={<SlidersHorizontal size={18} />} title={tr('Filter users')}
      description={tr('Combine role, status and branch.')}
      footer={
        <>
          <button type="button" className={`${buttonSecondary} mr-auto`} onClick={() => setDraft(NO_FILTERS)}>{tr('Reset')}</button>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Cancel')}</button>
          <button type="button" className={buttonPrimary} onClick={() => onApply(draft)}>{tr('Apply filters')}</button>
        </>
      }>
      <div className="space-y-6">
        <ChoiceGroup label={tr('Role')} value={draft.role} onChange={set('role')} choices={[
          { value: '', label: tr('All roles') }, { value: 'superadmin', label: tr('Super Admin') }, { value: 'user', label: tr('User') },
        ]} />
        <ChoiceGroup label={tr('Status')} value={draft.status} onChange={set('status')} choices={[
          { value: '', label: tr('All') }, { value: 'active', label: tr('Active') }, { value: 'inactive', label: tr('Inactive') },
          { value: 'locked', label: tr('Locked'), hint: tr('Too many failed sign-ins') },
        ]} />
        <SearchChoice label={tr('Branch')} anyLabel={tr('All branches')} options={options} value={draft.branch} onChange={set('branch')}
          placeholder={tr('Search outlet name or code')} loading={branchesLoading} />
        <p className="text-xs text-slate-500">{tr('A branch shows the users assigned to it; super admins see every branch and are always included.')}</p>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ pieces */

function Avatar({ user }: { user: AuthUser }) {
  return <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />;
}

function RoleBadge({ role }: { role: Role }) {
  const superadmin = role === 'superadmin';
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${superadmin ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
      {superadmin && <ShieldCheck size={12} />}{ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusBadge({ user }: { user: AuthUser }) {
  if (user.isLocked) return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Lock size={11} /> {tr('Locked')}</span>;
  return user.isActive
    ? <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{tr('Active')}</span>
    : <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />{tr('Inactive')}</span>;
}

/** Branches the account may see: superadmins every branch; a user without branches sees no data. */
function BranchesBadge({ user, branchName }: { user: AuthUser; branchName: (code: string) => string }) {
  if (user.role === 'superadmin') return <span className="whitespace-nowrap text-xs text-slate-500">{tr('All branches')}</span>;
  const codes = user.branches ?? [];
  if (!codes.length) {
    return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700" title={tr('This user sees no data until branches are assigned')}><CircleAlert size={11} /> {tr('No branch')}</span>;
  }
  const label = codes.length === 1 ? branchName(codes[0]) : tr('{0} branches', codes.length);
  return (
    <span className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700" title={codes.map(branchName).join('\n')}>
      <Store size={11} className="flex-shrink-0" /><span className="truncate">{label}</span>
    </span>
  );
}

/** the user has not filled in their own profile yet */
function ProfileBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700" title={tr('Full name, phone number, job title or department is missing')}>
      <CircleAlert size={11} /> {tr('Profile incomplete')}
    </span>
  );
}

function UserRow({ user, isMe, branchName, onView, actions }: {
  user: AuthUser; isMe: boolean; branchName: (code: string) => string; onView: () => void; actions: ActionItem[];
}) {
  return (
    <tr className="group hover:bg-slate-50/70">
      <td className="max-w-[18rem] px-4 py-3">
        <button type="button" onClick={onView} className="flex min-w-0 items-center gap-3 text-left">
          <Avatar user={user} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900 group-hover:text-blue-700">
              {user.displayName}{isMe && <span className="ml-1.5 text-xs font-normal text-slate-400">{tr('(you)')}</span>}
            </span>
            {user.profileComplete
              ? <span className="block truncate text-xs text-slate-500">@{user.username}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</span>
              : <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">@{user.username} <ProfileBadge /></span>}
          </span>
        </button>
      </td>
      <td className="hidden max-w-[16rem] px-4 py-3 lg:table-cell">
        <span className="block truncate text-slate-700">{user.email}</span>
        <span className="block truncate text-xs text-slate-400">{user.phoneNumber || '—'}</span>
      </td>
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-3"><BranchesBadge user={user} branchName={branchName} /></td>
      <td className="px-4 py-3"><StatusBadge user={user} /></td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 xl:table-cell">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : tr('Never')}</td>
      <td className="px-3 py-3 text-right"><ActionMenu items={actions} label={tr('Actions for {0}', user.username)} /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ new / edit */

interface AccountForm {
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  notes: string;
  password: string;
  mustChangePassword: boolean;
}

/**
 * New user: identity (optional, as the imported PIC accounts: name, phone, job title,
 * department), sign-in, access and branches; the user completes the rest under "My profile".
 * Edit: everything, incl. correcting the profile and the photo.
 */
function UserFormDrawer({ user, isMe, branches, branchesLoading, onClose, onSaved }: {
  user: AuthUser | null; isMe: boolean; branches: Branch[]; branchesLoading: boolean; onClose: () => void;
  onSaved: (u: AuthUser, created: boolean, password?: string) => void;
}) {
  const creating = !user;
  const { user: me, setUser: setMe } = useAuth();
  const [form, setForm] = useState<AccountForm>(() => ({
    username: user?.username ?? '', email: user?.email ?? '', role: user?.role ?? 'user', isActive: user?.isActive ?? true,
    notes: user?.notes ?? '', password: creating ? generatePassword() : '', mustChangePassword: creating ? true : user!.mustChangePassword,
  }));
  const [profile, setProfile] = useState<ProfileValues>(() => profileValues(user));
  const [branchCodes, setBranchCodes] = useState<string[]>(() => user?.branches ?? []);
  const [showPassword, setShowPassword] = useState(creating);
  // the username follows the full name until it is typed by hand
  const [usernameTouched, setUsernameTouched] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string | null } | null>(null);
  const set = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) => setForm(f => ({ ...f, [key]: value }));
  const setProfileField = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setProfile(p => ({ ...p, [key]: value }));

  const payload = useMemo(() => {
    const body: Record<string, unknown> = {
      username: form.username, email: form.email, role: form.role, isActive: form.isActive, mustChangePassword: form.mustChangePassword,
    };
    if (!creating) {
      body.notes = form.notes;
      for (const k of PROFILE_KEYS) body[k] = profile[k].trim();
    } else {
      if (form.notes.trim()) body.notes = form.notes;
      for (const k of ['fullName', 'phoneNumber', 'jobTitle', 'department'] as const) {
        if (profile[k].trim()) body[k] = profile[k].trim();
      }
    }
    if (form.password) body.password = form.password;
    if (form.role === 'user') body.branches = branchCodes;
    return body;
  }, [form, profile, creating, branchCodes]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ user: AuthUser }>(creating ? '/api/users' : `/api/users/${user!.id}`, {
        method: creating ? 'POST' : 'PATCH', body: JSON.stringify(payload),
      });
      onSaved(res.user, creating, form.password || undefined);
    } catch (err) {
      setError({ text: (err as Error).message, field: (err as ApiError).field });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: string) => (error?.field === name ? error.text : null);
  const knownField = error?.field && (['username', 'email', 'role', 'isActive', 'password', 'notes', 'avatar', 'branches'] as string[]).concat(PROFILE_KEYS).includes(error.field);

  return (
    <Drawer open onClose={onClose} size={creating ? 'md' : 'lg'}
      icon={creating ? <UserPlus size={18} /> : <UserRoundPen size={18} />}
      title={creating ? tr('New user') : tr('Edit {0}', user!.username)}
      description={creating ? tr('Identity, sign-in, role and branches. The user completes the rest of the profile after signing in.') : tr('Leave the password empty to keep the current one.')}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Cancel')}</button>
          <button type="submit" form="user-form" className={buttonPrimary} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}{creating ? tr('Create user') : tr('Save changes')}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate>
        {error && !knownField && (
          <p className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5" />{error.text}</p>
        )}

        {!creating && (
          <DrawerSection title={tr('Profile photo')}>
            <AvatarEditor name={user!.displayName} src={user!.avatarUrl} endpoint={`/api/users/${user!.id}/avatar`}
              onSaved={u => { if (u.id === me?.id) setMe(u); }} />
            {error?.field === 'avatar' && <p className="text-xs text-red-600">{error.text}</p>}
          </DrawerSection>
        )}

        {creating && (
          <DrawerSection title={tr('Identity')} description={tr('Optional — filled in now, the profile is complete at the first sign-in (the user can still change it).')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr('Full name')} htmlFor="f-fullName" error={fieldError('fullName')}>
                <input id="f-fullName" className={inputClass} value={profile.fullName} maxLength={120} autoComplete="off"
                  onChange={e => {
                    setProfileField('fullName', e.target.value);
                    if (!usernameTouched) set('username', suggestUsername(e.target.value));
                  }} />
              </Field>
              <Field label={tr('Phone number')} htmlFor="f-phoneNumber" error={fieldError('phoneNumber')} hint="e.g. 0812-3456-7890">
                <input id="f-phoneNumber" type="tel" className={inputClass} value={profile.phoneNumber} maxLength={32} autoComplete="off"
                  onChange={e => setProfileField('phoneNumber', e.target.value)} />
              </Field>
              <Field label={tr('Job title')} htmlFor="f-jobTitle" error={fieldError('jobTitle')}>
                <input id="f-jobTitle" list="job-titles" className={inputClass} value={profile.jobTitle} maxLength={80} autoComplete="off"
                  onChange={e => setProfileField('jobTitle', e.target.value)} placeholder={tr('PIC Outlet')} />
                <datalist id="job-titles">{JOB_TITLES.map(t => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label={tr('Department')} htmlFor="f-department" error={fieldError('department')}>
                <input id="f-department" list="departments" className={inputClass} value={profile.department} maxLength={80} autoComplete="off"
                  onChange={e => setProfileField('department', e.target.value)} placeholder={tr('Operations')} />
                <datalist id="departments">{DEPARTMENTS.map(t => <option key={t} value={t} />)}</datalist>
              </Field>
            </div>
          </DrawerSection>
        )}

        <DrawerSection title={tr('Sign-in')} description={tr('The user signs in with the username or the email address.')}>
          <div className="grid gap-4">
            <Field label={tr('Username')} htmlFor="f-username" required error={fieldError('username')} hint={tr('3–32: lowercase letters, numbers, . _ -')}>
              <input id="f-username" className={inputClass} value={form.username} onChange={e => { setUsernameTouched(true); set('username', e.target.value.toLowerCase()); }}
                autoCapitalize="none" spellCheck={false} maxLength={32} required autoComplete="off" />
            </Field>
            <Field label={tr('Email')} htmlFor="f-email" required error={fieldError('email')}>
              <input id="f-email" type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} maxLength={254} required autoComplete="off" />
            </Field>
            <Field label={creating ? tr('Password') : tr('New password')} htmlFor="f-password" required={creating} error={fieldError('password')}
              hint={creating ? tr('Generated for you — share it with the user privately. At least 8 characters with letters and numbers.') : tr('At least 8 characters with letters and numbers')}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input id="f-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass} pr-10 font-mono`}
                    value={form.password} onChange={e => set('password', e.target.value)} maxLength={128} required={creating}
                    placeholder={creating ? '' : tr('Keep current password')} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? tr('Hide password') : tr('Show password')}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="button" className={buttonSecondary} onClick={() => { set('password', generatePassword()); setShowPassword(true); }} title={tr('Generate a strong password')}>
                  <Wand2 size={16} /><span className="hidden sm:inline">{tr('Generate')}</span>
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={form.mustChangePassword} onChange={e => set('mustChangePassword', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700" />
              {tr('Must change password at next sign-in')}
            </label>
          </div>
        </DrawerSection>

        <DrawerSection title={tr('Access')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr('Role')} htmlFor="f-role" error={fieldError('role')} hint={form.role === 'superadmin' ? tr('Full access incl. platforms and user accounts') : tr('Dashboards only (Overview, Sales Transactions)')}>
              <select id="f-role" className={inputClass} value={form.role} onChange={e => set('role', e.target.value as Role)}>
                <option value="user">{tr('User')}</option>
                <option value="superadmin">{tr('Super Admin')}</option>
              </select>
            </Field>
            <Field label={tr('Status')} htmlFor="f-active" error={fieldError('isActive')} hint={isMe ? tr('You cannot deactivate your own account') : tr('Inactive users cannot sign in')}>
              <select id="f-active" className={inputClass} value={form.isActive ? '1' : '0'} disabled={isMe} onChange={e => set('isActive', e.target.value === '1')}>
                <option value="1">{tr('Active')}</option>
                <option value="0">{tr('Inactive')}</option>
              </select>
            </Field>
          </div>
        </DrawerSection>

        {form.role === 'user' ? (
          <DrawerSection title={tr('Branch access')} description={tr('Overview and Sales Transactions only show the data of these branches (also exports). Required for role User.')}>
            <BranchAssign branches={branches} loading={branchesLoading} value={branchCodes} onChange={setBranchCodes} invalid={error?.field === 'branches'} />
            {fieldError('branches') && <p className="mt-1.5 text-xs text-red-600">{fieldError('branches')}</p>}
          </DrawerSection>
        ) : (
          <p className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-red-700" /> {tr('Super admins see every branch.')}
          </p>
        )}

        {creating ? (
          <>
            <DrawerSection title={tr('Administrator notes')} description={tr('Only visible to super admins, e.g. area or outlet group.')}>
              <Field label={tr('Notes')} htmlFor="f-notes" error={fieldError('notes')}>
                <textarea id="f-notes" rows={2} className={`${inputClass} h-auto py-2`} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} />
              </Field>
            </DrawerSection>
            <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/60 px-3.5 py-3 text-sm text-blue-900">
              <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-700" />
              <p>
                {tr('After saving you get the login details to share with the user. At the first sign-in the user sets a new password and completes')} <span className="font-medium">{tr('My profile')}</span> {tr('(gender, date of birth, address, work location…).')}
              </p>
            </div>
          </>
        ) : (
          <>
            {!user!.profileComplete && (
              <p className="mt-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-900">
                <CircleAlert size={16} className="mt-0.5 flex-shrink-0" /> {tr('The user has not completed their profile yet. They can fill it in themself under My profile.')}
              </p>
            )}
            <ProfileFields values={profile} onChange={setProfileField} fieldError={fieldError} idPrefix="f" markRequired={false}
              currentBranchName={user!.workBranchName} />
            <DrawerSection title={tr('Administrator notes')} description={tr('Only visible to super admins.')}>
              <Field label={tr('Notes')} htmlFor="f-notes" error={fieldError('notes')}>
                <textarea id="f-notes" rows={3} className={`${inputClass} h-auto py-2`} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} />
              </Field>
            </DrawerSection>
          </>
        )}
      </form>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ view & delete */

function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9.5rem_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="min-w-0 break-words text-slate-800">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Label/value pairs in two columns (one on phones). */
function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-800">{v === null || v === undefined || v === '' ? <span className="text-slate-400">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function birthDateLabel(value: string | null): string | null {
  if (!value) return null;
  const d = parseLocalDate(value);
  const now = new Date();
  const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
  return tr('{0} ({1} years)', d.toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }), age);
}

/** "3 hours ago", "yesterday", "12 days ago" */
function ago(value: string | null): string {
  if (!value) return tr('Never');
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 60) return tr('Just now');
  if (s < 3600) return tr('{0} min ago', Math.floor(s / 60));
  if (s < 86_400) return tr('{0} h ago', Math.floor(s / 3600));
  const d = Math.floor(s / 86_400);
  return d === 1 ? tr('Yesterday') : d < 31 ? tr('{0} days ago', d) : formatDateTime(value);
}

/** WhatsApp link for an Indonesian number ("0812…" -> "62812…"). */
function whatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `62${digits.slice(1)}` : digits}`;
}

interface RecentActivity {
  id: number;
  at: string;
  action: string;
  status: 'ok' | 'failed' | 'denied';
  summary: string | null;
  page: string | null;
}

const PROFILE_REQUIRED: { key: keyof AuthUser; label: string }[] = [
  { key: 'fullName', get label() { return tr('Full name'); } }, { key: 'phoneNumber', get label() { return tr('Phone'); } }, { key: 'jobTitle', get label() { return tr('Job title'); } }, { key: 'department', get label() { return tr('Department'); } },
];

function UserDetailDrawer({ user, isMe, branchName, onClose, onEdit, onDelete, onUnlock }: {
  user: AuthUser; isMe: boolean; branchName: (code: string) => string; onClose: () => void; onEdit: () => void; onDelete: () => void; onUnlock: () => void;
}) {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentActivity[] | null>(null);
  const [counts, setCounts] = useState<{ total: number; exports: number } | null>(null);

  // last activity of this user (30 days)
  useEffect(() => {
    let cancelled = false;
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const params = new URLSearchParams({ user: user.id, dateFrom: toIsoDate(from), dateTo: toIsoDate(new Date()) });
    Promise.all([
      fetch(`/api/activity?${params}&limit=6`).then(r => (r.ok ? r.json() : { data: [] })),
      fetch(`/api/activity/summary?${params}`).then(r => (r.ok ? r.json() : null)),
    ]).then(([list, summary]) => {
      if (cancelled) return;
      setRecent(list.data ?? []);
      if (summary) setCounts({ total: summary.totals.total, exports: summary.totals.exports });
    }).catch(() => { if (!cancelled) setRecent([]); });
    return () => { cancelled = true; };
  }, [user.id]);

  const filled = PROFILE_REQUIRED.filter(f => user[f.key]).length;
  const missing = PROFILE_REQUIRED.filter(f => !user[f.key]).map(f => f.label);
  const branchCodes = user.branches ?? [];

  return (
    <Drawer open onClose={onClose} size="lg" icon={<UserRound size={18} />} title={tr('User details')} description={isMe ? tr('This is your account') : `@${user.username}`}
      footer={
        <>
          <button type="button" className={`${buttonSecondary} mr-auto`} onClick={onDelete} disabled={isMe} title={isMe ? tr('You cannot delete your own account') : undefined}>
            <Trash2 size={16} /> {tr('Delete')}
          </button>
          {user.isLocked && <button type="button" className={buttonSecondary} onClick={onUnlock}><Unlock size={16} /> {tr('Unlock')}</button>}
          <button type="button" className={buttonPrimary} onClick={onEdit}><Pencil size={16} /> {tr('Edit')}</button>
        </>
      }
    >
      {/* identity */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar name={user.displayName} src={user.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-semibold text-slate-900">{user.displayName}</p>
          <p className="truncate text-sm text-slate-500">
            {[user.jobTitle, user.department].filter(Boolean).join(' · ') || tr('Job title not filled in yet')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5"><RoleBadge role={user.role} /><StatusBadge user={user} />{!user.profileComplete && <ProfileBadge />}</div>
        </div>
      </div>

      {/* at a glance */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <Glance label={tr('Last sign-in')} value={ago(user.lastLoginAt)} sub={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : tr('has not signed in')} />
        <Glance label={tr('Branch access')} value={user.role === 'superadmin' ? 'All' : formatNumber(branchCodes.length)}
          sub={user.role === 'superadmin' ? tr('super admin') : branchCodes.length ? (branchCodes.length === 1 ? branchName(branchCodes[0]) : tr('branches')) : tr('sees no data')}
          tone={user.role === 'user' && !branchCodes.length ? 'bad' : undefined} />
        <Glance label={tr('Profile')} value={`${filled}/${PROFILE_REQUIRED.length}`} sub={missing.length ? tr('missing: {0}', missing.join(', ')) : tr('complete')}
          tone={missing.length ? 'warn' : 'good'} />
        <Glance label={tr('Activity, 30 days')} value={counts ? formatNumber(counts.total) : '…'} sub={counts ? tr('{0} exports', formatNumber(counts.exports)) : ''} />
      </div>

      <DrawerSection title={tr('Branch access')} description={user.role === 'superadmin' ? tr('Super admins see every branch') : tr('Overview, Sales Transactions and exports are limited to these branches')}>
        {user.role === 'superadmin' ? (
          <p className="flex items-center gap-2 text-sm text-slate-600"><ShieldCheck size={16} className="text-red-700" /> {tr('All branches')}</p>
        ) : branchCodes.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {branchCodes.map(code => (
              <li key={code} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <Store size={14} className="flex-shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-slate-800">{branchName(code)}</span>
                <span className="font-mono text-[11px] text-slate-400">{code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><CircleAlert size={16} /> {tr('No branch assigned — this user sees no data.')}</p>
        )}
      </DrawerSection>

      <DrawerSection title={tr('Contact')}>
        <InfoGrid items={[
          [tr('Email'), <a key="e" href={`mailto:${user.email}`} className="text-blue-700 hover:underline">{user.email}</a>],
          [tr('Phone'), user.phoneNumber ? (
            <span key="p" className="flex flex-wrap items-center gap-2">
              <a href={`tel:${user.phoneNumber}`} className="text-blue-700 hover:underline">{user.phoneNumber}</a>
              <a href={whatsApp(user.phoneNumber)} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">{tr('WhatsApp')}</a>
            </span>
          ) : null],
          [tr('Address'), user.address],
          [tr('City'), user.city],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Work')}>
        <InfoGrid items={[
          [tr('Job title'), user.jobTitle],
          [tr('Department'), user.department],
          [tr('Employee number'), user.employeeNumber],
          [tr('Work location'), user.workBranchName || user.workBranchCode],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Personal')} description={user.profileUpdatedAt ? tr('Last updated by the user {0}', formatDateTime(user.profileUpdatedAt)) : tr('Not yet filled in by the user')}>
        <InfoGrid items={[
          [tr('Gender'), user.gender ? GENDER_LABELS[user.gender] : null],
          [tr('Date of birth'), birthDateLabel(user.birthDate)],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Security')}>
        <InfoGrid items={[
          [tr('Username'), <span key="u" className="font-mono">{user.username}</span>],
          [tr('Last sign-in'), user.lastLoginAt ? `${formatDateTime(user.lastLoginAt)}${user.lastLoginIp ? ` · ${user.lastLoginIp}` : ''}` : tr('Never')],
          [tr('Password changed'), user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : null],
          [tr('Must change password'), user.mustChangePassword ? tr('Yes, at the next sign-in') : tr('No')],
          [tr('Failed sign-in attempts'), formatNumber(user.failedLoginAttempts)],
          [tr('Locked until'), user.isLocked && user.lockedUntil ? formatDateTime(user.lockedUntil) : tr('Not locked')],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Recent activity')} description={tr('Last 30 days')}>
        {recent === null ? (
          <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-slate-400">{tr('No activity in the last 30 days.')}</p>
        ) : (
          <ol className="relative space-y-3 border-l border-slate-200 pl-4">
            {recent.map(a => (
              <li key={a.id} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${a.status === 'ok' ? 'bg-slate-300' : a.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <p className="text-sm text-slate-800">{a.summary || a.action}</p>
                <p className="text-[11px] text-slate-400">{formatDateTime(a.at)} · <span className="font-mono">{a.action}</span></p>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={() => router.push(`/activity?user=${user.id}`)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
          <History size={14} /> {tr('Open in Activity Logs')}
        </button>
      </DrawerSection>

      <DrawerSection title={tr('Record')}>
        <InfoGrid items={[
          [tr('Created'), `${user.createdAt ? formatDateTime(user.createdAt) : '—'}${user.createdBy ? ` by ${user.createdBy}` : ''}`],
          [tr('Updated'), `${user.updatedAt ? formatDateTime(user.updatedAt) : '—'}${user.updatedBy ? ` by ${user.updatedBy}` : ''}`],
          [tr('Administrator notes'), user.notes],
        ]} />
      </DrawerSection>
    </Drawer>
  );
}

function Glance({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="truncate text-[11px] text-slate-500" title={sub}>{sub}</p>
    </div>
  );
}

/** Login details to hand over after creating an account or setting a new password (never stored). */
function IssuedLoginDrawer({ issued, branchName, onClose }: { issued: IssuedLogin; branchName: (code: string) => string; onClose: () => void }) {
  const { user, password, created } = issued;
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const branches = user.role === 'superadmin' ? 'Semua cabang' : (user.branches ?? []).map(branchName).join(', ') || '—';
  const text = [
    'Login Kopi Calf Integrated Portal',
    `URL: ${typeof window !== 'undefined' ? window.location.origin : ''}`,
    `Username: ${user.username}`,
    `Email: ${user.email}`,
    `Password: ${password}`,
    `Akses cabang: ${branches}`,
    user.mustChangePassword ? 'Wajib mengganti password saat login pertama.' : '',
  ].filter(Boolean).join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShow(true); // clipboard blocked: show the password so it can be copied by hand
    }
  };
  return (
    <Drawer open onClose={onClose} size="md" icon={<KeyRound size={18} />}
      title={created ? tr('User {0} created', user.username) : tr('New password for {0}', user.username)}
      description={tr('Share these details with the user privately. The password is shown only now.')}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Done')}</button>
          <button type="button" className={buttonPrimary} onClick={copy}>
            {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}{copied ? tr('Copied') : tr('Copy login details')}
          </button>
        </>
      }>
      <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
        <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{user.displayName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5"><RoleBadge role={user.role} /><BranchesBadge user={user} branchName={branchName} /></div>
        </div>
      </div>
      <DrawerSection title={tr('Login details')}>
        <DetailList rows={[
          [tr('Username'), <span key="u" className="font-mono">{user.username}</span>],
          [tr('Email'), user.email],
          [tr('Password'), (
            <span key="p" className="flex items-center gap-2">
              <span className="font-mono">{show ? password : '•'.repeat(Math.min(password.length, 14))}</span>
              <button type="button" onClick={() => setShow(s => !s)} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label={show ? tr('Hide password') : tr('Show password')}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          )],
          [tr('Branch access'), branches],
          [tr('First sign-in'), user.mustChangePassword ? tr('Must change the password') : tr('Password can be kept')],
        ]} />
      </DrawerSection>
    </Drawer>
  );
}

/** Confirmation stays a small centered dialog (a destructive yes/no, not a form). */
function DeleteDialog({ user, onClose, onDeleted, onError }: { user: AuthUser; onClose: () => void; onDeleted: () => void; onError: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/users/${user.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      onError((err as Error).message);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onClose={onClose} size="sm" title={tr('Delete user?')}
      description={tr('The account is removed permanently and the user is signed out everywhere.')}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>{tr('Cancel')}</button>
          <button type="button" className={buttonDanger} onClick={remove} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {tr('Delete')}
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-3">
        <KeyRound size={18} className="text-red-600" />
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{user.displayName}</p>
          <p className="text-slate-600">{user.username} · {user.email}</p>
        </div>
      </div>
    </Dialog>
  );
}

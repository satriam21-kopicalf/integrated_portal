'use client';

import { NativeSelect } from "@/so/ui/Jira";
import { COTR_KINDS, type CotrEmployee, type CotrKind, EmployeePicker, cotrOverrides, kindOf, usernameOf } from '@/components/access/CotrAccount';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, Copy, Eye, EyeOff, History, Info, KeyRound, Loader2, Lock, Pencil, Plus,
  LogIn, RefreshCw, ShieldCheck, SlidersHorizontal, Store, Trash2, Unlock, UserCheck, UserPlus, UserRound, UserRoundPen, Users, Wand2, X,
} from 'lucide-react';
import BranchAssign from '@/components/BranchAssign';
import type { Branch } from '@/components/BranchFilter';
import DashboardLayout from '@/components/layout/DashboardLayout';
import MasterCombobox from '@/components/MasterCombobox';
import HrmsEmployeePicker, { HRMS_FIELDS, followsHrms, hrmsValue, type HrmsEmployee } from '@/components/access/HrmsEmployeePicker';
import HrmsSyncDrawer from '@/components/access/HrmsSyncDrawer';
import { AccessSettingsDrawer, PageAccessEditor } from '@/components/access/PageAccess';
import ProfileFields, { PROFILE_KEYS, ProfileValues, profileValues } from '@/components/ProfileFields';
import { EmptyState, ErrorBlock, IconButton, PageHeader, PageShell, Pill, type PillTone, SearchInput, StatCard, StatGrid, Toolbar, ValueSkeleton, btn } from '@/jira/kc';
import { CardFooter, Toolbar as JToolbar, WorkCard, jHeadRow, jRow, jTable, jTd, jTh } from '@/jira';
import { Segmented } from '@/so/ui/Simple';
import ActionMenu, { ActionItem } from '@/components/ui/ActionMenu';
import Dialog, { Field } from '@/components/ui/Dialog';
import { buttonDanger, buttonPrimary, buttonSecondary, inputClass } from '@/jira/kc';
import Drawer, { DrawerSection } from '@/jira';
import { ActiveFilter, ActiveFilters, ChoiceGroup, FilterButton, SearchChoice } from '@/jira/filters';
import UserAvatar, { AvatarEditor } from '@/components/UserAvatar';
import FundUnits from '@/components/access/FundUnits';
import { LOGOS } from '@/lib/company';
import { AuthUser, branchLimitable, branchScoped, BusinessLine, GENDER_LABELS, Role, ROLE_LABELS, useAuth } from '@/lib/auth';

/** The tabs of User Accounts (2026-11-25): the three business lines (migration 054), and Roastery, Warehouse and Central
 *  Kitchen — accounts of the Kopi Calf line whose places are all of that unit (backend accounts.TABS). */
type Tab = BusinessLine | 'roastery' | 'warehouse' | 'ck';
const LINES: { key: Tab; label: string; unit: string }[] = [
  { key: 'kopicalf', label: 'Kopi Calf', unit: 'CALF' },
  { key: 'wasgee', label: 'Wasgee Tea', unit: 'CALF7' },
  { key: 'cotr', label: 'Calf On The Road', unit: 'COTR' },
  { key: 'roastery', label: 'Roastery', unit: 'ROASTERY' },
  { key: 'warehouse', label: 'Warehouse', unit: 'WAREHOUSE' },
  { key: 'ck', label: 'Central Kitchen', unit: 'CK' },
];
const UNIT_TABS: Record<string, Tab> = { ROASTERY: 'roastery', WAREHOUSE: 'warehouse', CK: 'ck' };
const lineOf = (tab: Tab): BusinessLine => (tab === 'wasgee' || tab === 'cotr' ? tab : 'kopicalf');
/** The places that can be given in a tab. Kopi Calf: everything that is not Wasgee (a PIC may hold a hub too); Calf On The
 *  Road works with pools, every place may still be given. */
function tabBranches(branches: Branch[], tab: Tab): Branch[] {
  if (tab === 'cotr') return branches;
  if (tab === 'wasgee') return branches.filter(b => b.unit === 'CALF7');
  if (tab === 'kopicalf') return branches.filter(b => b.unit !== 'CALF7');
  return branches.filter(b => b.unit && UNIT_TABS[b.unit] === tab);
}
/** The tab an account is listed in (same rule as the backend, without the Fund Request units given by hand). */
function tabOf(u: AuthUser, branches: Branch[]): Tab {
  const line = u.businessLine ?? 'kopicalf';
  if (line !== 'kopicalf' || (u.role !== 'user' && u.role !== 'outlet')) return line;
  const units = new Set((u.branches ?? []).map(c => branches.find(b => b.branch_code === c)?.unit ?? 'CALF'));
  return units.size === 1 ? UNIT_TABS[[...units][0]] ?? line : line;
}
import { PAGES } from '@/lib/pages';
import { formatDate, formatDateTime, formatNumber, parseLocalDate, toIsoDate } from '@/lib/format';
import { locale, tr, serverMsg } from '@/lib/i18n';
import { PageSkeleton } from '@/components/kc/Skeleton';

const PAGE_SIZE = 50;
/** header actions shown as an icon only, without a border (name in the tooltip) */

interface UsersSummary {
  total: number;
  active: number;
  inactive: number;
  locked: number;
  superadmins: number;
  users: number;
  /** role Outlet / Hub (2026-10-28) */
  outlets?: number;
  withoutBranch: number;
  neverSignedIn: number;
  active7d: number;
  branchesCovered: number;
  lines?: Partial<Record<Tab, number>>;
  /** the accounts per role of every tab */ roles?: Partial<Record<Tab, Partial<Record<Role, number>>>>;
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
  const [panel, setPanel] = useState<'access' | 'hrms' | null>(null);
  const [line, setLine] = useState<Tab>('kopicalf');
  const [viewing, setViewing] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState<AuthUser | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  // a COTR admin (2026-11-13) manages the accounts of the COTR line only: that tab, no role / platform / master settings
  const cotrAdmin = me?.role === 'cotr_admin';
  const allowed = me?.role === 'superadmin' || me?.role === 'admin' || cotrAdmin;
  useEffect(() => { if (cotrAdmin) setLine('cotr'); }, [cotrAdmin]);
  useEffect(() => {
    if (!allowed) return;
    // ESB branches of every brand (Kopi Calf, Wasgee Tea from its own ESB company) + sites without an ESB branch
    // (HUB WH / HUB CK, outlets not in ESB yet), assignable to role User
    // (a superadmin: of every brand, whatever its own data is narrowed to, 2026-11-25)
    fetch('/api/users/branches').then(res => (res.ok ? res.json() : []))
      .then((rows: Branch[]) => setBranches(rows))
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
      params.set('line', line);
      const [body, counts] = await Promise.all([
        api<ListResponse>(`/api/users?${params}`),
        api<UsersSummary>(`/api/users/summary?line=${line}`).catch(() => null),
      ]);
      setRows(body.data);
      setTotal(body.total);
      if (counts) setSummary(counts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, query, filters, line]);

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
      { label: tr('View Details'), icon: <Eye size={16} />, onSelect: () => setViewing(u) },
      { label: tr('Edit'), icon: <Pencil size={16} />, onSelect: () => setEditing(u) },
      ...(u.isLocked ? [{ label: tr('Unlock'), icon: <Unlock size={16} />, onSelect: () => unlock(u) }] : []),
      ...(cotrAdmin ? [] : [{ label: tr('Activity Log'), icon: <History size={16} />, onSelect: () => router.push(`/activity?user=${u.id}`) }]),
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
        <PageSkeleton cards={5} />
      </DashboardLayout>
    );
  }

  const s = summary;
  const ofRole = s?.roles?.[line];
  const roleTabs = [
    { key: '', label: tr('All'), count: s?.lines?.[line] ?? null },
    ...(['user', 'outlet', 'driver', 'cotr_admin', 'cost_control', 'admin', 'superadmin'] as Role[]).filter(r => ofRole?.[r] || filters.role === r)
      .map(r => ({ key: r as string, label: r === 'user' ? tr('User / PIC') : ROLE_LABELS[r], count: ofRole?.[r] ?? 0 })),
  ];
  const pickTab = (k: Tab) => { if (k === line) return; setLine(k); setRows([]); setPage(1); applyFilters(NO_FILTERS); };
  return (
    <DashboardLayout>
      <PageShell>
        <PageHeader title={tr('User Accounts')} subtitle={tr('Sign-in, role and branch access of every dashboard user')} eyebrow={tr('Management')}
          actions={<>
            {!cotrAdmin && <>
              <IconButton label={tr('Access Settings')} onClick={() => setPanel('access')}><ShieldCheck size={17} strokeWidth={1.75} /></IconButton>
              {me?.role === 'superadmin' && <IconButton label={tr('Sync with HRMS')} onClick={() => setPanel('hrms')}><RefreshCw size={17} strokeWidth={1.75} /></IconButton>}
            </>}
            <button type="button" className={btn('solid')} onClick={() => setEditing('new')}><Plus size={15} /> {tr('New User')}</button>
          </>} />

        {/* the same tabs as Fund Request: logo, name, count (2026-11-25) */}
        <div role="radiogroup" aria-label={tr('Business Line')} className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {LINES.filter(l => !cotrAdmin || l.key === 'cotr').map(l => {
            const on = l.key === line;
            return (
              <button key={l.key} type="button" role="radio" aria-checked={on} onClick={() => pickTab(l.key)}
                className={`inline-flex h-9 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded border px-3 text-sm font-medium transition-colors ${on ? 'border-[color:var(--j-0C66E4)] bg-white text-[color:var(--j-0055CC)] ring-1 ring-[color:var(--j-388BFF)]' : 'border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGOS[l.unit]} alt="" aria-hidden className={`max-h-6 max-w-14 object-contain ${on ? '' : 'opacity-60 grayscale'}`} />
                {l.label}{s?.lines && <span className="rounded-full bg-neutral-200/80 px-1.5 text-[11px] tabular-nums text-[color:var(--j-44546F)]">{formatNumber(s.lines[l.key] ?? 0)}</span>}
              </button>
            );
          })}
        </div>

        <StatGrid label={tr('User Summary')} cols={5}>
          <StatCard label={tr('Users')} icon={<Users />} value={s ? formatNumber(s.total) : <ValueSkeleton />}
            sub={s && tr('{0} superadmin · {1} user · {2} outlet/HUB', formatNumber(s.superadmins), formatNumber(s.users), formatNumber(s.outlets ?? 0))} />
          <StatCard label={tr('Active')} tone="brand" icon={<UserCheck />} value={s ? formatNumber(s.active) : <ValueSkeleton />}
            sub={s && `${formatNumber(s.inactive)} ${tr('inactive ·')} ${formatNumber(s.locked)} ${tr('locked')}`} />
          <StatCard label={tr('Signed In, 7 Days')} icon={<LogIn />} value={s ? formatNumber(s.active7d) : <ValueSkeleton />}
            sub={s && `${formatNumber(s.neverSignedIn)} ${tr('never signed in')}`} />
          <StatCard label={tr('Branches Covered')} icon={<Store />} value={s ? formatNumber(s.branchesCovered) : <ValueSkeleton />}
            sub={s && `${tr('of')} ${formatNumber(branches.filter(b => b.count > 0).length)} ${tr('branches with recent sales')}`} />
          <StatCard label={tr('Without Branch')} icon={<CircleAlert />} tone={s?.withoutBranch ? 'warn' : 'default'} value={s ? formatNumber(s.withoutBranch) : <ValueSkeleton />}
            sub={s && (s.withoutBranch ? tr('PIC / outlet accounts see no data until assigned') : tr('every PIC and outlet account has a branch'))} />
        </StatGrid>

        <WorkCard tabs={roleTabs} active={filters.role} onTab={r => applyFilters({ ...filters, role: r })} label={tr('Role')}>
          <JToolbar><Toolbar
            search={<SearchInput value={search} onChange={onSearch} placeholder={tr('Search name, username, email, phone or job title')} label={tr('Search Users')} />}
            chips={<ActiveFilters filters={activeFilters} onClear={() => applyFilters(NO_FILTERS)} />}>
            <FilterButton count={activeFilters.length} onClick={() => setFiltersOpen(true)} />
          </Toolbar></JToolbar>
          {error ? <ErrorBlock message={error} onRetry={load} /> : !loading && rows.length === 0 ? (
            <EmptyState icon={<UserRound size={22} />} title={filtersActive ? tr('No users match the search or filters') : tr('No users yet')} />
          ) : (
            <div className={loading && rows.length ? 'opacity-60' : ''}>
              <div className="hidden overflow-x-auto md:block">
                <table className={`${jTable} min-w-[760px]`}>
                  <thead>
                    <tr className={jHeadRow}>
                      <th scope="col" className={jTh}>{tr('User')}</th>
                      <th scope="col" className={`${jTh} hidden lg:table-cell`}>{tr('Contact')}</th>
                      <th scope="col" className={jTh}>{tr('Role')}</th>
                      <th scope="col" className={jTh}>{tr('Branch Access')}</th>
                      <th scope="col" className={jTh}>{tr('Status')}</th>
                      <th scope="col" className={`${jTh} hidden xl:table-cell`}>{tr('Last Sign-in')}</th>
                      <th scope="col" className="w-14 px-3 py-2.5"><span className="sr-only">{tr('Actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loading && !rows.length ? Array.from({ length: 6 }) : rows).map((u, i) => u ? (
                      <UserRow key={(u as AuthUser).id} user={u as AuthUser} isMe={(u as AuthUser).id === me?.id} branchName={branchName}
                        onView={() => setViewing(u as AuthUser)} actions={actionsFor(u as AuthUser)} />
                    ) : (
                      <tr key={i}><td colSpan={7} className="px-3 py-2"><div className="h-9 skeleton rounded-[3px]" /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-[color:var(--j-F1F2F4)] md:hidden">
                {rows.map(u => (
                  <li key={u.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar user={u} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(u)}>
                      <p className="truncate text-sm font-medium text-[color:var(--j-172B4D)]">{u.displayName}{u.id === me?.id && <span className="ml-1.5 text-xs font-normal text-[color:var(--j-626F86)]">{tr('(you)')}</span>}</p>
                      <p className="truncate text-xs text-[color:var(--j-626F86)]">{u.username} · {u.email}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5"><RoleBadge role={u.role} /><BranchesBadge user={u} branchName={branchName} /><StatusBadge user={u} /></div>
                    </button>
                    <ActionMenu items={actionsFor(u)} label={tr('Actions for {0}', u.username)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <CardFooter>
            <span className="text-xs text-[color:var(--j-626F86)]">{formatNumber(total)} {total === 1 ? tr('user') : tr('users')}{filtersActive ? tr(' match') : ''}</span>
            <div className="flex items-center gap-2 text-xs text-[color:var(--j-626F86)]">
              <button type="button" className={btn('outline', 'sm')} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label={tr('Previous Page')}><ChevronLeft size={15} /></button>
              <span className="tabular-nums">{tr('Page')} {page} {tr('of')} {pages}</span>
              <button type="button" className={btn('outline', 'sm')} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label={tr('Next Page')}><ChevronRight size={15} /></button>
            </div>
          </CardFooter>
        </WorkCard>
      </PageShell>

      {filtersOpen && <UserFiltersDrawer value={filters} branches={tabBranches(branches, line)} branchesLoading={branchesLoading}
        onApply={next => { applyFilters(next); setFiltersOpen(false); }} onClose={() => setFiltersOpen(false)} />}
      {editing && <UserFormDrawer user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me?.id}
        branches={branches} branchesLoading={branchesLoading} line={line}
        onClose={() => setEditing(null)} onSaved={saved} />}
      {viewing && <UserDetailDrawer user={viewing} isMe={viewing.id === me?.id} branchName={branchName} onClose={() => setViewing(null)}
        onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => { setDeleting(viewing); setViewing(null); }} onUnlock={() => unlock(viewing)} />}
      {deleting && <DeleteDialog user={deleting} onClose={() => setDeleting(null)}
        onDeleted={() => { setToast({ tone: 'ok', text: tr('User {0} deleted', deleting.username) }); setDeleting(null); load(); }}
        onError={text => setToast({ tone: 'error', text })} />}
      {panel === 'access' && <AccessSettingsDrawer onClose={() => setPanel(null)} />}
      {panel === 'hrms' && <HrmsSyncDrawer onClose={() => setPanel(null)} onChanged={load} />}
      {issued && <IssuedLoginDrawer issued={issued} branchName={branchName} onClose={() => setIssued(null)} />}

      {toast && (
        <div className={`fixed left-1/2 top-4 z-[90] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-[3px] px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === 'ok' ? 'bg-[color:var(--j-172B4D)]' : 'bg-red-600'}`} role="status">
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
    value: b.branch_code, label: b.branch_name, meta: <span className="font-mono text-[11px] text-[color:var(--j-626F86)]">{b.branch_code}</span>,
  })), [branches]);
  return (
    <Drawer open onClose={onClose} size="sm" icon={<SlidersHorizontal size={18} />} title={tr('Filter Users')}
      description={tr('Combine role, status and branch.')}
      footer={
        <>
          {/* 2026-11-28 phones: Reset as a quiet link, Cancel and Apply share the width */}
          <div className="flex w-full items-center gap-2">
            <button type="button" className="inline-flex h-10 items-center gap-1 px-1 text-sm font-medium text-[color:var(--j-0C66E4)] hover:underline sm:h-8" onClick={() => setDraft(NO_FILTERS)}>{tr('Reset')}</button>
            <span className="flex-1" />
            <button type="button" className={`${buttonSecondary} max-sm:flex-1`} onClick={onClose}>{tr('Cancel')}</button>
            <button type="button" className={`${buttonPrimary} max-sm:flex-1`} onClick={() => onApply(draft)}>{tr('Apply Filters')}</button>
          </div>
        </>
      }>
      <div className="space-y-6">
        <ChoiceGroup label={tr('Role')} value={draft.role} onChange={set('role')} choices={[
          { value: '', label: tr('All Roles') }, { value: 'superadmin', label: ROLE_LABELS.superadmin }, { value: 'admin', label: ROLE_LABELS.admin }, { value: 'cost_control', label: ROLE_LABELS.cost_control }, { value: 'user', label: ROLE_LABELS.user }, { value: 'outlet', label: ROLE_LABELS.outlet }, { value: 'driver', label: ROLE_LABELS.driver },
        ]} />
        <ChoiceGroup label={tr('Status')} value={draft.status} onChange={set('status')} choices={[
          { value: '', label: tr('All') }, { value: 'active', label: tr('Active') }, { value: 'inactive', label: tr('Inactive') },
          { value: 'locked', label: tr('Locked'), hint: tr('Too many failed sign-ins') },
        ]} />
        <SearchChoice label={tr('Branch')} anyLabel={tr('All Branches')} options={options} value={draft.branch} onChange={set('branch')}
          placeholder={tr('Search outlet name or code')} loading={branchesLoading} />
        <p className="text-xs text-[color:var(--j-626F86)]">{tr('A branch shows the users assigned to it. A Superadmin sees every branch and is always included.')}</p>
      </div>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ pieces */

function Avatar({ user }: { user: AuthUser }) {
  return <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />;
}

const ROLE_TONE: Record<Role, PillTone> = { superadmin: 'red', admin: 'red', cost_control: 'amber', outlet: 'teal', driver: 'violet', user: 'brand', cotr_admin: 'red' };

function RoleBadge({ role }: { role: Role }) {
  return <Pill tone={ROLE_TONE[role] ?? 'brand'} icon={role === 'superadmin' ? <ShieldCheck size={12} /> : undefined}>{ROLE_LABELS[role] ?? role}</Pill>;
}

function StatusBadge({ user }: { user: AuthUser }) {
  if (user.isLocked) return <Pill tone="amber" icon={<Lock size={11} />}>{tr('Locked')}</Pill>;
  return user.isActive ? <Pill tone="green" dot>{tr('Active')}</Pill> : <Pill tone="gray" dot>{tr('Inactive')}</Pill>;
}

/** Branches the account may see: superadmins every branch; a user without branches sees no data. */
function BranchesBadge({ user, branchName }: { user: AuthUser; branchName: (code: string) => string }) {
  if (!branchScoped(user.role) && !(branchLimitable(user.role) && user.branches?.length)) return <span className="whitespace-nowrap text-xs text-[color:var(--j-626F86)]">{tr('All Branches')}</span>;
  const codes = user.branches ?? [];
  if (!codes.length) return <Pill tone="red" icon={<CircleAlert size={11} />} title={tr('This user sees no data until branches are assigned')}>{tr('No branch')}</Pill>;
  const label = codes.length === 1 ? branchName(codes[0]) : tr('{0} branches', codes.length);
  return <Pill tone="gray" icon={<Store size={11} className="flex-shrink-0" />} title={codes.map(branchName).join('\n')} className="!max-w-[14rem]"><span className="min-w-0 truncate">{label}</span></Pill>;
}

/** The employee of the account left the company in HRMS (2026-11-15): only marked, the account stays as it is. */
function HrmsLeftBadge() {
  return <Pill tone="red" icon={<CircleAlert size={11} />} title={tr('This employee has left in HRMS. The account is only marked; deactivate it by hand if needed.')}>{tr('Left in HRMS')}</Pill>;
}

const HRMS_STATUS: Record<string, string> = { get aktif() { return tr('Active'); }, get kontrak() { return tr('Contract'); }, get percobaan() { return tr('Probation'); }, get keluar() { return tr('Left'); } };

/** The HRMS employee linked to the account, read live (status, site, join date …). */
function HrmsSection({ user }: { user: AuthUser }) {
  const [emp, setEmp] = useState<HrmsEmployee | null | undefined>(undefined);
  const id = user.hrmsEmployeeId;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/hrms-sync/employees/${encodeURIComponent(id)}`).then(r => (r.ok ? r.json() : null)).then(e => { if (!cancelled) setEmp(e); }).catch(() => { if (!cancelled) setEmp(null); });
    return () => { cancelled = true; };
  }, [id]);
  if (!followsHrms(user.role)) return null;
  if (!id) {
    return (
      <DrawerSection title={tr('HRMS')}>
        <p className="flex items-center gap-2 rounded-[3px] bg-amber-50 px-3 py-2 text-sm text-amber-800"><CircleAlert size={16} /> {tr('Not linked to an HRMS employee: job title and department are filled in by hand.')}</p>
      </DrawerSection>
    );
  }
  const status = emp?.status ?? user.hrmsStatus ?? null;
  return (
    <DrawerSection title={tr('HRMS')} description={user.hrmsSyncedAt ? tr('Follows HRMS · last synced {0}', formatDateTime(user.hrmsSyncedAt)) : tr('Follows HRMS')}>
      {emp === undefined ? <div className="h-16 skeleton rounded-[3px]" /> : (
        <InfoGrid items={[
          [tr('Employee status'), status ? <span key="s" className={status === 'keluar' ? 'font-medium text-red-700' : undefined}>{HRMS_STATUS[status] ?? status}</span> : null],
          [tr('Employee Number'), emp?.employeeNo ?? user.employeeNumber],
          [tr('Joined'), emp?.joinDate ? formatDate(emp.joinDate) : null],
          [tr('Site'), emp?.site ?? null],
          [tr('HRMS email'), emp?.email ?? null],
          [tr('Linked by'), user.hrmsLinkedBy ? LINKED_BY[user.hrmsLinkedBy] ?? user.hrmsLinkedBy : null],
        ]} />
      )}
      {emp === null && <p className="mt-2 text-xs text-red-600">{tr('The linked HRMS employee could not be read.')}</p>}
    </DrawerSection>
  );
}

const LINKED_BY: Record<string, string> = { get name() { return tr('Name'); }, get email() { return tr('Email'); }, get employee_no() { return tr('Employee Number'); }, get manual() { return tr('By hand'); } };

/** the user has not filled in their own profile yet */
function ProfileBadge() {
  return <Pill tone="amber" icon={<CircleAlert size={11} />} title={tr('Full name, phone number, job title or department is missing')}>{tr('Profile Incomplete')}</Pill>;
}

function UserRow({ user, isMe, branchName, onView, actions }: {
  user: AuthUser; isMe: boolean; branchName: (code: string) => string; onView: () => void; actions: ActionItem[];
}) {
  return (
    <tr className={jRow} onClick={onView}>
      <td className={`${jTd} max-w-[18rem]`}>
        <button type="button" onClick={e => { e.stopPropagation(); onView(); }} className="flex min-w-0 items-center gap-3 text-left">
          <Avatar user={user} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-[color:var(--j-172B4D)] group-hover:text-[color:var(--j-0C66E4)]">
              {user.displayName}{isMe && <span className="ml-1.5 text-xs font-normal text-[color:var(--j-626F86)]">{tr('(you)')}</span>}
            </span>
            {user.profileComplete
              ? <span className="block truncate text-xs text-[color:var(--j-626F86)]">@{user.username}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</span>
              : <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[color:var(--j-626F86)]">@{user.username} <ProfileBadge /></span>}
            {user.hrmsLeft && <span className="mt-0.5 block"><HrmsLeftBadge /></span>}
          </span>
        </button>
      </td>
      <td className={`${jTd} hidden max-w-[16rem] lg:table-cell`}>
        <span className="block truncate text-[color:var(--j-44546F)]">{user.email}</span>
        <span className="block truncate text-xs text-[color:var(--j-626F86)]">{user.phoneNumber || '—'}</span>
      </td>
      <td className={jTd}><RoleBadge role={user.role} /></td>
      <td className={jTd}><BranchesBadge user={user} branchName={branchName} /></td>
      <td className={jTd}><StatusBadge user={user} /></td>
      <td className={`${jTd} hidden whitespace-nowrap text-xs text-[color:var(--j-626F86)] xl:table-cell`}>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : tr('Never')}</td>
      <td className={`${jTd} text-right`} onClick={e => e.stopPropagation()}><ActionMenu items={actions} label={tr('Actions for {0}', user.username)} /></td>
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
function UserFormDrawer({ user, isMe, branches, branchesLoading, line, onClose, onSaved }: {
  user: AuthUser | null; isMe: boolean; branches: Branch[]; branchesLoading: boolean; line: Tab; onClose: () => void;
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
  const [pageOverrides, setPageOverrides] = useState<Record<string, boolean>>(() => user?.pageOverrides ?? {});
  const [tab, setTab] = useState<Tab>(() => (user ? tabOf(user, branches) : line));
  const businessLine = lineOf(tab);
  // superadmin / admin: every branch (nothing stored, new branches included) or the chosen ones only (2026-11-25)
  const [everyBranch, setEveryBranch] = useState(() => !(user?.branches ?? []).length);
  const [hiddenPages, setHiddenPages] = useState<string[]>(() => user?.hiddenPages ?? []);
  // Calf On The Road (2026-11-12): the account is made from its employee in Master Driver and a kind that sets the pages
  const [cotrEmployee, setCotrEmployee] = useState<CotrEmployee | null>(() => (user?.cotrDriver ? { ...user.cotrDriver, phone: null, position: null } : null));
  const [cotrKind, setCotrKind] = useState<CotrKind>(() => (user ? kindOf(user.role, user.pages) : 'driver'));
  const [userRolePages, setUserRolePages] = useState<string[]>([]);
  useEffect(() => {
    api<{ roles: Record<string, string[]> }>('/api/access/pages').then(r => setUserRolePages(r.roles.user ?? [])).catch(() => setUserRolePages([]));
  }, []);
  const cotrMode = businessLine === 'cotr' && form.role !== 'superadmin' && form.role !== 'cost_control';
  const pickKind = (k: CotrKind) => {
    setCotrKind(k);
    setForm(f => ({ ...f, role: k === 'driver' ? 'driver' : k === 'admin' ? 'cotr_admin' : 'user' }));
    if (k !== 'custom') setPageOverrides(cotrOverrides(k, userRolePages));
    if (cotrEmployee && creating) {
      const name = usernameOf(k, cotrEmployee);
      setForm(f => ({ ...f, username: name, email: `${name}@kopicalf.co.id` }));
    }
  };
  const pickEmployee = (e: CotrEmployee) => {
    setCotrEmployee(e);
    if (creating) {
      setProfile(p => ({ ...p, fullName: e.name, phoneNumber: e.phone ?? p.phoneNumber, jobTitle: e.position ?? p.jobTitle, department: e.department ?? p.department }));
      const name = usernameOf(cotrKind, e);
      setForm(f => ({ ...f, username: name, email: `${name}@kopicalf.co.id` }));
      setUsernameTouched(true);
    }
  };
  // HRMS (migration 110): a person account follows its HRMS employee; undefined = link unchanged, '' = unlink
  const [hrmsPick, setHrmsPick] = useState<HrmsEmployee | null>(null);
  const [hrmsChange, setHrmsChange] = useState<string | undefined>(undefined);
  const hrmsLinked = hrmsChange === undefined ? !!user?.hrmsEmployeeId : !!hrmsChange;
  // migration 115: a person account is made from its HRMS employee; a shared or test account says so and is never linked
  const [accountKind, setAccountKind] = useState<'person' | 'shared' | 'test'>(user?.accountKind ?? 'person');
  const person = followsHrms(form.role) && accountKind === 'person';
  // the profile keys shown read-only: those the picked employee has, else those the server locks for the account
  const hrmsFields = useMemo<string[]>(() => (!person || !hrmsLinked ? []
    : hrmsPick ? HRMS_FIELDS.filter(k => hrmsValue(hrmsPick, k)) : (user?.hrmsLocked ?? [])), [person, hrmsLinked, hrmsPick, user]);
  const [showPassword, setShowPassword] = useState(creating);
  // the username follows the full name until it is typed by hand
  const [usernameTouched, setUsernameTouched] = useState(!creating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string | null } | null>(null);
  const set = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) => setForm(f => ({ ...f, [key]: value }));
  const setProfileField = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setProfile(p => ({ ...p, [key]: value }));
  const pickHrms = (e: HrmsEmployee) => {
    setHrmsPick(e);
    setHrmsChange(e.id);
    if (creating && !usernameTouched && !profile.fullName) set('username', suggestUsername(e.name));
    setProfile(p => {
      const next = { ...p };
      for (const k of HRMS_FIELDS) { const v = hrmsValue(e, k); if (v) (next as Record<string, string>)[k] = v; }
      return next;
    });
  };
  const unlinkHrms = () => { setHrmsPick(null); setHrmsChange(''); };

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
    if (branchScoped(form.role)) body.branches = branchCodes;
    if (branchLimitable(form.role)) body.branches = everyBranch ? [] : branchCodes;
    if (form.role !== 'superadmin') body.pageOverrides = pageOverrides;
    else {
      body.hiddenPages = hiddenPages;
      // a super admin keeps only the WW-WR team markers (Form / Monitoring WW-WR)
      body.pageOverrides = Object.fromEntries(Object.entries(pageOverrides).filter(([k, v]) => v && (k === 'form.wwwr' || k === 'mon.wwwr')));
    }
    body.businessLine = businessLine;
    if (followsHrms(form.role)) body.accountKind = accountKind;
    if (person && hrmsChange !== undefined) body.hrmsEmployeeId = hrmsChange;
    if (person && hrmsLinked) for (const k of hrmsFields) delete body[k];
    if (cotrMode) {
      body.cotrDriver = cotrEmployee?.code ?? '';
      if (cotrKind !== 'custom' && cotrKind !== 'driver') body.pageOverrides = cotrOverrides(cotrKind, userRolePages);
      delete body.branches;
    }
    return body;
  }, [form, profile, creating, branchCodes, everyBranch, pageOverrides, businessLine, hiddenPages, cotrMode, cotrEmployee, cotrKind, userRolePages, person, accountKind, hrmsChange, hrmsLinked, hrmsFields]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (branchLimitable(form.role) && !everyBranch && !branchCodes.length) { setError({ text: tr('Choose at least one branch, or Every branch'), field: 'branches' }); return; }
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
  const knownField = error?.field && (['username', 'email', 'role', 'isActive', 'password', 'notes', 'avatar', 'branches', 'pageOverrides', 'hrmsEmployeeId'] as string[]).concat(PROFILE_KEYS).includes(error.field);

  return (
    <Drawer open onClose={onClose} size={creating ? 'md' : 'lg'}
      icon={creating ? <UserPlus size={18} /> : <UserRoundPen size={18} />}
      title={creating ? tr('New User') : tr('Edit {0}', user!.username)}
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
          <p className="mb-5 flex items-start gap-2 rounded-[3px] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5" />{error.text}</p>
        )}

        {!creating && (
          <DrawerSection title={tr('Profile Photo')}>
            <AvatarEditor name={user!.displayName} src={user!.avatarUrl} endpoint={`/api/users/${user!.id}/avatar`}
              onSaved={u => { if (u.id === me?.id) setMe(u); }} />
            {error?.field === 'avatar' && <p className="text-xs text-red-600">{error.text}</p>}
          </DrawerSection>
        )}

        {cotrMode && (
          <DrawerSection title={tr('COTR employee')} description={tr('Choose the employee in Master Driver: the name, phone, position and department are filled from it and the account is tied to them.')}>
            <EmployeePicker value={cotrEmployee} onPick={pickEmployee} inputClass={inputClass} />
            {fieldError('cotrDriver') && <p className="text-xs text-red-600">{fieldError('cotrDriver')}</p>}
            <Field label={tr('Kind of account')} htmlFor="f-cotr-kind" hint={COTR_KINDS.find(k => k.key === cotrKind)?.hint()}>
              <NativeSelect id="f-cotr-kind" className={inputClass} value={cotrKind} onChange={e => pickKind(e.target.value as CotrKind)}>
                {COTR_KINDS.map(k => <option key={k.key} value={k.key}>{k.label()}</option>)}
              </NativeSelect>
            </Field>
          </DrawerSection>
        )}

        {followsHrms(form.role) && (
          <DrawerSection title={tr('HRMS employee')} description={accountKind === 'person'
            ? tr('A person account is made from its HRMS employee: name, job title and department follow HRMS.')
            : tr('A shared or test account is never linked to HRMS and is left out of the person scores.')}>
            <Field label={tr('Kind of account')} htmlFor="f-account-kind">
              <NativeSelect id="f-account-kind" className={inputClass} value={accountKind}
                onChange={e => { const k = e.target.value as typeof accountKind; setAccountKind(k); if (k !== 'person') { setHrmsPick(null); setHrmsChange(undefined); } }}>
                <option value="person">{tr('Person (HRMS employee)')}</option>
                <option value="shared">{tr('Shared account (a team)')}</option>
                <option value="test">{tr('Test account')}</option>
              </NativeSelect>
            </Field>
            {person && (
              <HrmsEmployeePicker linked={hrmsLinked} picked={hrmsPick} onPick={pickHrms} onUnlink={unlinkHrms}
                initialQuery={profile.fullName} error={fieldError('hrmsEmployeeId')} />
            )}
            {!person && fieldError('hrmsEmployeeId') && <p className="text-xs text-red-600">{fieldError('hrmsEmployeeId')}</p>}
          </DrawerSection>
        )}

        {creating && !cotrMode && (
          <DrawerSection title={tr('Identity')} description={tr('Optional — filled in now, the profile is complete at the first sign-in (the user can still change it).')}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={tr('Full name')} htmlFor="f-fullName" error={fieldError('fullName')}>
                <input id="f-fullName" className={inputClass} value={profile.fullName} maxLength={120} autoComplete="off"
                  onChange={e => {
                    setProfileField('fullName', e.target.value);
                    if (!usernameTouched) set('username', suggestUsername(e.target.value));
                  }} />
              </Field>
              <Field label={tr('Phone Number')} htmlFor="f-phoneNumber" error={fieldError('phoneNumber')} hint="e.g. 0812-3456-7890">
                <input id="f-phoneNumber" type="tel" className={inputClass} value={profile.phoneNumber} maxLength={32} autoComplete="off"
                  onChange={e => setProfileField('phoneNumber', e.target.value)} />
              </Field>
              {!hrmsFields.includes('jobTitle') && <>
                <Field label={tr('Job title')} htmlFor="f-jobTitle" error={fieldError('jobTitle')}>
                  <MasterCombobox kind="jobTitle" id="f-jobTitle" value={profile.jobTitle} onChange={v => setProfileField('jobTitle', v)}
                    canAdd placeholder={tr('PIC Outlet')} />
                </Field>
                <Field label={tr('Department')} htmlFor="f-department" error={fieldError('department')}>
                  <MasterCombobox kind="department" id="f-department" value={profile.department} onChange={v => setProfileField('department', v)}
                    canAdd placeholder={tr('Operations')} />
                </Field>
              </>}
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
            <Field label={creating ? tr('Password') : tr('New Password')} htmlFor="f-password" required={creating} error={fieldError('password')}
              hint={creating ? tr('Generated for you — share it with the user privately. At least 8 characters with letters and numbers.') : tr('At least 8 characters with letters and numbers')}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input id="f-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass} pr-10 font-mono`}
                    value={form.password} onChange={e => set('password', e.target.value)} maxLength={128} required={creating}
                    placeholder={creating ? '' : tr('Keep current password')} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[color:var(--j-626F86)] hover:text-[color:var(--j-44546F)]"
                    aria-label={showPassword ? tr('Hide password') : tr('Show password')}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="button" className={buttonSecondary} onClick={() => { set('password', generatePassword()); setShowPassword(true); }} title={tr('Generate a Strong Password')}>
                  <Wand2 size={16} /><span className="hidden sm:inline">{tr('Generate')}</span>
                </button>
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm text-[color:var(--j-44546F)]">
              <input type="checkbox" checked={form.mustChangePassword} onChange={e => set('mustChangePassword', e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--j-8590A2)] text-[color:var(--j-0C66E4)]" />
              {tr('Must change password at next sign-in')}
            </label>
          </div>
        </DrawerSection>

        <DrawerSection title={tr('Access')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tr('Business Line')} htmlFor="f-line" error={fieldError('businessLine')} hint={tr('The tab of User Accounts the account is listed in; its branches are of this line')}>
              <NativeSelect id="f-line" value={tab} disabled={me?.role === 'cotr_admin'} onChange={e => { const v = e.target.value as Tab; setTab(v); if (!branchLimitable(form.role)) setBranchCodes([]); if (v === 'cotr' && creating) pickKind('driver'); else if (form.role === 'driver') set('role', 'user'); }} className={inputClass}>
                {LINES.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
              </NativeSelect>
            </Field>
            {!cotrMode && <Field label={tr('Role')} htmlFor="f-role" error={fieldError('role')} hint={form.role === 'superadmin' ? tr('Full access incl. platforms and user accounts') : form.role === 'cost_control' ? tr('Inventory Surveyor: every branch and the pages of the role') : form.role === 'outlet' ? tr('Shared outlet / HUB account: Stock Opname and Waste of the assigned branches') : form.role === 'driver' ? tr('Calf On The Road driver: signs in to cotr.kopicalf.co.id only; tie the account to the driver in Monitoring COTR → Master Driver') : form.role === 'admin' ? tr('Admin: the pages the Superadmin gives it. It manages accounts of role User, with the pages it has itself.') : tr('User (Area Supervisor / PIC): the forms except Cost Control Clock In, Dashboard, Sales and Aggregator of the assigned branches.')}>
              <NativeSelect id="f-role" className={inputClass} value={form.role} disabled={me?.role === 'admin'} onChange={e => { set('role', e.target.value as Role); setPageOverrides({}); }}>
                <option value="user">{ROLE_LABELS.user}</option>
                {me?.role === 'superadmin' && <option value="admin">{ROLE_LABELS.admin}</option>}
                <option value="outlet">{ROLE_LABELS.outlet}</option>
                <option value="driver">{ROLE_LABELS.driver}</option>
                <option value="cost_control">{ROLE_LABELS.cost_control}</option>
                <option value="superadmin">{ROLE_LABELS.superadmin}</option>
              </NativeSelect>
            </Field>}
            <Field label={tr('Status')} htmlFor="f-active" error={fieldError('isActive')} hint={isMe ? tr('You cannot deactivate your own account') : tr('Inactive users cannot sign in')}>
              <NativeSelect id="f-active" className={inputClass} value={form.isActive ? '1' : '0'} disabled={isMe} onChange={e => set('isActive', e.target.value === '1')}>
                <option value="1">{tr('Active')}</option>
                <option value="0">{tr('Inactive')}</option>
              </NativeSelect>
            </Field>
          </div>
        </DrawerSection>

        {form.role !== 'driver' && (!cotrMode || cotrKind === 'custom') && (
          <DrawerSection title={tr('Page Access')} description={tr('Pages of the role are ticked; tick or untick to add or remove a page for this user only. Change the role pages under Roles & pages.')}>
            <PageAccessEditor role={form.role} overrides={pageOverrides} onChange={setPageOverrides} hidden={hiddenPages} onHiddenChange={setHiddenPages}
              limit={me?.role === 'admin' ? me.pages ?? [] : undefined} />
            {fieldError('pageOverrides') && <p className="text-xs text-red-600">{fieldError('pageOverrides')}</p>}
          </DrawerSection>
        )}

        {cotrMode ? (
          <p className="mt-6 flex items-start gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-3 py-2.5 text-sm text-[color:var(--j-44546F)]">
            <Info size={16} className="mt-0.5 flex-shrink-0 text-[color:var(--j-0C66E4)]" /> {tr('No ESB branches for the COTR team: the pool comes from the employee in Master Driver.')}
          </p>
        ) : branchScoped(form.role) || branchLimitable(form.role) ? (
          <DrawerSection title={tr('Branch Access')} description={branchLimitable(form.role) ? tr('Optional: choose branches to narrow this account. None chosen = every branch.') : tr('Dashboard, Sales Transactions, Stock Opname and the forms show only these branches, exports too. Required for the roles User and Outlet/HUB.')}>
            {branchLimitable(form.role) && (
              <Segmented label={tr('Branch Access')} value={everyBranch ? 'all' : 'some'} onChange={v => setEveryBranch(v === 'all')}
                options={[{ value: 'all', label: tr('Every branch') }, { value: 'some', label: tr('Chosen branches') }]} />
            )}
            {branchLimitable(form.role) && everyBranch ? (
              <p className="mt-2 text-xs text-[color:var(--j-626F86)]">{tr('Every brand and unit, new branches included.')}</p>
            ) : (
              <div className={branchLimitable(form.role) ? 'mt-3' : ''}>
                {/* what the account already holds outside this tab stays visible, never silently kept or lost */}
                <BranchAssign branches={branchLimitable(form.role) ? branches : [...tabBranches(branches, tab), ...branches.filter(b => branchCodes.includes(b.branch_code) && !tabBranches(branches, tab).includes(b))]}
                  loading={branchesLoading} value={branchCodes} onChange={setBranchCodes} invalid={error?.field === 'branches'} />
                {branchLimitable(form.role) && branchCodes.length > 0 && !branches.some(b => b.unit === 'CALF7' && branchCodes.includes(b.branch_code)) && (
                  <p className="mt-1.5 text-xs text-amber-800">{tr('No Wasgee branch chosen: this account will not see the figures of Wasgee.')}</p>
                )}
              </div>
            )}
            {fieldError('branches') && <p className="mt-1.5 text-xs text-red-600">{fieldError('branches')}</p>}
          </DrawerSection>
        ) : (
          <p className="mt-6 flex items-start gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-3 py-2.5 text-sm text-[color:var(--j-44546F)]">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0 text-red-700" /> {form.role === 'driver' ? tr('Drivers have no branches: their pool and fleet are set in Master Driver.') : tr('A Superadmin sees every branch.')}
          </p>
        )}

        {!creating && <FundUnits userId={user!.id} />}

        {creating ? (
          <>
            <DrawerSection title={tr('Administrator Notes')} description={tr('Only a Superadmin sees this, e.g. the area or outlet group.')}>
              <Field label={tr('Notes')} htmlFor="f-notes" error={fieldError('notes')}>
                <textarea id="f-notes" rows={2} className={`${inputClass} h-auto py-2`} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} />
              </Field>
            </DrawerSection>
            <div className="mt-6 flex items-start gap-2.5 rounded-[3px] border border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-3.5 py-3 text-sm text-[color:var(--j-0055CC)]">
              <Info size={16} className="mt-0.5 flex-shrink-0 text-[color:var(--j-0C66E4)]" />
              <p>
                {tr('After saving you get the login details to share with the user. At the first sign-in the user sets a new password and completes')} <span className="font-medium">{tr('My profile')}</span> {tr('(gender, date of birth, address, work location…).')}
              </p>
            </div>
          </>
        ) : (
          <>
            {!user!.profileComplete && (
              <p className="mt-6 flex items-start gap-2 rounded-[3px] border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-900">
                <CircleAlert size={16} className="mt-0.5 flex-shrink-0" /> {tr('The user has not completed their profile yet. They can fill it in themself under My profile.')}
              </p>
            )}
            <ProfileFields values={profile} onChange={setProfileField} fieldError={fieldError} idPrefix="f" markRequired={false} locked={hrmsFields}
              currentBranchName={user!.workBranchName} />
            <DrawerSection title={tr('Administrator Notes')} description={tr('Only a Superadmin sees this.')}>
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
    <dl className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-F1F2F4)]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9.5rem_1fr] gap-3 px-3 py-2 text-sm">
          <dt className="text-[color:var(--j-626F86)]">{k}</dt>
          <dd className="min-w-0 break-words text-[color:var(--j-172B4D)]">{v ?? '—'}</dd>
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
          <dt className="text-xs font-semibold capitalize text-[color:var(--j-626F86)]">{k}</dt>
          <dd className="mt-0.5 break-words text-sm text-[color:var(--j-172B4D)]">{v === null || v === undefined || v === '' ? <span className="text-[color:var(--j-626F86)]">—</span> : v}</dd>
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
  const limited = branchScoped(user.role) || (branchLimitable(user.role) && branchCodes.length > 0);

  return (
    <Drawer open onClose={onClose} size="lg" icon={<UserRound size={18} />} title={tr('User Details')} description={isMe ? tr('This is your account') : `@${user.username}`}
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
          <p className="truncate text-xl font-semibold text-[color:var(--j-172B4D)]">{user.displayName}</p>
          <p className="truncate text-sm text-[color:var(--j-626F86)]">
            {[user.jobTitle, user.department].filter(Boolean).join(' · ') || tr('Job title not filled in yet')}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5"><RoleBadge role={user.role} /><StatusBadge user={user} />{user.hrmsLeft && <HrmsLeftBadge />}{!user.profileComplete && <ProfileBadge />}</div>
        </div>
      </div>

      {/* at a glance */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-DCDFE4)] sm:grid-cols-4">
        <Glance label={tr('Last Sign-in')} value={ago(user.lastLoginAt)} sub={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : tr('has not signed in')} />
        <Glance label={tr('Branch Access')} value={!limited ? 'All' : formatNumber(branchCodes.length)}
          sub={!limited ? ROLE_LABELS[user.role] : branchCodes.length ? (branchCodes.length === 1 ? branchName(branchCodes[0]) : tr('branches')) : tr('sees no data')}
          tone={branchScoped(user.role) && !branchCodes.length ? 'bad' : undefined} />
        <Glance label={tr('Profile')} value={`${filled}/${PROFILE_REQUIRED.length}`} sub={missing.length ? tr('missing: {0}', missing.join(', ')) : tr('complete')}
          tone={missing.length ? 'warn' : 'good'} />
        <Glance label={tr('Activity, 30 Days')} value={counts ? formatNumber(counts.total) : '…'} sub={counts ? tr('{0} exports', formatNumber(counts.exports)) : ''} />
      </div>

      <DrawerSection title={tr('Branch Access')} description={!limited ? tr('{0} sees every branch', ROLE_LABELS[user.role]) : tr('Overview, Sales Transactions and exports are limited to these branches')}>
        {!limited ? (
          <p className="flex items-center gap-2 text-sm text-[color:var(--j-44546F)]"><ShieldCheck size={16} className="text-red-700" /> {tr('All Branches')}</p>
        ) : branchCodes.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {branchCodes.map(code => (
              <li key={code} className="flex items-center gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 py-2 text-sm">
                <Store size={14} className="flex-shrink-0 text-[color:var(--j-626F86)]" />
                <span className="min-w-0 flex-1 truncate text-[color:var(--j-172B4D)]">{branchName(code)}</span>
                <span className="font-mono text-[11px] text-[color:var(--j-626F86)]">{code}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 rounded-[3px] bg-red-50 px-3 py-2 text-sm text-red-700"><CircleAlert size={16} /> {tr('No branch assigned — this user sees no data.')}</p>
        )}
      </DrawerSection>

      <FundUnits userId={user.id} />

      <DrawerSection title={tr('Pages')} description={user.role === 'superadmin' ? tr('A Superadmin opens every page') : tr('Pages of the role {0}, plus the exceptions of this user', ROLE_LABELS[user.role])}>
        <ul className="flex flex-wrap gap-1.5">
          {PAGES.filter(p => user.role === 'superadmin' || (user.pages ?? []).includes(p.key)).map(p => {
            const extra = user.pageOverrides?.[p.key] === true;
            return (
              <li key={p.key} className={`rounded-full px-2.5 py-1 text-xs ${extra ? 'bg-emerald-50 font-medium text-emerald-800' : 'bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)]'}`}
                title={extra ? tr('Added for this user') : p.group}>{p.label}</li>
            );
          })}
          {Object.entries(user.pageOverrides ?? {}).filter(([, on]) => !on).map(([key]) => (
            <li key={key} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700 line-through" title={tr('Removed for This User')}>
              {PAGES.find(p => p.key === key)?.label ?? key}
            </li>
          ))}
        </ul>
      </DrawerSection>

      <DrawerSection title={tr('Contact')}>
        <InfoGrid items={[
          [tr('Email'), <a key="e" href={`mailto:${user.email}`} className="text-[color:var(--j-0C66E4)] hover:underline">{user.email}</a>],
          [tr('Phone'), user.phoneNumber ? (
            <span key="p" className="flex flex-wrap items-center gap-2">
              <a href={`tel:${user.phoneNumber}`} className="text-[color:var(--j-0C66E4)] hover:underline">{user.phoneNumber}</a>
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
          [tr('Employee Number'), user.employeeNumber],
          [tr('Work Location'), user.workBranchName || user.workBranchCode],
        ]} />
      </DrawerSection>

      <HrmsSection user={user} />

      <DrawerSection title={tr('Personal')} description={user.profileUpdatedAt ? tr('Last updated by the user {0}', formatDateTime(user.profileUpdatedAt)) : tr('Not yet filled in by the user')}>
        <InfoGrid items={[
          [tr('Gender'), user.gender ? GENDER_LABELS[user.gender] : null],
          [tr('Date of birth'), birthDateLabel(user.birthDate)],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Security')}>
        <InfoGrid items={[
          [tr('Username'), <span key="u" className="font-mono">{user.username}</span>],
          [tr('Last Sign-in'), user.lastLoginAt ? `${formatDateTime(user.lastLoginAt)}${user.lastLoginIp ? ` · ${user.lastLoginIp}` : ''}` : tr('Never')],
          [tr('Password changed'), user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : null],
          [tr('Must change password'), user.mustChangePassword ? tr('Yes, at the next sign-in') : tr('No')],
          [tr('Failed sign-in attempts'), formatNumber(user.failedLoginAttempts)],
          [tr('Locked until'), user.isLocked && user.lockedUntil ? formatDateTime(user.lockedUntil) : tr('Not locked')],
        ]} />
      </DrawerSection>

      <DrawerSection title={tr('Recent Activity')} description={tr('Last 30 Days')}>
        {recent === null ? (
          <div className="space-y-2">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 skeleton rounded-[3px]" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-[color:var(--j-626F86)]">{tr('No activity in the last 30 days.')}</p>
        ) : (
          <ol className="relative space-y-3 border-l border-[color:var(--j-DCDFE4)] pl-4">
            {recent.map(a => (
              <li key={a.id} className="relative">
                <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${a.status === 'ok' ? 'bg-neutral-300' : a.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <p className="text-sm text-[color:var(--j-172B4D)]">{a.summary || a.action}</p>
                <p className="text-[11px] text-[color:var(--j-626F86)]">{formatDateTime(a.at)} · <span className="font-mono">{a.action}</span></p>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={() => router.push(`/activity?user=${user.id}`)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--j-0C66E4)] hover:underline">
          <History size={14} /> {tr('Open in Activity Logs')}
        </button>
      </DrawerSection>

      <DrawerSection title={tr('Account History')}>
        <InfoGrid items={[
          [tr('Created'), `${user.createdAt ? formatDateTime(user.createdAt) : '—'}${user.createdBy ? ` by ${user.createdBy}` : ''}`],
          [tr('Updated'), `${user.updatedAt ? formatDateTime(user.updatedAt) : '—'}${user.updatedBy ? ` by ${user.updatedBy}` : ''}`],
          [tr('Administrator Notes'), user.notes],
        ]} />
      </DrawerSection>
    </Drawer>
  );
}

function Glance({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'good' | 'warn' | 'bad' }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-[color:var(--j-172B4D)]';
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <p className="text-xs font-semibold capitalize text-[color:var(--j-626F86)]">{label}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="truncate text-[11px] text-[color:var(--j-626F86)]" title={sub}>{sub}</p>
    </div>
  );
}

/** Login details to hand over after creating an account or setting a new password (never stored). */
function IssuedLoginDrawer({ issued, branchName, onClose }: { issued: IssuedLogin; branchName: (code: string) => string; onClose: () => void }) {
  const { user, password, created } = issued;
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const branches = !branchScoped(user.role) && !(branchLimitable(user.role) && user.branches?.length) ? 'Semua cabang' : (user.branches ?? []).map(branchName).join(', ') || '—';
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
      <div className="flex items-center gap-3 border-b border-[color:var(--j-F1F2F4)] pb-5">
        <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-[color:var(--j-172B4D)]">{user.displayName}</p>
          <div className="mt-1 flex flex-wrap gap-1.5"><RoleBadge role={user.role} /><BranchesBadge user={user} branchName={branchName} /></div>
        </div>
      </div>
      <DrawerSection title={tr('Login Details')}>
        <DetailList rows={[
          [tr('Username'), <span key="u" className="font-mono">{user.username}</span>],
          [tr('Email'), user.email],
          [tr('Password'), (
            <span key="p" className="flex items-center gap-2">
              <span className="font-mono">{show ? password : '•'.repeat(Math.min(password.length, 14))}</span>
              <button type="button" onClick={() => setShow(s => !s)} className="rounded p-1 text-[color:var(--j-626F86)] hover:text-[color:var(--j-44546F)]" aria-label={show ? tr('Hide password') : tr('Show password')}>
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          )],
          [tr('Branch Access'), branches],
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
      <div className="flex items-center gap-3 rounded-[3px] bg-red-50 px-3 py-3">
        <KeyRound size={18} className="text-red-600" />
        <div className="text-sm">
          <p className="font-semibold text-[color:var(--j-172B4D)]">{user.displayName}</p>
          <p className="text-[color:var(--j-44546F)]">{user.username} · {user.email}</p>
        </div>
      </div>
    </Dialog>
  );
}

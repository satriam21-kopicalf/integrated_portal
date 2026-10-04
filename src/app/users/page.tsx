'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, KeyRound, Loader2, Lock, Pencil, Plus, Search,
  ShieldCheck, Trash2, Unlock, UserRound, Users, Wand2, X,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Dialog, { buttonDanger, buttonPrimary, buttonSecondary, Field, inputClass } from '@/components/ui/Dialog';
import UserAvatar, { AvatarEditor } from '@/components/UserAvatar';
import { AuthUser, Role, ROLE_LABELS, useAuth } from '@/lib/auth';
import { formatDateTime, formatNumber } from '@/lib/format';

const PAGE_SIZE = 20;

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
  if (!res.ok) throw new ApiError(body.error || `HTTP ${res.status}`, body.field);
  return body as T;
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  const pw = Array.from(values, v => alphabet[v % alphabet.length]).join('');
  return /[A-Za-z]/.test(pw) && /\d/.test(pw) ? pw : generatePassword();
}

export default function UsersPage() {
  const router = useRouter();
  const { user: me, setUser: setMe } = useAuth();
  const [rows, setRows] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AuthUser | 'new' | null>(null);
  const [viewing, setViewing] = useState<AuthUser | null>(null);
  const [deleting, setDeleting] = useState<AuthUser | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allowed = me?.role === 'superadmin';
  useEffect(() => {
    if (me && !allowed) router.replace('/overview');
  }, [me, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (query) params.set('search', query);
      if (role) params.set('role', role);
      if (status) params.set('status', status);
      const body = await api<ListResponse>(`/api/users?${params}`);
      setRows(body.data);
      setTotal(body.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, query, role, status]);

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

  const saved = (u: AuthUser, created: boolean) => {
    setEditing(null);
    if (u.id === me?.id) setMe(u);
    setToast({ tone: 'ok', text: created ? `User ${u.username} created` : `User ${u.username} updated` });
    if (viewing?.id === u.id) setViewing(u);
    load();
  };

  const unlock = async (u: AuthUser) => {
    try {
      const body = await api<{ user: AuthUser }>(`/api/users/${u.id}/unlock`, { method: 'POST' });
      setToast({ tone: 'ok', text: `${u.username} unlocked` });
      setViewing(body.user);
      load();
    } catch (err) {
      setToast({ tone: 'error', text: (err as Error).message });
    }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtersActive = Boolean(query || role || status);

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center text-slate-400"><Loader2 className="animate-spin" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl"><Users size={20} className="text-blue-700" /> User Accounts</h1>
              <p className="text-xs text-slate-500 sm:text-sm">Accounts that can sign in to the dashboard and their access role</p>
            </div>
            <button type="button" className={buttonPrimary} onClick={() => setEditing('new')}>
              <Plus size={16} /> New user
            </button>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search name, username or email"
                  className={`${inputClass} pl-9`} aria-label="Search users" />
              </div>
              <div className="flex gap-2">
                <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} className={`${inputClass} w-auto`} aria-label="Role">
                  <option value="">All roles</option>
                  <option value="superadmin">Super Admin</option>
                  <option value="user">User</option>
                </select>
                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className={`${inputClass} w-auto`} aria-label="Status">
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
            </div>

            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                <AlertCircle className="text-red-500" />
                <p className="text-sm text-slate-700">{error}</p>
                <button type="button" className={buttonSecondary} onClick={load}>Try again</button>
              </div>
            ) : !loading && rows.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-14 text-center">
                <UserRound className="mb-2 text-slate-300" size={28} />
                <p className="text-sm font-medium text-slate-700">{filtersActive ? 'No users match the filters' : 'No users yet'}</p>
              </div>
            ) : (
              <div className={`relative ${loading && rows.length ? 'opacity-60' : ''}`}>
                <table className="hidden w-full text-sm md:table">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">User</th>
                      <th scope="col" className="px-4 py-2.5">Email</th>
                      <th scope="col" className="px-4 py-2.5">Role</th>
                      <th scope="col" className="px-4 py-2.5">Status</th>
                      <th scope="col" className="px-4 py-2.5">Last sign-in</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(loading && !rows.length ? Array.from({ length: 5 }) : rows).map((u, i) => u ? (
                      <UserRow key={(u as AuthUser).id} user={u as AuthUser} isMe={(u as AuthUser).id === me?.id}
                        onView={() => setViewing(u as AuthUser)} onEdit={() => setEditing(u as AuthUser)} onDelete={() => setDeleting(u as AuthUser)} />
                    ) : (
                      <tr key={i}><td colSpan={6} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                    ))}
                  </tbody>
                </table>
                <ul className="divide-y divide-slate-100 md:hidden">
                  {rows.map(u => (
                    <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar user={u} />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setViewing(u)}>
                        <p className="truncate text-sm font-medium text-slate-900">{u.fullName}</p>
                        <p className="truncate text-xs text-slate-500">{u.username} · {u.email}</p>
                        <div className="mt-1 flex gap-1.5"><RoleBadge role={u.role} /><StatusBadge user={u} /></div>
                      </button>
                      <button type="button" onClick={() => setEditing(u)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${u.username}`}><Pencil size={16} /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500 sm:flex-row">
              <span>{formatNumber(total)} {total === 1 ? 'user' : 'users'}{filtersActive ? ' match' : ''}</span>
              <div className="flex items-center gap-2">
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
                <span>Page {page} of {pages}</span>
                <button type="button" className={`${buttonSecondary} h-8 px-2`} disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {editing && <UserFormDialog user={editing === 'new' ? null : editing} isMe={editing !== 'new' && editing.id === me?.id}
        onClose={() => setEditing(null)} onSaved={saved} />}
      {viewing && <UserDetailDialog user={viewing} isMe={viewing.id === me?.id} onClose={() => setViewing(null)}
        onEdit={() => { setEditing(viewing); setViewing(null); }} onDelete={() => { setDeleting(viewing); setViewing(null); }} onUnlock={() => unlock(viewing)} />}
      {deleting && <DeleteDialog user={deleting} onClose={() => setDeleting(null)}
        onDeleted={() => { setToast({ tone: 'ok', text: `User ${deleting.username} deleted` }); setDeleting(null); load(); }}
        onError={text => setToast({ tone: 'error', text })} />}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-[90] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.tone === 'ok' ? 'bg-slate-900' : 'bg-red-600'}`} role="status">
          {toast.tone === 'ok' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} />}
          {toast.text}
          <button type="button" onClick={() => setToast(null)} className="ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}
    </DashboardLayout>
  );
}

/* ------------------------------------------------------------------ pieces */

function Avatar({ user }: { user: AuthUser }) {
  return <UserAvatar name={user.fullName} src={user.avatarUrl} size="md" />;
}

function RoleBadge({ role }: { role: Role }) {
  const superadmin = role === 'superadmin';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${superadmin ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
      {superadmin && <ShieldCheck size={12} />}{ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusBadge({ user }: { user: AuthUser }) {
  if (user.isLocked) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Lock size={11} /> Locked</span>;
  return user.isActive
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inactive</span>;
}

function UserRow({ user, isMe, onView, onEdit, onDelete }: { user: AuthUser; isMe: boolean; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-4 py-2.5">
        <button type="button" onClick={onView} className="flex items-center gap-3 text-left">
          <Avatar user={user} />
          <span className="min-w-0">
            <span className="block truncate font-medium text-slate-900">{user.fullName}{isMe && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</span>
            <span className="block truncate text-xs text-slate-500">{user.username}{user.jobTitle ? ` · ${user.jobTitle}` : ''}</span>
          </span>
        </button>
      </td>
      <td className="px-4 py-2.5 text-slate-600">{user.email}</td>
      <td className="px-4 py-2.5"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-2.5"><StatusBadge user={user} /></td>
      <td className="px-4 py-2.5 text-xs text-slate-500">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}</td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1">
          <IconButton label={`View ${user.username}`} onClick={onView}><Eye size={16} /></IconButton>
          <IconButton label={`Edit ${user.username}`} onClick={onEdit}><Pencil size={16} /></IconButton>
          <IconButton label={`Delete ${user.username}`} onClick={onDelete} disabled={isMe} danger><Trash2 size={16} /></IconButton>
        </div>
      </td>
    </tr>
  );
}

function IconButton({ label, onClick, children, disabled, danger }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={disabled ? 'You cannot delete your own account' : label} aria-label={label}
      className={`rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ form */

interface FormState {
  fullName: string;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  phoneNumber: string;
  jobTitle: string;
  department: string;
  notes: string;
  password: string;
  mustChangePassword: boolean;
}

function UserFormDialog({ user, isMe, onClose, onSaved }: { user: AuthUser | null; isMe: boolean; onClose: () => void; onSaved: (u: AuthUser, created: boolean) => void }) {
  const creating = !user;
  const { user: me, setUser: setMe } = useAuth();
  const [form, setForm] = useState<FormState>(() => ({
    fullName: user?.fullName ?? '', username: user?.username ?? '', email: user?.email ?? '', role: user?.role ?? 'user',
    isActive: user?.isActive ?? true, phoneNumber: user?.phoneNumber ?? '', jobTitle: user?.jobTitle ?? '',
    department: user?.department ?? '', notes: user?.notes ?? '', password: '', mustChangePassword: creating ? true : user!.mustChangePassword,
  }));
  const [showPassword, setShowPassword] = useState(creating);
  const [photo, setPhoto] = useState<string | null>(null); // picked before the user exists
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string | null } | null>(null);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));

  const payload = useMemo(() => {
    const body: Record<string, unknown> = {
      fullName: form.fullName, username: form.username, email: form.email, role: form.role, isActive: form.isActive,
      phoneNumber: form.phoneNumber, jobTitle: form.jobTitle, department: form.department, notes: form.notes,
      mustChangePassword: form.mustChangePassword,
    };
    if (form.password) body.password = form.password;
    return body;
  }, [form]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let res = await api<{ user: AuthUser }>(creating ? '/api/users' : `/api/users/${user!.id}`, {
        method: creating ? 'POST' : 'PATCH', body: JSON.stringify(payload),
      });
      if (creating && photo) {
        res = await api<{ user: AuthUser }>(`/api/users/${res.user.id}/avatar`, { method: 'PUT', body: JSON.stringify({ image: photo }) });
      }
      onSaved(res.user, creating);
    } catch (err) {
      setError({ text: (err as Error).message, field: (err as ApiError).field });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: string) => (error?.field === name ? error.text : null);

  return (
    <Dialog open onClose={onClose} size="lg" title={creating ? 'New user' : `Edit ${user!.username}`}
      description={creating ? 'The user signs in with the username or email and the password set here.' : 'Leave the password empty to keep the current one.'}
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="submit" form="user-form" className={buttonPrimary} disabled={saving}>
            {saving && <Loader2 size={16} className="animate-spin" />}{creating ? 'Create user' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Profile photo</legend>
          {creating
            ? <AvatarEditor name={form.fullName} src={null} onPick={setPhoto} />
            : <AvatarEditor name={form.fullName} src={user!.avatarUrl} endpoint={`/api/users/${user!.id}/avatar`}
                onSaved={u => { if (u.id === me?.id) setMe(u); }} />}
          {error?.field === 'avatar' && <p className="mt-1 text-xs text-red-600">{error.text}</p>}
        </fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2">Account</legend>
          <Field label="Full name" htmlFor="f-name" required error={fieldError('fullName')} className="sm:col-span-2">
            <input id="f-name" className={inputClass} value={form.fullName} onChange={e => set('fullName', e.target.value)} maxLength={120} required />
          </Field>
          <Field label="Username" htmlFor="f-username" required error={fieldError('username')} hint="3–32: lowercase letters, numbers, . _ -">
            <input id="f-username" className={inputClass} value={form.username} onChange={e => set('username', e.target.value.toLowerCase())}
              autoCapitalize="none" spellCheck={false} maxLength={32} required />
          </Field>
          <Field label="Email" htmlFor="f-email" required error={fieldError('email')}>
            <input id="f-email" type="email" className={inputClass} value={form.email} onChange={e => set('email', e.target.value)} maxLength={254} required />
          </Field>
          <Field label="Role" htmlFor="f-role" error={fieldError('role')} hint={form.role === 'superadmin' ? 'Full access incl. platforms and user accounts' : 'Dashboards only (Overview, Sales Transactions)'}>
            <select id="f-role" className={inputClass} value={form.role} onChange={e => set('role', e.target.value as Role)}>
              <option value="user">User</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </Field>
          <Field label="Status" htmlFor="f-active" error={fieldError('isActive')} hint={isMe ? 'You cannot deactivate your own account' : 'Inactive users cannot sign in'}>
            <select id="f-active" className={inputClass} value={form.isActive ? '1' : '0'} disabled={isMe} onChange={e => set('isActive', e.target.value === '1')}>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2">{creating ? 'Password' : 'Reset password'}</legend>
          <Field label={creating ? 'Password' : 'New password'} htmlFor="f-password" required={creating} error={fieldError('password')}
            hint="At least 8 characters with letters and numbers" className="sm:col-span-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="f-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass} pr-10 font-mono`}
                  value={form.password} onChange={e => set('password', e.target.value)} maxLength={128} required={creating}
                  placeholder={creating ? '' : 'Keep current password'} />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button type="button" className={buttonSecondary} onClick={() => { set('password', generatePassword()); setShowPassword(true); }} title="Generate a strong password">
                <Wand2 size={16} /><span className="hidden sm:inline">Generate</span>
              </button>
            </div>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input type="checkbox" checked={form.mustChangePassword} onChange={e => set('mustChangePassword', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-700" />
            Must change password at next sign-in
          </label>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:col-span-2">Profile</legend>
          <Field label="Phone number" htmlFor="f-phone" error={fieldError('phoneNumber')}>
            <input id="f-phone" type="tel" className={inputClass} value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} maxLength={32} />
          </Field>
          <Field label="Job title" htmlFor="f-job" error={fieldError('jobTitle')}>
            <input id="f-job" className={inputClass} value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} maxLength={80} />
          </Field>
          <Field label="Department" htmlFor="f-dept" error={fieldError('department')} className="sm:col-span-2">
            <input id="f-dept" className={inputClass} value={form.department} onChange={e => set('department', e.target.value)} maxLength={80} />
          </Field>
          <Field label="Notes" htmlFor="f-notes" error={fieldError('notes')} className="sm:col-span-2">
            <textarea id="f-notes" rows={3} className={`${inputClass} h-auto py-2`} value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={500} />
          </Field>
        </fieldset>

        {error && !error.field && <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5" />{error.text}</p>}
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ view & delete */

function UserDetailDialog({ user, isMe, onClose, onEdit, onDelete, onUnlock }: {
  user: AuthUser; isMe: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void; onUnlock: () => void;
}) {
  const rows: [string, React.ReactNode][] = [
    ['Username', user.username],
    ['Email', user.email],
    ['Role', <RoleBadge key="r" role={user.role} />],
    ['Status', <StatusBadge key="s" user={user} />],
    ['Phone number', user.phoneNumber || '—'],
    ['Job title', user.jobTitle || '—'],
    ['Department', user.department || '—'],
    ['Notes', user.notes || '—'],
    ['Must change password', user.mustChangePassword ? 'Yes' : 'No'],
    ['Last sign-in', user.lastLoginAt ? `${formatDateTime(user.lastLoginAt)}${user.lastLoginIp ? ` · ${user.lastLoginIp}` : ''}` : 'Never'],
    ['Failed sign-in attempts', formatNumber(user.failedLoginAttempts)],
    ['Locked until', user.isLocked && user.lockedUntil ? formatDateTime(user.lockedUntil) : '—'],
    ['Password changed', user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : '—'],
    ['Created', `${user.createdAt ? formatDateTime(user.createdAt) : '—'}${user.createdBy ? ` by ${user.createdBy}` : ''}`],
    ['Updated', `${user.updatedAt ? formatDateTime(user.updatedAt) : '—'}${user.updatedBy ? ` by ${user.updatedBy}` : ''}`],
  ];
  return (
    <Dialog open onClose={onClose} size="md" title={user.fullName} description={isMe ? 'This is your account' : undefined}
      footer={
        <>
          {user.isLocked && <button type="button" className={buttonSecondary} onClick={onUnlock}><Unlock size={16} /> Unlock</button>}
          <button type="button" className={buttonSecondary} onClick={onDelete} disabled={isMe}><Trash2 size={16} /> Delete</button>
          <button type="button" className={buttonPrimary} onClick={onEdit}><Pencil size={16} /> Edit</button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <UserAvatar name={user.fullName} src={user.avatarUrl} size="xl" />
        <div>
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-3 py-2 text-sm">
            <dt className="text-slate-500">{k}</dt>
            <dd className="min-w-0 break-words text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

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
    <Dialog open onClose={onClose} size="sm" title="Delete user?"
      description="The account is removed permanently and the user is signed out everywhere."
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={buttonDanger} onClick={remove} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
          </button>
        </>
      }
    >
      <div className="flex items-center gap-3 rounded-lg bg-red-50 px-3 py-3">
        <KeyRound size={18} className="text-red-600" />
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-slate-600">{user.username} · {user.email}</p>
        </div>
      </div>
    </Dialog>
  );
}

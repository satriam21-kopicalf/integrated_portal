'use client';

// The signed-in user's own drawers: "My profile" (identity + photo) and
// "Change password", opened from the sidebar menu or the profile nudge.
// Mounted once in providers.tsx. Also shows the forced password change, the
// welcome after signing in and, until the profile is complete, a small
// reminder to fill it in.

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CircleUserRound, Info, KeyRound, Link2, Loader2, ShieldCheck, UserRoundPen, X } from 'lucide-react';
import ChangePasswordDrawer from '@/components/ChangePasswordDrawer';
import ProfileFields, { PROFILE_KEYS, ProfileValues, profileValues, REQUIRED_PROFILE_KEYS, sameProfile } from '@/components/ProfileFields';
import { AvatarEditor } from '@/components/UserAvatar';
import { Pill } from '@/components/kc';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { buttonPrimary, buttonSecondary } from '@/components/ui/Dialog';
import { AuthUser, ROLE_LABELS, useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { tr, serverMsg } from '@/lib/i18n';

interface AccountDrawers {
  openProfile: () => void;
  openPassword: () => void;
}

const Context = createContext<AccountDrawers>({ openProfile: () => {}, openPassword: () => {} });

export function useAccountDrawers(): AccountDrawers {
  return useContext(Context);
}

export function AccountDrawersProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState<'profile' | 'password' | null>(null);
  const openProfile = useCallback(() => setOpen('profile'), []);
  const openPassword = useCallback(() => setOpen('password'), []);
  const value = useMemo(() => ({ openProfile, openPassword }), [openProfile, openPassword]);
  const close = useCallback(() => setOpen(null), []);
  return (
    <Context.Provider value={value}>
      {children}
      {user && (
        <>
          {/* keyed by user so the form starts from the saved values each time it opens */}
          {open === 'profile' && <MyProfileDrawer key={user.id} onClose={close} onChangePassword={openPassword} />}
          <ChangePasswordDrawer open={open === 'password'} onClose={close} />
          {user.mustChangePassword
            ? <ChangePasswordDrawer open forced onClose={() => {}} />
            : (
              <>
                {/* the greeting and mood pop-up after sign-in was removed (2026-11-16, asked by the user) */}
                {!user.profileComplete && open === null && <ProfileNudge user={user} onOpen={openProfile} />}
              </>
            )}
        </>
      )}
    </Context.Provider>
  );
}

/* ------------------------------------------------------------------ My profile */

function MyProfileDrawer({ onClose, onChangePassword }: { onClose: () => void; onChangePassword: () => void }) {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState<ProfileValues>(() => profileValues(user));
  const [form, setForm] = useState<ProfileValues>(saved);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ text: string; field?: string | null } | null>(null);
  if (!user) return null;

  const dirty = !sameProfile(form, saved);
  const filled = REQUIRED_PROFILE_KEYS.filter(k => form[k].trim()).length;
  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setDone(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError({ text: tr('Full name is required'), field: 'fullName' });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const k of PROFILE_KEYS) body[k] = form[k].trim();
      const res = await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(serverMsg(data.error) || tr('Could not save the profile')), { field: data.field });
      const next = profileValues(data.user as AuthUser);
      setSaved(next);
      setForm(next);
      setDone(true);
      setUser(data.user);
    } catch (err) {
      setError({ text: (err as Error).message, field: (err as { field?: string }).field });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name: string) => (error?.field === name ? error.text : null);
  const role = ROLE_LABELS[user.role] ?? user.role;

  return (
    <Drawer open onClose={onClose} size="lg" icon={<UserRoundPen size={18} />} title={tr('My profile')}
      description={tr('Your identity on the portal. Fields marked * complete your profile.')}
      footer={
        <>
          {done && !dirty && <span className="mr-auto flex items-center gap-1.5 text-sm font-medium text-[color:var(--j-216E4E)]"><Check size={16} /> {tr('Profile saved')}</span>}
          <button type="button" className={buttonSecondary} onClick={onClose}>{done && !dirty ? tr('Close') : tr('Cancel')}</button>
          <button type="submit" form="my-profile" className={buttonPrimary} disabled={saving || !dirty}>
            {saving && <Loader2 size={16} className="animate-spin" />} {tr('Save profile')}
          </button>
        </>
      }
    >
      <form id="my-profile" onSubmit={submit} className="space-y-0" noValidate>
        {/* identity (2026-11-16, the kopicalf-hrms profile card): one photo with the name, title, role, HRMS and how
            complete the profile is; the photo buttons under the name */}
        <div className="-mx-5 -mt-5 mb-6 border-b border-[color:var(--j-DCDFE4)] sm:-mx-6">
          <div className="h-14 bg-[color:var(--j-0C66E4)]" aria-hidden />
          <div className="px-5 pb-5 pt-4 sm:px-6">
            <AvatarEditor name={form.fullName || user.username} src={user.avatarUrl} endpoint="/api/auth/me/avatar" onSaved={setUser}>
              <div>
                <p className="truncate text-lg font-bold tracking-tight text-[color:var(--j-172B4D)]">{form.fullName || user.displayName}</p>
                <p className="truncate text-[13px] text-[color:var(--j-626F86)]">{[form.jobTitle, form.department].filter(Boolean).join(' · ') || tr('Job title not filled in yet')}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Pill tone={user.role === 'superadmin' ? 'red' : 'brand'} icon={user.role === 'superadmin' ? <ShieldCheck size={11} /> : undefined}>{role}</Pill>
                  {user.hrmsEmployeeId && <Pill tone="green" icon={<Link2 size={11} />}>{tr('Linked to HRMS')}</Pill>}
                  {user.accountKind === 'shared' && <Pill tone="gray">{tr('Shared account')}</Pill>}
                  {user.accountKind === 'test' && <Pill tone="amber">{tr('Test account')}</Pill>}
                  <Pill tone={filled === REQUIRED_PROFILE_KEYS.length ? 'green' : 'amber'}>{tr('Profile')} {filled}/{REQUIRED_PROFILE_KEYS.length}</Pill>
                </div>
              </div>
            </AvatarEditor>
            {user.hrmsEmployeeId && (
              <p className="mt-3 flex items-start gap-2 rounded-[4px] border-l-[3px] border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] px-3 py-2 text-xs text-[color:var(--j-44546F)]">
                <Info size={14} className="mt-px flex-shrink-0 text-[color:var(--j-0C66E4)]" />
                {tr('Name, job title, department and the other HRMS details follow HRMS and are updated every hour; ask HR to change them.')}
              </p>
            )}
          </div>
        </div>

        {!user.profileComplete && (
          <div className="mt-6 rounded-[3px] border border-[color:var(--j-F8E6A0)] bg-[color:var(--j-FFF7D6)]/70 px-3.5 py-3 text-sm text-[color:var(--j-7F5F01)]">
            <p className="font-medium">{tr('Complete your profile')}</p>
            <p className="mt-0.5 text-[color:var(--j-7F5F01)]/90">{tr('Your administrator only set up your sign-in. Please add your own details below.')}</p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--j-F8E6A0)]">
                <div className="h-full rounded-full bg-[color:var(--j-E2B203)] transition-[width]" style={{ width: `${(filled / REQUIRED_PROFILE_KEYS.length) * 100}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums">{filled} {tr('of')} {REQUIRED_PROFILE_KEYS.length} {tr('required')}</span>
            </div>
          </div>
        )}

        {error && !PROFILE_KEYS.includes(error.field as keyof ProfileValues) && (
          <p className="mt-6 flex items-start gap-2 rounded-[3px] bg-[color:var(--j-FFECEB)] px-3 py-2 text-sm text-[color:var(--j-AE2E24)]" role="alert"><AlertCircle size={16} className="mt-0.5" />{error.text}</p>
        )}

        <ProfileFields values={form} onChange={set} fieldError={fieldError} idPrefix="me" currentBranchName={user.workBranchName} locked={user.hrmsLocked ?? []} />

        <DrawerSection title={tr('Sign-in & Access')} description={tr('Managed by an administrator.')}>
          <dl className="divide-y divide-[color:var(--j-F1F2F4)] border-y border-[color:var(--j-F1F2F4)] text-sm">
            {([
              [tr('Username'), user.username],
              [tr('Email'), user.email],
              [tr('Role'), <span key="r" className="inline-flex items-center gap-1">{user.role === 'superadmin' && <ShieldCheck size={13} className="text-[color:var(--j-C9372C)]" />}{role}</span>],
              [tr('Password changed'), user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : '—'],
            ] as [string, ReactNode][]).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{k}</dt>
                <dd className="min-w-0 break-words text-[color:var(--j-172B4D)]">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className={buttonSecondary} onClick={onChangePassword}><KeyRound size={16} /> {tr('Change Password')}</button>
        </DrawerSection>
      </form>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ reminder */

const NUDGE_KEY = 'portal.profileNudge.dismissed';

/** Bottom-corner reminder while the profile is incomplete (hidden for the session once dismissed). */
function ProfileNudge({ user, onOpen }: { user: AuthUser; onOpen: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(NUDGE_KEY) === user.id;
    } catch {
      /* storage unavailable: show it */
    }
    setVisible(!dismissed);
  }, [user.id]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(NUDGE_KEY, user.id);
    } catch {
      /* not remembered */
    }
  };

  if (!visible) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] sm:left-auto sm:w-[360px]" role="status" data-bottom-notice>
      <div className="drawer-backdrop rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[3px] bg-[color:var(--j-FFF7D6)] text-[color:var(--j-B38600)]"><CircleUserRound size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{tr('Complete your profile')}</p>
            <p className="mt-0.5 text-sm text-[color:var(--j-626F86)]">{tr('Add your full name, phone number, job title and department.')}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`${buttonPrimary} h-9 px-3`} onClick={onOpen}>{tr('Complete Profile')}</button>
              <button type="button" className={`${buttonSecondary} h-9 px-3`} onClick={dismiss}>{tr('Later')}</button>
            </div>
          </div>
          <button type="button" onClick={dismiss} className="rounded-[3px] p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]" aria-label={tr('Dismiss')}><X size={16} /></button>
        </div>
      </div>
    </div>
  );
}

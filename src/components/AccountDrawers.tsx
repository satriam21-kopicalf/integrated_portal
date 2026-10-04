'use client';

// The signed-in user's own drawers: "My profile" (identity + photo) and
// "Change password", opened from the sidebar menu or the profile nudge.
// Mounted once in providers.tsx. Also shows the forced password change and,
// until the profile is complete, a small reminder to fill it in.

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CircleUserRound, KeyRound, Loader2, ShieldCheck, UserRoundPen, X } from 'lucide-react';
import ChangePasswordDrawer from '@/components/ChangePasswordDrawer';
import ProfileFields, { PROFILE_KEYS, ProfileValues, profileValues, REQUIRED_PROFILE_KEYS, sameProfile } from '@/components/ProfileFields';
import { AvatarEditor } from '@/components/UserAvatar';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { buttonPrimary, buttonSecondary } from '@/components/ui/Dialog';
import { AuthUser, ROLE_LABELS, useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';

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
            : !user.profileComplete && open === null && <ProfileNudge user={user} onOpen={openProfile} />}
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
      setError({ text: 'Full name is required', field: 'fullName' });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      for (const k of PROFILE_KEYS) body[k] = form[k].trim();
      const res = await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || 'Gagal menyimpan profil'), { field: data.field });
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
    <Drawer open onClose={onClose} size="lg" icon={<UserRoundPen size={18} />} title="My profile"
      description="Your identity on the portal. Fields marked * complete your profile."
      footer={
        <>
          {done && !dirty && <span className="mr-auto flex items-center gap-1.5 text-sm font-medium text-emerald-700"><Check size={16} /> Profile saved</span>}
          <button type="button" className={buttonSecondary} onClick={onClose}>{done && !dirty ? 'Close' : 'Cancel'}</button>
          <button type="submit" form="my-profile" className={buttonPrimary} disabled={saving || !dirty}>
            {saving && <Loader2 size={16} className="animate-spin" />} Save profile
          </button>
        </>
      }
    >
      <form id="my-profile" onSubmit={submit} className="space-y-0" noValidate>
        <DrawerSection title="Profile photo" description="Shown in the sidebar and in User Accounts. Saved right away.">
          <AvatarEditor name={form.fullName || user.username} src={user.avatarUrl} endpoint="/api/auth/me/avatar" onSaved={setUser} />
        </DrawerSection>

        {!user.profileComplete && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-sm text-amber-900">
            <p className="font-medium">Complete your profile</p>
            <p className="mt-0.5 text-amber-800/90">Your administrator only set up your sign-in. Please add your own details below.</p>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-100">
                <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${(filled / REQUIRED_PROFILE_KEYS.length) * 100}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums">{filled} of {REQUIRED_PROFILE_KEYS.length} required</span>
            </div>
          </div>
        )}

        {error && !PROFILE_KEYS.includes(error.field as keyof ProfileValues) && (
          <p className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5" />{error.text}</p>
        )}

        <ProfileFields values={form} onChange={set} fieldError={fieldError} idPrefix="me" currentBranchName={user.workBranchName} />

        <DrawerSection title="Sign-in & access" description="Managed by an administrator.">
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100 text-sm">
            {([
              ['Username', user.username],
              ['Email', user.email],
              ['Role', <span key="r" className="inline-flex items-center gap-1">{user.role === 'superadmin' && <ShieldCheck size={13} className="text-red-600" />}{role}</span>],
              ['Password changed', user.passwordChangedAt ? formatDateTime(user.passwordChangedAt) : '—'],
            ] as [string, ReactNode][]).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 px-3 py-2">
                <dt className="text-slate-500">{k}</dt>
                <dd className="min-w-0 break-words text-slate-800">{v}</dd>
              </div>
            ))}
          </dl>
          <button type="button" className={buttonSecondary} onClick={onChangePassword}><KeyRound size={16} /> Change password</button>
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
    <div className="fixed inset-x-4 bottom-4 z-[70] sm:left-auto sm:w-[360px]" role="status">
      <div className="drawer-backdrop rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><CircleUserRound size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Complete your profile</p>
            <p className="mt-0.5 text-sm text-slate-500">Add your full name, phone number, job title and department.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`${buttonPrimary} h-9 px-3`} onClick={onOpen}>Complete profile</button>
              <button type="button" className={`${buttonSecondary} h-9 px-3`} onClick={dismiss}>Later</button>
            </div>
          </div>
          <button type="button" onClick={dismiss} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss"><X size={16} /></button>
        </div>
      </div>
    </div>
  );
}

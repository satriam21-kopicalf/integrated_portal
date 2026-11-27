'use client';

// Change your own password (2026-11-16, the kopicalf-hrms look): who you are and when the password last changed, a
// show / hide switch on every field, a strength bar, the rules ticked as you type (also: not the current one), the
// confirmation marked as it matches, and a note that the other devices are signed out. The request is unchanged.

import { FormEvent, useState } from 'react';
import { Check, CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2, X } from 'lucide-react';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { buttonPrimary, buttonSecondary, Field, inputClass } from '@/components/ui/Dialog';
import UserAvatar from '@/components/UserAvatar';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { tr, serverMsg } from '@/lib/i18n';

const RULES: { label: string; test: (pw: string, current: string) => boolean }[] = [
  { get label() { return tr('At Least 8 Characters'); }, test: pw => pw.length >= 8 },
  { get label() { return tr('Letters and Numbers'); }, test: pw => /[A-Za-z]/.test(pw) && /\d/.test(pw) },
  { get label() { return tr('Different from the current password'); }, test: (pw, cur) => !!pw && pw !== cur },
];

/** 0-4: length 8, letters + numbers, upper and lower case, a symbol or 12+ characters. */
function strength(pw: string): number {
  if (!pw) return 0;
  return [pw.length >= 8, /[A-Za-z]/.test(pw) && /\d/.test(pw), /[a-z]/.test(pw) && /[A-Z]/.test(pw), /[^A-Za-z0-9]/.test(pw) || pw.length >= 12]
    .filter(Boolean).length;
}
const LEVELS = [
  { get label() { return tr('Too weak'); }, bar: 'bg-red-500', text: 'text-red-600' },
  { get label() { return tr('Weak'); }, bar: 'bg-red-500', text: 'text-red-600' },
  { get label() { return tr('Fair'); }, bar: 'bg-amber-500', text: 'text-amber-600' },
  { get label() { return tr('Good'); }, bar: 'bg-emerald-500', text: 'text-emerald-600' },
  { get label() { return tr('Strong'); }, bar: 'bg-emerald-600', text: 'text-emerald-700' },
];

function PasswordInput({ id, value, onChange, autoComplete, invalid }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)}
        className={`${inputClass} pr-10 ${invalid ? 'border-red-300 bg-red-50/40' : ''}`} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]"
        aria-label={show ? tr('Hide password') : tr('Show password')} aria-pressed={show}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/** Change your own password; `forced` when the account must change it before continuing. */
export default function ChangePasswordDrawer({ open, onClose, forced = false }: { open: boolean; onClose: () => void; forced?: boolean }) {
  const { user, setUser, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setDone(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const rulesOk = RULES.every(r => r.test(next, current));
  const matches = !!confirm && next === confirm;
  const level = LEVELS[strength(next)];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError(tr('The password confirmation does not match'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(serverMsg(body.error) || tr('Could not change the password'));
      setDone(true);
      setUser(body.user);
      setTimeout(close, 900);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      locked={forced}
      size="sm"
      icon={<KeyRound size={18} />}
      title={forced ? tr('Set a new password') : tr('Change Password')}
      description={forced ? tr('Your account requires a new password before you continue.') : tr('Keep your account safe with a password only you know.')}
      footer={
        <>
          {forced
            ? <button type="button" className={buttonSecondary} onClick={() => logout()}>{tr('Sign Out')}</button>
            : <button type="button" className={buttonSecondary} onClick={close}>{tr('Cancel')}</button>}
          <button type="submit" form="change-password" className={buttonPrimary} disabled={saving || !current || !rulesOk || !matches}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null}
            {done ? tr('Saved') : tr('Save password')}
          </button>
        </>
      }
    >
      <form id="change-password" onSubmit={submit}>
        {user && (
          <div className="-mx-5 -mt-5 mb-5 flex items-center gap-3 border-b border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-5 py-3 sm:-mx-6 sm:px-6">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{user.displayName}</p>
              <p className="truncate text-xs text-[color:var(--j-626F86)]">
                @{user.username} · {user.passwordChangedAt ? tr('Password changed {0}', formatDateTime(user.passwordChangedAt)) : tr('Password not changed yet')}
              </p>
            </div>
          </div>
        )}

        <DrawerSection title={tr('Current Password')}>
          <Field label={tr('Current Password')} htmlFor="pw-current" required>
            <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={setCurrent} />
          </Field>
        </DrawerSection>

        <DrawerSection title={tr('New Password')}>
          <Field label={tr('New Password')} htmlFor="pw-new" required>
            <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={setNext} />
          </Field>
          {next && (
            <div aria-live="polite">
              <div className="flex gap-1" aria-hidden>
                {[1, 2, 3, 4].map(i => <span key={i} className={`h-1.5 flex-1 rounded-full ${strength(next) >= i ? level.bar : 'bg-[color:var(--j-DCDFE4)]'}`} />)}
              </div>
              <p className={`mt-1 text-xs font-medium ${level.text}`}>{tr('Strength: {0}', level.label)}</p>
            </div>
          )}
          <ul className="space-y-1.5 rounded-[4px] border-l-[3px] border-[color:var(--j-8590A2)] bg-[color:var(--j-F7F8F9)] px-3.5 py-3 text-xs">
            {RULES.map(r => {
              const ok = r.test(next, current);
              return (
                <li key={r.label} className={`flex items-center gap-2 ${ok ? 'text-emerald-700' : 'text-[color:var(--j-626F86)]'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full ${ok ? 'bg-emerald-100' : 'bg-[color:var(--j-DCDFE4)]'}`}>
                    {ok ? <Check size={11} strokeWidth={3} /> : <X size={10} strokeWidth={3} className="text-[color:var(--j-626F86)]" />}
                  </span>
                  {r.label}
                </li>
              );
            })}
          </ul>
          <Field label={tr('Confirm New Password')} htmlFor="pw-confirm" required error={confirm && !matches ? tr('Does not match') : null}>
            <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} invalid={!!confirm && !matches} />
          </Field>
          {matches && <p className="-mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} /> {tr('Passwords match')}</p>}
        </DrawerSection>

        {!forced && (
          <p className="mt-5 flex items-start gap-2 rounded-[4px] border-l-[3px] border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] px-3.5 py-3 text-xs text-[color:var(--j-0055CC)]">
            <Info size={14} className="mt-px flex-shrink-0" /> {tr('After saving, every other device signed in to your account is signed out. This device stays signed in.')}
          </p>
        )}
        {error && <p className="mt-4 rounded-[4px] border-l-[3px] border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      </form>
    </Drawer>
  );
}

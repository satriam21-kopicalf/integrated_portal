'use client';

import { FormEvent, useState } from 'react';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import Dialog, { buttonPrimary, buttonSecondary, Field, inputClass } from '@/components/ui/Dialog';
import { useAuth } from '@/lib/auth';

const RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { label: 'Letters and numbers', test: pw => /[A-Za-z]/.test(pw) && /\d/.test(pw) },
];

/** Change your own password; `forced` when the account must change it before continuing. */
export default function ChangePasswordDialog({ open, onClose, forced = false }: { open: boolean; onClose: () => void; forced?: boolean }) {
  const { setUser, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setCurrent(''); setNext(''); setConfirm(''); setError(null); setDone(false); setShow(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError('Konfirmasi password tidak sama');
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
      if (!res.ok) throw new Error(body.error || 'Gagal mengubah password');
      setDone(true);
      setUser(body.user);
      setTimeout(close, 900);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Dialog
      open={open}
      onClose={close}
      locked={forced}
      size="sm"
      title={forced ? 'Set a new password' : 'Change password'}
      description={forced ? 'Your account requires a new password before you continue.' : 'Other devices will be signed out.'}
      footer={
        <>
          {forced
            ? <button type="button" className={buttonSecondary} onClick={() => logout()}>Sign out</button>
            : <button type="button" className={buttonSecondary} onClick={close}>Cancel</button>}
          <button type="submit" form="change-password" className={buttonPrimary} disabled={saving || !current || !next || !confirm}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : done ? <Check size={16} /> : null}
            {done ? 'Saved' : 'Save password'}
          </button>
        </>
      }
    >
      <form id="change-password" onSubmit={submit} className="space-y-3">
        <Field label="Current password" htmlFor="pw-current" required>
          <input id="pw-current" type={type} autoComplete="current-password" className={inputClass} value={current} onChange={e => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="pw-new" required>
          <div className="relative">
            <input id="pw-new" type={type} autoComplete="new-password" className={`${inputClass} pr-10`} value={next} onChange={e => setNext(e.target.value)} />
            <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label={show ? 'Hide passwords' : 'Show passwords'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <ul className="space-y-0.5 text-xs">
          {RULES.map(r => (
            <li key={r.label} className={`flex items-center gap-1.5 ${r.test(next) ? 'text-emerald-600' : 'text-slate-400'}`}>
              <Check size={12} /> {r.label}
            </li>
          ))}
        </ul>
        <Field label="Confirm new password" htmlFor="pw-confirm" required error={confirm && next !== confirm ? 'Does not match' : null}>
          <input id="pw-confirm" type={type} autoComplete="new-password" className={inputClass} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
}

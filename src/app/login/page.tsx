'use client';

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Clock, Eye, EyeOff, Info, Loader2, Lock, User } from 'lucide-react';
import { BRAND_LINE } from '@/components/BrandWatermark';
import { assetUrl } from '@/lib/assets';
import { DAY_PART_ICONS } from '@/components/WelcomeNotice';
import { PreferenceSwitches } from '@/components/ui/Preferences';
import { OPERATIONS_URL, safeNext, useAuth } from '@/lib/auth';
import { Farewell, markSignedIn, takeFarewell } from '@/lib/greetings';
import { tr, serverMsg } from '@/lib/i18n';

const NOTICES: Record<string, string> = {
  get expired() { return tr('Your session has ended. Please sign in again.'); },
  get 'signed-out'() { return tr('You have been signed out.'); },
  get operations() { return tr('Your account uses the Operations app: sign in at operations.kopicalf.co.id.'); },
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type FieldErrors = { identifier?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const { status, setUser } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  // a form account (PIC, Area Supervisor …): it signs in to Operations instead
  const [operations, setOperations] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [farewell, setFarewell] = useState<Farewell | null>(null);
  const [next, setNext] = useState('/overview');

  // query string is read on the client (the page is statically rendered)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get('next')));
    const reason = params.get('reason') ?? '';
    const bye = reason === 'signed-out' ? takeFarewell() : null;
    setFarewell(bye);
    setNotice(bye ? null : NOTICES[reason] ?? null);
    if (reason === 'operations') setOperations(OPERATIONS_URL);
  }, []);

  // already signed in: straight to the dashboard
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOperations(null);
    setNotice(null);
    setFarewell(null);
    const ident = identifier.trim();
    // usernames never contain "@", so one field serves both ways of signing in
    const method = ident.includes('@') ? 'email' : 'username';
    const problems: FieldErrors = {};
    if (!ident) problems.identifier = tr('Enter your username or email');
    else if (method === 'email' && !EMAIL_RE.test(ident)) problems.identifier = tr('Enter a valid email address');
    if (!password) problems.password = tr('Enter your password');
    setFields(problems);
    if (problems.identifier || problems.password) {
      document.getElementById(problems.identifier ? 'identifier' : 'password')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password, method, remember }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && body.redirect) setOperations(String(body.redirect).startsWith('https://') ? body.redirect : OPERATIONS_URL);
      if (!res.ok) throw new Error(serverMsg(body.error) || tr('Sign-in failed, please try again'));
      markSignedIn(); // the dashboard greets the user once
      setUser(body.user);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
      document.getElementById('password')?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const onPasswordKey = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.('CapsLock') ?? false);

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[color:var(--j-F7F8F9)] px-4" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      {/* 2026-11-28 the Jira look: a plain page, the Calf logo and the app name over one white card */}
      <PreferenceSwitches className="absolute right-4 top-4 sm:right-6 sm:top-6" />
      <div className="flex w-full flex-1 flex-col items-center justify-center py-12">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand logo from public/assets */}
          <img src={assetUrl('assets/calf-logo.png')} alt="Kopi Calf" className="h-12 w-auto object-contain" />
          <p className="mt-3 text-xl font-semibold tracking-tight text-[color:var(--j-172B4D)]">Portal</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--j-626F86)]">{BRAND_LINE}</p>
        </div>
        <div className="w-full max-w-[400px] rounded-[3px] bg-white px-6 py-8 shadow-[0_1px_1px_#091E4240,0_0_1px_#091E424F] dark:shadow-none dark:ring-1 dark:ring-[color:var(--j-DCDFE4)] sm:px-10">
          <div>
            <h1 className="text-center text-base font-semibold text-[color:var(--j-172B4D)]">{tr('Sign in')}</h1>
            <p className="mt-1 text-center text-sm text-[color:var(--j-626F86)]">{tr('Kopi Calf Integration Platform')}</p>

            <div className="mt-8 space-y-6">
              {farewell && <FarewellCard farewell={farewell} />}
              {notice && (
                <p className="flex items-start gap-2 rounded-[3px] bg-[color:var(--j-E9F2FF)] px-3 py-2.5 text-sm text-[color:var(--j-0055CC)]" role="status">
                  <Info size={16} className="mt-0.5 flex-shrink-0" /> {notice}
                </p>
              )}

              <form onSubmit={submit} className="space-y-5" noValidate>
                <Field id="identifier" label={tr('Username or Email')} error={fields.identifier}>
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
                  <input
                    id="identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); setFields(f => ({ ...f, identifier: undefined })); }}
                    aria-invalid={!!fields.identifier}
                    aria-describedby={fields.identifier ? 'identifier-error' : undefined}
                    className={inputClass(!!fields.identifier)}
                  />
                </Field>

                <Field id="password" label={tr('Password')} error={fields.password}
                  hint={capsLock && !fields.password ? tr('Caps Lock is on') : undefined}>
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setFields(f => ({ ...f, password: undefined })); }}
                    onKeyUp={onPasswordKey}
                    onKeyDown={onPasswordKey}
                    onBlur={() => setCapsLock(false)}
                    aria-invalid={!!fields.password}
                    aria-describedby={fields.password ? 'password-error' : capsLock ? 'password-hint' : undefined}
                    className={`${inputClass(!!fields.password)} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-[3px] p-1.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)]/40"
                    aria-label={showPassword ? tr('Hide password') : tr('Show password')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-[color:var(--j-44546F)]">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-[color:var(--j-8590A2)] text-[color:var(--j-0C66E4)] focus:ring-[color:var(--j-388BFF)]" />
                    {tr('Keep me signed in')}
                  </label>
                  <button type="button" onClick={() => setShowForgot(s => !s)} aria-expanded={showForgot}
                    className="rounded font-medium text-[color:var(--j-0C66E4)] hover:text-[color:var(--j-0055CC)] dark:hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)]/40">
                    {tr('Forgot password?')}
                  </button>
                </div>
                {showForgot && (
                  <p className="-mt-2 rounded-[3px] bg-[color:var(--j-F7F8F9)] px-3 py-2 text-xs text-[color:var(--j-44546F)]" role="status">
                    {tr('Ask your administrator to reset it.')}
                  </p>
                )}

                {error && (
                  <p className="flex items-start gap-2 rounded-[3px] bg-[color:var(--j-FFECEB)] px-3 py-2.5 text-sm text-[color:var(--j-AE2E24)]" role="alert">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
                  </p>
                )}
                {operations && (
                  <a href={operations} className="flex h-11 w-full items-center justify-center gap-2 rounded-[3px] border border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] text-sm font-semibold text-[color:var(--j-0055CC)] hover:bg-[color:var(--j-CCE0FF)]">
                    {tr('Open Operations')} <ArrowRight size={16} />
                  </a>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-[3px] bg-[color:var(--j-0C66E4)] lg:h-10 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--j-0055CC)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--j-388BFF)]/25 disabled:cursor-wait disabled:opacity-80"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? tr('Signing in…') : tr('Sign in')}
                  {!submitting && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <footer className="pb-6 text-center text-xs text-[color:var(--j-626F86)]" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        © {new Date().getFullYear()} {tr('Kopi Calf · PT Yuda Prawira Group')}
      </footer>
    </main>
  );
}

function inputClass(invalid: boolean) {
  return (
    'h-12 w-full rounded-[3px] border-2 bg-white pl-10 pr-3 text-base text-[color:var(--j-172B4D)] lg:h-10 lg:text-sm placeholder:text-[color:var(--j-626F86)] transition-colors ' +
    'focus:outline-none focus:ring-4 ' +
    (invalid
      ? 'border-[color:var(--j-F87168)] focus:border-[color:var(--j-C9372C)] focus:ring-[color:var(--j-C9372C)]/10'
      : 'border-[color:var(--j-DCDFE4)] hover:border-[color:var(--j-8590A2)] focus:border-[color:var(--j-0C66E4)] focus:ring-[color:var(--j-388BFF)]/10')
  );
}

function Field({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-[color:var(--j-44546F)]">{label}</label>
      <div className="relative">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-[color:var(--j-C9372C)]">{error}</p>}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-[color:var(--j-7F5F01)]">{hint}</p>}
    </div>
  );
}

/** Shown after signing out: a goodbye that fits the time of day (and today's mood). */
function FarewellCard({ farewell }: { farewell: Farewell }) {
  const Icon = DAY_PART_ICONS[farewell.part] ?? Info;
  return (
    <div className="notice-in flex items-start gap-3 rounded-[3px] bg-[color:var(--j-E9F2FF)] px-4 py-3.5" role="status">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--j-0C66E4)] text-white">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{farewell.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[color:var(--j-44546F)]">{farewell.message}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-[color:var(--j-626F86)]">
          <Clock size={12} /> {tr('Signed Out')}{farewell.duration ? tr(' · session {0}', farewell.duration) : ''}
        </p>
      </div>
    </div>
  );
}

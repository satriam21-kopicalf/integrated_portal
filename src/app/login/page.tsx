'use client';

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Clock, Eye, EyeOff, Info, Loader2, Lock, TrendingUp, User } from 'lucide-react';
import { DAY_PART_ICONS } from '@/components/WelcomeNotice';
import { PreferenceSwitches } from '@/components/ui/Preferences';
import { safeNext, useAuth } from '@/lib/auth';
import { Farewell, markSignedIn, takeFarewell } from '@/lib/greetings';
import { tr, serverMsg } from '@/lib/i18n';

const NOTICES: Record<string, string> = {
  get expired() { return tr('Your session has ended. Please sign in again.'); },
  get 'signed-out'() { return tr('You have been signed out.'); },
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
  }, []);

  // already signed in: straight to the dashboard
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
    <main className="flex min-h-dvh bg-white">
      <BrandPanel />

      <div className="relative flex min-h-dvh flex-1 flex-col">
        <PreferenceSwitches className="absolute right-4 top-4 sm:right-6 sm:top-6" />
        <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
          <div className="w-full max-w-[380px]">
            {/* phones and tablets: the logo sits above the form (the brand panel is hidden) */}
            <Image src="/assets/calf-logo.png" alt={tr('Kopi Calf')} width={150} height={80} priority unoptimized
              className="mb-10 h-16 w-auto object-contain lg:hidden" />

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{tr('Sign in')}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{tr('Kopi Calf Integration Platform')}</p>

            <div className="mt-8 space-y-6">
              {farewell && <FarewellCard farewell={farewell} />}
              {notice && (
                <p className="flex items-start gap-2 rounded-lg bg-[#eef0fb] dark:bg-[#161c52] px-3 py-2.5 text-sm text-[#080e63]" role="status">
                  <Info size={16} className="mt-0.5 flex-shrink-0" /> {notice}
                </p>
              )}

              <form onSubmit={submit} className="space-y-5" noValidate>
                <Field id="identifier" label={tr('Username or email')} error={fields.identifier}>
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1385]/40"
                    aria-label={showPassword ? tr('Hide password') : tr('Show password')}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </Field>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-slate-600">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0b1385] dark:text-[#a5abf0] focus:ring-[#0b1385]" />
                    {tr('Keep me signed in')}
                  </label>
                  <button type="button" onClick={() => setShowForgot(s => !s)} aria-expanded={showForgot}
                    className="rounded font-medium text-[#0b1385] dark:text-[#a5abf0] hover:text-[#080e63] dark:hover:text-white hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0b1385]/40">
                    {tr('Forgot password?')}
                  </button>
                </div>
                {showForgot && (
                  <p className="-mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" role="status">
                    {tr('Ask your administrator to reset it.')}
                  </p>
                )}

                {error && (
                  <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0b1385] text-sm font-semibold text-white shadow-sm shadow-[#0b1385]/20 transition-colors hover:bg-[#080e63] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#0b1385]/25 disabled:cursor-wait disabled:bg-[#0b1385]/80"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? tr('Signing in…') : tr('Sign in')}
                  {!submitting && <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>
            </div>
          </div>
        </div>

        <footer className="pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {tr('Kopi Calf · PT Yuda Prawira Group')}
        </footer>
      </div>
    </main>
  );
}

function inputClass(invalid: boolean) {
  return (
    'h-11 w-full rounded-lg border bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors ' +
    'focus:outline-none focus:ring-4 ' +
    (invalid
      ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
      : 'border-slate-200 hover:border-slate-300 focus:border-[#0b1385] focus:ring-[#0b1385]/10')
  );
}

function Field({ id, label, error, hint, children }: {
  id: string; label: string; error?: string; hint?: string; children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">{children}</div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-amber-700">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ brand panel */

/** Large screens: the brand side, one hue (Calf blue #0b1385) with white; decorative, no real figures. */
function BrandPanel() {
  return (
    <aside className="relative hidden w-[46%] max-w-[720px] flex-col overflow-hidden bg-[#0b1385] p-10 text-white lg:flex xl:p-14">
      <GridPattern />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-[#2b36b8]/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[26rem] w-[26rem] rounded-full bg-[#050a4a]/50 blur-3xl" aria-hidden />

      {/* the logo in white */}
      <Image src="/assets/calf-logo.png" alt={tr('Kopi Calf')} width={150} height={80} priority unoptimized
        className="relative h-14 w-auto self-start object-contain brightness-0 invert" />

      <div className="relative flex flex-1 items-center justify-center py-10">
        <DashboardIllustration />
      </div>
      {/* balances the logo so the illustration sits in the middle */}
      <div className="h-14" aria-hidden />
    </aside>
  );
}

function GridPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden>
      <defs>
        <pattern id="login-grid" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-grid)" />
    </svg>
  );
}

/** A white dashboard card drawn in Calf blue only: a trend, bars and a floating KPI chip. */
function DashboardIllustration() {
  const bars = [38, 56, 46, 70, 60, 84, 66];
  return (
    <div className="relative w-full max-w-[460px]" aria-hidden>
      <div className="rounded-2xl bg-white p-5 shadow-2xl shadow-[#050a4a]/30">
        <div className="flex items-center justify-between">
          <span className="space-y-1.5">
            <span className="block h-2 w-20 rounded-full bg-slate-200" />
            <span className="block h-3 w-32 rounded-full bg-[#0b1385]" />
          </span>
          <span className="flex gap-1.5">
            <span className="h-6 w-12 rounded-md bg-[#eef0fb] dark:bg-[#161c52]" /><span className="h-6 w-12 rounded-md bg-[#0b1385]" />
          </span>
        </div>
        <svg viewBox="0 0 300 110" className="mt-4 h-32 w-full">
          <defs>
            <linearGradient id="login-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#0b1385" stopOpacity=".18" /><stop offset="1" stopColor="#0b1385" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[26, 54, 82].map(y => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#e2e8f0" />)}
          <path d="M0,92 C30,84 45,66 75,70 S120,44 150,50 S200,28 225,34 S270,16 300,20 L300,110 L0,110 Z" fill="url(#login-area)" />
          <path d="M0,98 C35,94 50,84 80,86 S125,70 155,74 S205,58 230,62 S270,48 300,50" fill="none" stroke="#9ca3e6" strokeWidth="2" strokeDasharray="5 5" />
          <path d="M0,92 C30,84 45,66 75,70 S120,44 150,50 S200,28 225,34 S270,16 300,20" fill="none" stroke="#0b1385" strokeWidth="2.5" />
          <circle cx="225" cy="34" r="5" fill="#fff" stroke="#0b1385" strokeWidth="2.5" />
        </svg>
        <div className="mt-4 flex h-16 items-end gap-2">
          {bars.map((h, i) => (
            <span key={i} className={`flex-1 rounded-t ${i === 5 ? 'bg-[#0b1385]' : 'bg-[#dcdff5] dark:bg-[#232a6b]'}`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      {/* floating KPI chip */}
      <div className="absolute -left-6 -top-6 flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-xl shadow-[#050a4a]/25">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fb] dark:bg-[#161c52] text-[#0b1385] dark:text-[#a5abf0]"><TrendingUp size={16} /></span>
        <span className="space-y-1.5">
          <span className="block h-1.5 w-12 rounded-full bg-slate-200" />
          <span className="block h-2.5 w-16 rounded-full bg-[#0b1385]" />
        </span>
      </div>
    </div>
  );
}

/** Shown after signing out: a goodbye that fits the time of day (and today's mood). */
function FarewellCard({ farewell }: { farewell: Farewell }) {
  const Icon = DAY_PART_ICONS[farewell.part] ?? Info;
  return (
    <div className="notice-in flex items-start gap-3 rounded-xl bg-[#eef0fb] dark:bg-[#161c52] px-4 py-3.5" role="status">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#0b1385] text-white">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{farewell.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{farewell.message}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
          <Clock size={12} /> {tr('Signed out')}{farewell.duration ? tr(' · session {0}', farewell.duration) : ''}
        </p>
      </div>
    </div>
  );
}

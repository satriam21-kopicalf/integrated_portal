'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, AtSign, BarChart3, Clock, Eye, EyeOff, FileSpreadsheet, Info, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { DAY_PART_ICONS } from '@/components/WelcomeNotice';
import { safeNext, useAuth } from '@/lib/auth';
import { Farewell, markSignedIn, takeFarewell } from '@/lib/greetings';

type Method = 'username' | 'email';

const NOTICES: Record<string, string> = {
  expired: 'Your session has ended. Please sign in again.',
  'signed-out': 'You have been signed out.',
};

const inputClass =
  'h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'transition-colors hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/10';

export default function LoginPage() {
  const router = useRouter();
  const { status, setUser } = useAuth();
  const [method, setMethod] = useState<Method>('username');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const switchMethod = (m: Method) => {
    setMethod(m);
    setIdentifier('');
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setFarewell(null);
    if (method === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identifier.trim())) {
      setError('Masukkan alamat email yang valid');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password, method, remember }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Login gagal, coba lagi');
      markSignedIn(); // the dashboard greets the user once
      setUser(body.user);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  const IdentIcon = method === 'email' ? AtSign : User;

  return (
    <main className="flex min-h-dvh bg-white">
      <AnalyticsPanel />
      <div className="flex min-h-dvh flex-1 flex-col">
      {/* phones and tablets: a slim brand band instead of the panel */}
      <div className="relative h-28 overflow-hidden bg-[#0b1530] lg:hidden" aria-hidden>
        <GridPattern />
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-blue-600/40 blur-3xl" />
        <MiniChart className="absolute bottom-0 left-0 h-20 w-full" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center text-center">
            {/* served from the site itself (same origin): the first thing on screen, no external round trip */}
            <Image src="/assets/calf-logo.png" alt="Kopi Calf" width={170} height={90} priority unoptimized
              className="h-[90px] w-auto object-contain" />
            {/* logo only on screen; the heading stays for screen readers */}
            <h1 className="sr-only">Sign in to Kopi Calf Portal</h1>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:p-8">
            {farewell && <FarewellCard farewell={farewell} />}
            {notice && (
              <p className="mb-5 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 text-sm text-blue-800" role="status">
                <Info size={16} className="mt-0.5 flex-shrink-0" /> {notice}
              </p>
            )}

            <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1" role="tablist" aria-label="Sign in with">
              {(['username', 'email'] as Method[]).map(m => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => switchMethod(m)}
                  className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                    method === m ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m === 'username' ? <User size={15} /> : <AtSign size={15} />}
                  {m === 'username' ? 'Username' : 'Email'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
                  {method === 'email' ? 'Email address' : 'Username'}
                </label>
                <div className="relative">
                  <IdentIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="identifier"
                    key={method}
                    type={method === 'email' ? 'email' : 'text'}
                    inputMode={method === 'email' ? 'email' : 'text'}
                    autoComplete={method === 'email' ? 'email' : 'username'}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder={method === 'email' ? 'name@kopicalf.co.id' : 'your.username'}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`${inputClass} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600" />
                Keep me signed in for 30 days
              </label>

              {error && (
                <p className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2.5 text-sm text-red-700" role="alert">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !identifier.trim() || !password}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-slate-500">
            Forgot your password? <span className="font-medium text-slate-700">Contact your administrator.</span>
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={13} /> Secure sign-in · activity is logged
          </p>
        </div>
      </div>

      <footer className="pb-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Kopi Calf · PT Yuda Prawira Group
      </footer>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ brand panel */

/** Large screens: a data-analytics panel next to the form (illustration only: no real figures). */
function AnalyticsPanel() {
  return (
    <aside className="relative hidden w-[46%] max-w-[760px] flex-col justify-between overflow-hidden bg-[#0b1530] p-10 text-white lg:flex xl:p-14">
      <GridPattern />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 -top-24 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden />

      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
          Live data from every outlet
        </p>
        <h2 className="mt-6 max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          Sales, costs and operations — <span className="bg-gradient-to-r from-sky-300 to-indigo-300 bg-clip-text text-transparent">one view</span>.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-blue-100/80">
          Every outlet&apos;s transactions synced from ESB, turned into analytics the team can act on.
        </p>
      </div>

      <DashboardIllustration />

      <ul className="relative grid gap-3 text-sm text-blue-50/90 xl:grid-cols-3">
        {([
          [BarChart3, 'Sales analytics', 'Trends, channels, branches, hours'],
          [ShieldCheck, 'Cost control', 'COGS, usage and data quality'],
          [FileSpreadsheet, 'Exports', 'Excel and Google Sheets'],
        ] as const).map(([Icon, title, text]) => (
          <li key={title} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon size={16} className="text-sky-200" /></span>
            <span><span className="block font-medium text-white">{title}</span><span className="block text-xs text-blue-100/70">{text}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function GridPattern() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
      <defs>
        <pattern id="login-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="white" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-grid)" />
    </svg>
  );
}

/** A stylised dashboard: KPI tiles, a trend, bars and a donut. Decorative, no numbers. */
function DashboardIllustration() {
  return (
    <div className="relative my-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur-md" aria-hidden>
      <div className="mb-3 flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 h-2 w-24 rounded-full bg-white/15" />
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {['from-sky-400 to-blue-500', 'from-indigo-400 to-violet-500', 'from-emerald-400 to-teal-500', 'from-amber-300 to-orange-400'].map((g, i) => (
          <div key={g} className="rounded-xl bg-white/[0.07] p-2.5">
            <span className="block h-1.5 w-10 rounded-full bg-white/25" />
            <span className={`mt-2 block h-3 rounded-full bg-gradient-to-r ${g}`} style={{ width: `${62 + i * 9}%` }} />
            <svg viewBox="0 0 60 16" className="mt-2 h-4 w-full"><polyline fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="1.5"
              points={['0,12 10,10 20,11 30,7 40,8 50,4 60,5', '0,9 10,11 20,8 30,9 40,5 50,6 60,3', '0,13 10,12 20,9 30,10 40,7 50,7 60,4', '0,8 10,9 20,6 30,8 40,6 50,3 60,4'][i]} /></svg>
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-5 gap-2.5">
        <div className="col-span-3 rounded-xl bg-white/[0.07] p-3">
          <span className="block h-1.5 w-16 rounded-full bg-white/25" />
          <svg viewBox="0 0 300 110" className="mt-2 h-28 w-full">
            <defs>
              <linearGradient id="login-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity=".45" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient>
            </defs>
            {[22, 50, 78].map(y => <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="rgba(255,255,255,.08)" />)}
            <path d="M0,88 C30,80 45,62 75,66 S120,40 150,46 S200,24 225,30 S270,12 300,16 L300,110 L0,110 Z" fill="url(#login-area)" />
            <path d="M0,88 C30,80 45,62 75,66 S120,40 150,46 S200,24 225,30 S270,12 300,16" fill="none" stroke="#7dd3fc" strokeWidth="2.5" />
            <path d="M0,94 C35,90 50,80 80,82 S125,66 155,70 S205,54 230,58 S270,44 300,46" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2" strokeDasharray="5 5" />
            <circle cx="225" cy="30" r="4.5" fill="#0b1530" stroke="#7dd3fc" strokeWidth="2.5" />
          </svg>
        </div>
        <div className="col-span-2 flex flex-col gap-2.5">
          <div className="flex flex-1 items-center gap-3 rounded-xl bg-white/[0.07] p-3">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#818cf8" strokeWidth="5" strokeDasharray="44 88" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#38bdf8" strokeWidth="5" strokeDasharray="26 88" strokeDashoffset="-44" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#fbbf24" strokeWidth="5" strokeDasharray="12 88" strokeDashoffset="-70" />
            </svg>
            <span className="flex-1 space-y-1.5">
              <span className="block h-1.5 w-full rounded-full bg-white/20" /><span className="block h-1.5 w-3/4 rounded-full bg-white/15" /><span className="block h-1.5 w-1/2 rounded-full bg-white/10" />
            </span>
          </div>
          <div className="flex flex-1 items-end gap-1.5 rounded-xl bg-white/[0.07] p-3">
            {[40, 65, 50, 80, 58, 92, 70].map((h, i) => (
              <span key={i} className={`flex-1 rounded-t ${i === 5 ? 'bg-sky-300' : 'bg-white/25'}`} style={{ height: `${h * 0.42}px` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChart({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 80" preserveAspectRatio="none" className={className} aria-hidden>
      <defs><linearGradient id="login-mini" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity=".35" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient></defs>
      <path d="M0,62 C40,58 60,40 100,44 S160,26 200,32 S270,12 310,18 S370,6 400,8 L400,80 L0,80 Z" fill="url(#login-mini)" />
      <path d="M0,62 C40,58 60,40 100,44 S160,26 200,32 S270,12 310,18 S370,6 400,8" fill="none" stroke="#7dd3fc" strokeWidth="2" />
    </svg>
  );
}

/** Shown after signing out: a goodbye that fits the time of day (and today's mood). */
function FarewellCard({ farewell }: { farewell: Farewell }) {
  const Icon = DAY_PART_ICONS[farewell.part] ?? Info;
  return (
    <div className="notice-in mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white px-4 py-3.5" role="status">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{farewell.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{farewell.message}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          <Clock size={12} /> You have been signed out{farewell.duration ? ` · session ${farewell.duration}` : ''}
        </p>
      </div>
    </div>
  );
}

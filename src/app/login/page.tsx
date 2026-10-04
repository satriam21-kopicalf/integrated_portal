'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, AtSign, Eye, EyeOff, Info, Loader2, Lock, LogIn, User } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { safeNext, useAuth } from '@/lib/auth';

type Method = 'username' | 'email';

const NOTICES: Record<string, string> = {
  expired: 'Your session has ended. Please sign in again.',
  'signed-out': 'You have been signed out.',
};

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
  const [next, setNext] = useState('/overview');

  // query string is read on the client (the page is statically rendered)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(safeNext(params.get('next')));
    setNotice(NOTICES[params.get('reason') ?? ''] ?? null);
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
    <main className="flex min-h-dvh bg-slate-50">
      {/* Brand panel */}
      <section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-800 via-blue-700 to-blue-900 p-10 text-white lg:flex">
        <span className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/5" aria-hidden />
        <span className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/5" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 h-1 bg-red-500" aria-hidden />
        <div className="relative flex items-center gap-3">
          <span className="relative h-12 w-12 overflow-hidden rounded-xl bg-white">
            <Image src={assetUrl('assets/calf-logo.png')} alt="Kopi Calf" fill sizes="48px" className="object-contain p-1" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-wide">PORTAL</p>
            <p className="text-sm text-blue-100">Integration Platform</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">Sales and operations, in one place.</h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100">
            Track every outlet&apos;s sales as they sync, compare periods and channels, and export the
            reports your teams rely on.
          </p>
        </div>
        <p className="relative text-xs text-blue-200">© {new Date().getFullYear()} Kopi Calf · PT Yuda Prawira Group</p>
      </section>

      {/* Form */}
      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="relative h-11 w-11 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
              <Image src={assetUrl('assets/calf-logo.png')} alt="Kopi Calf" fill sizes="44px" className="object-contain p-1" />
            </span>
            <div className="leading-tight">
              <p className="font-bold tracking-wide text-slate-900">PORTAL</p>
              <p className="text-xs text-slate-500">Integration Platform</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Use your username or email to access the dashboard.</p>

          {notice && (
            <p className="mt-5 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-800" role="status">
              <Info size={16} className="mt-0.5 flex-shrink-0" /> {notice}
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Sign in with">
            {(['username', 'email'] as Method[]).map(m => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => switchMethod(m)}
                className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
                  method === m ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {m === 'username' ? <User size={15} /> : <AtSign size={15} />}
                {m === 'username' ? 'Username' : 'Email'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div>
              <label htmlFor="identifier" className="mb-1 block text-xs font-semibold text-slate-700">
                {method === 'email' ? 'Email address' : 'Username'}
              </label>
              <div className="relative">
                <IdentIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
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
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-500" />
              Keep me signed in for 30 days
            </label>

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !identifier.trim() || !password}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">Forgot your password? Contact your administrator.</p>
        </div>
      </section>
    </main>
  );
}

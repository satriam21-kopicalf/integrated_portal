'use client';

import { FormEvent, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, AtSign, Eye, EyeOff, Info, Loader2, Lock, User } from 'lucide-react';
import { safeNext, useAuth } from '@/lib/auth';

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
    <main className="flex min-h-dvh flex-col bg-white">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex flex-col items-center text-center">
            {/* served from the site itself (same origin): the first thing on screen, no external round trip */}
            <Image src="/assets/calf-logo.png" alt="Kopi Calf" width={136} height={72} priority unoptimized
              className="h-[72px] w-auto object-contain" />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">Sign in to Portal</h1>
            <p className="mt-1.5 text-sm text-slate-500">Kopi Calf Integration Platform</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:p-8">
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
        </div>
      </div>

      <footer className="pb-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Kopi Calf · PT Yuda Prawira Group
      </footer>
    </main>
  );
}

'use client';

// New deployments reach an open or installed portal (PWA) without reinstalling. The backend is always live (every
// call goes to /api); only the page code can be old, when the app stays open in the background for hours. So:
// - when the app comes back to the foreground, it checks /version.json and reloads at once if a new build is out
//   (nothing is being typed at that moment), and asks the service worker to update itself;
// - while in use, it checks every 10 minutes and offers "Reload" instead of reloading under the user's hands
//   (e.g. a stock opname being filled in).

import { RefreshCw, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tr } from '@/lib/i18n';

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID;
const EVERY_MS = 10 * 60_000;

async function newBuildOut(): Promise<boolean> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const { build } = (await res.json()) as { build?: string };
    return Boolean(build && CURRENT && build !== CURRENT);
  } catch {
    return false; // offline: keep the page
  }
}

export default function AppUpdate() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const check = async (resumed: boolean) => {
      if (!(await newBuildOut())) return;
      if (resumed) window.location.reload();
      else setReady(true);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => undefined);
      void check(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void check(false); }, EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, []);

  if (!ready || hidden) return null;
  return (
    <div role="status" className="fixed left-1/2 top-3 z-[80] flex w-[min(24rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl">
      <RefreshCw size={18} className="flex-shrink-0 text-blue-600" />
      <p className="min-w-0 flex-1 text-sm text-slate-700">{tr('A new version of the portal is available.')}</p>
      <button type="button" onClick={() => window.location.reload()}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700">{tr('Reload')}</button>
      <button type="button" onClick={() => setHidden(true)} aria-label={tr('Close')} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <X size={16} />
      </button>
    </div>
  );
}

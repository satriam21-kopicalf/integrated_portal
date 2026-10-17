'use client';

// Install the portal as an app (signed-in pages only, so it never covers the login form). Offers the install once per
// device:
// - Android / desktop Chrome & Edge: the browser's own prompt (beforeinstallprompt) behind an "Install" button;
// - iPhone / iPad: iOS has no install prompt, so the banner shows the steps Share → Add to Home Screen
//   (Safari, and since iOS 16.4 Chrome / Edge / Firefox on iOS too).
// Shown once, right after signing in (not again when moving between pages); hidden when the portal already runs
// installed; "Later" hides it for 14 days.

import { Download, PlusSquare, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { installOfferPending, installOfferShown } from '@/lib/greetings';
import { tr } from '@/lib/i18n';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const LATER_KEY = 'portal.install.later';
const LATER_MS = 14 * 864e5;

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; a touch screen gives it away
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function postponed() {
  try {
    return Date.now() - Number(localStorage.getItem(LATER_KEY) ?? 0) < LATER_MS;
  } catch {
    return false;
  }
}

/** The service worker of the installed app (public/sw.js); registered on every page, the login page included. */
export function useServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
  }, []);
}

export default function InstallApp() {
  const [mode, setMode] = useState<'ios' | 'prompt' | null>(null);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);

  useEffect(() => {
    if (standalone() || postponed() || !installOfferPending()) return;
    // shown once no other bottom notice (the profile reminder) is on screen, so the two never stack
    let timer: ReturnType<typeof setTimeout>;
    const showWhenFree = (m: 'ios' | 'prompt', delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.querySelector('[data-bottom-notice]')) showWhenFree(m, 3000);
        else if (installOfferPending()) { installOfferShown(); setMode(m); }
      }, delay);
    };
    if (isIOS()) {
      showWhenFree('ios', 2500);
      return () => clearTimeout(timer);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
      showWhenFree('prompt', 0);
    };
    const onInstalled = () => setMode(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!mode) return null;

  const later = () => {
    try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch { /* private mode */ }
    setMode(null);
  };
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === 'accepted') setMode(null); else later();
  };

  return (
    <div role="dialog" aria-label={tr('Install the app')}
      className="fixed inset-x-3 z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:inset-x-auto sm:right-4"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl border border-slate-100" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{tr('Install Kopi Calf Portal')}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            {tr('Open the portal from the home screen, full screen like an app.')}
          </p>
        </div>
        <button type="button" onClick={later} aria-label={tr('Close')}
          className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {mode === 'ios' ? (
        <ol className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">1</span>
            <Share size={15} className="shrink-0 text-blue-600" aria-hidden />
            <span>{tr('Tap Share in the browser bar')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">2</span>
            <PlusSquare size={15} className="shrink-0 text-slate-700" aria-hidden />
            <span>{tr('Choose Add to Home Screen, then Add')}</span>
          </li>
        </ol>
      ) : (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={later} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">{tr('Later')}</button>
          <button type="button" onClick={install}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Download size={15} /> {tr('Install')}
          </button>
        </div>
      )}
    </div>
  );
}

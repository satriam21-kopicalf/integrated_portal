'use client';

import { Languages, Moon, Sun } from 'lucide-react';
import { Lang, useLang, tr } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const LANGS: { value: Lang; short: string; label: string }[] = [
  { value: 'en', get short() { return tr('EN'); }, get label() { return tr('English'); } },
  { value: 'id', get short() { return tr('ID'); }, get label() { return tr('Indonesia'); } },
];

/** Compact theme and language switches (login page). */
export function PreferenceSwitches({ className = '' }: { className?: string }) {
  const { dark, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const next = LANGS.find(l => l.value !== lang)!;
  const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-900';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" onClick={() => setLang(next.value)} className={btn}
        title={tr('Language')} aria-label={`${tr('Language')}: ${next.label}`}>
        <Languages size={15} aria-hidden />{LANGS.find(l => l.value === lang)!.short}
      </button>
      <button type="button" onClick={() => setMode(dark ? 'light' : 'dark')} className={`${btn} w-9 px-0`}
        title={dark ? tr('Light') : tr('Dark')} aria-label={dark ? tr('Switch to light mode') : tr('Switch to dark mode')}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}

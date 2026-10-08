'use client';

import { Languages, Monitor, Moon, Sun } from 'lucide-react';
import { Lang, t, useLang, tr } from '@/lib/i18n';
import { ThemeMode, useTheme } from '@/lib/theme';

const THEMES: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, get label() { return tr('Light'); } },
  { value: 'dark', icon: Moon, get label() { return tr('Dark'); } },
  { value: 'system', icon: Monitor, get label() { return tr('System'); } },
];

const LANGS: { value: Lang; short: string; label: string }[] = [
  { value: 'en', get short() { return tr('EN'); }, get label() { return tr('English'); } },
  { value: 'id', get short() { return tr('ID'); }, get label() { return tr('Indonesia'); } },
];

function Choice<V extends string>({ value, options, onChange, label }: {
  value: V; label: string;
  options: { value: V; label: string; icon?: typeof Sun }[];
  onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-lg bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={`inline-flex h-7 items-center justify-center gap-1 rounded-md text-xs font-medium transition-colors ${
              on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {Icon && <Icon size={13} aria-hidden />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Appearance and language, in the user menu. */
export function PreferenceControls() {
  const { mode, setMode } = useTheme();
  const { lang, setLang } = useLang();
  return (
    <div className="space-y-2.5 border-b border-slate-100 px-3 py-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('Appearance')}</p>
        <Choice label={t('Appearance')} value={mode} onChange={setMode} options={THEMES.map(o => ({ ...o, label: t(o.label) }))} />
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('Language')}</p>
        <Choice label={t('Language')} value={lang} onChange={setLang} options={LANGS.map(o => ({ value: o.value, label: o.label }))} />
      </div>
    </div>
  );
}

/** Compact theme and language switches (login page). */
export function PreferenceSwitches({ className = '' }: { className?: string }) {
  const { dark, setMode } = useTheme();
  const { lang, setLang } = useLang();
  const next = LANGS.find(l => l.value !== lang)!;
  const btn = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" onClick={() => setLang(next.value)} className={btn}
        title={t('Language')} aria-label={`${t('Language')}: ${next.label}`}>
        <Languages size={15} aria-hidden />{LANGS.find(l => l.value === lang)!.short}
      </button>
      <button type="button" onClick={() => setMode(dark ? 'light' : 'dark')} className={`${btn} w-9 px-0`}
        title={dark ? t('Light') : t('Dark')} aria-label={dark ? t('Switch to light mode') : t('Switch to dark mode')}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}

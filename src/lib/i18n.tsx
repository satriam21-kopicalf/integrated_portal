'use client';

// English / Bahasa Indonesia. Texts are written in English in the code and wrapped in t();
// the English text is the key of the Indonesian dictionary (lib/i18n-id.ts), so a missing
// translation simply shows the English text. Placeholders: t('{0} of {1}', a, b).
//
// t() reads the current language from this module, so it also works in chart formatters and
// constant tables (as getters). Changing the language remounts the app (key={lang}), which
// re-renders every memoised chart option and label with the new language.

import { createContext, Fragment, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ID } from './i18n-id';

export type Lang = 'en' | 'id';

export const LANG_KEY = 'portal.lang';

let current: Lang = 'en';

/** Translation of an English UI text into the current language. */
export function t(key: string, ...args: (string | number | null | undefined)[]): string {
  let s = key;
  if (current === 'id') {
    const hit = ID[key];
    if (hit !== undefined) s = hit;
    else noteMissing(key);
  }
  return args.length ? s.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? '')) : s;
}

/** A read-only list whose items are translated when read (constant tables at module level). */
export function trList(items: string[]): string[] {
  return new Proxy(items, {
    get(target, key, receiver) {
      const v = Reflect.get(target, key, receiver);
      return typeof key === 'string' && /^\d+$/.test(key) && typeof v === 'string' ? t(v) : v;
    },
  });
}

/** Same as t(): the name used in components (many of them have a local `t`). */
export const tr = t;

/** Current language (also outside React). */
export const lang = (): Lang => current;

/** Locale for dates of the current language. */
export const locale = (): string => (current === 'id' ? 'id-ID' : 'en-GB');

/** Locale for numbers of the current language (1,234.5 or 1.234,5). */
export const numberLocale = (): string => (current === 'id' ? 'id-ID' : 'en-US');

// QA aid: localStorage['portal.i18n.debug'] = '1' collects untranslated texts in window.__i18nMissing
function noteMissing(key: string) {
  if (typeof window === 'undefined' || !/[a-z]/i.test(key)) return;
  const w = window as unknown as { __i18nDebug?: boolean; __i18nMissing?: Set<string> };
  if (w.__i18nDebug === undefined) {
    try {
      w.__i18nDebug = window.localStorage.getItem('portal.i18n.debug') === '1';
    } catch {
      w.__i18nDebug = false;
    }
  }
  if (w.__i18nDebug) (w.__i18nMissing ??= new Set()).add(key);
}

/* ------------------------------------------------------------------ messages from the API */

// The backend answers in Indonesian (validation, sign-in) and sometimes in English: English UI
// gets the Indonesian ones translated here, the Indonesian UI gets English ones from the dictionary.
const SERVER_EN: [RegExp, string][] = [
  [/^Username\/email atau password salah$/, 'Wrong username/email or password'],
  [/^Akun dinonaktifkan\. Hubungi administrator\.$/, 'This account is disabled. Contact your administrator.'],
  [/^Akun terkunci karena terlalu banyak percobaan\. Coba lagi dalam (\d+) menit\.$/, 'Account locked after too many attempts. Try again in $1 minutes.'],
  [/^Akun terkunci selama (\d+) menit karena terlalu banyak percobaan\.$/, 'Account locked for $1 minutes after too many attempts.'],
  [/^Sesi berakhir, silakan login kembali$/, 'Your session has ended, please sign in again'],
  [/^Silakan login terlebih dahulu$/, 'Please sign in first'],
  [/^Hanya superadmin yang dapat mengakses fitur ini$/, 'Only super admins can use this feature'],
  [/^Anda tidak dapat menghapus akun Anda sendiri$/, 'You cannot delete your own account'],
  [/^Anda tidak dapat menonaktifkan akun Anda sendiri$/, 'You cannot deactivate your own account'],
  [/^Cabang tidak dikenal: (.*)$/, 'Unknown branch: $1'],
  [/^Email sudah dipakai$/, 'This email is already in use'],
  [/^Username sudah dipakai$/, 'This username is already in use'],
  [/^Format email tidak valid$/, 'Invalid email address'],
  [/^File bukan gambar yang valid$/, 'The file is not a valid image'],
  [/^Format gambar tidak didukung \(gunakan JPG, PNG atau WebP\)$/, 'Image format not supported (use JPG, PNG or WebP)'],
  [/^File export belum siap atau sudah kedaluwarsa$/, 'The export file is not ready yet or has expired'],
  [/^Format tanggal harus YYYY-MM-DD$/, 'Dates must be YYYY-MM-DD'],
  [/^Tanggal mulai harus sebelum tanggal akhir$/, 'The start date must be before the end date'],
  [/^Jenis kelamin tidak valid$/, 'Invalid gender'],
  [/^Lokasi kerja tidak ditemukan$/, 'Work location not found'],
  [/^Nama lengkap wajib diisi$/, 'Full name is required'],
  [/^Nomor karyawan hanya huruf, angka, titik, garis miring atau strip$/, 'Employee number: letters, numbers, dots, slashes or dashes only'],
  [/^Nomor telepon tidak valid$/, 'Invalid phone number'],
  [/^Tanggal lahir tidak valid$/, 'Invalid date of birth'],
  [/^Password baru harus berbeda dari password saat ini$/, 'The new password must differ from the current one'],
  [/^Password harus mengandung huruf dan angka$/, 'The password must contain letters and numbers'],
  [/^Password maksimal 128 karakter$/, 'The password can be 128 characters at most'],
  [/^Password minimal (\d+) karakter$/, 'The password needs at least $1 characters'],
  [/^Password saat ini salah$/, 'The current password is wrong'],
  [/^Password wajib diisi$/, 'A password is required'],
  [/^Minimal harus ada satu superadmin aktif$/, 'There must be at least one active super admin'],
  [/^Pilih minimal satu cabang untuk role User$/, 'Choose at least one branch for the User role'],
  [/^User tidak ditemukan$/, 'User not found'],
  [/^Username 3-32 karakter: huruf kecil, angka, titik, garis bawah atau strip$/, 'Username: 3–32 characters, lowercase letters, numbers, dots, underscores or dashes'],
  [/^Field tidak dapat diubah sendiri: (.*)$/, 'These fields cannot be changed by yourself: $1'],
  [/^Pengaturan tidak dikenal: (.*)$/, 'Unknown setting: $1'],
  [/^(.+) perlu good, warning, serious \(angka\)$/, '$1 needs good, warning, serious (numbers)'],
  [/^(.+): harus 0 <= good <= warning <= serious <= 100$/, '$1: must be 0 <= good <= warning <= serious <= 100'],
  [/^forecast di luar batas \(lookback 7-120 hari, safety 0-14 hari\)$/, 'Forecast out of range (lookback 7–120 days, safety 0–14 days)'],
  [/^forecast perlu lookback_days, safety_days, trend_cap_pct$/, 'The forecast needs lookback_days, safety_days and trend_cap_pct'],
  [/^Export terhenti \(proses export berhenti\)\. Silakan export ulang\.$/, 'The export stopped (the export process ended). Please export again.'],
  [/^Export terhenti \(server restart\)\. Silakan export ulang\.$/, 'The export stopped (server restart). Please export again.'],
  [/^Export tidak dapat dimulai\. Silakan export ulang\.$/, 'The export could not start. Please export again.'],
  [/^Google Apps Script tidak dapat dihubungi: (.*)$/, 'Google Apps Script cannot be reached: $1'],
  [/^Ketik "(.+)" (.*)$/, 'Type "$1" $2'],
];

/** A message from the API in the UI language. */
export function serverMsg(msg: string | null | undefined): string {
  if (!msg) return msg ?? '';
  if (current === 'id') return t(msg);
  for (const [re, en] of SERVER_EN) if (re.test(msg)) return msg.replace(re, en);
  return msg;
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangState>({ lang: 'en', setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  // the first render is English on the server and the client (no hydration mismatch); the stored
  // choice is applied right after mount
  const [value, setValue] = useState<Lang>('en');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANG_KEY);
      if (stored === 'id') {
        current = 'id';
        setValue('id');
      }
    } catch {
      /* default English */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = value;
  }, [value]);

  const setLang = useCallback((l: Lang) => {
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* not remembered */
    }
    current = l;
    setValue(l);
  }, []);

  const ctx = useMemo(() => ({ lang: value, setLang }), [value, setLang]);
  return (
    <LangContext.Provider value={ctx}>
      <Fragment key={value}>{children}</Fragment>
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

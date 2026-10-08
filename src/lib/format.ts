// Display formatting shared by the dashboard: dates and numbers follow the UI language
// (English: 1,234 · 08 Oct 2026; Indonesian: 1.234 · 08 Okt 2026); Rupiah always "Rp 1.234".

import { lang, locale, numberLocale } from './i18n';

const NUMBER = { en: new Intl.NumberFormat('en-US'), id: new Intl.NumberFormat('id-ID') };
const currencyFormat = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const COMPACT = {
  en: new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }),
  id: new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }),
};

type Num = number | string | null | undefined;

function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** x.toFixed(digits) with the decimal separator of the UI language (33.5 / 33,5); no thousands grouping. */
export function fixed(value: number, digits?: number): string;
export function fixed(value: number | null | undefined, digits?: number): string | undefined;
export function fixed(value: number | null | undefined, digits = 0): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.toLocaleString(numberLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
}

export function formatNumber(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : NUMBER[lang()].format(n);
}

export function formatCurrency(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : currencyFormat.format(n);
}

/** "Rp 1.40B" style for tight spaces (summary cards on mobile). */
export function formatCompactCurrency(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : `Rp ${COMPACT[lang()].format(n)}`;
}

/** Parses "2026-09-10" as a local calendar date (no UTC shift). */
export function parseLocalDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(locale(), {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1_000_000) return `${fixed(bytes / 1000, 0)} KB`;
  return `${fixed(bytes / 1_000_000, 1)} MB`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** yyyy-mm-dd for a local Date. */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Display formatting shared by the dashboard (English UI, Indonesian Rupiah amounts).

const numberFormat = new Intl.NumberFormat('en-US');
const currencyFormat = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

type Num = number | string | null | undefined;

function toNumber(value: Num): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : numberFormat.format(n);
}

export function formatCurrency(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : currencyFormat.format(n);
}

/** "Rp 1.40B" style for tight spaces (summary cards on mobile). */
export function formatCompactCurrency(value: Num): string {
  const n = toNumber(value);
  return n === null ? '-' : `Rp ${compactFormat.format(n)}`;
}

/** Parses "2026-09-10" as a local calendar date (no UTC shift). */
export function parseLocalDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '-';
  const d = parseLocalDate(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
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

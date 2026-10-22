import { toIsoDate } from '@/lib/format';

export type CompareMode = 'auto' | 'month' | 'year' | 'custom';

export interface CompareValue {
  mode: CompareMode;
  /** custom only */
  from: string;
  to: string;
}


/** Same calendar dates `months` earlier; days past the end of a shorter month land on its last day. */
function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toIsoDate(target);
}

/** The comparison period to send (null = the API default: the same weekdays, whole weeks earlier). */
export function compareRange(value: CompareValue, period: { from: string; to: string } | null): { from: string; to: string } | null {
  if (value.mode === 'custom' && value.from) return { from: value.from, to: value.to || value.from };
  if (!period || (value.mode !== 'month' && value.mode !== 'year')) return null;
  const n = value.mode === 'month' ? -1 : -12;
  return { from: shiftMonths(period.from, n), to: shiftMonths(period.to, n) };
}

'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import Drawer from '@/components/ui/Drawer';
import { buttonDanger, buttonSecondary, inputClass } from '@/components/ui/Dialog';
import { formatDate, formatDateTime, formatNumber, toIsoDate } from '@/lib/format';

export interface LogStorage {
  entries: number;
  oldest: string | null;
  newest: string | null;
}

/**
 * Superadmin: remove the activity log now — everything, or what is older than a day — instead of
 * waiting for the daily clean-up. Typed confirmation; the reset itself becomes the first new entry.
 */
export default function ResetLogsDrawer({ storage, retentionDays, onClose, onDone }: {
  storage: LogStorage | null;
  retentionDays: number | null;
  onClose: () => void;
  onDone: (removed: number) => void;
}) {
  const [scope, setScope] = useState<'all' | 'before'>('all');
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const [before, setBefore] = useState(toIsoDate(week));
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirm === 'RESET' && (scope === 'all' || Boolean(before));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/activity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm, before: scope === 'before' ? before : null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      onDone(body.removed ?? 0);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Drawer open onClose={busy ? () => {} : onClose} size="sm" icon={<Trash2 size={18} />} title="Reset activity logs"
      description="Remove log entries now instead of waiting for the automatic clean-up."
      footer={
        <>
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={buttonDanger} onClick={submit} disabled={!ready || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {scope === 'all' ? 'Reset all logs' : 'Delete older entries'}
          </button>
        </>
      }>
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Entries stored</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{storage ? formatNumber(storage.entries) : '…'}</dd>
          </div>
          <div className="bg-white px-3 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Auto clean-up</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{retentionDays ? `after ${retentionDays} days` : 'off'}</dd>
          </div>
          <div className="col-span-2 bg-white px-3 py-2.5 text-xs text-slate-500">
            {storage?.oldest ? <>From {formatDateTime(storage.oldest)} to {formatDateTime(storage.newest)}</> : 'The log is empty'}
          </div>
        </dl>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-slate-700">What to remove</legend>
          {([
            ['all', 'All entries', 'Empty the whole log.'],
            ['before', 'Entries before a date', 'Keep recent activity, remove what is older.'],
          ] as const).map(([value, label, hint]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${scope === value ? 'border-red-300 bg-red-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="radio" name="scope" value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-1 accent-red-600" />
              <span>
                <span className="block text-sm font-medium text-slate-800">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </label>
          ))}
          {scope === 'before' && (
            <div className="pl-1 pt-1">
              <label className="text-xs text-slate-500" htmlFor="reset-before">Remove everything before (WIB)</label>
              <input id="reset-before" type="date" value={before} max={toIsoDate(new Date())} onChange={e => setBefore(e.target.value)} className={`${inputClass} mt-1`} />
              {before && <p className="mt-1 text-[11px] text-slate-500">Entries up to {formatDate(toIsoDate(new Date(new Date(`${before}T00:00:00`).getTime() - 86_400_000)))} are removed.</p>}
            </div>
          )}
        </fieldset>

        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800"><AlertTriangle size={16} /> This cannot be undone</p>
          <p className="text-xs leading-relaxed text-red-800">
            Removed entries are gone for good. The reset itself is recorded as a new entry with your name, so it stays traceable.
          </p>
          <label className="block text-xs font-medium text-red-900" htmlFor="reset-confirm">Type <b>RESET</b> to confirm</label>
          <input id="reset-confirm" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" placeholder="RESET"
            className={`${inputClass} border-red-200 font-mono`} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Drawer>
  );
}

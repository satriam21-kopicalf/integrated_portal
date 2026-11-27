'use client';

// The ring of the running download (lib/download-progress.ts): the percentage inside, the file name below, Cancel.
// Same look as kopicalf-hrms (components/ui/download-progress.tsx, 2026-11-16).

import { Check, FileSpreadsheet, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { type DownloadState, subscribeDownload } from '@/lib/download-progress';
import { tr } from '@/lib/i18n';

const R = 46;
const C = 2 * Math.PI * R;

export default function DownloadProgress() {
  const [s, setS] = useState<DownloadState | null>(null);
  useEffect(() => subscribeDownload(setS), []);
  if (!s || typeof document === 'undefined') return null;
  const done = s.phase === 'done';
  const pct = done ? 100 : Math.max(0, Math.min(100, s.percent ?? 0));
  const measured = done || s.percent !== null;
  const Icon = /\.pdf$/i.test(s.filename) ? FileText : FileSpreadsheet;
  const status = done ? tr('Done') : s.phase === 'preparing' ? tr('Preparing the file…') : tr('Downloading…');
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-900/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={status}>
      <div className="w-full max-w-[320px] rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-6 text-center shadow-xl">
        <div className="relative mx-auto h-[120px] w-[120px]">
          <svg viewBox="0 0 120 120" className={`h-full w-full -rotate-90 ${measured ? '' : 'animate-spin [animation-duration:1.4s]'}`} aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" className="stroke-neutral-100" />
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={C}
              strokeDashoffset={measured ? C * (1 - pct / 100) : C * 0.72}
              className={`transition-[stroke-dashoffset] duration-300 ease-out ${done ? 'stroke-emerald-500' : 'stroke-brand-700'}`} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {done ? <Check className="h-9 w-9 text-emerald-500" strokeWidth={2.5} />
              : measured ? <span className="text-[26px] font-bold leading-none tabular-nums text-[color:var(--j-172B4D)]" aria-live="polite">{pct}%</span> : null}
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold text-[color:var(--j-172B4D)]">{status}</p>
        <p className="mx-auto mt-1.5 flex max-w-full items-center justify-center gap-1.5 text-xs text-[color:var(--j-626F86)]">
          <Icon className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate" title={s.filename}>{s.filename}</span>
        </p>
        {s.phase === 'preparing' && <p className="mt-2 text-[11px] text-[color:var(--j-626F86)]">{tr('The server is putting the data together, please wait')}</p>}
        {!done && s.cancel && (
          <button type="button" onClick={s.cancel}
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-4 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">
            <X className="h-3.5 w-3.5" />{tr('Cancel')}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

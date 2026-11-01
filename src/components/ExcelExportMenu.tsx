'use client';

// The Excel export of a page with several files (Review Stock Opname, Waste monitor): the Excel icon button, opening a
// menu of the files, each with its own icon, what it holds and how many rows; the footer says what the files cover.

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { assetUrl } from '@/lib/assets';
import { fmtNumber } from '@/so/ui';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

export type ExportChoice = {
  key: string; label: string; hint: string; icon: ReactNode; count?: number | null;
  /** icon colours of the choice, e.g. "bg-emerald-50 text-emerald-600" */ tone?: string;
  run: () => Promise<void> | void;
};

export default function ExcelExportMenu({ choices, footer, title }: { choices: ExportChoice[]; footer?: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const pick = async (c: ExportChoice) => {
    setBusy(c.key);
    try {
      await c.run();
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)} disabled={!!busy} aria-expanded={open} aria-haspopup="menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        title={busy ? tr('Export in progress') : tr('Export to Excel')} aria-label={tr('Export')}>
        {busy ? <Loader2 size={18} className="animate-spin text-slate-600" />
          : <span className="relative h-6 w-6"><Image src={assetUrl('assets/xlsx.png')} alt="" fill sizes="24px" className="object-contain" /></span>}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl sm:left-auto sm:right-0">
          <div className="p-1.5">
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title ?? `${tr('Export to')} Excel`}</p>
            {choices.map((c) => (
              <button key={c.key} type="button" role="menuitem" disabled={c.count === 0 || !!busy} onClick={() => void pick(c)}
                className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent">
                <span className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${c.tone ?? 'bg-slate-100 text-slate-500'}`}>
                  {busy === c.key ? <Loader2 size={16} className="animate-spin" /> : c.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{c.label}</span>
                  <span className="block text-xs text-slate-500">{c.hint}</span>
                </span>
                {c.count != null && <span className="mt-0.5 flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">{fmtNumber(c.count)}</span>}
              </button>
            ))}
            {footer && <p className="border-t border-slate-100 px-2.5 pb-1 pt-2 text-[11px] text-slate-400">{footer}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

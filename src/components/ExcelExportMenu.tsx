'use client';

// The Excel export of a page with several files (Review Stock Opname, Waste monitor): the Export button, opening a
// menu of the files (a dropdown on desktop, a bottom sheet on phones), each with its own icon, what it holds and how many rows; the footer says what the files cover.

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { assetUrl } from '@/lib/assets';
import { fmtNumber } from '@/so/ui';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';
import { Popover, PopoverButton } from '@/components/kc/Popover';

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
      <PopoverButton label={tr('Export')} value={busy ? tr('Exporting…') : tr('Export')} open={open} disabled={!!busy}
        title={busy ? tr('Export in progress') : tr('Export to Excel')} onClick={() => setOpen(!open)}
        icon={busy ? <Loader2 className="animate-spin text-neutral-600" /> : <span className="relative block h-[18px] w-[18px]"><Image src={assetUrl('assets/xlsx.png')} alt="" fill sizes="18px" className="object-contain" /></span>} />
      <Popover open={open} onClose={() => setOpen(false)} title={title ?? `${tr('Export to')} Excel`} subtitle={footer}>
        <div className="p-1.5" role="menu">
          {choices.map((c) => (
            <button key={c.key} type="button" role="menuitem" disabled={c.count === 0 || !!busy} onClick={() => void pick(c)}
              className="flex w-full items-start gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent sm:py-2">
              <span className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${c.tone ?? 'bg-neutral-100 text-neutral-500'}`}>
                {busy === c.key ? <Loader2 size={16} className="animate-spin" /> : c.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-neutral-800">{c.label}</span>
                <span className="block text-xs text-neutral-500">{c.hint}</span>
              </span>
              {c.count != null && <span className="mt-0.5 flex-shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-neutral-600">{fmtNumber(c.count)}</span>}
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

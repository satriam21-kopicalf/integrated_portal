'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { INFO, InfoKey, MetricInfo } from '@/lib/metricInfo';
import { tr } from '@/lib/i18n';

const WIDTH = 360;

/**
 * ⓘ next to an analytic's title: where the data comes from, what is counted and the
 * formulas. Opens on hover or click (touch), rendered in a portal so cards never clip it.
 */
export default function InfoTip({ info }: { info: InfoKey | MetricInfo }) {
  const data: MetricInfo = typeof info === 'string' ? INFO[info] : info;
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const hide = useCallback(() => { setOpen(false); setPinned(false); }, []);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 260;
    const below = r.bottom + 8 + h < window.innerHeight;
    setPos({
      top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - h),
      left: Math.min(Math.max(8, r.left - 12), window.innerWidth - Math.min(WIDTH, window.innerWidth - 16) - 8),
    });
    if (!pinned) return;
    const away = (e: MouseEvent) => { if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) hide(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') hide(); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, pinned, hide]);

  return (
    <>
      <button ref={btn} type="button" aria-label={tr('How "{0}" is calculated', tr(data.title))} aria-expanded={open}
        onClick={e => { e.stopPropagation(); setPinned(p => !p); setOpen(o => !(o && pinned)); }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}
        className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
        <Info size={14} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={panel} role="tooltip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: `min(${WIDTH}px, calc(100vw - 16px))` }}
          className="fixed z-[95] rounded-xl border border-slate-200 bg-white p-3.5 text-left text-xs leading-relaxed text-slate-600 shadow-xl">
          <p className="mb-2 text-sm font-semibold text-slate-900">{tr(data.title)}</p>
          {data.formula && data.formula.length > 0 && (
            <Part title={tr('Formula')}>
              {data.formula.map(f => <li key={f} className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-800">{tr(f)}</li>)}
            </Part>
          )}
          <Part title={tr('What is counted')}>{data.definition.map(d => <li key={d}>{tr(d)}</li>)}</Part>
          <Part title={tr('Source')}>{data.source.map(s => <li key={s}>{tr(s)}</li>)}</Part>
        </div>,
        document.body,
      )}
    </>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

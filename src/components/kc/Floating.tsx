'use client';

// The panel of a field (a list, a calendar, the filters), 2026-11-25: a bottom sheet with its title on phones and in the
// PWA, under the field from tablets up. In a portal, so a card, a table or a drawer never cuts it off. The panel on top
// takes Escape; a press inside never counts as a press outside for what is under it.

import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { tr } from '@/lib/i18n';

const QUERY = '(max-width: 639.98px)';
const subscribe = (fn: () => void) => { const m = window.matchMedia(QUERY); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); };
/** phones and the PWA */
export const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);

const stack: object[] = [];

export default function Floating({ open, onClose, title, subtitle, anchor, width = 320, maxHeight, footer, children }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; anchor: RefObject<HTMLElement | null>; width?: number; maxHeight?: number; footer?: ReactNode; children: ReactNode;
}) {
  const phone = usePhone();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const [pos, setPos] = useState<{ top: number; left: number; max: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const me = {};
    stack.push(me);
    const top = () => stack[stack.length - 1] === me;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && top()) { e.stopPropagation(); closeRef.current(); } };
    const away = (e: MouseEvent) => { if (top() && !anchor.current?.contains(e.target as Node)) closeRef.current(); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('mousedown', away);
    return () => { stack.splice(stack.indexOf(me), 1); document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', away); };
  }, [open, anchor]);

  // a press inside stays inside (native: the listeners of the panels below sit on document)
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('mousedown', stop);
    el.addEventListener('touchstart', stop, { passive: true });
    return () => { el.removeEventListener('mousedown', stop); el.removeEventListener('touchstart', stop); };
  }, [open, phone]);

  useLayoutEffect(() => {
    if (!open || phone) return;
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (!r) return;
      const h = Math.min(maxHeight ?? 9999, panel.current?.scrollHeight ?? 320), below = innerHeight - r.bottom - 12, above = r.top - 12;
      const up = below < h && above > below;
      // a tall panel (calendar) that fits on neither side: over the field, in full
      if (Math.max(below, above) < h) { const top = Math.max(8, innerHeight - h - 8); setPos({ top, left: Math.max(8, Math.min(r.left, innerWidth - width - 8)), max: Math.min(maxHeight ?? 9999, innerHeight - top - 8) }); return; }
      setPos({ top: up ? Math.max(8, r.top - 4 - Math.min(h, above)) : r.bottom + 4, left: Math.max(8, Math.min(r.left, innerWidth - width - 8)), max: Math.min(maxHeight ?? 9999, up ? above : below) });
    };
    place();
    const moved = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', moved, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', moved, true); };
  }, [open, phone, anchor, width, maxHeight]);

  if (!open || typeof document === 'undefined') return null;
  const body = <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>;
  const foot = footer && <footer className="flex flex-shrink-0 items-center gap-2 border-t border-neutral-200 bg-white px-4 py-3" style={phone ? { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' } : undefined}>{footer}</footer>;
  return createPortal(phone ? (
    <div ref={panel} className="fixed inset-0 z-[90] flex items-end" role="presentation" onClick={(e) => e.stopPropagation()}>
      <div className="drawer-backdrop absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet-panel relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl">
        <span className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-neutral-200" aria-hidden />
        <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5">
          <div className="min-w-0"><p className="text-base font-semibold text-neutral-900">{title}</p>{subtitle && <p className="text-xs text-neutral-500">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} aria-label={tr('Close')} className="-mr-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"><X size={18} /></button>
        </header>
        {body}{foot ?? <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />}
      </div>
    </div>
  ) : (
    <div ref={panel} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, maxHeight: pos?.max }}
      className="fixed z-[90] flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">{body}{foot}</div>
  ), document.body);
}

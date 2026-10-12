'use client';

import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { tr } from '@/lib/i18n';

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** shown on hover, e.g. why the item is disabled */
  hint?: string;
  /** a divider above this item */
  separated?: boolean;
}

const MENU_WIDTH = 192;

/**
 * Row actions behind a "⋯" button. The menu is rendered in a portal with fixed
 * positioning, so scrolling/overflowing table containers never clip it; it opens
 * below the button (above when there is no room) and closes on outside click,
 * Escape, scroll or resize.
 */
export default function ActionMenu({ items, label = tr('Actions') }: { items: ActionItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? items.length * 36 + 12;
    const below = r.bottom + 6 + height < window.innerHeight;
    setPos({
      top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - height),
      left: Math.min(Math.max(8, r.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - 8),
    });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
          open ? 'border-slate-300 bg-slate-100 text-slate-900' : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
        }`}
      >
        <MoreHorizontal size={18} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={menu}
          role="menu"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH }}
          className="fixed z-[80] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {items.map(item => (
            <div key={item.label}>
              {item.separated && <div className="my-1 h-px bg-slate-100" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.hint}
                onClick={e => {
                  e.stopPropagation();
                  close();
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={item.danger ? 'text-red-500' : 'text-slate-400'}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

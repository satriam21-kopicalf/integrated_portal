'use client';

// The panel of a toolbar button (date range, branches, export …), 2026-11-04: a dropdown under the button from tablets
// up, a bottom sheet over a dimmed page on phones and in the PWA (big enough to read and to tap, never cut off by the
// screen edge). Place it inside the `relative` box of the button; it closes with Escape, the backdrop or the X.

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cx } from './index';
import { tr } from '@/lib/i18n';

export function Popover({ open, onClose, title, subtitle, actions, footer, children, width = 'sm:w-[22rem]', bodyClassName }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
  /** next to the title (e.g. Clear) */ actions?: ReactNode;
  footer?: ReactNode; children: ReactNode; width?: string; bodyClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop fixed inset-0 z-[79] bg-neutral-900/30 sm:hidden" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={typeof title === 'string' ? title : undefined}
        className={cx('sheet-panel fixed inset-x-0 bottom-0 z-[80] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl',
          'sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(36rem,80dvh)] sm:rounded-xl sm:border sm:border-neutral-200 sm:shadow-lg sm:[animation:none]', width)}>
        <span className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-neutral-200 sm:hidden" aria-hidden />
        <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-neutral-900 sm:text-sm">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {actions}
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr('Close')}><X size={16} /></button>
          </div>
        </header>
        <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>{children}</div>
        {footer && (
          <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3 sm:py-2.5"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</footer>
        )}
      </div>
    </>
  );
}

/** The button of a toolbar panel: icon, the current value from tablets up, a count badge, highlighted when in use. */
export function PopoverButton({ icon, label, value, active, open, badge, onClick, disabled, title }: {
  icon: ReactNode; label: string; value?: ReactNode; active?: boolean; open?: boolean; badge?: number; onClick: () => void; disabled?: boolean; title?: string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-expanded={open} aria-label={label} title={title ?? label}
      className={cx('relative inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-9',
        active || open ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100' : 'border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50')}>
      <span className="flex-shrink-0 [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>
      {/* the value from tablets up; a toolbar with room shows it on phones too ([&_.pb-value]:inline) */}
      {value !== undefined && <span className="pb-value hidden max-w-[11rem] truncate sm:inline lg:max-w-[15rem]">{value}</span>}
      {!!badge && badge > 1 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-brand-700 px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white sm:static sm:ring-0">{badge}</span>
      )}
    </button>
  );
}

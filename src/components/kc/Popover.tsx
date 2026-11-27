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
        className={cx('sheet-panel fixed inset-x-0 bottom-0 z-[80] flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[8px] bg-white shadow-xl',
          'sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-[min(36rem,80dvh)] sm:rounded-[3px] sm:border sm:border-[color:var(--j-DCDFE4)] sm:shadow-lg sm:[animation:none]', width)}>
        <span className="mx-auto mt-2 h-1 w-10 flex-shrink-0 rounded-full bg-[color:var(--j-DCDFE4)] sm:hidden" aria-hidden />
        <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-[color:var(--j-DCDFE4)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-[color:var(--j-172B4D)] sm:text-sm">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{subtitle}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {actions}
            <button type="button" onClick={onClose} className="rounded-[3px] p-1.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]" aria-label={tr('Close')}><X size={16} /></button>
          </div>
        </header>
        <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', bodyClassName)}>{children}</div>
        {footer && (
          <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-4 py-3 sm:py-2.5"
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
      className={cx('relative inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-[3px] border px-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:h-9',
        active || open ? 'border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)] hover:bg-[color:var(--j-CCE0FF)]' : 'border-[color:var(--j-DCDFE4)] bg-white text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]')}>
      <span className="flex-shrink-0 [&>svg]:h-[17px] [&>svg]:w-[17px]">{icon}</span>
      {/* the value from tablets up; a toolbar with room shows it on phones too ([&_.pb-value]:inline) */}
      {value !== undefined && <span className="pb-value hidden max-w-[11rem] truncate sm:inline lg:max-w-[15rem]">{value}</span>}
      {!!badge && badge > 1 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-[color:var(--j-0C66E4)] px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white sm:static sm:ring-0">{badge}</span>
      )}
    </button>
  );
}

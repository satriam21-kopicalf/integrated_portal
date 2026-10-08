'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { tr } from '@/lib/i18n';

/**
 * Side panel sliding in from the right (full width on phones). Same props as
 * Dialog. Escape / backdrop close unless `locked`.
 */
export default function Drawer({
  open, title, description, onClose, children, footer, size = 'md', locked = false, icon, onBack, titleExtra, focusFirstField = true,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** shows a back arrow before the title (drill-down history) */
  onBack?: () => void;
  /** next to the title, e.g. an ⓘ */
  titleExtra?: ReactNode;
  /** cannot be dismissed (e.g. a required password change) */
  locked?: boolean;
  icon?: ReactNode;
  /** false: focus the panel itself on open (e.g. when the first field is a date picker) */
  focusFirstField?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // latest handler / lock state without re-running the effects (callers pass a
  // new onClose on every render; re-running would steal focus while typing)
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  useEffect(() => {
    closeRef.current = onClose;
    lockedRef.current = locked;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockedRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // focus the first field once, when the drawer opens
  useEffect(() => {
    if (!open) return;
    const first = focusFirstField ? panel.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=file]), select, textarea') : null;
    (first ?? panel.current)?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <div className="drawer-backdrop absolute inset-0 bg-slate-900/40 dark:bg-black/70" onClick={locked ? undefined : onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`drawer-panel relative flex h-full w-full flex-col bg-white shadow-2xl outline-none ${width}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {onBack && (
              <button type="button" onClick={onBack} className="mt-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={tr('Back')}>
                <ArrowLeft size={18} />
              </button>
            )}
            {icon && <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">{icon}</span>}
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">{title}{titleExtra}</h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {!locked && (
            <button type="button" onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tr('Close')}>
              <X size={18} />
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:px-6">{footer}</footer>}
      </div>
    </div>
  );
}

/** Titled group of fields inside a drawer. */
export function DrawerSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0 [&:not(:first-child)]:pt-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

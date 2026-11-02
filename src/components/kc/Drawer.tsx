'use client';

// The side panel of the portal (design after kopicalf-hrms, 2026-11-02): slides in from the right, full width on
// phones. Header (back arrow, icon, title, description, close), a scrolling body, a footer for the actions. Escape and
// the backdrop close it unless `locked`. @/components/ui/Drawer and @/so/ui/Drawer re-export this one, so every drawer
// of the portal shares it.

import { ReactNode, useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { tr } from '@/lib/i18n';

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
  // latest handler / lock state without re-running the effects (callers pass a new onClose on every render;
  // re-running would steal focus while typing)
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
    <div className="fixed inset-0 z-[80] !m-0 flex justify-end" role="presentation">
      <div className="drawer-backdrop absolute inset-0 bg-neutral-900/30 dark:bg-black/70" onClick={locked ? undefined : onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={`drawer-panel relative flex h-full w-full flex-col bg-white shadow-xl outline-none sm:border-l sm:border-neutral-200 ${width}`}>
        <header className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            {onBack && (
              <button type="button" onClick={onBack} className="mt-0.5 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" aria-label={tr('Back')}>
                <ArrowLeft size={17} />
              </button>
            )}
            {icon && <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
            <div className="min-w-0">
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold leading-snug text-neutral-900">{title}{titleExtra}</h2>
              {description && <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>}
            </div>
          </div>
          {!locked && (
            <button type="button" onClick={onClose} className="-mr-1 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr('Close')}>
              <X size={17} />
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3 sm:px-6"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>{footer}</footer>
        )}
      </div>
    </div>
  );
}

/** A titled group of fields inside a drawer: the title as a small uppercase label, a line between groups. */
export function DrawerSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-neutral-200 pb-6 last:border-b-0 last:pb-0 [&:not(:first-child)]:pt-6">
      {(title || description) && (
        <div>
          {title && <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>}
          {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

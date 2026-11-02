'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { tr } from '@/lib/i18n';

/** Centered modal (bottom sheet on phones). Escape / backdrop close unless `locked`. */
export default function Dialog({
  open, title, description, onClose, children, footer, size = 'md', locked = false,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** cannot be dismissed (e.g. a required password change) */
  locked?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  // latest close handler / lock state without re-running the effects below:
  // callers pass a new onClose on every render, and re-running would move focus
  const closeRef = useRef(onClose);
  const lockedRef = useRef(locked);
  useEffect(() => {
    closeRef.current = onClose;
    lockedRef.current = locked;
  });

  // Escape to close + no page scroll behind the dialog, while open
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

  // focus the first field once, when the dialog opens (never while typing)
  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    (first ?? panel.current)?.focus();
  }, [open]);

  if (!open) return null;
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-neutral-900/30 dark:bg-black/70" onClick={locked ? undefined : onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-xl ${width}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-neutral-500">{description}</p>}
          </div>
          {!locked && (
            <button type="button" data-close onClick={onClose} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr('Close')}>
              <X size={18} />
            </button>
          )}
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({
  label, htmlFor, error, hint, required, children, className = '',
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-neutral-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'h-10 w-full rounded-lg px-3 text-sm ' +
  'border border-transparent bg-neutral-100 text-neutral-900 placeholder:text-neutral-400 transition-colors hover:bg-neutral-200/60 focus:border-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400';

export const buttonPrimary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-3.5 text-[13px] font-medium text-white shadow-sm ' +
  'transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60';

export const buttonSecondary =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 text-[13px] font-medium ' +
  'text-neutral-800 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-60';

export const buttonDanger =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-[13px] font-medium text-white shadow-sm ' +
  'transition-colors hover:bg-red-700 disabled:opacity-60';

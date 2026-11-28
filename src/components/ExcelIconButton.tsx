'use client';

// The one Excel button of the portal (2026-11-28, the Jira look): the real Excel icon and the text "Export Excel" or
// "Import Excel", the same on every page. `label` says what the file holds (tooltip / screen readers). A button
// (onClick, a spinner while busy) or a plain link (href).

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { tr } from '@/lib/i18n';

export const excelBtnClass = 'inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-3 text-[13px] font-medium text-[color:var(--j-172B4D)] transition-colors hover:bg-[color:var(--j-F7F8F9)] active:bg-[color:var(--j-091E420F)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-388BFF)] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 sm:h-9';

/** The real Excel icon (or a spinner while busy). */
export function ExcelIcon({ busy, size = 18 }: { busy?: boolean; size?: number }) {
  return busy
    ? <Loader2 size={size} className="animate-spin text-[color:var(--j-44546F)]" />
    : <span className="relative block flex-shrink-0" style={{ width: size, height: size }}><Image src={assetUrl('assets/xlsx.png')} alt="" fill sizes={`${size}px`} className="object-contain" /></span>;
}

/** "Export Excel" / "Import Excel" text. */
export const excelText = (mode: 'export' | 'import' = 'export') => (mode === 'import' ? tr('Import Excel') : tr('Export Excel'));

export default function ExcelIconButton({ label, onClick, href, loading, disabled, className, mode = 'export', text }: {
  /** kept for older callers; every Excel button now has the same frame */ boxed?: boolean;
  className?: string;
  label?: string;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  disabled?: boolean;
  mode?: 'export' | 'import';
  /** a different text (e.g. "Reading …" while busy) */ text?: string;
}) {
  const body = <><ExcelIcon busy={loading} /><span>{text ?? excelText(mode)}</span></>;
  const title = label ?? excelText(mode);
  if (href) {
    return <a href={href} className={`${excelBtnClass} ${className ?? ''}`} title={title} aria-disabled={disabled || undefined}>{body}</a>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={`${excelBtnClass} ${className ?? ''}`} title={title} aria-busy={loading || undefined}>
      {body}
    </button>
  );
}

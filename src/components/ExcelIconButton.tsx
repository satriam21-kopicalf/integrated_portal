'use client';

// The Excel icon button of the downloads (same look as the export button of Sales Transactions): an icon only, the
// label in the tooltip and for screen readers. A button (onClick, with a spinner while busy) or a plain link (href).

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

const cls = 'inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[3px] transition-colors hover:bg-[color:var(--j-091E420F)] aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50';

const boxedCls = 'inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white transition-colors hover:bg-[color:var(--j-F7F8F9)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-9';

export default function ExcelIconButton({ label, onClick, href, loading, disabled, boxed, className }: {
  /** bordered, for a filter toolbar */ boxed?: boolean;
  className?: string;
  label: string;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const icon = loading
    ? <Loader2 size={18} className="animate-spin text-[color:var(--j-44546F)]" />
    : <span className="relative h-6 w-6"><Image src={assetUrl("assets/xlsx.png")} alt="" fill sizes="24px" className="object-contain" /></span>;
  if (href) {
    return <a href={href} className={cls} title={label} aria-label={label} aria-disabled={disabled || undefined}>{icon}</a>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={`${boxed ? boxedCls : cls} ${className ?? ''}`} title={label} aria-label={label} aria-busy={loading || undefined}>
      {icon}
    </button>
  );
}

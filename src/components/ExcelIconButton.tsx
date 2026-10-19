'use client';

// The Excel icon button of the downloads (same look as the export button of Sales Transactions): an icon only, the
// label in the tooltip and for screen readers. A button (onClick, with a spinner while busy) or a plain link (href).

import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { assetUrl } from '@/lib/assets';

const cls = 'inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 aria-disabled:pointer-events-none aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50';

export default function ExcelIconButton({ label, onClick, href, loading, disabled }: {
  label: string;
  onClick?: () => void;
  href?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const icon = loading
    ? <Loader2 size={18} className="animate-spin text-slate-600" />
    : <span className="relative h-6 w-6"><Image src={assetUrl("assets/xlsx.png")} alt="" fill sizes="24px" className="object-contain" /></span>;
  if (href) {
    return <a href={href} className={cls} title={label} aria-label={label} aria-disabled={disabled || undefined}>{icon}</a>;
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className={cls} title={label} aria-label={label} aria-busy={loading || undefined}>
      {icon}
    </button>
  );
}

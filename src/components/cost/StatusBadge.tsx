'use client';

import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert } from 'lucide-react';
import { STATUS, Status } from '@/lib/costControl';
import { tr } from '@/lib/i18n';

const ICONS = { good: CheckCircle2, warning: CircleAlert, serious: AlertTriangle, critical: OctagonAlert };

/** Status with icon + label (never colour alone). */
export default function StatusBadge({ status, value, title, compact = false }: {
  status: Status | null | undefined;
  value?: string;
  title?: string;
  compact?: boolean;
}) {
  if (!status) return <span className="text-xs text-slate-400" title={title ?? tr('Not enough data')}>{value ?? '–'}</span>;
  const s = STATUS[status];
  const Icon = ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}
      title={title ?? s.label}
    >
      <Icon size={12} aria-hidden />
      {value ?? s.label}
      {compact ? <span className="sr-only">{s.label}</span> : null}
    </span>
  );
}

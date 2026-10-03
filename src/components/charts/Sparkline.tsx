'use client';

/** Tiny trend line (no axes); scales to its container width. */
export default function Sparkline({
  values, color = '#2a78d6', height = 28, className = '', label,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
  label?: string;
}) {
  if (values.length < 2) return <div className={className} style={{ height }} />;
  const max = Math.max(...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const w = 100;
  const pad = 2;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(2)},${(pad + (1 - (v - min) / span) * (height - 2 * pad)).toFixed(2)}`)
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

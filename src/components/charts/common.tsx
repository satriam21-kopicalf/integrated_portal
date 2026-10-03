'use client';

// Legend keys shared by charts and tables: identity comes from the coloured
// mark next to the text, never from coloured text.

export function SeriesKey({ color, shape = 'square' }: { color: string; shape?: 'line' | 'square' | 'dot' }) {
  if (shape === 'line') return <span className="inline-block h-0.5 w-3 flex-shrink-0 rounded-full" style={{ background: color }} />;
  if (shape === 'dot') return <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />;
  return <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: color }} />;
}

export function Legend({ items }: { items: { key: string; label: string; color: string; shape?: 'line' | 'square' }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map(i => (
        <li key={i.key} className="flex items-center gap-1.5">
          <SeriesKey color={i.color} shape={i.shape} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

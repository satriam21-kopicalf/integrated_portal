'use client';

// Building blocks of the guide (Panduan / Guide, content-modules.tsx), for the Indonesian and the English text.

import { AlertTriangle, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

export type Section = { id: string; title: string; body: ReactNode };
export type Part = { key: 'dash' | 'sales' | 'form' | 'cc' | 'ops' | 'cotr' | 'agg' | 'mgmt'; label: string; icon: ReactNode; intro: string; sections: Section[] };

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--j-0C66E4)] text-xs font-semibold text-white">{i + 1}</span>
          <div className="min-w-0 text-sm leading-relaxed text-[color:var(--j-44546F)]">{it}</div>
        </li>
      ))}
    </ol>
  );
}
export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`flex gap-2.5 rounded-[3px] border px-3.5 py-2.5 text-sm ${tone === 'warn' ? 'border-[color:var(--j-F8E6A0)] bg-[color:var(--j-FFF7D6)] text-[color:var(--j-7F5F01)]' : 'border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)]'}`}>
      {tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <Lightbulb size={16} className="mt-0.5 flex-shrink-0" />}
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
      <table className="m-cards w-full min-w-[520px] text-sm">
        <thead className="border-b-2 border-[color:var(--j-DCDFE4)] bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">
          <tr>{head.map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
          {rows.map((r, i) => <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="px-3 py-2 text-[color:var(--j-44546F)]">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
export const Menu = ({ children }: { children: ReactNode }) => <span className="rounded bg-[color:var(--j-091E420F)] px-1.5 py-0.5 font-medium text-[color:var(--j-172B4D)]">{children}</span>;
export const Go = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="font-medium text-[color:var(--j-0C66E4)] hover:underline">{children}</Link>;

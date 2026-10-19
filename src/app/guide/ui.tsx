'use client';

// Building blocks of the guide (Panduan), shared by the Indonesian and English text.

import { AlertTriangle, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

export type Section = { id: string; title: string; body: ReactNode };
export type Part = { key: 'so' | 'cc' | 'admin'; label: string; icon: ReactNode; intro: string; sections: Section[] };

export function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">{i + 1}</span>
          <div className="min-w-0 text-sm leading-relaxed text-slate-700">{it}</div>
        </li>
      ))}
    </ol>
  );
}
export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-100 bg-blue-50/70 text-blue-900'}`}>
      {tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <Lightbulb size={16} className="mt-0.5 flex-shrink-0" />}
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="m-cards w-full min-w-[520px] text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>{head.map(h => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => <tr key={i} className="align-top">{r.map((c, j) => <td key={j} className="px-3 py-2 text-slate-700">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
export const Menu = ({ children }: { children: ReactNode }) => <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-800">{children}</span>;
export const Go = ({ href, children }: { href: string; children: ReactNode }) => <Link href={href} className="font-medium text-blue-700 hover:underline">{children}</Link>;

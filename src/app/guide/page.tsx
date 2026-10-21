'use client';

// Panduan (user guide): how to run stock opname at a branch and how Cost Control uses the portal, for the outlet PIC /
// crew, the Cost Control team and super admins. Indonesian or English as the portal language; the tabs follow the
// pages the user opens. The guide itself is a page super admins can show or hide per role or user (User Accounts).

import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { hasPage, useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { CC_PAGES } from '@/lib/pages';
import * as EN from './content-en';
import * as ID from './content-id';
import type { Part } from './ui';

export default function GuidePage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const text = lang === 'en' ? EN : ID;
  const parts = useMemo(() => {
    const { SO, CC, ADMIN } = lang === 'en' ? EN : ID;
    if (!user) return [SO];
    const out: Part[] = [];
    if (hasPage(user, 'stock-opname')) out.push(SO);
    if (user.role === 'superadmin' || CC_PAGES.some(p => hasPage(user, p))) out.push(CC);
    if (user.role === 'superadmin') out.push(ADMIN);
    return out.length ? out : [SO];
  }, [user, lang]);
  const [tab, setTab] = useState<Part['key']>('so');
  useEffect(() => {
    if (!parts.some(p => p.key === tab)) setTab(parts[0].key);
  }, [parts, tab]);
  const part = parts.find(p => p.key === tab) ?? parts[0];

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="px-4 pt-5 sm:px-6 sm:pt-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl"><BookOpen size={20} /> {text.PAGE.title}</h1>
          <p className="text-xs text-slate-500 sm:text-sm">{text.PAGE.subtitle}</p>
          {parts.length > 1 && (
            <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
              {parts.map(p => (
                <button key={p.key} type="button" role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === p.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          )}
        </header>
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav className="hidden lg:block" aria-label={text.PAGE.toc}>
            <div className="sticky top-4 space-y-1">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{text.PAGE.toc}</p>
              {part.sections.map((s, i) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-white hover:text-slate-900">{i + 1}. {s.title}</a>
              ))}
            </div>
          </nav>
          <div className="min-w-0 space-y-4">
            <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{part.intro}</p>
            {part.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-base font-semibold text-slate-900">{i + 1}. {s.title}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

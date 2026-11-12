'use client';

// Panduan (user guide). Indonesian (2026-11-13): one tab per module of the sidebar — Dashboard, Sales Transactions,
// Form, Cost Control, Operations, Calf On The Road, Aggregator, Management — each menu in detail (content-modules);
// English keeps the earlier guide (stock opname, Cost Control, monitoring, COTR, admin). Indonesian or English as the portal language; the tabs follow the
// pages the user opens. The guide itself is a page super admins can show or hide per role or user (User Accounts).

import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { hasPage, useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { CC_PAGES } from '@/lib/pages';
import * as EN from './content-en';
import * as ID from './content-id';
import { COTR_EN } from './content-cotr';
import { AGG, CCX, COTR, DASH, FORM, MGMT, OPS, SALES } from './content-modules';
import type { Part } from './ui';

export default function GuidePage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const text = lang === 'en' ? EN : ID;
  const parts = useMemo(() => {
    const superadmin = user?.role === 'superadmin';
    const any = (prefix: string) => superadmin || !!user?.pages.some(p => p.startsWith(prefix));
    if (lang !== 'en') {
      // a tab per module, shown with the pages the account opens
      if (!user) return [FORM];
      const out: Part[] = [];
      if (hasPage(user, 'overview')) out.push(DASH);
      if (hasPage(user, 'sales')) out.push(SALES);
      if (hasPage(user, 'stock-opname') || hasPage(user, 'waste') || any('form.')) out.push(FORM);
      if (superadmin || CC_PAGES.some(p => hasPage(user, p))) out.push(CCX);
      if (any('mon.')) out.push(OPS);
      if (any('cotr.')) out.push(COTR);
      if (any('rating.')) out.push(AGG);
      if (superadmin) out.push(MGMT);
      return out.length ? out : [FORM];
    }
    const { SO, CC, MON, ADMIN } = EN;
    if (!user) return [SO];
    const out: Part[] = [];
    if (hasPage(user, 'stock-opname')) out.push(SO);
    if (superadmin || CC_PAGES.some(p => hasPage(user, p))) out.push(CC);
    if (hasPage(user, 'mon.overview') || hasPage(user, 'mon.branch-groups')) out.push(MON);
    // Calf On The Road (2026-11-11): every account opening a COTR page
    if (any('cotr.')) out.push(COTR_EN);
    if (superadmin) out.push(ADMIN);
    return out.length ? out : [SO];
  }, [user, lang]);
  const [tab, setTab] = useState<Part['key']>('so');
  useEffect(() => {
    if (!parts.some(p => p.key === tab)) setTab(parts[0].key);
  }, [parts, tab]);
  const part = parts.find(p => p.key === tab) ?? parts[0];

  return (
    <DashboardLayout>
      <div className="min-h-full bg-neutral-50">
        <header className="px-4 pt-5 sm:px-6 sm:pt-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 sm:text-xl"><BookOpen size={20} /> {text.PAGE.title}</h1>
          <p className="text-xs text-neutral-500 sm:text-sm">{text.PAGE.subtitle}</p>
          {parts.length > 1 && (
            <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
              {parts.map(p => (
                <button key={p.key} type="button" role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === p.key ? 'bg-brand-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          )}
        </header>
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav className="hidden lg:block" aria-label={text.PAGE.toc}>
            <div className="sticky top-4 space-y-1">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{text.PAGE.toc}</p>
              {part.sections.map((s, i) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-white hover:text-neutral-900">{i + 1}. {s.title}</a>
              ))}
            </div>
          </nav>
          <div className="min-w-0 space-y-4">
            <p className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 text-sm text-neutral-700">{part.intro}</p>
            {part.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-4 space-y-3 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="text-base font-semibold text-neutral-900">{i + 1}. {s.title}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

'use client';

// Panduan / Guide (2026-11-13): one tab per module of the sidebar — Dashboard, Sales Transactions, Form, Cost Control,
// Operations, Calf On The Road, Aggregator, Management — each menu in detail, in Indonesian or English as the portal
// language (content-modules: one source, the screen labels through tr()). A tab shows with the pages the account opens;
// the guide itself is a page super admins can show or hide per role or user (User Accounts).

import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { hasPage, useAuth } from '@/lib/auth';
import { useLang } from '@/lib/i18n';
import { CC_PAGES } from '@/lib/pages';
import { type GuideKey, guideParts, PAGE } from './content-modules';
import type { Part } from './ui';

export default function GuidePage() {
  const { user } = useAuth();
  const { lang } = useLang();
  const text = PAGE[lang === 'en' ? 'en' : 'id'];
  const parts = useMemo(() => {
    const all = guideParts(lang === 'en' ? 'en' : 'id');
    if (!user) return [all.form];
    const superadmin = user.role === 'superadmin';
    const any = (prefix: string) => superadmin || user.pages.some(p => p.startsWith(prefix));
    const keys: GuideKey[] = [];
    if (hasPage(user, 'overview')) keys.push('dash');
    if (hasPage(user, 'sales')) keys.push('sales');
    if (hasPage(user, 'stock-opname') || hasPage(user, 'waste') || any('form.')) keys.push('form');
    if (superadmin || CC_PAGES.some(p => hasPage(user, p))) keys.push('cc');
    if (any('mon.')) keys.push('ops');
    if (any('cotr.')) keys.push('cotr');
    if (any('rating.')) keys.push('agg');
    if (superadmin) keys.push('mgmt');
    return (keys.length ? keys : (['form'] as GuideKey[])).map(k => all[k]);
  }, [user, lang]);
  const [tab, setTab] = useState<Part['key']>('dash');
  useEffect(() => {
    if (!parts.some(p => p.key === tab)) setTab(parts[0].key);
  }, [parts, tab]);
  const part = parts.find(p => p.key === tab) ?? parts[0];

  return (
    <DashboardLayout>
      <div className="min-h-full bg-neutral-50">
        <header className="px-4 pt-5 sm:px-6 sm:pt-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-neutral-900 sm:text-xl"><BookOpen size={20} /> {text.title}</h1>
          <p className="text-xs text-neutral-500 sm:text-sm">{text.subtitle}</p>
          {parts.length > 1 && (
            <div className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist">
              {parts.map(p => (
                <button key={p.key} type="button" role="tab" aria-selected={tab === p.key}
                  onClick={(e) => { setTab(p.key); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }}
                  className={`inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === p.key ? 'bg-brand-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                  {p.icon}{p.label}
                </button>
              ))}
            </div>
          )}
        </header>
        <div className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav className="hidden lg:block" aria-label={text.toc}>
            <div className="sticky top-4 space-y-1">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{text.toc}</p>
              {part.sections.map((s, i) => (
                <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-white hover:text-neutral-900">{i + 1}. {s.title}</a>
              ))}
            </div>
          </nav>
          <div className="min-w-0 space-y-4">
            <p className="rounded-xl border border-neutral-200/80 bg-white px-4 py-3 text-sm text-neutral-700">{part.intro}</p>
            {/* phones and tablets: the contents as a menu above the sections */}
            {part.sections.length > 2 && (
              <details className="rounded-xl border border-neutral-200/80 bg-white px-4 py-2.5 text-sm lg:hidden">
                <summary className="cursor-pointer font-medium text-neutral-800">{text.toc} ({part.sections.length})</summary>
                <div className="mt-2 space-y-1">
                  {part.sections.map((s, i) => (
                    <a key={s.id} href={`#${s.id}`} className="block rounded-md py-1 text-neutral-600 hover:text-neutral-900">{i + 1}. {s.title}</a>
                  ))}
                </div>
              </details>
            )}
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

'use client';

// COGS & usage (Cost Control · Analytics): emptied for now (user decision 2026-10-17). Its figures will follow the ones
// built in Outlet ratio (COGS, BB, espresso and usage ratios per outlet from ESB data); the earlier page and its
// components (src/components/cost) stay in the repository for that rebuild.

import Link from 'next/link';
import { ArrowRight, BarChart3, Calculator, Layers, Store } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { tr } from '@/lib/i18n';

export default function CostPage() {
  const points = [
    { icon: Store, title: tr('Per outlet'), text: tr('Gross and net sales, purchases from Warehouse, Central Kitchen and CK Food') },
    { icon: BarChart3, title: tr('Ratios'), text: tr('COGS, BB, espresso and usage ratios with the stock opname of the period') },
    { icon: Layers, title: tr('Trends'), text: tr('Month by month and outlet by outlet, from the same figures as Outlet ratio') },
  ];
  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="px-4 pt-5 sm:px-6 sm:pt-6">
          <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{tr('COGS & usage')}</h1>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{tr('Cost Control · Analytics')}</p>
        </header>
        <div className="p-4 sm:p-6">
          <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Calculator size={26} /></span>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">{tr('Coming soon')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              {tr('This page is being rebuilt. Its figures will follow the ones already in Outlet ratio, so COGS & usage and the outlet ratios always agree.')}
            </p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              {points.map(p => (
                <div key={p.title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p.icon size={18} className="text-slate-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-900">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.text}</p>
                </div>
              ))}
            </div>
            <Link href="/cost-control/ratio"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
              {tr('Open Outlet ratio')} <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

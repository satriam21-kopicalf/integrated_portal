'use client';

// Pages of a feature being built (Waste, Form, Monitoring — 2026-10-18): the menu entries and the access rules are final (pages
// waste, cc.waste-*, form.*, mon.* in lib/pages.ts and integrated_portal_be app/access.py); the screens show the
// planned flow and check the API answers for this user (GET /api/waste/..., /api/forms/..., /api/monitoring/...).

import { CheckCircle2, Construction, ShieldAlert } from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { Page, Panel } from '@/so/ui';
import { tr } from '@/lib/i18n';

export default function FeatureSkeleton({ title, subtitle, endpoint, steps, icon, logo }: {
  title: string; subtitle: string; endpoint: string; steps?: string[]; icon: ReactNode; /** the icon is a brand logo (wide, on white) */ logo?: boolean;
}) {
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  useEffect(() => {
    fetch(endpoint, { credentials: 'same-origin' })
      .then(r => setAccess(r.ok ? 'ok' : 'denied'))
      .catch(() => setAccess('denied'));
  }, [endpoint]);

  return (
    <Page title={title} subtitle={subtitle}>
      <Panel>
        <div className="flex flex-col items-center px-4 py-10 text-center sm:py-14">
          <span className={logo ? "mb-3 flex h-12 items-center justify-center rounded-2xl bg-white px-4 ring-1 ring-slate-200" : "mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"}>{icon}</span>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Construction size={12} /> {tr('Being built')}
          </p>
          <p className="mt-3 max-w-md text-sm text-slate-600">{tr('This page is ready in the menu and in the access settings (User Accounts → Roles & pages). The screens come next.')}</p>
          <ol className="mt-6 w-full max-w-md space-y-2 text-left">
            {(steps ?? []).map((s, i) => (
              <li key={s} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-700">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-slate-500">
            {access === 'ok' ? <><CheckCircle2 size={14} className="text-emerald-600" /> {tr('Your account has access to this page')}</>
              : access === 'denied' ? <><ShieldAlert size={14} className="text-red-600" /> {tr('Your account has no access to this page')}</>
              : tr('Checking access…')}
          </p>
        </div>
      </Panel>
    </Page>
  );
}

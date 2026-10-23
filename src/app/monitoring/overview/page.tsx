"use client";

// Monitoring → Overview (page mon.overview): on hold — "Under Development" (2026-10-23). The overview is the final result
// of the PIC Check In, Monitoring Product and Monitoring Outlet data and is shown again once the SWAT team has audited
// that data. The figures stay available in the three monitoring pages; the API (GET /api/monitoring/overview) is kept.

import { ClipboardCheck, Construction, MapPinCheck, Package, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { Page, Panel } from "@/so/ui";
import { tr } from "@/lib/i18n";

const SOURCES = [
  { href: "/monitoring/pic-check-in", icon: MapPinCheck, get label() { return tr("PIC Check In"); } },
  { href: "/monitoring/product", icon: Package, label: "Monitoring Product" },
  { href: "/monitoring/outlet", icon: Store, label: "Monitoring Outlet" },
];

export default function MonitoringOverviewPage() {
  return (
    <Page title={tr("Monitoring overview")} subtitle={tr("PIC Check In, Monitoring Product and Monitoring Outlet together")}>
      <Panel>
        <div className="flex flex-col items-center px-4 py-12 text-center sm:py-16">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Construction size={26} /></span>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">Under Development</p>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">{tr("The overview is being prepared")}</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
            {tr("The overview is the final result of the data filled in by the PICs. It is shown once the SWAT team has audited the PIC Check In, Monitoring Product and Monitoring Outlet data.")}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-slate-500"><ShieldCheck size={14} className="text-emerald-600" /> {tr("Waiting for the audit of the SWAT team")}</p>
          <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-3">
            {SOURCES.map((s) => (
              <Link key={s.href} href={s.href} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700">
                <s.icon size={16} className="flex-shrink-0 text-slate-400" /><span className="truncate">{s.label}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-400"><ClipboardCheck size={12} /> {tr("The data per form stays available in these monitoring pages.")}</p>
        </div>
      </Panel>
    </Page>
  );
}

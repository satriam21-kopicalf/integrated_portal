"use client";

// Aggregator Insight → Overview (page agg.overview, 2026-11-24): how fresh the BotFood data is, what it holds today,
// and who of the team handles the outlets today. The modules of stage 2 are listed as Coming Soon.

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, Database, LayoutDashboard } from "lucide-react";
import { ErrorState } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { Lozenge } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { MODULES, type Handle, type Status, ago } from "@/aggregator/shared";

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("id-ID"));

export default function AggregatorOverview() {
  const [st, setSt] = useState<Status | null>(null);
  const [h, setH] = useState<Handle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => {
    setErr(null);
    call<Status>("/api/aggregator/status").then((x) => setSt({ ...x, stale: !!x.syncedMedian && Date.now() - new Date(x.syncedMedian).getTime() > 3 * 3600_000 })).catch((e) => setErr(e.message));
    call<Handle>("/api/aggregator/handle").then(setH).catch(() => setH(null));
  };
  useEffect(load, []);

  const handled = h ? h.outlets.filter((o) => Object.values(o.slots).some((a) => a.userId)).length : null;
  const perMember = h ? Object.entries(h.outlets.reduce<Record<string, number>>((m, o) => {
    for (const a of Object.values(o.slots)) if (a.userId && a.name) m[a.name] = (m[a.name] ?? 0) + 1;
    return m;
  }, {})).sort((a, b) => b[1] - a[1]) : [];
  const stale = !!st?.stale;
  const failed = st ? Object.entries(st.pulls).filter(([, p]) => p.error) : [];

  return (
    <Page title={tr("Aggregator Insight")} subtitle={tr("The work and reports of the Aggregator team")} media={<LayoutDashboard size={19} />}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          {st && !st.configured && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {tr("The BotFood connection is not set on the server yet.")}</div>
          )}
          {(stale || failed.length > 0) && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{stale && tr("The BotFood data is more than 3 hours old: check the merchant accounts before acting.")}
                {failed.map(([k, p]) => <span key={k} className="block">{tr("Last {0} pull failed: {1}", k, p.error ?? "")}</span>)}</span></div>
          )}
          <StatStrip columns={4} label={tr("Today")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Outlets open now")} value={st ? <>{n(st.open)} <span className="text-sm font-normal text-neutral-500">/ {n(st.channels)}</span></> : <StatSkeleton />} />
            <Stat label={tr("Items out of stock")} value={st ? n(st.outOfStock) : <StatSkeleton />} />
            <Stat label={tr("Reviews kept")} value={st ? n(st.reviews) : <StatSkeleton />} />
            <Stat label={tr("Outlets handled today")} value={h ? <>{n(handled)} <span className="text-sm font-normal text-neutral-500">/ {n(h.outlets.length)}</span></> : <StatSkeleton />} />
          </StatStrip>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title={tr("Data freshness")} description={tr("BotFood is a signal with its own delay; the official status is the merchant account.")}>
              <dl className="divide-y divide-neutral-100 text-sm">
                {[
                  [tr("Last pull by the portal"), ago(st?.pulls.global?.finishedAt ?? null)],
                  [tr("BotFood read the platforms (median)"), ago(st?.syncedMedian ?? null)],
                  [tr("BotFood read the platforms (oldest)"), ago(st?.syncedOldest ?? null)],
                  [tr("Reviews kept from"), st?.reviewsFrom ? new Date(st.reviewsFrom).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"],
                  [tr("Outlets not matched to ours"), st ? (st.unmapped ? <Lozenge tone="amber">{n(st.unmapped)}</Lozenge> : <Lozenge tone="green">0</Lozenge>) : "—"],
                ].map(([k, v], i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5"><dt className="text-neutral-500">{k}</dt><dd className="text-right font-medium text-neutral-900">{v}</dd></div>
                ))}
              </dl>
            </Panel>
            <Panel title={tr("Handle schedule today")} description={tr("The outlets each member of the team works on today")}
              actions={<Link href="/aggregator-insight/schedule" className="text-sm font-medium text-brand-700 hover:underline">{tr("Open")}</Link>}>
              {!h ? <p className="px-4 py-6 text-sm text-neutral-500">…</p> : perMember.length === 0 ? (
                <Link href="/aggregator-insight/schedule" className="flex items-center gap-3 px-4 py-5 text-sm text-neutral-600 hover:bg-neutral-50">
                  <CalendarDays size={18} className="text-neutral-400" /><span className="flex-1">{tr("No outlet is assigned yet. Set the handle schedule of the team.")}</span><ChevronRight size={15} className="text-neutral-300" />
                </Link>
              ) : (
                <ul className="divide-y divide-neutral-100 text-sm">
                  {perMember.map(([name, c]) => (
                    <li key={name} className="flex items-center justify-between px-4 py-2.5"><span className="font-medium text-neutral-900">{name}</span><span className="text-neutral-500">{tr("{0} outlets", c)}</span></li>
                  ))}
                  {h.outlets.length - (handled ?? 0) > 0 && (
                    <li className="flex items-center justify-between px-4 py-2.5 text-amber-800"><span>{tr("Not handled")}</span><span>{tr("{0} outlets", h.outlets.length - (handled ?? 0))}</span></li>
                  )}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title={tr("Coming next")} description={tr("Built on the BotFood data now kept by the portal")}>
            <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(MODULES).map(([k, m]) => (
                <Link key={k} href={`/aggregator-insight/${k}`} className="flex items-start gap-3 rounded-lg border border-neutral-200 px-3 py-3 hover:bg-neutral-50">
                  <Database size={16} className="mt-0.5 text-neutral-400" />
                  <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-neutral-900">{m.title()} <Lozenge>{tr("Soon")}</Lozenge></span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{m.text()}</span></span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </Page>
  );
}

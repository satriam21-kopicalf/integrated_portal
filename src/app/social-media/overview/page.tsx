"use client";

// Social Media → Overview (page social.analytics). 2026-11-24, the user: "kosongkan terlebih dahulu pada tampilan Social
// Media Overview" — emptied until it is wanted again; the full dashboard (sentiment, channels, keyword tone, media tone,
// word cloud, cities, visibility, trending, drill-downs) is kept in src/social/OverviewFull.tsx, its backend
// /api/social/insights stays live.

import Link from "next/link";
import { BarChart3, ChevronRight, MessageSquareText } from "lucide-react";
import { Page, Panel } from "@/components/kc/compat";
import { tr } from "@/lib/i18n";

export default function SocialOverviewPage() {
  return (
    <Page title={tr("Social Media Overview")} subtitle={tr("Being prepared")} media={<BarChart3 size={19} />}>
      <Panel title={tr("The overview is being prepared")} description={tr("Meanwhile every mention, its sentiment and its reach are in Social Media Analytics.")}>
        <div className="p-4">
          <Link href="/social-media" className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 transition-colors hover:border-brand-200 hover:bg-neutral-50 sm:max-w-md">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><MessageSquareText size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-neutral-900">{tr("Social Media Analytics")}</span>
              <span className="block text-xs text-neutral-500">{tr("Mentions, sentiment & reach")}</span></span>
            <ChevronRight size={15} className="text-neutral-300" />
          </Link>
        </div>
      </Panel>
    </Page>
  );
}

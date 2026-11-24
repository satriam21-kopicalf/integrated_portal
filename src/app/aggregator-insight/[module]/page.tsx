"use client";

// Aggregator Insight: the modules of stage 2 onwards (Opening & Closing, Out of Stock, Reviews, Complaints, Void, Price
// & Menu, Reports), Coming Soon until built (2026-11-24). Page agg.overview.

import { notFound, useParams } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { tr } from "@/lib/i18n";
import { MODULES } from "@/aggregator/shared";

export default function AggregatorModule() {
  const { module } = useParams<{ module: string }>();
  const m = MODULES[module];
  if (!m) notFound();
  return <FeatureSkeleton eyebrow={tr("Aggregator Insight")} title={m.title()} subtitle={m.text()} endpoint="/api/aggregator/status"
    icon={<LayoutDashboard size={20} />} soon={tr("Coming soon: this module is built on the BotFood data the portal now keeps every hour.")} />;
}

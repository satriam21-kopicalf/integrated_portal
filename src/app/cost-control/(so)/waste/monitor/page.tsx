"use client";

// Waste monitor (Cost Control, page cc.waste-monitor): which branches entered their waste, totals per branch and
// reason. Skeleton for now (components/FeatureSkeleton.tsx).

import { Activity } from "lucide-react";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { tr } from "@/lib/i18n";

export default function WasteMonitorPage() {
  return (
    <FeatureSkeleton title={tr("Waste monitor")} subtitle={tr("Waste entered by every branch")} endpoint="/api/waste/monitor"
      icon={<Activity size={22} />}
      steps={[
        tr("See which branches entered their waste today"),
        tr("Totals per branch, item and reason"),
        tr("Open a branch to see its entries and photos"),
      ]} />
  );
}

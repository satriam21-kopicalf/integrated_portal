"use client";

// Waste monitor (Cost Control, page cc.waste-monitor): which branches entered their waste, totals per branch and
// reason. Skeleton for now (so/features/waste/WasteSkeleton.tsx).

import { Activity } from "lucide-react";
import WasteSkeleton from "@/so/features/waste/WasteSkeleton";
import { tr } from "@/lib/i18n";

export default function WasteMonitorPage() {
  return (
    <WasteSkeleton title={tr("Waste monitor")} subtitle={tr("Waste entered by every branch")} endpoint="/api/waste/monitor"
      icon={<Activity size={22} />}
      steps={[
        tr("See which branches entered their waste today"),
        tr("Totals per branch, item and reason"),
        tr("Open a branch to see its entries and photos"),
      ]} />
  );
}

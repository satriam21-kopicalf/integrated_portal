"use client";

// Waste review (Cost Control, page cc.waste-review): approve the waste of a branch or send it back. Skeleton for now
// (components/FeatureSkeleton.tsx).

import { ClipboardList } from "lucide-react";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { tr } from "@/lib/i18n";

export default function WasteReviewPage() {
  return (
    <FeatureSkeleton title={tr("Waste review")} subtitle={tr("Approve the waste of the branches or send it back")} endpoint="/api/waste/reviews"
      icon={<ClipboardList size={22} />}
      steps={[
        tr("Waste submitted by the branches waits here"),
        tr("Check the quantities, reasons and photos"),
        tr("Approve, or send it back to the branch with a note"),
      ]} />
  );
}

"use client";

// Waste (outlet input, page "waste"): the outlet enters every waste of its branch; Cost Control reviews it.
// Skeleton for now (so/features/waste/WasteSkeleton.tsx).

import { Trash2 } from "lucide-react";
import WasteSkeleton from "@/so/features/waste/WasteSkeleton";
import { tr } from "@/lib/i18n";

export default function WastePage() {
  return (
    <WasteSkeleton title={tr("Waste")} subtitle={tr("Enter the waste of your branch")} endpoint="/api/waste/entries"
      icon={<Trash2 size={22} />}
      steps={[
        tr("Pick the branch and the day"),
        tr("Enter each wasted item: quantity, unit and reason, with a photo"),
        tr("Submit: Cost Control reviews the waste of the day"),
      ]} />
  );
}

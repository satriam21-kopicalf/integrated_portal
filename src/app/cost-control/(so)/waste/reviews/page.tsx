"use client";

// Waste review (Cost Control, page cc.waste-review): approve or reject the waste the branches entered
// (src/so/features/waste/WasteMonitor.tsx).

import WasteMonitor from "@/so/features/waste/WasteMonitor";

export default function WasteReviewPage() {
  return <WasteMonitor mode="review" />;
}

"use client";

// Form → Procurement (2026-11-16): heavy tools, tools, decoration and merchandise to buy for the outlet. Same page access
// as Maintenance (form.damaged-equipment). See so/features/de/DeForm.

import DeForm from "@/so/features/de/DeForm";

export default function Page() {
  return <DeForm kind="PROCUREMENT" />;
}

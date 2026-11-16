"use client";

// Form → Maintenance (page form.damaged-equipment; 2026-11-16: Maintenance and Procurement are two forms). See
// so/features/de/DeForm.

import DeForm from "@/so/features/de/DeForm";

export default function Page() {
  return <DeForm kind="REPAIR" />;
}

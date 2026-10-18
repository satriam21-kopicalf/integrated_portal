"use client";

// Monitoring of the forms (pages mon.pic-check-in, mon.outlet, mon.product, mon.tools). Skeleton for now.

import { notFound, useParams } from "next/navigation";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { FORMS, isFormKey } from "@/so/features/monitoring/forms";

export default function MonitoringPage() {
  const { form } = useParams<{ form: string }>();
  if (!isFormKey(form)) notFound();
  const f = FORMS[form];
  return <FeatureSkeleton title={f.title()} subtitle={f.monitoring.subtitle()} endpoint={`/api/monitoring/${form}`} icon={f.icon} steps={f.monitoring.steps()} />;
}

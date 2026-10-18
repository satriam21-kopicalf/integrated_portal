"use client";

// Form of the outlets / PICs (pages form.pic-check-in, form.outlet, form.product, form.tools). Skeleton for now.

import { notFound, useParams } from "next/navigation";
import FeatureSkeleton from "@/components/FeatureSkeleton";
import { FORMS, isFormKey } from "@/so/features/monitoring/forms";

export default function FormPage() {
  const { form } = useParams<{ form: string }>();
  if (!isFormKey(form)) notFound();
  const f = FORMS[form];
  return <FeatureSkeleton title={f.title()} subtitle={f.form.subtitle()} endpoint={`/api/forms/${form}`} icon={f.icon} steps={f.form.steps()} />;
}

"use client";

// The Travel Path form is filled in Operations only (page form.travel): the portal points there.

import { ExternalLink } from "lucide-react";
import { Page } from "@/so/ui";
import { tr } from "@/lib/i18n";

export default function TravelFormPage() {
  return (
    <Page title="Travel Path" subtitle={tr("Filled by the outlets in Operations")}>
      <a href="https://operations.kopicalf.co.id/forms/travel" className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"><ExternalLink size={15} /> {tr("Open in Operations")}</a>
    </Page>
  );
}

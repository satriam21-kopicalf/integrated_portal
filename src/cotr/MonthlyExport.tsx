"use client";

// The month of Calf On The Road in one Excel file (recommendation #12): Product, Report Armada, batch codes, waste &
// cupping, fleet issues and the reconciliation, for finance and the owners.

import { downloadFile } from "@/lib/download-progress";
import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Button, Input, useToast } from "@/so/ui";
import { tr } from "@/lib/i18n";

const thisMonth = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);

export function MonthlyExport({ pool }: { pool?: string }) {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth());
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await downloadFile(`Ringkasan COTR ${month}.xlsx`,
        (signal) => fetch(`/api/cotr/monthly-workbook?month=${month}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`, { credentials: "same-origin", signal }),
        async (res) => (await res.json().catch(() => ({})))?.detail ?? `Excel (${res.status})`);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-2">
      <Input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={tr("Month")} className="h-9 w-40" />
      <Button size="sm" variant="secondary" loading={busy} onClick={() => void download()} title={tr("Product, Report Armada, batch codes, waste, fleet issues and reconciliation in one file")}>
        <FileSpreadsheet size={14} /> {tr("Monthly summary")}</Button>
    </div>
  );
}

"use client";

// The Excel download with several sheets, a Summary first (Aggregator Insight, Fund Request, Travel Path).

export { daysAgo } from "./time";

export type Sheet = { sheet: string; title?: string; header: string[]; rows: (string | number | null)[][] };

/** An Excel file with several sheets (Summary first): integrated_portal_be POST /api/xlsx {sheets}. */
export async function downloadSheets(fileName: string, sheets: Sheet[]): Promise<void> {
  const res = await fetch("/api/xlsx", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName, sheets: sheets.map((s) => ({ ...s, sheet: s.sheet.slice(0, 31) })) }),
  });
  if (!res.ok) throw new Error(`Excel (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

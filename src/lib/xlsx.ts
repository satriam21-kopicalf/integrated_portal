// A table a page shows, downloaded as an Excel file (integrated_portal_be POST /api/xlsx, 2026-10-30): the CSV
// downloads became Excel, as every other export. Numbers stay numbers; the file has a title, the download time and a
// bold frozen header.

import { downloadFile } from "@/lib/download-progress";

export type XlsxCell = string | number | null | undefined;

export async function downloadXlsx({ fileName, sheet, title, header, rows }: {
  fileName: string; sheet: string; title?: string; header: string[]; rows: XlsxCell[][];
}): Promise<void> {
  await downloadFile(`${fileName}.xlsx`, (signal) => fetch("/api/xlsx", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, signal,
    body: JSON.stringify({ fileName, sheet: sheet.slice(0, 31), title, header, rows: rows.map((r) => r.map((v) => (v === undefined ? null : v))) }),
  }), async (res) => `Excel (${res.status})`);
}

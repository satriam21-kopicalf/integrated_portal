// A table a page shows, downloaded as an Excel file (integrated_portal_be POST /api/xlsx, 2026-10-30): the CSV
// downloads became Excel, as every other export. Numbers stay numbers; the file has a title, the download time and a
// bold frozen header.

export type XlsxCell = string | number | null | undefined;

export async function downloadXlsx({ fileName, sheet, title, header, rows }: {
  fileName: string; sheet: string; title?: string; header: string[]; rows: XlsxCell[][];
}): Promise<void> {
  const res = await fetch("/api/xlsx", {
    method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ fileName, sheet: sheet.slice(0, 31), title, header, rows: rows.map((r) => r.map((v) => (v === undefined ? null : v))) }),
  });
  if (!res.ok) throw new Error(`Excel (${res.status})`);
  const href = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href, download: `${fileName}.xlsx` }).click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

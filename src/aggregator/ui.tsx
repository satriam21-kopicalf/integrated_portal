"use client";

// Aggregator Insight (2026-11-24): the pieces the report pages share — the period and platform toolbar, and the Excel
// download with a Summary sheet first.

import { Input, cx } from "@/so/ui";
import { tr } from "@/lib/i18n";

export const PLATFORMS = ["GoFood", "GrabFood", "ShopeeFood"] as const;

export const isoDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400_000));
export const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} j ${min % 60} m` : `${min} m`);

export function PeriodBar({ from, to, onFrom, onTo, platform, onPlatform }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; platform: string; onPlatform: (v: string) => void;
}) {
  const quick = [[tr("Today"), 0, 0], [tr("Yesterday"), 1, 1], [tr("7 days"), 6, 0], [tr("30 days"), 29, 0]] as const;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={from} max={to} onChange={(e) => e.target.value && onFrom(e.target.value)} className="h-9 w-auto" aria-label={tr("From")} />
      <span className="text-neutral-400">–</span>
      <Input type="date" value={to} min={from} onChange={(e) => e.target.value && onTo(e.target.value)} className="h-9 w-auto" aria-label={tr("To")} />
      <div className="flex gap-1">
        {quick.map(([label, a, b]) => (
          <button key={label} type="button" onClick={() => { onFrom(daysAgo(a)); onTo(daysAgo(b)); }}
            className={cx("h-8 rounded-md px-2 text-xs font-medium", from === daysAgo(a) && to === daysAgo(b) ? "bg-brand-50 text-brand-800" : "text-neutral-600 hover:bg-neutral-100")}>{label}</button>
        ))}
      </div>
      <select value={platform} onChange={(e) => onPlatform(e.target.value)} className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm" aria-label={tr("Platform")}>
        <option value="">{tr("All platforms")}</option>
        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}

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

"use client";

// The daily side of the waste monitor (integrated_portal_be app/waste.py daily / usage_report, migration 041): every
// branch reports its waste each day (an entry or "no waste today"); the branches not reported on the last day of the
// period, and per branch a cell per day. Usage Management: the quantities the branches filled for the period.

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Empty, ErrorState, SkeletonRows, cx, fmtNumber, theadClass } from "@/so/ui";
import { type Period, dmy } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type DailyData, type UsageRow, fmtQty, usagePhotoUrl } from "./waste";

const query = (period: Period, branch: string) =>
  new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}) });

function useLoad<T>(url: string) {
  const [state, setState] = useState<{ url: string; data?: T; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    call<T>(url).then((data) => live && setState({ url, data })).catch((e: Error) => live && setState({ url, error: e.message }));
    return () => { live = false; };
  }, [url, retry]);
  const current = state?.url === url ? state : null;
  return { data: current?.data, error: current?.error, retry: () => { setState(null); setRetry((n) => n + 1); } };
}

export function DailyReport({ period, branch, onBranch }: { period: Period; branch: string; onBranch: (code: string) => void }) {
  const { data, error, retry } = useLoad<DailyData>(`/api/waste/daily?${query(period, branch)}`);
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <SkeletonRows cols={6} />;
  if (!data.dates.length) return <Empty title={tr("No day of this period has started yet")} />;
  const short = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
  return (
    <div>
      <div className={cx("flex items-start gap-2 border-b border-slate-100 px-4 py-3 text-sm", data.missingLast.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800")}>
        {data.missingLast.length ? <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />}
        <p>
          {data.missingLast.length
            ? <>{tr("{0} branches have not reported their waste for {1}", data.missingLast.length, dmy(data.lastDate!))}: <span className="font-medium">{data.missingLast.map((b) => b.name.replace(/^Kopi Calf /, "")).join(", ")}</span></>
            : tr("Every branch reported its waste for {0}", dmy(data.lastDate!))}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={theadClass}>
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-2">{tr("Branch")}</th>
              <th className="px-2 py-2 text-right">{tr("Reported")}</th>
              <th className="px-2 py-2 text-right">{tr("Usage list")}</th>
              {data.dates.map((d) => <th key={d} className="px-1 py-2 text-center font-medium">{short(d)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...data.branches].sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name)).map((b) => (
              <tr key={b.code} className="hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-4 py-2">
                  <button type="button" onClick={() => onBranch(b.code)} className="text-left text-slate-800 hover:text-blue-600">{b.name}</button>
                </td>
                <td className={cx("px-2 py-2 text-right tabular-nums", b.missing ? "text-amber-700" : "text-slate-600")}>{b.reported}/{b.days.length}</td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600">{b.usageDays}/{b.days.length}</td>
                {b.days.map((c) => (
                  <td key={c.date} className="px-1 py-2 text-center">
                    <span title={c.entries ? tr("{0} waste entries", c.entries) : c.noWaste ? tr("No waste today") : tr("Not reported")}
                      className={cx("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-semibold",
                        c.entries ? "bg-blue-100 text-blue-700" : c.noWaste ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {c.entries ? c.entries : c.noWaste ? "0" : "–"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-slate-500">{tr("Number = waste entries · 0 = no waste today · – = not reported")}</p>
    </div>
  );
}

export function UsageReport({ period, branch }: { period: Period; branch: string }) {
  const { data, error, retry } = useLoad<{ data: UsageRow[] }>(`/api/waste/usage?${query(period, branch)}`);
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data?.data ?? []).filter((r) => !s || r.itemName.toLowerCase().includes(s) || r.branchName.toLowerCase().includes(s));
  }, [data, search]);
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <SkeletonRows cols={5} />;
  return (
    <div>
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <input className="h-9 rounded-lg border border-slate-200 px-3 text-sm sm:max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search item or branch")} />
      </div>
      {!rows.length ? <Empty title={tr("No Usage Management list filled in this period")} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr><th className="px-4 py-2">{tr("Day")}</th><th className="px-4 py-2">{tr("Branch")}</th><th className="px-4 py-2">{tr("Item")}</th>
                <th className="px-4 py-2 text-right">{tr("Quantity")}</th><th className="px-4 py-2">{tr("Category")}</th><th className="px-4 py-2">{tr("Photo")}</th><th className="px-4 py-2">{tr("Filled by")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 1000).map((r) => (
                <tr key={`${r.branchCode}-${r.businessDate}-${r.itemCode}`}>
                  <td className="px-4 py-2 text-slate-600">{dmy(r.businessDate)}</td>
                  <td className="px-4 py-2 text-slate-800">{r.branchName}</td>
                  <td className="px-4 py-2"><span className="text-slate-800">{r.itemName}</span> <span className="text-[11px] text-slate-400">{r.itemCode}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtQty(r.qty)} <span className="text-xs text-slate-500">{r.unit}</span></td>
                  <td className="px-4 py-2 text-xs text-slate-600">{r.category ?? "—"}{r.note && <span className="block text-slate-400">“{r.note}”</span>}</td>
                  <td className="px-4 py-2">{r.hasPhoto ? (
                    <a href={usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode)} alt="" loading="lazy" className="h-10 w-10 rounded-md bg-slate-100 object-cover" />
                    </a>) : <span className="text-xs text-slate-400">—</span>}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{r.by} · {wibDateTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 1000 && <p className="px-4 py-2 text-xs text-slate-500">{tr("{0} of {1} shown", fmtNumber(1000), fmtNumber(rows.length))}</p>}
        </div>
      )}
    </div>
  );
}

"use client";

// The daily side of the waste monitor (integrated_portal_be app/waste.py daily / usage_report, migration 041): every
// branch reports its waste each day (an entry or "no waste today"); the branches not reported on the last day of the
// period, and per branch a cell per day. Only the outlets open in the period (2026-11-06); the summary, a search, a
// status filter and pages of 25 branches. Usage Management: the quantities the branches filled for the period.

import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Empty, ErrorState, PageNav, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import { type Period, dmy } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type DailyData, type UsageRow, fmtQty, usagePhotoUrl } from "./waste";
import { thumb } from "@/lib/assets";

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

type DailyFilter = "" | "missing" | "late" | "full";
const shortName = (n: string) => n.replace(/^Kopi Calf (To Go )?/, "");

export function DailyReport({ period, branch, onBranch }: { period: Period; branch: string; onBranch: (code: string) => void }) {
  const { data, error, retry } = useLoad<DailyData>(`/api/waste/daily?${query(period, branch)}`);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<DailyFilter>("");
  const [allMissing, setAllMissing] = useState(false);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const last = data?.dates.length ? data.dates.length - 1 : -1;
    return [...(data?.branches ?? [])]
      .filter((b) => !s || b.name.toLowerCase().includes(s) || b.code.toLowerCase().includes(s))
      .filter((b) => show === "" || (show === "missing" ? last >= 0 && !b.days[last]?.reported : show === "late" ? b.missing > 0 : b.missing === 0))
      .sort((a, b) => b.missing - a.missing || a.name.localeCompare(b.name));
  }, [data, q, show]);
  const paged = usePaged(rows, q + show + rows.length, 25);
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data) return <SkeletonRows cols={6} />;
  if (!data.dates.length) return <Empty title={tr("No day of this period has started yet")} />;
  const short = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);
  const total = data.branches.length;
  const cells = data.branches.reduce((a, b) => a + b.days.length, 0);
  const reportedCells = data.branches.reduce((a, b) => a + b.reported, 0);
  const full = data.branches.filter((b) => b.missing === 0).length;
  const lastOk = total - data.missingLast.length;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const missing = allMissing ? data.missingLast : data.missingLast.slice(0, 10);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 border-b border-neutral-100 px-4 py-3 sm:grid-cols-4">
        {([
          [tr("Branches Open"), fmtNumber(total), tr("selling in the period")],
          [tr("Reported {0}", short(data.lastDate!)), `${fmtNumber(lastOk)} / ${fmtNumber(total)}`, pct(lastOk, total)],
          [tr("Reporting Rate"), pct(reportedCells, cells), tr("{0} of {1} branch-days", fmtNumber(reportedCells), fmtNumber(cells))],
          [tr("Every Day Reported"), fmtNumber(full), tr("{0} branches with a gap", fmtNumber(total - full))],
        ] as const).map(([k, v, sub]) => (
          <div key={k} className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{k}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">{v}</p>
            <p className="text-[11px] text-neutral-500">{sub}</p>
          </div>
        ))}
      </div>
      {data.missingLast.length > 0 ? (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{tr("{0} branches have not reported their waste for {1}", data.missingLast.length, dmy(data.lastDate!))}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {missing.map((b) => (
                <button key={b.code} type="button" onClick={() => onBranch(b.code)}
                  className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100">{shortName(b.name)}</button>
              ))}
              {data.missingLast.length > 10 && (
                <button type="button" onClick={() => setAllMissing(!allMissing)} className="px-1 text-xs font-medium text-amber-800 underline">
                  {allMissing ? tr("Show less") : tr("+{0} more", data.missingLast.length - 10)}</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 size={16} />{tr("Every branch reported its waste for {0}", dmy(data.lastDate!))}</p>
      )}
      <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input className="h-9 w-full rounded-lg border border-neutral-200 pl-8 pr-3 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search branch")} /></div>
        <div className="flex flex-wrap gap-1 rounded-xl bg-neutral-100 p-1 sm:ml-auto" role="radiogroup" aria-label={tr("Show")}>
          {([["", tr("All")], ["missing", tr("Not reported {0}", short(data.lastDate!))], ["late", tr("With a gap")], ["full", tr("Every day")]] as [DailyFilter, string][]).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={show === v} onClick={() => setShow(v)}
              className={cx("rounded-lg px-2.5 py-1 text-xs font-medium", show === v ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900")}>{l}</button>
          ))}
        </div>
      </div>
      {!rows.length ? <Empty title={tr("No branch matches")} /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="sticky left-0 z-10 min-w-[13rem] bg-neutral-50 py-2 pl-5 pr-3">{tr("Branch")}</th>
                <th className="px-2 py-2 text-right">{tr("Reported")}</th>
                <th className="px-2 py-2 text-right">{tr("Usage List")}</th>
                {data.dates.map((d) => <th key={d} className="px-1 py-2 text-center font-medium">{short(d)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paged.rows.map((b) => (
                <tr key={b.code} className="hover:bg-neutral-50">
                  <td className="sticky left-0 z-10 max-w-[15rem] bg-white py-2 pl-5 pr-3">
                    <button type="button" onClick={() => onBranch(b.code)} className="block max-w-full truncate text-left font-medium text-neutral-800 hover:text-brand-600" title={b.name}>{shortName(b.name)}</button>
                    <span className="block h-1 w-full overflow-hidden rounded-full bg-neutral-100" aria-hidden>
                      <span className={cx("block h-full rounded-full", b.missing ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${b.days.length ? (b.reported / b.days.length) * 100 : 0}%` }} /></span>
                  </td>
                  <td className={cx("whitespace-nowrap px-2 py-2 text-right tabular-nums", b.missing ? "font-medium text-amber-700" : "text-neutral-600")}>{b.reported}/{b.days.length}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-neutral-600">{b.usageDays}/{b.days.length}</td>
                  {b.days.map((c) => (
                    <td key={c.date} className="px-0.5 py-2 text-center">
                      <span title={`${dmy(c.date)} · ${c.entries ? tr("{0} waste entries", c.entries) : c.noWaste ? tr("No waste today") : tr("Not reported")}`}
                        className={cx("inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-semibold",
                          c.entries ? "bg-brand-100 text-brand-700" : c.noWaste ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        {c.entries ? c.entries : c.noWaste ? "0" : "–"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2 text-[11px] text-neutral-500">
        <span className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-brand-100" />{tr("waste entries")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100" />{tr("0 = no waste today")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" />{tr("– = not reported")}</span>
          <span>{tr("{0} branches shown · closed outlets (no sales) left out", fmtNumber(rows.length))}</span>
        </span>
        <PageNav paged={paged} />
      </div>
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
      <div className="flex flex-col gap-2 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <input className="h-9 rounded-lg border border-neutral-200 px-3 text-sm sm:max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search item or branch")} />
      </div>
      {!rows.length ? <Empty title={tr("No Usage Management list filled in this period")} /> : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}>
              <tr><th className="px-4 py-2">{tr("Day")}</th><th className="px-4 py-2">{tr("Branch")}</th><th className="px-4 py-2">{tr("Item")}</th>
                <th className="px-4 py-2 text-right">{tr("Quantity")}</th><th className="px-4 py-2">{tr("Category")}</th><th className="px-4 py-2">{tr("Photo")}</th><th className="px-4 py-2">{tr("Filled by")}</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.slice(0, 1000).map((r) => (
                <tr key={`${r.branchCode}-${r.businessDate}-${r.itemCode}`}>
                  <td className="px-4 py-2 text-neutral-600">{dmy(r.businessDate)}</td>
                  <td className="px-4 py-2 text-neutral-800">{r.branchName}</td>
                  <td className="px-4 py-2"><span className="text-neutral-800">{r.itemName}</span> <span className="text-[11px] text-neutral-400">{r.itemCode}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtQty(r.qty)} <span className="text-xs text-neutral-500">{r.unit}</span></td>
                  <td className="px-4 py-2 text-xs text-neutral-600">{r.category ?? "—"}{r.note && <span className="block text-neutral-400">“{r.note}”</span>}</td>
                  <td className="px-4 py-2">{r.hasPhoto ? (
                    <a href={usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode), 96)} decoding="async" alt="" loading="lazy" className="h-10 w-10 rounded-md bg-neutral-100 object-cover" />
                    </a>) : <span className="text-xs text-neutral-400">—</span>}</td>
                  <td className="px-4 py-2 text-xs text-neutral-500">{r.by} · {wibDateTime(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 1000 && <p className="px-4 py-2 text-xs text-neutral-500">{tr("{0} of {1} shown", fmtNumber(1000), fmtNumber(rows.length))}</p>}
        </div>
      )}
    </div>
  );
}

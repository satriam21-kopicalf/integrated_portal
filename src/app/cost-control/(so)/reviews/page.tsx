"use client";

// Counts to review (PPIC / Cost Control Supervisor, D-36): submitted counts first, any status on demand. The approved
// counts of the period download as one xlsx for every branch (2026-10-15).

import { ClipboardCheck, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Input, Page, Panel, SearchBox, SkeletonRows, fmtDate, fmtDay, theadClass, useToast } from "@/so/ui";
import { ChoiceGroup } from "@/so/ui/FilterControls";
import { api, errorText } from "@/so/lib/api";
import { STATUS, countTypeLabel, ENTRY_SOURCE } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Row = {
  id: string; number: string; facility_code: string; facility_name: string; facility_type: string; count_type: string; business_date: string;
  status: string; entry_source?: string; is_late: boolean; outside_radius: boolean; submitted_at: string | null; started_by_name: string | null; lines: number;
  counted: number; flagged: number;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ReviewsPage() {
  const [to, setTo] = useState(() => iso(new Date(Date.now() + 7 * 3600e3)));
  const [from, setFrom] = useState(() => iso(new Date(Date.now() + 7 * 3600e3 - 6 * 864e5)));
  const [status, setStatus] = useState("SUBMITTED");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  // every branch of the period in one file: approved and exported counts, one sheet per branch
  const downloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/so/count-reports/file?date_from=${from}&date_to=${to}&status=REVIEWED&per_branch=true`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname Report ${from} - ${to}.xlsx` }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setDownloading(false);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      setRows(await api<Row[]>(`/api/so/counts?date_from=${from}&date_to=${to}${status ? `&status=${status}` : ""}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [from, to, status]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || [r.facility_name, r.facility_code, r.number].some((v) => v.toLowerCase().includes(s)));
  }, [rows, search]);

  return (
    <Page title={tr("Review stock opname")} subtitle={tr("Approve submitted counts or ask for a recount")}
      actions={<Button variant="secondary" loading={downloading} onClick={downloadAll}><Download size={16} /> {tr("Download all branches (xlsx)")}</Button>}>
      <Panel toolbar={
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchBox value={search} onChange={setSearch} placeholder={tr("Search facility or count number")} />
            <div className="flex gap-2">
              <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label={tr("From")} className="sm:w-40" />
              <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} aria-label={tr("To")} className="sm:w-40" />
            </div>
          </div>
          <ChoiceGroup label={tr("Status")} value={status} onChange={setStatus}
            choices={[{ value: "SUBMITTED", label: STATUS.SUBMITTED.label() }, { value: "RECOUNT_REQUESTED", label: STATUS.RECOUNT_REQUESTED.label() },
              { value: "IN_PROGRESS", label: STATUS.IN_PROGRESS.label() }, { value: "APPROVED", label: STATUS.APPROVED.label() }, { value: "EXPORTED", label: STATUS.EXPORTED.label() }, { value: "", label: tr("All") }]} />
        </>
      }>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<ClipboardCheck size={28} />} title={tr("No counts in this period")} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {shown.map((r) => (
                <li key={r.id}>
                  <Link href={`/cost-control/reviews/${r.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{r.facility_name}</span>
                      <span className="block truncate text-xs text-slate-500">{countTypeLabel(r.count_type)} · {fmtDay(r.business_date)}</span>
                      {r.flagged > 0 && <span className="mt-1 block text-xs text-amber-700">{tr("{0} lines to check", r.flagged)}</span>}
                    </span>
                    <Badge tone={(STATUS[r.status] ?? STATUS.IN_PROGRESS).tone} dot>{(STATUS[r.status] ?? STATUS.IN_PROGRESS).label()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="px-4 py-2.5">{tr("Facility")}</th>
                    <th className="px-4 py-2.5">{tr("Count")}</th>
                    <th className="px-4 py-2.5">{tr("Status")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Lines")}</th>
                    <th className="px-4 py-2.5">{tr("Evidence")}</th>
                    <th className="px-4 py-2.5">{tr("Submitted")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={6} /> : shown.map((r) => (
                    <tr key={r.id} className="group hover:bg-slate-50/70">
                      <td className="max-w-[18rem] px-4 py-3">
                        <Link href={`/cost-control/reviews/${r.id}`} className="block min-w-0">
                          <span className="block truncate font-medium text-slate-900 group-hover:text-blue-700">{r.facility_name}</span>
                          <span className="block truncate font-mono text-[11px] text-slate-400">{r.number}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{countTypeLabel(r.count_type)}<span className="block text-xs text-slate-400">{fmtDay(r.business_date)}</span></td>
                      <td className="px-4 py-3"><Badge tone={(STATUS[r.status] ?? STATUS.IN_PROGRESS).tone} dot>{(STATUS[r.status] ?? STATUS.IN_PROGRESS).label()}</Badge></td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{r.counted}/{r.lines}
                        {r.flagged > 0 && <span className="block text-xs text-amber-700">{tr("{0} to check", r.flagged)}</span>}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">
                        {r.entry_source && r.entry_source !== "CREW" && <Badge tone="violet">{ENTRY_SOURCE[r.entry_source]?.()}</Badge>}
                        {r.is_late && <Badge tone="amber">{tr("Late")}</Badge>}{r.outside_radius && <Badge tone="amber">{tr("Outside radius")}</Badge>}
                      </div></td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{r.submitted_at ? fmtDate(r.submitted_at) : "—"}
                        {r.started_by_name && <span className="block">{r.started_by_name}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </Page>
  );
}

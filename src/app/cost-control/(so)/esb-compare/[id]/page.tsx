"use client";

// One exported count against its ESB stock opname: per item the platform quantity, ESB actual (must match) and
// ESB system quantity (variance in quantity and value).

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Panel, SearchBox, cx, fmtDay, fmtNumber, theadClass } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel, fmtQty } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { COMPARE } from "@/so/lib/esb";

type Line = { product_id: string; product_code: string; product_name: string; unit: string | null; platform_qty: string | null; esb_actual: string | null;
  esb_system: string | null; status: string; variance_qty?: string; variance_value?: string };
type Result = { count_id: string; number: string; facility_name: string; business_date: string; count_type: string; status: string;
  esb_doc: { doc_num: string; status_name: string } | null; lines: Line[]; mismatches?: number; variance_value?: string };

const LINE: Record<string, { tone: "green" | "red" | "amber" | "slate"; label: () => string }> = {
  MATCH: { tone: "green", label: () => tr("Match") },
  MISMATCH: { tone: "red", label: () => tr("Differs") },
  MISSING_IN_ESB: { tone: "amber", label: () => tr("Not in ESB") },
  ONLY_IN_ESB: { tone: "amber", label: () => tr("Only in ESB") },
};

export default function CompareDetail() {
  const { id } = useParams<{ id: string }>();
  const [r, setR] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try {
      setR(await api<Result>(`/api/so/counts/${id}/compare`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const lines = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (r?.lines ?? []).filter((l) => (!onlyIssues || l.status !== "MATCH" || Number(l.variance_qty ?? 0) !== 0) &&
      (!s || l.product_name.toLowerCase().includes(s) || l.product_code.toLowerCase().includes(s)));
  }, [r, q, onlyIssues]);

  if (error) return <div className="p-4 sm:p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!r) return <div className="flex justify-center p-10 text-slate-400"><Loader2 className="animate-spin" /></div>;
  const st = COMPARE[r.status] ?? COMPARE.NO_ESB_BRANCH;
  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <Link href="/cost-control/esb-compare" className="mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">{r.facility_name}</h1>
            <p className="text-xs text-slate-500 sm:text-sm">{countTypeLabel(r.count_type)} · {fmtDay(r.business_date)} · <span className="font-mono">{r.number}</span>
              {r.esb_doc && <> · ESB <span className="font-mono">{r.esb_doc.doc_num}</span> ({r.esb_doc.status_name})</>}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><Badge tone={st.tone}>{st.label()}</Badge>
              {r.variance_value !== undefined && <Badge>{tr("Variance")} Rp {fmtNumber(Math.round(Number(r.variance_value)))}</Badge>}</div>
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-6">
        {r.status === "WAITING_FOR_ESB" || r.status === "NO_ESB_BRANCH" ? (
          <Panel><p className="px-5 py-10 text-center text-sm text-slate-500">
            {r.status === "WAITING_FOR_ESB" ? tr("ESB has no stock opname for this branch, day and purpose yet. Upload the export file in ESB; the comparison appears after the next ESB sync.")
              : tr("This facility is not linked to an ESB branch.")}</p></Panel>
        ) : (
          <Panel toolbar={
            <div className="flex flex-col gap-2 sm:flex-row">
              <SearchBox value={q} onChange={setQ} placeholder={tr("Search item")} />
              <Button variant={onlyIssues ? "primary" : "secondary"} size="sm" onClick={() => setOnlyIssues((v) => !v)}>{tr("Only differences")}</Button>
            </div>
          }>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className={theadClass}>
                  <tr><th className="px-3 py-2.5">{tr("Item")}</th><th className="px-3 py-2.5">{tr("Unit")}</th><th className="px-3 py-2.5 text-right">{tr("Platform")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("ESB actual")}</th><th className="px-3 py-2.5 text-right">{tr("ESB system")}</th>
                    <th className="px-3 py-2.5 text-right">{tr("Variance")}</th><th className="px-3 py-2.5">{tr("Status")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l) => (
                    <tr key={l.product_id} className={cx(l.status !== "MATCH" && "bg-red-50/30")}>
                      <td className="max-w-[18rem] px-3 py-2.5"><span className="block truncate font-medium text-slate-900">{l.product_name}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{l.product_code}</span></td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{l.unit ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(l.platform_qty) || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmtQty(l.esb_actual) || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtQty(l.esb_system) || "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{l.variance_qty !== undefined ? <>{fmtQty(l.variance_qty)}<span className="block text-[11px] text-slate-400">Rp {fmtNumber(Math.round(Number(l.variance_value)))}</span></> : "—"}</td>
                      <td className="px-3 py-2.5"><Badge tone={(LINE[l.status] ?? LINE.MISMATCH).tone}>{(LINE[l.status] ?? LINE.MISMATCH).label()}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

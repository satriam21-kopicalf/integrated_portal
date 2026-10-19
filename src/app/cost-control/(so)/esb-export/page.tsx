"use client";

// ESB export (06.9 §8): approved counts of one day and count type become one ESB "Stock Opname Template" file. The file
// is kept, so downloading a batch again gives exactly the file that was imported (same SHA-256).

import { Download, FileOutput, FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Input, Page, Panel, Select, SkeletonRows, cx, fmtDate, fmtDay, fmtNumber, theadClass, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Ready = { id: string; number: string; facility_name: string; facility_code: string; lines: number; counted: number; reviewed_at: string | null };
type Batch = { id: string; number: string; business_date: string; count_type: string; counts: number; lines: number; total_value: string | null;
  file_sha256: string; created_at: string; created_by_name: string | null };
const TYPES = ["DAILY_PACKAGING", "WEEKLY_RAW", "MONTHLY_RAW", "ADHOC"];
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

async function download(url: string, name: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(tr("The file could not be downloaded"));
  const href = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href, download: name }).click();
  URL.revokeObjectURL(href);
}

export default function EsbExportPage() {
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [type, setType] = useState("WEEKLY_RAW");
  const [ready, setReady] = useState<Ready[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setReady(null);
    try {
      const [r, b] = await Promise.all([
        api<Ready[]>(`/api/so/count-exports/ready?business_date=${day}&count_type=${type}`),
        api<Batch[]>("/api/so/count-exports"),
      ]);
      setReady(r);
      setPicked(new Set(r.map((x) => x.id)));
      setBatches(b);
    } catch (e) {
      setError(errorText(e));
    }
  }, [day, type]);
  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setBusy(true);
    try {
      const b = await api<Batch>("/api/so/count-exports", { method: "POST", json: { business_date: day, count_type: type, count_ids: Array.from(picked) } });
      await download(`/api/so/count-exports/${b.id}/file`, `${b.number}.xlsx`);
      toast(tr("{0} counts exported", b.counts));
      setConfirm(false);
      void load();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const all = (ready ?? []).length > 0 && (ready ?? []).every((r) => picked.has(r.id));

  return (
    <Page title={tr("ESB export")} subtitle={tr("Approved counts become one import file in the ESB stock opname template")}>
      <Panel title={tr("Ready to export")} toolbar={
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_240px_1fr]">
          <Field label={tr("Day")}><Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /></Field>
          <Field label={tr("Count type")}><Select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t} value={t}>{countTypeLabel(t)}</option>)}</Select></Field>
          <div className="flex items-end justify-end">
            <Button disabled={!picked.size} onClick={() => setConfirm(true)}><FileOutput size={16} /> {tr("Export {0} counts", picked.size)}</Button>
          </div>
        </div>
      }>
        {error ? <ErrorState message={error} onRetry={load} /> : ready && ready.length === 0 ? (
          <Empty icon={<FileSpreadsheet size={28} />} title={tr("Nothing waiting for export")}>{tr("Only approved counts of the chosen day and type are exported.")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="m-cards w-full min-w-[560px] text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className="w-10 px-4 py-2.5"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={all} aria-label={tr("Select all shown")}
                    onChange={() => setPicked(all ? new Set() : new Set((ready ?? []).map((r) => r.id)))} /></th>
                  <th className="px-4 py-2.5">{tr("Facility")}</th><th className="px-4 py-2.5 text-right">{tr("Lines")}</th><th className="px-4 py-2.5">{tr("Approved")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ready === null ? <SkeletonRows cols={4} rows={3} /> : ready.map((r) => (
                  <tr key={r.id} className={cx(picked.has(r.id) && "bg-blue-50/40")}>
                    <td className="px-4 py-3"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={picked.has(r.id)} aria-label={r.facility_name}
                      onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>
                    <td className="px-4 py-3"><span className="block font-medium text-slate-900">{r.facility_name}</span><span className="block font-mono text-[11px] text-slate-400">{r.number}</span></td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.lines}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.reviewed_at ? fmtDate(r.reviewed_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={tr("Export history")} description={tr("Download again any time: the file is exactly the one that was exported.")}>
        {batches && batches.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">{tr("No exports yet")}</p> : (
          <ul className="divide-y divide-slate-100">
            {(batches ?? []).map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><FileSpreadsheet size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{b.number} · {countTypeLabel(b.count_type)} · {fmtDay(b.business_date)}</p>
                  <p className="truncate text-xs text-slate-500">
                    {tr("{0} counts · {1} lines", b.counts, b.lines)}{b.total_value ? ` · Rp ${fmtNumber(Math.round(Number(b.total_value)))}` : ""} · {fmtDate(b.created_at)}{b.created_by_name ? ` · ${b.created_by_name}` : ""}
                  </p>
                  <p className="truncate font-mono text-[10px] text-slate-400" title={b.file_sha256}>SHA-256 {b.file_sha256}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => download(`/api/so/count-exports/${b.id}/file`, `${b.number}.xlsx`).catch((e) => toast(errorText(e), "error"))}>
                  <Download size={14} /> .xlsx
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <ConfirmDialog open={confirm} busy={busy} onClose={() => setConfirm(false)} onConfirm={run}
        title={tr("Export {0} counts to ESB?", picked.size)}
        description={<>{tr("The counts become EXPORTED and the file is downloaded. Upload it in ESB, then check the comparison.")} <Badge>{countTypeLabel(type)}</Badge></>}
        confirmLabel={tr("Export")} />
    </Page>
  );
}

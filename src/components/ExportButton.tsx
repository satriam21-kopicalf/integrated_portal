'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { formatBytes, formatDate, formatDuration, formatNumber } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';

interface ExportButtonProps {
  dateFrom?: string;
  dateTo?: string;
  branch?: string; // branch codes separated by commas
  branchLabel?: string; // display name of the selected branch(es)
  txType?: string; // sales (ESB report) | void | other_cost | all
  typeLabel?: string;
}

// Excel export job state returned by integrated_portal_be (/api/exports)
interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  dateFrom: string;
  dateTo: string;
  totalDays: number;
  daysDone: number;
  currentDate: string | null;
  rows: number;
  headers: number;
  sheets: number;
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
  downloadUrl: string | null;
}

type ReportKind = 'detail' | 'daily';
const REPORTS: { value: ReportKind; label: string; description: string }[] = [
  { value: 'detail', label: 'Sales Recapitulation Detail', description: 'One row per menu item · 46 columns' },
  { value: 'daily', label: 'Daily Sales Recapitulation', description: 'One row per date and branch' },
];

const POLL_INTERVAL_MS = 2000;
const DEFAULT_DAYS = 65; // backend default when no dates are selected
const LARGE_RANGE_DAYS = 31;
const ROWS_PER_DAY_ESTIMATE = 65000;

function rangeDays(dateFrom?: string, dateTo?: string): number {
  if (!dateFrom) return DEFAULT_DAYS + 1;
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const end = dateTo || new Date().toISOString().slice(0, 10);
  return Math.round((toDate(end) - toDate(dateFrom)) / 86_400_000) + 1;
}

function startDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

interface ExportState {
  report: ReportKind;
  job: ExportJob | null;
  startedAt: number;
  error: string | null;
}

export default function ExportButton({
  dateFrom, dateTo, branch, branchLabel = 'All branches', txType = 'sales', typeLabel = 'Sales',
}: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReport, setConfirmReport] = useState<ReportKind | null>(null);
  const [state, setState] = useState<ExportState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setConfirmReport(null);
  }, []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      // the export keeps running on the server; only polling stops
      isMounted.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const running = Boolean(state && !state.error && state.job?.status !== 'done');

  // tick for elapsed/remaining time while running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  const poll = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/exports/${jobId}`, { cache: 'no-store' });
      const job: ExportJob = await res.json();
      if (!res.ok) throw new Error((job as unknown as { error?: string }).error || `HTTP ${res.status}`);
      if (!isMounted.current) return;
      setState(s => (s ? { ...s, job } : s));
      if (job.status === 'done') {
        if (job.rows && job.downloadUrl && job.fileName) startDownload(job.downloadUrl, job.fileName);
        return;
      }
      if (job.status === 'error') return;
      pollTimer.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
    } catch (error) {
      console.error('Export status error:', error);
      // transient network error: keep polling
      if (isMounted.current) pollTimer.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS * 2);
    }
  }, []);

  const runExport = async (report: ReportKind) => {
    closeMenu();
    if (pollTimer.current) clearTimeout(pollTimer.current);
    setState({ report, job: null, startedAt: Date.now(), error: null });
    setNow(Date.now());
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom: dateFrom || null, dateTo: dateTo || null, branch: branch || null, type: txType, report }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || `HTTP ${res.status}`);
      setState(s => (s ? { ...s, job } : s));
      pollTimer.current = setTimeout(() => poll(job.id), POLL_INTERVAL_MS);
    } catch (error) {
      setState(s => (s ? { ...s, error: error instanceof Error ? error.message : 'Unknown error' } : s));
    }
  };

  const requestExport = (report: ReportKind) => {
    if (report === 'detail' && rangeDays(dateFrom, dateTo) > LARGE_RANGE_DAYS) {
      setConfirmReport(report);
      return;
    }
    runExport(report);
  };

  const days = rangeDays(dateFrom, dateTo);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          disabled={running}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          title={running ? 'Export in progress' : 'Export to Excel'}
          aria-label="Export to Excel"
        >
          {running ? (
            <Loader2 size={18} className="animate-spin text-slate-600" />
          ) : (
            <span className="relative h-5 w-5">
              <Image src={assetUrl('assets/xlsx.png')} alt="" fill sizes="20px" className="object-contain" />
            </span>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {confirmReport ? (
              <div className="p-4">
                <div className="flex gap-3">
                  <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Large export</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {days} days{!dateFrom && ' (no date filter, last 65 days)'}
                      {!branch && ` · approx. ${formatNumber(days * ROWS_PER_DAY_ESTIMATE)} rows`}. This can take several minutes; the file is split into multiple sheets above 1,048,575 rows.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmReport(null)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                    Cancel
                  </button>
                  <button type="button" onClick={() => runExport(confirmReport)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-1.5">
                <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Export to Excel</p>
                {REPORTS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => requestExport(r.value)}
                    className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <FileSpreadsheet size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{r.label}</span>
                      <span className="block text-xs text-slate-500">{r.description}</span>
                    </span>
                  </button>
                ))}
                <p className="border-t border-slate-100 px-2.5 pb-1 pt-2 text-[11px] text-slate-400">
                  {typeLabel} · {branchLabel} · {dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : 'Last 65 days'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {state && (
        <ExportProgressPanel
          state={state}
          now={now}
          branchLabel={branchLabel}
          typeLabel={typeLabel}
          onRetry={() => runExport(state.report)}
          onClose={() => {
            if (pollTimer.current) clearTimeout(pollTimer.current);
            setState(null);
          }}
        />
      )}
    </>
  );
}

function ExportProgressPanel({
  state, now, branchLabel, typeLabel, onRetry, onClose,
}: {
  state: ExportState;
  now: number;
  branchLabel: string;
  typeLabel: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { job, error, report } = state;
  const reportLabel = REPORTS.find(r => r.value === report)?.label ?? 'Export';
  const failed = Boolean(error || job?.status === 'error');
  const done = !failed && job?.status === 'done';
  const empty = done && !job?.rows;
  const percent = job ? Math.round((job.daysDone / Math.max(job.totalDays, 1)) * 100) : 0;
  const elapsed = (now - state.startedAt) / 1000;
  const remaining = job && job.daysDone > 0 && !done ? (elapsed / job.daysDone) * (job.totalDays - job.daysDone) : null;

  let statusText = 'Starting export…';
  if (failed) statusText = 'Export failed';
  else if (empty) statusText = 'No data for this selection';
  else if (done) statusText = 'Export complete';
  else if (job?.status === 'queued') statusText = 'Waiting in queue…';
  else if (job?.status === 'running') {
    statusText = job.currentDate
      ? `Processed ${formatDate(job.currentDate)} · day ${job.daysDone} of ${job.totalDays}`
      : `Preparing ${job.totalDays} day${job.totalDays > 1 ? 's' : ''}…`;
  }

  const tone = failed ? 'text-rose-600' : done && !empty ? 'text-emerald-600' : empty ? 'text-amber-600' : 'text-blue-600';
  const Icon = failed ? XCircle : done && !empty ? CheckCircle2 : empty ? AlertTriangle : Loader2;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <FileSpreadsheet size={20} className="text-slate-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{reportLabel}</p>
          <p className="truncate text-xs text-slate-500">
            {typeLabel} · {branchLabel}
            {job ? ` · ${formatDate(job.dateFrom)} – ${formatDate(job.dateTo)}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
          <Icon size={16} className={!failed && !done ? 'animate-spin' : ''} />
          <span className="truncate">{statusText}</span>
          {!failed && !done && <span className="ml-auto tabular-nums text-slate-900">{percent}%</span>}
        </div>

        {!failed && !done && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-blue-600 transition-all duration-500 ${!job || job.status === 'queued' ? 'w-1/4 animate-pulse' : ''}`}
              style={job && job.status !== 'queued' ? { width: `${Math.max(percent, 3)}%` } : undefined}
            />
          </div>
        )}

        {failed && (
          <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error || job?.error || 'Something went wrong.'}</p>
        )}

        {!failed && job && !empty && (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
            <Stat label="Rows" value={formatNumber(job.rows)} />
            <Stat label={report === 'daily' ? 'Bills' : 'Transactions'} value={formatNumber(job.headers)} />
            {done ? (
              <>
                <Stat label="File size" value={formatBytes(job.fileSize)} />
                <Stat label="Sheets" value={formatNumber(job.sheets)} />
              </>
            ) : (
              <>
                <Stat label="Elapsed" value={formatDuration(elapsed)} />
                <Stat label="Remaining" value={remaining === null ? 'Estimating…' : `~${formatDuration(remaining)}`} />
              </>
            )}
          </dl>
        )}

        {empty && <p className="mt-2 text-xs text-slate-500">Try a different date range, branch or transaction type.</p>}

        {(done || failed) && (
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Dismiss
            </button>
            {failed && (
              <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                <RotateCcw size={14} /> Try again
              </button>
            )}
            {done && !empty && job?.downloadUrl && job.fileName && (
              <a
                href={job.downloadUrl}
                download={job.fileName}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Download size={14} /> Download again
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-semibold tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}

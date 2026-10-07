'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FileSpreadsheet, Loader2, RotateCcw, Sheet, X, XCircle } from 'lucide-react';
import { formatBytes, formatDate, formatDuration, formatNumber } from '@/lib/format';
import { REPORTS, TrackedExport, useExports } from '@/lib/exports';

const TYPE_LABELS: Record<string, string> = { sales: 'Sales', void: 'Void & Cancelled', other_cost: 'Other Cost', all: 'All' };

/** Progress cards of the exports being followed, on every page (bottom right). */
export default function ExportToasts() {
  const { exports, retry, dismiss } = useExports();
  const [now, setNow] = useState(() => Date.now());
  const running = exports.some(t => !t.error && t.job?.status !== 'done' && t.job?.status !== 'error');

  // tick for elapsed/remaining time while running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!exports.length) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] flex flex-col gap-2 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96">
      {exports.slice(-3).map(t => (
        <ExportProgressPanel key={t.key} item={t} now={now} onRetry={() => retry(t.key)} onClose={() => dismiss(t.key)} />
      ))}
    </div>
  );
}

function ExportProgressPanel({ item, now, onRetry, onClose }: {
  item: TrackedExport;
  now: number;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { job, error, params } = item;
  const report = params.report;
  const gsheet = (job?.format ?? params.format) === 'gsheet';
  const uploading = job?.phase === 'upload';
  // a detail report to Google Sheets is written and uploaded part by part
  const inParts = gsheet && report !== 'daily';
  const parts = job?.sheetParts ?? [];
  const reportLabel = REPORTS.find(r => r.value === report)?.label ?? 'Export';
  const typeLabel = TYPE_LABELS[params.typeLabel] ?? params.typeLabel;
  const failed = Boolean(error || job?.status === 'error');
  const done = !failed && job?.status === 'done';
  const empty = done && !job?.rows;
  // building the file is the first 85% of a Google Sheets export, the upload the rest
  const buildPct = job ? (job.daysDone / Math.max(job.totalDays, 1)) * 100 : 0;
  const percent = Math.round(inParts ? buildPct * 0.97 : gsheet ? buildPct * 0.85 + (uploading ? (job?.uploadPct ?? 0) * 0.15 : 0) : buildPct);
  const elapsed = Math.max(0, (now - item.startedAt) / 1000);
  const remaining = job && job.daysDone > 0 && !done ? (elapsed / job.daysDone) * (job.totalDays - job.daysDone) : null;

  let statusText = 'Starting export…';
  if (failed) statusText = 'Export failed';
  else if (empty) statusText = 'No data for this selection';
  else if (done) statusText = 'Export complete';
  else if (job?.status === 'queued') statusText = 'Waiting in queue…';
  else if (uploading) statusText = job?.uploadPart ? `Uploading sheet ${job.uploadPart} to Google Sheets…` : 'Uploading to Google Sheets…';
  else if (job?.status === 'running') {
    statusText = job.currentDate
      ? `Processed ${formatDate(job.currentDate)} · day ${job.daysDone} of ${job.totalDays}`
      : `Preparing ${job.totalDays} day${job.totalDays > 1 ? 's' : ''}…`;
  }

  const tone = failed ? 'text-rose-600' : done && !empty ? 'text-emerald-600' : empty ? 'text-amber-600' : 'text-blue-600';
  const Icon = failed ? XCircle : done && !empty ? CheckCircle2 : empty ? AlertTriangle : Loader2;

  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
          {gsheet ? <Sheet size={20} className="text-emerald-600" /> : <FileSpreadsheet size={20} className="text-slate-700" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{reportLabel}{gsheet && <span className="font-normal text-slate-500"> · Google Sheets</span>}</p>
          <p className="truncate text-xs text-slate-500">
            {typeLabel} · {params.branchLabel}
            {job ? ` · ${formatDate(job.dateFrom)} – ${formatDate(job.dateTo)}` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close" title={!failed && !done ? 'Hide (the export keeps running on the server)' : 'Close'}>
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
          <>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-blue-600 transition-all duration-500 ${!job || job.status === 'queued' ? 'w-1/4 animate-pulse' : ''}`}
                style={job && job.status !== 'queued' ? { width: `${Math.max(percent, 3)}%` } : undefined}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {gsheet
                ? (parts.length ? `${parts.length} sheet(s) ready so far — you can keep using other pages.` : 'You can keep using other pages — a link to the sheet appears here when ready.')
                : 'You can keep using other pages — the file downloads automatically when ready.'}
            </p>
          </>
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
                {job.fileSize ? <Stat label="File size" value={formatBytes(job.fileSize)} /> : <Stat label="Google Sheets" value={formatNumber(parts.length || 1)} />}
                <Stat label={parts.length > 1 ? 'Parts' : 'Sheets'} value={formatNumber(job.sheets)} />
              </>
            ) : (
              <>
                <Stat label="Elapsed" value={formatDuration(elapsed)} />
                {uploading
                  ? <Stat label="Uploaded" value={`${job.uploadPct ?? 0}%`} />
                  : <Stat label="Remaining" value={remaining === null ? 'Estimating…' : `~${formatDuration(remaining)}`} />}
              </>
            )}
          </dl>
        )}

        {empty && <p className="mt-2 text-xs text-slate-500">Try a different date range, branch or transaction type.</p>}

        {done && gsheet && parts.length > 1 && (
          <ul className="custom-scrollbar mt-2 max-h-32 space-y-1 overflow-auto rounded-lg border border-slate-100 px-2.5 py-2 text-xs">
            {parts.map(p => (
              <li key={p.part}>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-700 hover:underline">
                  <Sheet size={12} className="flex-shrink-0 text-emerald-600" />
                  <span className="truncate">Part {p.part} · {formatDate(p.dateFrom)}{p.dateTo !== p.dateFrom ? ` – ${formatDate(p.dateTo)}` : ''}</span>
                  <span className="ml-auto flex-shrink-0 tabular-nums text-slate-400">{formatNumber(p.rows)} rows</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {done && gsheet && job?.sheetUrl && (
          <p className="mt-2 text-[11px] text-slate-500">
            {job.sheetLinkAccess === 'view' || job.sheetLinkAccess === 'edit'
              ? `Anyone with the link can ${job.sheetLinkAccess === 'edit' ? 'edit' : 'open'} ${parts.length > 1 ? 'the folder and its sheets' : 'it'} — no access request needed.`
              : job.sheetSharedWith ? `Shared with ${job.sheetSharedWith}.` : 'Saved in the portal\'s Google Drive folder (not shared with your e-mail).'}
          </p>
        )}

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
                className={gsheet
                  ? 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100'
                  : 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800'}
                title={gsheet ? 'The same data as an Excel file' : undefined}
              >
                <Download size={14} /> {gsheet ? '.xlsx' : 'Download again'}
              </a>
            )}
            {done && !empty && gsheet && job?.sheetUrl && (
              <a
                href={job.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <ExternalLink size={14} /> {parts.length > 1 ? 'Open folder' : 'Open sheet'}
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

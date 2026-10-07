'use client';

import { useCallback, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, FileSpreadsheet, Loader2, Sheet } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { ExportFormat, GSHEET_MAX_CELLS, REPORTS, ReportKind, useExports } from '@/lib/exports';
// rows of the detail report that fit in one Google Sheet: larger exports are split into parts
const ROWS_PER_SHEET = Math.floor(GSHEET_MAX_CELLS / 46);
import { formatDate, formatNumber } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';

// The export runs on the server and is followed by ExportsProvider (src/lib/exports.tsx),
// so it keeps going - and downloads (Excel) or links the sheet (Google Sheets) when ready -
// while the user moves to other pages.

interface ExportButtonProps {
  dateFrom?: string;
  dateTo?: string;
  branch?: string; // branch codes separated by commas
  branchLabel?: string; // display name of the selected branch(es)
  txType?: string; // sales (ESB report) | void | other_cost | all
  typeLabel?: string;
}

const DEFAULT_DAYS = 65; // backend default when no dates are selected
const LARGE_RANGE_DAYS = 31;
const ROWS_PER_DAY_ESTIMATE = 65000;
const FORMAT_KEY = 'portal.exportFormat';

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'gsheet', label: 'Google Sheets' },
];

function rangeDays(dateFrom?: string, dateTo?: string): number {
  if (!dateFrom) return DEFAULT_DAYS + 1;
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const end = dateTo || new Date().toISOString().slice(0, 10);
  return Math.round((toDate(end) - toDate(dateFrom)) / 86_400_000) + 1;
}

export default function ExportButton({
  dateFrom, dateTo, branch, branchLabel = 'All branches', txType = 'sales', typeLabel = 'Sales',
}: ExportButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReport, setConfirmReport] = useState<ReportKind | null>(null);
  const [chosenFormat, setChosenFormat] = useState<ExportFormat>(() => {
    try {
      return window.localStorage.getItem(FORMAT_KEY) === 'gsheet' ? 'gsheet' : 'xlsx';
    } catch {
      return 'xlsx';
    }
  });
  const { busy: running, googleSheets, start } = useExports();
  const format: ExportFormat = googleSheets ? chosenFormat : 'xlsx';
  const chooseFormat = (f: ExportFormat) => {
    setChosenFormat(f);
    try {
      window.localStorage.setItem(FORMAT_KEY, f);
    } catch {
      /* remembered for this visit only */
    }
  };
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setConfirmReport(null);
  }, []);
  useClickOutside(menuRef, closeMenu, menuOpen);

  const runExport = (report: ReportKind) => {
    closeMenu();
    start({ dateFrom, dateTo, branch, txType, report, format, branchLabel, typeLabel });
  };

  const requestExport = (report: ReportKind) => {
    if (report === 'detail' && (rangeDays(dateFrom, dateTo) > LARGE_RANGE_DAYS || splitInParts)) {
      setConfirmReport(report);
      return;
    }
    runExport(report);
  };

  const days = rangeDays(dateFrom, dateTo);
  // rough: only all-branch exports can be estimated (about 65k item rows per day)
  const splitInParts = format === 'gsheet' && !branch && days * ROWS_PER_DAY_ESTIMATE > ROWS_PER_SHEET;
  const parts = Math.max(1, Math.ceil((days * ROWS_PER_DAY_ESTIMATE) / 150000));
  const destination = format === 'gsheet' ? 'Google Sheets' : 'Excel';

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          disabled={running}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white transition-colors hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          title={running ? 'Export in progress' : 'Export to Excel or Google Sheets'}
          aria-label="Export"
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
                    <p className="text-sm font-semibold text-slate-900">{splitInParts ? 'Split into several Google Sheets' : 'Large export'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {days} days{!dateFrom && ' (no date filter, last 65 days)'}
                      {!branch && ` · approx. ${formatNumber(days * ROWS_PER_DAY_ESTIMATE)} rows`}.{' '}
                      {splitInParts
                        ? `One Google Sheet holds at most 10 million cells (about ${formatNumber(ROWS_PER_SHEET)} rows of this report), so this export is split into about ${parts} sheets of ~3 days each, together in one Google Drive folder. Each sheet appears as soon as it is ready; anyone with the link can open them. For one single file, export to Excel.`
                        : 'This can take several minutes; the file is split into multiple sheets above 1,048,575 rows.'}
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
                <div role="radiogroup" aria-label="Export format" className="mb-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  {FORMATS.map(f => {
                    const unavailable = f.value === 'gsheet' && !googleSheets;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        role="radio"
                        aria-checked={format === f.value}
                        disabled={unavailable}
                        onClick={() => chooseFormat(f.value)}
                        title={unavailable ? 'Google Sheets is not set up on the server yet' : undefined}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          format === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800 disabled:hover:text-slate-500'}`}
                      >
                        {f.value === 'gsheet' ? <Sheet size={14} className="text-emerald-600" /> : <FileSpreadsheet size={14} className="text-emerald-700" />}
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {!googleSheets && (
                  <p className="px-2.5 pb-1 text-[11px] leading-snug text-slate-400">Google Sheets becomes available once it is set up on the server.</p>
                )}
                <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Export to {destination}</p>
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
                  {format === 'gsheet' && <span className="block pt-0.5">The sheet is shared with your account e-mail.</span>}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

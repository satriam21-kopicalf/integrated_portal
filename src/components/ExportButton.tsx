'use client';

import { useCallback, useRef, useState } from 'react';
import { Popover, PopoverButton } from '@/components/kc/Popover';
import { btn } from '@/components/kc';
import Image from 'next/image';
import { AlertTriangle, FileSpreadsheet, Loader2, Sheet } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { ExportFormat, GSHEET_MAX_CELLS, MENU_MAX_DAYS, REPORTS, ReportKind, useExports } from '@/lib/exports';
// rows of the detail report that fit in one Google Sheet: larger exports are split into parts
const ROWS_PER_SHEET = Math.floor(GSHEET_MAX_CELLS / 46);
import { formatDate, formatNumber } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

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
  { value: 'xlsx', get label() { return tr('Excel (.xlsx)'); } },
  { value: 'gsheet', get label() { return tr('Google Sheets'); } },
];

function rangeDays(dateFrom?: string, dateTo?: string): number {
  if (!dateFrom) return DEFAULT_DAYS + 1;
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const end = dateTo || new Date().toISOString().slice(0, 10);
  return Math.round((toDate(end) - toDate(dateFrom)) / 86_400_000) + 1;
}

export default function ExportButton({
  dateFrom, dateTo, branch, branchLabel = tr('All Branches'), txType = 'sales', typeLabel = tr('Sales'),
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
        <PopoverButton label={tr('Export')} value={running ? tr('Exporting…') : tr('Export')} open={menuOpen} disabled={running}
          title={running ? tr('Export in progress') : tr('Export to Excel or Google Sheets')} onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          icon={running ? <Loader2 className="animate-spin text-neutral-600" /> : <span className="relative block h-[18px] w-[18px]"><Image src={assetUrl('assets/xlsx.png')} alt="" fill sizes="18px" className="object-contain" /></span>} />

        <Popover open={menuOpen} onClose={closeMenu} title={confirmReport ? (splitInParts ? tr('Split into several Google Sheets') : tr('Large export')) : tr('Export')} width="sm:w-[22rem]"
          subtitle={`${typeLabel} · ${branchLabel} · ${dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : tr('Last 65 days')}`}>
            {confirmReport ? (
              <div className="p-4">
                <div className="flex gap-3">
                  <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{splitInParts ? tr('Split into several Google Sheets') : tr('Large export')}</p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {days} {tr('days')}{!dateFrom && tr(' (no date filter, last 65 days)')}
                      {!branch && tr(' · approx. {0} rows', formatNumber(days * ROWS_PER_DAY_ESTIMATE))}.{' '}
                      {splitInParts
                        ? tr('One Google Sheet holds at most 10 million cells (about {0} rows of this report), so this export is split into about {1} sheets of ~3 days each, together in one Google Drive folder. Each sheet appears as soon as it is ready; anyone with the link can open them. For one single file, export to Excel.', formatNumber(ROWS_PER_SHEET), parts)
                        : tr('This can take several minutes; the file is split into multiple sheets above 1,048,575 rows.')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmReport(null)} className={btn('outline')}>
                    {tr('Cancel')}
                  </button>
                  <button type="button" onClick={() => runExport(confirmReport)} className={btn('solid')}>
                    {tr('Continue')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-1.5">
                <div role="radiogroup" aria-label={tr('Export Format')} className="mb-1.5 grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
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
                        title={unavailable ? tr('Google Sheets is not set up on the server yet') : undefined}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          format === f.value ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800 disabled:hover:text-neutral-500'}`}
                      >
                        {f.value === 'gsheet' ? <Sheet size={14} className="text-emerald-600" /> : <FileSpreadsheet size={14} className="text-emerald-700" />}
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                {!googleSheets && (
                  <p className="px-2.5 pb-1 text-[11px] leading-snug text-neutral-400">{tr('Google Sheets becomes available once it is set up on the server.')}</p>
                )}
                <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{tr('Export to')} {destination}</p>
                {REPORTS.map(r => {
                  // one sheet only: the period is capped (one month of every branch ≈ 450k rows)
                  const tooLong = r.value === 'menu' && days > MENU_MAX_DAYS[format];
                  return (
                    <button
                      key={r.value}
                      type="button"
                      disabled={tooLong}
                      onClick={() => requestExport(r.value)}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-3 text-left transition-colors hover:bg-neutral-50 active:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent sm:py-2"
                    >
                      <FileSpreadsheet size={18} className="mt-0.5 flex-shrink-0 text-neutral-400" />
                      <span>
                        <span className="block text-sm font-medium text-neutral-800">{r.label}</span>
                        <span className="block text-xs text-neutral-500">{r.description}</span>
                        {tooLong && <span className="block text-xs text-amber-700">{tr('At most {0} days for {1}: choose a shorter period', MENU_MAX_DAYS[format], destination)}</span>}
                      </span>
                    </button>
                  );
                })}
                <p className="border-t border-neutral-100 px-2.5 pb-1 pt-2 text-[11px] text-neutral-400">
                  {typeLabel} · {branchLabel} · {dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : tr('Last 65 days')}
                  {format === 'gsheet' && <span className="block pt-0.5">{tr('The sheet is shared with your account e-mail.')}</span>}
                </p>
              </div>
            )}
        </Popover>
      </div>
    </>
  );
}

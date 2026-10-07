'use client';

// Excel / Google Sheets exports that keep going while the user moves between pages.
//
// The export itself runs on the server (its own process, independent of the
// browser). This provider sits above every page (src/app/providers.tsx), so its
// polling and the progress card survive navigation; the jobs being followed are
// kept in localStorage per user, so even a reload picks them up again. When an Excel job
// finishes the file downloads automatically (once, also with several tabs open); a Google
// Sheets job shows a link to the sheet (opening a tab without a click is blocked by browsers).

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';

export type ReportKind = 'detail' | 'daily';
export type ExportFormat = 'xlsx' | 'gsheet';
/** Google Sheets holds at most 10 million cells per spreadsheet */
export const GSHEET_MAX_CELLS = 10_000_000;
export const REPORTS: { value: ReportKind; label: string; description: string }[] = [
  { value: 'detail', label: 'Sales Recapitulation Detail', description: 'One row per menu item · 46 columns' },
  { value: 'daily', label: 'Daily Sales Recapitulation', description: 'One row per date and branch' },
];

// Excel export job state returned by integrated_portal_be (/api/exports)
export interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  report?: ReportKind;
  format?: ExportFormat;
  /** "upload" while the file is uploaded to Google Sheets */
  phase?: 'upload' | null;
  uploadPct?: number | null;
  sheetUrl?: string | null;
  /** e-mail the Google Sheet was shared with (null: only the Drive folder has access) */
  sheetSharedWith?: string | null;
  /** anyone with the link can open the sheet(s): view | edit; none/absent = only who it is shared with */
  sheetLinkAccess?: 'view' | 'edit' | 'none' | null;
  /** a detail report too big for one Google Sheet: one sheet per part, all in sheetFolderUrl */
  sheetParts?: { part: number; dateFrom: string; dateTo: string; rows: number; url: string }[];
  sheetFolderUrl?: string | null;
  /** part being uploaded */
  uploadPart?: number | null;
  type?: string;
  branch?: string | null;
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
  createdAt?: string;
  downloadUrl: string | null;
}

export interface ExportParams {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  txType: string;
  report: ReportKind;
  format?: ExportFormat; // xlsx when missing (exports stored before Google Sheets)
  branchLabel: string;
  typeLabel: string;
}

export interface TrackedExport {
  /** local key (the job id once the server answered) */
  key: string;
  params: ExportParams;
  startedAt: number;
  job: ExportJob | null;
  error: string | null;
  downloaded: boolean;
}

interface ExportsState {
  exports: TrackedExport[];
  /** an export is queued or running */
  busy: boolean;
  /** Google Sheets export is configured on the server */
  googleSheets: boolean;
  start: (params: ExportParams) => void;
  retry: (key: string) => void;
  dismiss: (key: string) => void;
}

const ExportsContext = createContext<ExportsState>({
  exports: [], busy: false, googleSheets: false, start: () => {}, retry: () => {}, dismiss: () => {},
});

const POLL_INTERVAL_MS = 2000;
const FORGET_FINISHED_AFTER_MS = 60 * 60 * 1000; // finished jobs are not brought back after an hour
const STORAGE_PREFIX = 'portal.exports.';

type Stored = Pick<TrackedExport, 'key' | 'params' | 'startedAt' | 'downloaded'> & { done?: boolean };

function readStored(userId: string): Stored[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Stored[]) : [];
  } catch {
    return [];
  }
}

function writeStored(userId: string, list: TrackedExport[]) {
  try {
    const stored: Stored[] = list
      .filter(t => t.job) // only jobs the server knows
      .map(t => ({ key: t.key, params: t.params, startedAt: t.startedAt, downloaded: t.downloaded,
        done: t.job?.status === 'done' || t.job?.status === 'error' }));
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(stored));
  } catch {
    /* storage unavailable: the export still runs and downloads in this tab */
  }
}

function startDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const isActive = (t: TrackedExport) => !t.error && t.job?.status !== 'done' && t.job?.status !== 'error';

export function ExportsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [list, setList] = useState<TrackedExport[]>([]);
  const [googleSheets, setGoogleSheets] = useState(false);
  const listRef = useRef(list);
  const loaded = useRef(false);

  useEffect(() => {
    listRef.current = list;
    if (userId && loaded.current) writeStored(userId, list);
  }, [list, userId]);

  // resume what this user was exporting (this tab before a reload, or another tab/device)
  useEffect(() => {
    if (!userId) return;
    const now = Date.now();
    const stored = readStored(userId).filter(s => !s.done || now - s.startedAt < FORGET_FINISHED_AFTER_MS);
    setList(stored.map(s => ({ ...s, job: null, error: null })));
    loaded.current = true;
    let cancelled = false;
    fetch('/api/exports', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : { jobs: [] }))
      .then(({ jobs, googleSheets: sheets }: { jobs: ExportJob[]; googleSheets?: boolean }) => {
        if (cancelled) return;
        setGoogleSheets(Boolean(sheets));
        const running = jobs.filter(j => j.status === 'queued' || j.status === 'running');
        setList(prev => [
          ...prev,
          ...running.filter(j => !prev.some(t => t.key === j.id)).map(j => ({
            key: j.id,
            params: {
              dateFrom: j.dateFrom, dateTo: j.dateTo, branch: j.branch ?? undefined, txType: j.type ?? 'sales',
              report: j.report ?? 'detail', format: j.format ?? 'xlsx', branchLabel: j.branch ? j.branch.split(',').join(', ') : 'All branches',
              typeLabel: j.type ?? 'sales',
            },
            startedAt: j.createdAt ? Date.parse(j.createdAt) : Date.now(),
            job: j, error: null, downloaded: false,
          })),
        ]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const update = useCallback((key: string, patch: Partial<TrackedExport>) => {
    setList(prev => prev.map(t => (t.key === key ? { ...t, ...patch } : t)));
  }, []);

  // poll every followed job until it is done or failed
  const pending = list.some(t => isActive(t) && !t.key.startsWith('new_'));
  useEffect(() => {
    if (!userId || !pending) return;
    const tick = async () => {
      for (const t of listRef.current) {
        if (!isActive(t) || t.key.startsWith('new_')) continue;
        try {
          const res = await fetch(`/api/exports/${t.key}`, { cache: 'no-store' });
          if (res.status === 404) {
            update(t.key, { error: 'Export tidak ditemukan atau sudah kedaluwarsa.' });
            continue;
          }
          if (!res.ok) continue; // transient: try again on the next tick
          const job: ExportJob = await res.json();
          update(t.key, { job });
          if (job.status === 'done' && job.format !== 'gsheet' && job.rows && job.downloadUrl && job.fileName && !t.downloaded) {
            // another tab may already have downloaded it
            const already = readStored(userId).find(s => s.key === t.key)?.downloaded;
            update(t.key, { downloaded: true });
            if (!already) startDownload(job.downloadUrl, job.fileName);
          }
        } catch {
          /* network hiccup: keep polling */
        }
      }
    };
    tick();
    const timer = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, pending, update]);

  const start = useCallback((params: ExportParams) => {
    const temp = `new_${Date.now()}`;
    setList(prev => [...prev, { key: temp, params, startedAt: Date.now(), job: null, error: null, downloaded: false }]);
    fetch('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateFrom: params.dateFrom || null, dateTo: params.dateTo || null, branch: params.branch || null,
        type: params.txType, report: params.report, format: params.format ?? 'xlsx',
      }),
    })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setList(prev => prev.map(t => (t.key === temp ? { ...t, key: body.id, job: body } : t)));
      })
      .catch(error => update(temp, { error: error instanceof Error ? error.message : 'Unknown error' }));
  }, [update]);

  const dismiss = useCallback((key: string) => setList(prev => prev.filter(t => t.key !== key)), []);
  const retry = useCallback((key: string) => {
    const t = listRef.current.find(x => x.key === key);
    if (!t) return;
    dismiss(key);
    start(t.params);
  }, [dismiss, start]);

  const busy = list.some(isActive);
  const value = useMemo(() => ({ exports: list, busy, googleSheets, start, retry, dismiss }), [list, busy, googleSheets, start, retry, dismiss]);
  return <ExportsContext.Provider value={value}>{children}</ExportsContext.Provider>;
}

export function useExports(): ExportsState {
  return useContext(ExportsContext);
}

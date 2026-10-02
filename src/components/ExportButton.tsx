'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { assetUrl } from '@/lib/assets';
import { Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface ExportButtonProps {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
}

// Excel export job state returned by integrated_portal_be (/api/exports)
interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  totalDays: number;
  daysDone: number;
  rows: number;
  headers: number;
  sheets: number;
  fileName: string | null;
  fileSize: number | null;
  error: string | null;
  downloadUrl: string | null;
}

const POLL_INTERVAL_MS = 2000;
const DEFAULT_DAYS = 65; // backend default when no dates are selected
const LARGE_RANGE_DAYS = 31;
const ROWS_PER_DAY_ESTIMATE = 65000;

function rangeDays(dateFrom?: string, dateTo?: string): number {
  const toDate = (s: string) => new Date(`${s}T00:00:00Z`).getTime();
  const today = new Date().toISOString().slice(0, 10);
  if (!dateFrom && !dateTo) return DEFAULT_DAYS + 1;
  if (!dateFrom) return DEFAULT_DAYS + 1;
  return Math.round((toDate(dateTo || today) - toDate(dateFrom)) / 86_400_000) + 1;
}

function formatNumber(value: number) {
  return value.toLocaleString('id-ID');
}

function startDownload(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ExportButton({ dateFrom, dateTo, branch }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'progress'; text: string } | null>(null);
  const [lastDownload, setLastDownload] = useState<{ url: string; fileName: string } | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      // The export keeps running on the server; we only stop polling.
      isMounted.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const finish = (type: 'success' | 'error', text: string) => {
    if (!isMounted.current) return;
    setLoading(false);
    setProgress(null);
    setMessage({ type, text });
    if (type === 'success') setTimeout(() => isMounted.current && setMessage(null), 15000);
  };

  const handleJobUpdate = (job: ExportJob) => {
    if (!isMounted.current) return;

    if (job.status === 'error') {
      finish('error', job.error || 'Export gagal. Silakan coba lagi.');
      return;
    }

    if (job.status === 'done') {
      if (!job.rows || !job.downloadUrl || !job.fileName) {
        finish('error', 'Tidak ada data untuk periode ini');
        return;
      }
      startDownload(job.downloadUrl, job.fileName);
      setLastDownload({ url: job.downloadUrl, fileName: job.fileName });
      const sizeMb = job.fileSize ? ` · ${(job.fileSize / 1_000_000).toFixed(1)} MB` : '';
      const sheets = job.sheets > 1 ? ` · ${job.sheets} sheet` : '';
      finish('success', `Export selesai: ${formatNumber(job.rows)} baris${sizeMb}${sheets}`);
      return;
    }

    setProgress({ current: Math.round((job.daysDone / job.totalDays) * 100), total: job.totalDays });
    setMessage({
      type: 'progress',
      text: job.status === 'queued'
        ? 'Menunggu antrian export...'
        : `Memproses hari ${job.daysDone}/${job.totalDays} · ${formatNumber(job.rows)} baris`,
    });
    pollTimer.current = setTimeout(() => poll(job.id), POLL_INTERVAL_MS);
  };

  const poll = async (jobId: string) => {
    try {
      const res = await fetch(`/api/exports/${jobId}`, { cache: 'no-store' });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || `HTTP ${res.status}`);
      handleJobUpdate(job);
    } catch (error) {
      console.error('Export status error:', error);
      // transient network errors: keep polling
      if (isMounted.current) pollTimer.current = setTimeout(() => poll(jobId), POLL_INTERVAL_MS * 2);
    }
  };

  const handleExport = async () => {
    const days = rangeDays(dateFrom, dateTo);
    if (days > LARGE_RANGE_DAYS) {
      const estimate = branch ? '' : ` (perkiraan ±${formatNumber(days * ROWS_PER_DAY_ESTIMATE)} baris)`;
      const period = dateFrom || dateTo ? `${days} hari` : `${days} hari terakhir (tanpa filter tanggal)`;
      if (!window.confirm(`Export ${period}${estimate}. Proses bisa memakan beberapa menit. Lanjutkan?`)) {
        return;
      }
    }

    setLoading(true);
    setLastDownload(null);
    setProgress({ current: 0, total: days });
    setMessage({ type: 'progress', text: 'Memulai export...' });

    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateFrom: dateFrom || null, dateTo: dateTo || null, branch: branch || null }),
      });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || `HTTP ${res.status}`);
      handleJobUpdate(job);
    } catch (error) {
      console.error('Export error:', error);
      finish('error', error instanceof Error ? `Export gagal: ${error.message}` : 'Export gagal. Silakan coba lagi.');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleExport}
        disabled={loading}
        className="p-2 text-slate-600 hover:text-green-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        title="Export to Excel"
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <div className="w-6 h-6 relative">
            <Image
              src={assetUrl('assets/xlsx.png')}
              alt="Export Excel"
              fill
              sizes="24px"
              className="object-contain"
            />
          </div>
        )}
      </button>

      {/* Progress/Message Toast */}
      {message && (
        <div className={`absolute right-0 top-full mt-2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm whitespace-nowrap min-w-[260px] ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
          ) : message.type === 'error' ? (
            <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          ) : (
            <Loader2 size={18} className="text-blue-600 animate-spin flex-shrink-0" />
          )}
          <div className="flex-1">
            <p>{message.text}</p>
            {message.type === 'success' && lastDownload && (
              <a
                href={lastDownload.url}
                download={lastDownload.fileName}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline"
              >
                <Download size={12} /> Unduh ulang
              </a>
            )}
            {message.type === 'progress' && progress && progress.total > 0 && (
              <div className="mt-1.5">
                <div className="w-full bg-blue-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress.current}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

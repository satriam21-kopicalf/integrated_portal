'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';

interface ExportButtonProps {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
}

export default function ExportButton({ dateFrom, dateTo, branch }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'progress'; text: string } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);
    setProgress(null);

    try {
      // Call export API
      setProgress({ current: 0, total: 0 });
      setMessage({ type: 'progress', text: 'Fetching data...' });

      const res = await fetch('/api/transactions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom,
          dateTo,
          branch,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessage({ type: 'error', text: data.error });
        return;
      }

      if (data.totalRows === 0) {
        setMessage({ type: 'error', text: 'No data to export' });
        return;
      }

      setProgress({ current: 50, total: data.totalRows });
      setMessage({ type: 'progress', text: `Processing ${data.totalRows} rows...` });

      // Generate Excel file
      const XLSX = await import('xlsx');

      setMessage({ type: 'progress', text: 'Generating Excel file...' });

      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['ESB Sales Report'],
        ['Generated', new Date().toLocaleString('id-ID')],
        ['Period', `${data.dateRange?.from || 'N/A'} - ${data.dateRange?.to || 'N/A'}`],
        branch && ['Branch', branch],
        [''],
        ['Summary'],
        ['Total Rows', data.totalRows || 0],
        ['Total Transactions', data.totalHeaders || 0],
        ['Total Items', data.totalItems || 0],
      ].filter(Boolean);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData as (string | number | null)[][]);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Data sheet
      setProgress({ current: 75, total: data.totalRows });
      setMessage({ type: 'progress', text: 'Writing data...' });

      const wsData = XLSX.utils.aoa_to_sheet([data.headers, ...data.data]);
      wsData['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
        { wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
        { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 12 }, { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(wb, wsData, 'Transactions');

      const fromDate = data.dateRange?.from || new Date().toISOString().slice(0, 10);
      const toDate = data.dateRange?.to || new Date().toISOString().slice(0, 10);
      const fileName = `ESB_Sales_${fromDate}_to_${toDate}.xlsx`;

      setProgress({ current: 90, total: data.totalRows });
      XLSX.writeFile(wb, fileName);

      setProgress({ current: 100, total: data.totalRows });
      setMessage({
        type: 'success',
        text: `Exported ${data.totalRows?.toLocaleString() || 0} rows successfully!`
      });

      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setLoading(false);
      setProgress(null);
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
              src="/assets/xlsx.png"
              alt="Export Excel"
              fill
              className="object-contain"
            />
          </div>
        )}
      </button>

      {/* Progress/Message Toast */}
      {message && (
        <div className={`absolute right-0 top-full mt-2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm whitespace-nowrap min-w-[200px] ${
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
            {progress && progress.total > 0 && (
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

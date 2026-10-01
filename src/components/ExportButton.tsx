'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
}

export default function ExportButton({ dateFrom, dateTo, branch }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Call export API
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

      // If data is returned as JSON, convert to XLSX on client
      if (data.data && data.data.length > 0) {
        // Dynamically import xlsx to avoid SSR issues
        const XLSX = await import('xlsx');

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Build summary data array
        const summaryData: (string | number | null)[][] = [
          ['ESB Sales Recapitulation Report'],
          ['PT Yuda Prawira Group'],
          [''],
          ['Generated', new Date().toLocaleString('id-ID')],
          ['Period', `${data.dateRange?.from || 'N/A'} - ${data.dateRange?.to || 'N/A'}`],
        ];

        // Add branch if selected
        if (branch) {
          summaryData.push(['Branch', branch]);
        }

        summaryData.push(
          [''],
          ['Summary'],
          ['Total Rows', data.totalRows || 0],
          ['Total Transactions', data.totalHeaders || 0],
          ['Total Items', data.totalItems || 0]
        );

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Data sheet with headers and data
        const wsData = XLSX.utils.aoa_to_sheet([data.headers, ...data.data]);

        // Set column widths
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

        // Generate filename with date range
        const fromDate = data.dateRange?.from || new Date().toISOString().slice(0, 10);
        const toDate = data.dateRange?.to || new Date().toISOString().slice(0, 10);
        const fileName = `ESB_Sales_${fromDate}_to_${toDate}.xlsx`;

        XLSX.writeFile(wb, fileName);

        setMessage({ type: 'success', text: `Exported ${data.totalRows || 0} rows successfully!` });
      } else {
        setMessage({ type: 'error', text: 'No data to export' });
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: 'Export failed. Please try again.' });
    } finally {
      setLoading(false);
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

      {/* Message Toast */}
      {message && (
        <div className={`absolute right-0 top-full mt-2 z-50 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={16} className="text-green-600" />
          ) : (
            <AlertCircle size={16} className="text-red-600" />
          )}
          {message.text}
        </div>
      )}
    </div>
  );
}

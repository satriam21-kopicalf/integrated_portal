'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export default function ExportButton({ dateFrom, dateTo }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/transactions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateFrom,
          dateTo,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setMessage({ type: 'error', text: data.error });
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary sheet
      const summaryData = [
        ['ESB Sales Recapitulation Report'],
        ['PT Yuda Prawira Group'],
        [''],
        ['Generated', new Date().toLocaleString('id-ID')],
        ['Period', `${data.dateRange?.from || 'N/A'} - ${data.dateRange?.to || 'N/A'}`],
        [''],
        ['Summary'],
        ['Total Rows', data.totalRows || 0],
        ['Total Transactions', data.totalHeaders || 0],
        ['Total Items', data.totalItems || 0],
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Data sheet with headers and data
      if (data.data && data.data.length > 0) {
        const wsData = XLSX.utils.aoa_to_sheet([data.headers, ...data.data]);

        // Set column widths
        wsData['!cols'] = [
          { wch: 20 }, // Sales Number
          { wch: 20 }, // Bill Number
          { wch: 15 }, // Sales Type
          { wch: 12 }, // Batch Order
          { wch: 15 }, // Table Section
          { wch: 20 }, // Table Name
          { wch: 12 }, // Sales Date
          { wch: 20 }, // Sales Date In
          { wch: 20 }, // Sales Date Out
          { wch: 25 }, // Branch
          { wch: 15 }, // Brand
          { wch: 15 }, // City
          { wch: 15 }, // Area
          { wch: 15 }, // Visit Purpose
          { wch: 15 }, // Member Code
          { wch: 20 }, // Member Name
          { wch: 15 }, // Visitor Type
          { wch: 15 }, // Employee Code
          { wch: 20 }, // Employee Name
          { wch: 20 }, // Customer Name
          { wch: 15 }, // Payment Method
          { wch: 15 }, // Subtotal
          { wch: 15 }, // Discount Total
          { wch: 15 }, // Service Charge
          { wch: 15 }, // Tax Total
          { wch: 15 }, // Grand Total
          { wch: 15 }, // Voucher Discount
          { wch: 15 }, // Cash Received
          { wch: 15 }, // Change Given
          { wch: 15 }, // Cashier
          { wch: 12 }, // Status
          { wch: 8 },  // Pax Total
          { wch: 8 },  // Line Number
          { wch: 15 }, // Menu Category
          { wch: 20 }, // Menu Category Detail
          { wch: 25 }, // Menu
          { wch: 15 }, // Menu Code
          { wch: 20 }, // Menu Notes
          { wch: 10 }, // Quantity
          { wch: 12 }, // Unit Price
          { wch: 12 }, // Subtotal Item
          { wch: 12 }, // Discount Item
          { wch: 12 }, // Total Item
          { wch: 20 }, // Order Time
        ];

        XLSX.utils.book_append_sheet(wb, wsData, 'Transactions');
      }

      // Save file
      const fileName = `ESB_Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setMessage({ type: 'success', text: `Exported ${data.totalRows || 0} rows successfully!` });

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
        className="p-2 text-slate-600 hover:text-green-600 hover:bg-slate-100 rounded-lg transition-colors"
        title="Export to Excel"
      >
        {loading ? (
          <Loader2 size={20} className="animate-spin" />
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

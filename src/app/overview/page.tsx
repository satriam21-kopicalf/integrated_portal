'use client';

import DashboardLayout from '@/components/layout/DashboardLayout';

export default function OverviewPage() {
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard Overview</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time analytics and insights for your business</p>
        </div>

        {/* In Development State */}
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            {/* In Development Animation */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-50 border border-amber-200 rounded-full">
              <svg className="w-4 h-4 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-amber-700 font-semibold text-sm">In Development</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

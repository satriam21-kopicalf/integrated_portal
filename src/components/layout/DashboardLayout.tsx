'use client';

import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar - Fixed on mobile, sticky on desktop */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-auto">
        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}

'use client';

import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar - Sticky on desktop, fixed on mobile */}
      <div className="relative lg:sticky lg:top-0 lg:h-screen lg:flex-shrink-0 z-[70]">
        <Sidebar />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header - visible only on mobile */}
        <div className="lg:hidden">
          <Sidebar />
        </div>

        {/* Page Content */}
        <div className="min-h-screen lg:pt-0 pt-16">
          {children}
        </div>
      </main>
    </div>
  );
}

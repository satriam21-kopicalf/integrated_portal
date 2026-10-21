'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Menu } from 'lucide-react';
import Sidebar, { Brand } from './Sidebar';
import TableCards from './TableCards';
import { ToastProvider } from '@/so/ui';
import { canAccess, useAuth } from '@/lib/auth';
import { tr } from '@/lib/i18n';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  // the guide (Panduan): an icon next to the brand of the sidebar, and in the phone row (2026-10-21: no app bar)
  const guide = !!user && canAccess(user, '/guide');

  // close the drawer after navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // lock page scroll + Escape to close while the mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* no app bar (2026-10-21): on phones the menu and the brand open the page and scroll away with it */}
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="flex items-center gap-2 px-3 pt-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
              aria-label={tr('Open menu')}
            >
              <Menu size={20} />
            </button>
            <Brand />
            {guide && (
              <Link href="/guide" title={tr('Guide')} aria-label={tr('Guide')}
                aria-current={pathname === '/guide' ? 'page' : undefined}
                className={`ml-auto rounded-lg p-2 hover:bg-slate-200/60 hover:text-slate-900 ${pathname === '/guide' ? 'bg-slate-200/60 text-slate-900' : 'text-slate-500'}`}>
                <BookOpen size={19} />
              </Link>
            )}
          </div>
          <ToastProvider>{children}</ToastProvider>
        </main>
        <TableCards />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Menu } from 'lucide-react';
import Sidebar, { Brand } from './Sidebar';
import { canAccess, useAuth } from '@/lib/auth';
import { tr } from '@/lib/i18n';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();
  // the guide (Panduan) sits in the header as an icon, not in the sidebar (2026-10-16); page access still applies
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
        {/* Header: menu + brand on phones, the guide icon on every screen */}
        <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 lg:h-11 lg:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label={tr('Open menu')}
          >
            <Menu size={20} />
          </button>
          <div className="lg:hidden"><Brand /></div>
          {guide && (
            <Link href="/guide" title={tr('Guide')} aria-label={tr('Guide')}
              aria-current={pathname === '/guide' ? 'page' : undefined}
              className={`ml-auto rounded-lg p-2 hover:bg-slate-100 hover:text-slate-900 ${pathname === '/guide' ? 'bg-slate-100 text-slate-900' : 'text-slate-500'}`}>
              <BookOpen size={19} />
            </Link>
          )}
        </div>

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

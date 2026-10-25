'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen } from 'lucide-react';
import Sidebar from './Sidebar';
import TableCards from './TableCards';
import BottomNav, { FocusContext } from './BottomNav';
import UserAvatar from '@/components/UserAvatar';
import { BRAND_LINE } from '@/components/BrandWatermark';
import { ToastProvider } from '@/so/ui';
import { assetUrl } from '@/lib/assets';
import { canAccess, useAuth } from '@/lib/auth';
import { PAGES } from '@/lib/pages';
import { tr } from '@/lib/i18n';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // a form being filled hides the phone tab bar (BottomNav.useFocusMode)
  const [focus, setFocus] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const main = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // close the drawer after navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // the app bar gets its line and the page title once the page scrolls
  useEffect(() => {
    const el = main.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 56);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
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
        <main ref={main} className={`min-w-0 flex-1 overflow-auto ${focus ? '' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0'}`}>
          <AppBar pathname={pathname} scrolled={scrolled} onMenu={() => setMobileOpen(true)} />
          <FocusContext.Provider value={setFocus}><ToastProvider>{children}</ToastProvider></FocusContext.Provider>
        </main>
        {!focus && <BottomNav onMenu={() => setMobileOpen(true)} />}
        <TableCards />
      </div>
    </div>
  );
}

/** Phones & tablets: the bar of the app — the brand, then the page title once the page scrolls under it, the guide
 * (Panduan) and the account (opens the menu). Desktop has the sidebar instead. */
function AppBar({ pathname, scrolled, onMenu }: { pathname: string; scrolled: boolean; onMenu: () => void }) {
  const { user } = useAuth();
  const guide = !!user && canAccess(user, '/guide');
  // the most specific page of the path (Cost Control pages sit under /cost-control)
  const page = PAGES.filter((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return (
    <header className={`sticky top-0 z-30 transition-colors duration-200 lg:hidden ${
      scrolled ? 'border-b border-slate-200/70 bg-white/85 backdrop-blur-xl' : 'border-b border-transparent bg-slate-50'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
        <div className="relative h-10 min-w-0 flex-1">
          <div className={`absolute inset-0 flex items-center gap-2.5 transition-all duration-200 ${scrolled && page ? 'pointer-events-none -translate-y-2 opacity-0' : 'opacity-100'}`}>
            <span className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
              <Image src={assetUrl('assets/calf-logo.png')} alt="Kopi Calf" fill sizes="36px" className="object-contain p-1" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[13px] font-extrabold tracking-[0.14em] text-blue-700">PORTAL</span>
              <span className="block truncate text-[11px] font-medium text-slate-500">{BRAND_LINE}</span>
            </span>
          </div>
          {page && (
            <p className={`absolute inset-0 flex items-center truncate text-base font-semibold text-slate-900 transition-all duration-200 ${scrolled ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
              {page.label}
            </p>
          )}
        </div>
        {guide && (
          <Link href="/guide" title={tr('Guide')} aria-label={tr('Guide')} aria-current={pathname === '/guide' ? 'page' : undefined}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full active:bg-slate-200/70 ${pathname === '/guide' ? 'bg-blue-50 text-blue-700' : 'text-slate-500'}`}>
            <BookOpen size={19} />
          </Link>
        )}
        {user && (
          <button type="button" onClick={onMenu} className="relative flex-shrink-0 rounded-full p-0.5 ring-2 ring-white active:opacity-80" aria-label={tr('Open menu')}>
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {!user.profileComplete && <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-maroon-600 ring-2 ring-white" />}
          </button>
        )}
      </div>
    </header>
  );
}

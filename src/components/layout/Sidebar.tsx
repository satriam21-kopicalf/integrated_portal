'use client';

// The sidebar of the portal (design after kopicalf-hrms, 2026-11-02): a light neutral column — the brand, the main
// entries, one entry per module opening its pages in a panel (sidebar/ModulePanel), the account at the foot. Collapsible
// on desktop (remembered), a drawer on phones. The menus are data in sidebar/menu.ts.

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cx } from '@/components/kc';
import { canAccess, inMenu, useAuth } from '@/lib/auth';
import { tr } from '@/lib/i18n';
import { POPUPS, POPUP_ORDER, type MenuSection, navigation, under } from './sidebar/menu';
import ModulePanel from './sidebar/ModulePanel';
import UserMenu from './sidebar/UserMenu';
import { Brand, NavItem, SectionLabel } from './sidebar/parts';

export { Brand } from './sidebar/parts';

const COLLAPSED_KEY = 'portal.sidebar.collapsed';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable: the preference just isn't remembered */
  }
}

const headerButton = 'rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-200/60 hover:text-neutral-700';

export default function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen: boolean; onMobileClose: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // restore the preference after mount (avoids hydration mismatches)
  useEffect(() => { setCollapsed(readFlag(COLLAPSED_KEY, false)); }, []);
  const toggleCollapsed = () => setCollapsed((c) => { writeFlag(COLLAPSED_KEY, !c); return !c; });

  return (
    <>
      {/* desktop */}
      <aside className={cx('hidden h-full flex-shrink-0 border-r border-neutral-200 bg-neutral-50 transition-[width] duration-200 lg:flex', collapsed ? 'w-[64px]' : 'w-60')}>
        <SidebarContent collapsed={collapsed} pathname={pathname}>
          <button type="button" onClick={toggleCollapsed} className={headerButton}
            aria-label={collapsed ? tr('Expand sidebar') : tr('Collapse sidebar')} title={collapsed ? tr('Expand sidebar') : tr('Collapse sidebar')}>
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </SidebarContent>
      </aside>

      {/* phones: a drawer */}
      <div className={cx('fixed inset-0 z-[60] bg-neutral-900/50 transition-opacity duration-200 dark:bg-black/70 lg:hidden', mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onMobileClose} aria-hidden="true" />
      <aside className={cx('fixed inset-y-0 left-0 z-[65] flex w-72 max-w-[85vw] bg-neutral-50 shadow-2xl transition-transform duration-200 lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}
        aria-hidden={!mobileOpen}>
        <SidebarContent collapsed={false} pathname={pathname} onNavigate={onMobileClose}>
          <button type="button" onClick={onMobileClose} className={headerButton} aria-label={tr('Close menu')}><X size={17} /></button>
        </SidebarContent>
      </aside>
    </>
  );
}

function SidebarContent({ collapsed, pathname, onNavigate, children }: {
  collapsed: boolean; pathname: string; onNavigate?: () => void; /** header action (collapse / close) */ children: React.ReactNode;
}) {
  const { user } = useAuth();
  const items = navigation.filter((item) => user && inMenu(user, item.href));
  // the modules with the pages this account opens
  const modules = POPUP_ORDER.map((key) => ({
    key, config: POPUPS[key],
    sections: POPUPS[key].sections
      .map((s): MenuSection => ({ title: s.title, hint: s.hint, icon: s.icon, items: s.items.filter((i) => user && inMenu(user, i.href)) }))
      .filter((s) => s.items.length),
  })).filter((m) => m.sections.length);
  const guide = !!user && canAccess(user, '/guide');

  return (
    <div className="flex h-full w-full flex-col">
      <div className={cx('flex flex-shrink-0 items-center', collapsed ? 'flex-col gap-1 px-2 py-3' : 'h-16 justify-between gap-1.5 px-3')}>
        <Brand compact={collapsed} />
        <div className={cx('flex items-center', collapsed ? 'flex-col gap-1' : 'gap-0.5')}>
          {guide && (
            <Link href="/guide" onClick={onNavigate} title={tr('Guide')} aria-label={tr('Guide')} aria-current={pathname === '/guide' ? 'page' : undefined}
              className={cx(headerButton, pathname === '/guide' && 'bg-white text-brand-700 shadow-sm ring-1 ring-neutral-200')}>
              <BookOpen size={17} />
            </Link>
          )}
          {children}
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4 pt-1" aria-label={tr('Main menu')}>
        {items.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{tr('Main menu')}</SectionLabel>
            <ul className="space-y-0.5">
              {items.map((item) => <li key={item.href}><NavItem item={item} active={under(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} /></li>)}
            </ul>
          </div>
        )}
        {modules.length > 0 && (
          <div>
            <SectionLabel collapsed={collapsed}>{tr('Modules')}</SectionLabel>
            <ul className="space-y-0.5">
              {modules.map((m) => (
                <li key={m.key}><ModulePanel config={m.config} sections={m.sections} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} /></li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <UserMenu collapsed={collapsed} />
    </div>
  );
}

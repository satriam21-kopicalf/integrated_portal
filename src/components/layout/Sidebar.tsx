'use client';

import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity, Blocks, Boxes, Calculator, ChevronDown, ChevronRight, ClipboardCheck, ClipboardList, FileSpreadsheet, GitCompareArrows, ListChecks, Settings2, ChevronsUpDown, History, KeyRound, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Receipt, ShieldCheck, UserCog, UserRoundPen, Users, X,
} from 'lucide-react';
import { useAccountDrawers } from '@/components/AccountDrawers';
import UserAvatar from '@/components/UserAvatar';
import { PreferenceControls } from '@/components/ui/Preferences';
import { assetUrl } from '@/lib/assets';
import { ROLE_LABELS, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

const navigation = [
  { get name() { return tr('Dashboard'); }, href: '/overview', icon: LayoutDashboard, get description() { return tr('Overview & analytics'); }, superadmin: false },
  { get name() { return tr('Sales Transactions'); }, href: '/sales', icon: Receipt, get description() { return tr('View & export data'); }, superadmin: false },
  { get name() { return tr('Stock Opname'); }, href: '/stock-opname', icon: ClipboardCheck, get description() { return tr('Count stock of your branches'); }, superadmin: false },
];

/** "Cost Control" menu: role cost_control and superadmins (stock opname of every branch, COGS); opens as a pop-up list. */
const costControl = [
  { get title() { return tr('Stock opname'); }, items: [
    { get name() { return tr('Monitor'); }, href: '/cost-control/monitor', icon: Activity, get description() { return tr('Counts of every branch today'); } },
    { get name() { return tr('Review'); }, href: '/cost-control/reviews', icon: ClipboardList, get description() { return tr('Approve or ask for a recount'); } },
  ] },
  { get title() { return tr('ESB'); }, items: [
    { get name() { return tr('ESB export'); }, href: '/cost-control/esb-export', icon: FileSpreadsheet, get description() { return tr('Stock opname file for ESB'); } },
    { get name() { return tr('ESB comparison'); }, href: '/cost-control/esb-compare', icon: GitCompareArrows, get description() { return tr('Count vs ESB stock'); } },
  ] },
  { get title() { return tr('Stock opname settings'); }, items: [
    { get name() { return tr('Count lists'); }, href: '/cost-control/lists', icon: ListChecks, get description() { return tr('Items per branch & type'); } },
    { get name() { return tr('Item groups'); }, href: '/cost-control/groups', icon: Boxes, get description() { return tr('Reusable sets of items'); } },
    { get name() { return tr('Count types'); }, href: '/cost-control/types', icon: Settings2, get description() { return tr('Names, schedules & calendar'); } },
  ] },
  { get title() { return tr('Analytics'); }, items: [
    { get name() { return tr('COGS & usage'); }, href: '/cost-control', icon: Calculator, get description() { return tr('COGS, usage & purchasing'); } },
  ] },
];

const under = (pathname: string, href: string) => pathname === href || (href !== '/cost-control' && pathname.startsWith(`${href}/`));

/** "Management" group: superadmin only (the pages and the API check the role too). */
const management = [
  { get name() { return tr('User Accounts'); }, href: '/users', icon: Users, get description() { return tr('Logins, roles & branches'); } },
  { get name() { return tr('Activity Logs'); }, href: '/activity', icon: History, get description() { return tr('Who did what & exports'); } },
];

const platforms = [
  { get name() { return tr('Roastery'); }, href: '#', icon: assetUrl('assets/roastery.png') },
  { get name() { return tr('Central Kitchen'); }, href: '#', icon: assetUrl('assets/ck.png') },
  { get name() { return tr('Warehouse Management System'); }, href: '#', icon: assetUrl('assets/warehouse.png') },
  { get name() { return tr('Operational'); }, href: '#', icon: assetUrl('assets/operational.png') },
  { get name() { return tr('Finance'); }, href: '#', icon: assetUrl('assets/finance.png') },
  { name: 'HRMS', href: '#', icon: assetUrl('assets/hr.png') },
];

const COLLAPSED_KEY = 'portal.sidebar.collapsed';
const PLATFORMS_KEY = 'portal.sidebar.platforms';
const MANAGEMENT_KEY = 'portal.sidebar.management';

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
    /* storage unavailable: preference just isn't remembered */
  }
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(true);
  const [managementOpen, setManagementOpen] = useState(true);

  // restore preferences after mount (avoids hydration mismatches)
  useEffect(() => {
    setCollapsed(readFlag(COLLAPSED_KEY, false));
    setPlatformsOpen(readFlag(PLATFORMS_KEY, true));
    setManagementOpen(readFlag(MANAGEMENT_KEY, true));
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      writeFlag(COLLAPSED_KEY, !c);
      return !c;
    });
  };
  const toggleManagement = () => {
    setManagementOpen(o => {
      writeFlag(MANAGEMENT_KEY, !o);
      return !o;
    });
  };
  const togglePlatforms = () => {
    setPlatformsOpen(o => {
      writeFlag(PLATFORMS_KEY, !o);
      return !o;
    });
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden h-full flex-shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <SidebarContent collapsed={collapsed} pathname={pathname} platformsOpen={platformsOpen} onTogglePlatforms={togglePlatforms}
          managementOpen={managementOpen} onToggleManagement={toggleManagement}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={collapsed ? tr('Expand sidebar') : tr('Collapse sidebar')}
            title={collapsed ? tr('Expand sidebar') : tr('Collapse sidebar')}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </SidebarContent>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] bg-slate-900/50 dark:bg-black/70 transition-opacity duration-200 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-[65] flex w-72 max-w-[85vw] bg-white shadow-2xl transition-transform duration-200 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!mobileOpen}
      >
        <SidebarContent
          collapsed={false}
          pathname={pathname}
          platformsOpen={platformsOpen}
          onTogglePlatforms={togglePlatforms}
          managementOpen={managementOpen}
          onToggleManagement={toggleManagement}
          onNavigate={onMobileClose}
        >
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={tr('Close menu')}
          >
            <X size={18} />
          </button>
        </SidebarContent>
      </aside>
    </>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <Image src={assetUrl('assets/calf-logo.png')} alt={tr('Kopi Calf')} fill sizes="36px" className="object-contain p-0.5" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-bold tracking-wide text-slate-900">{tr('PORTAL')}</p>
          <p className="truncate text-xs text-slate-500">{tr('Integration Platform')}</p>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  collapsed, pathname, platformsOpen, onTogglePlatforms, managementOpen, onToggleManagement, onNavigate, children,
}: {
  collapsed: boolean;
  pathname: string;
  platformsOpen: boolean;
  onTogglePlatforms: () => void;
  managementOpen: boolean;
  onToggleManagement: () => void;
  onNavigate?: () => void;
  children: React.ReactNode; // header action (collapse / close)
}) {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const items = navigation.filter(item => !item.superadmin || isSuperadmin);
  const showCostControl = isSuperadmin || user?.role === 'cost_control';
  // the group stays open while one of its pages is shown
  const managementActive = management.some(m => pathname === m.href);
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className={`flex h-16 flex-shrink-0 items-center border-b border-slate-100 ${collapsed ? 'flex-col justify-center gap-1 px-2 py-2 h-auto' : 'justify-between gap-2 px-4'}`}>
        <Brand compact={collapsed} />
        {children}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr('Main menu')}</p>}
        <ul className="space-y-0.5">
          {items.map(item => (
            <li key={item.href}><NavItem item={item} active={under(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} /></li>
          ))}
        </ul>

        {/* Cost Control: stock opname of every branch + COGS (role cost_control and superadmins), a pop-up menu */}
        {showCostControl && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            {!collapsed && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr('Cost Control')}</p>}
            <CostControlMenu pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        )}

        {/* management: superadmin only */}
        {isSuperadmin && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            {collapsed ? (
              <ul className="space-y-0.5" aria-label={tr('Management')}>
                {management.map(item => (
                  <li key={item.href}><NavItem item={item} active={pathname === item.href} collapsed onNavigate={onNavigate} /></li>
                ))}
              </ul>
            ) : (
              <>
                <GroupToggle label={tr('Management')} icon={<UserCog size={13} />} open={managementOpen || managementActive}
                  onClick={onToggleManagement} />
                {(managementOpen || managementActive) && (
                  <ul className="ml-[1.15rem] space-y-0.5 border-l border-slate-200 pl-2">
                    {management.map(item => (
                      <li key={item.href}><NavItem item={item} active={pathname === item.href} collapsed={false} onNavigate={onNavigate} sub /></li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        {/* platforms: superadmin only */}
        {isSuperadmin && <div className="mt-5 border-t border-slate-100 pt-4">
          {collapsed ? (
            <ul className="space-y-1">
              {platforms.map(p => (
                <li key={p.name}>
                  <Link href={p.href} title={p.name} className="flex justify-center rounded-lg py-2 hover:bg-slate-50">
                    <span className="relative h-5 w-5">
                      <Image src={p.icon} alt={p.name} fill sizes="20px" className="object-contain dark:invert" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <GroupToggle label={tr('Platforms')} icon={<Blocks size={13} />} open={platformsOpen} onClick={onTogglePlatforms} />
              {platformsOpen && (
                <ul className="ml-[1.15rem] space-y-0.5 border-l border-slate-200 pl-2">
                  {platforms.map(p => (
                    <li key={p.name}>
                      <Link
                        href={p.href}
                        onClick={onNavigate}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      >
                        <span className="relative h-4 w-4 flex-shrink-0">
                          <Image src={p.icon} alt="" fill sizes="16px" className="object-contain dark:invert" />
                        </span>
                        <span className="truncate">{p.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>}
      </nav>

      <UserMenu collapsed={collapsed} />
    </div>
  );
}

type NavEntry = { name: string; href: string; icon: typeof Users; description: string };

/** One sidebar entry that opens the Cost Control pages as a pop-up list (beside the sidebar; centred on small screens). */
function CostControlMenu({ pathname, collapsed, onNavigate }: { pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const current = costControl.flatMap(s => s.items).find(i => under(pathname, i.href));
  const active = !!current;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 420;
      if (!r || window.innerWidth < 1024) { setPos(null); return; }
      setPos({ left: r.right + 10, top: Math.max(12, Math.min(r.top - 12, window.innerHeight - h - 12)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, [open]);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus(); }, [open]);

  const go = () => { setOpen(false); onNavigate?.(); };
  const menu = (
    <div ref={panel} role="menu" aria-label={tr('Cost Control')}
      className={`fixed z-[80] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
        pos ? '' : 'left-1/2 top-1/2 max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto'}`}
      style={pos ? { left: pos.left, top: pos.top } : undefined}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Calculator size={16} className="text-slate-500" /> {tr('Cost Control')}</p>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tr('Close menu')}><X size={16} /></button>
      </div>
      <div className="grid gap-x-2 gap-y-3 p-3 sm:grid-cols-2">
        {costControl.map(section => (
          <div key={section.title}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
            <ul>
              {section.items.map(item => {
                const Icon = item.icon;
                const on = under(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={go} role="menuitem" aria-current={on ? 'page' : undefined}
                      className={`flex items-start gap-3 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        on ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={15} strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-sm ${on ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{item.name}</span>
                        <span className="block truncate text-xs text-slate-400">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title={collapsed ? tr('Cost Control') : undefined}
        className={`relative flex w-full items-center gap-3 rounded-lg py-2 text-left text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${
          active || open ? 'bg-slate-100 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-slate-900" />}
        <Calculator size={18} strokeWidth={1.75} className={active ? 'text-slate-900' : 'text-slate-400'} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{current ? current.name : tr('Cost Control')}</span>
              <span className="block truncate text-xs font-normal text-slate-400">{current ? tr('Cost Control') : tr('Stock opname, ESB & COGS')}</span>
            </span>
            <ChevronRight size={15} className="text-slate-400" />
          </>
        )}
      </button>
      {open && createPortal(
        <>
          {!pos && <div className="fixed inset-0 z-[75] bg-slate-900/40 dark:bg-black/60" aria-hidden="true" />}
          {menu}
        </>,
        document.body,
      )}
    </>
  );
}

function NavItem({ item, active, collapsed, onNavigate, sub = false }: {
  item: NavEntry; active: boolean; collapsed: boolean; onNavigate?: () => void; sub?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.name : undefined}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
        collapsed ? 'justify-center px-0' : 'px-2.5'
      } ${active ? 'bg-slate-100 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
    >
      {active && <span className={`absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-slate-900 ${sub ? '-left-[9px]' : 'left-0'}`} />}
      <Icon size={sub ? 16 : 18} strokeWidth={1.75} className={active ? 'text-slate-900' : 'text-slate-400'} />
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate">{item.name}</span>
          <span className="block truncate text-xs font-normal text-slate-400">{item.description}</span>
        </span>
      )}
    </Link>
  );
}

/** Heading of a sidebar group that folds its items away. */
function GroupToggle({ label, icon, open, onClick }: { label: string; icon?: ReactNode; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
      aria-expanded={open}
    >
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const { openProfile, openPassword } = useAccountDrawers();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!user) return null;
  const role = ROLE_LABELS[user.role] ?? user.role;
  const superadmin = user.role === 'superadmin';

  return (
    <div className="flex-shrink-0 border-t border-slate-100 p-3" ref={ref}>
      <div className="relative">
        {open && (
          <div className={`absolute bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ${collapsed ? 'left-0 w-64' : 'inset-x-0'}`}>
            <div className="border-b border-slate-100 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <UserAvatar name={user.displayName} src={user.avatarUrl} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.displayName}</p>
                  <RoleBadge role={role} superadmin={superadmin} />
                </div>
              </div>
              <dl className="mt-2.5 space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-slate-400">{tr('Username')}</dt><dd className="truncate font-medium text-slate-700">{user.username}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">{tr('Email')}</dt><dd className="truncate font-medium text-slate-700">{user.email}</dd></div>
              </dl>
            </div>
            <PreferenceControls />
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => { setOpen(false); openProfile(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <UserRoundPen size={16} /> {tr('My profile')}
                {!user.profileComplete && <span className="ml-auto rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{tr('Incomplete')}</span>}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); openPassword(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <KeyRound size={16} /> {tr('Change password')}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); logout(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> {tr('Sign out')}
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 ${collapsed ? 'justify-center' : ''}`}
          aria-expanded={open}
          title={collapsed ? `${user.displayName} · ${role}` : undefined}
        >
          <span className="relative flex-shrink-0">
            <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm" />
            {!user.profileComplete && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" title={tr('Profile incomplete')} />
            )}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-slate-900">{user.displayName}</span>
                <span className="block truncate text-xs text-slate-400">{role} · {user.username}</span>
              </span>
              <ChevronsUpDown size={15} className="text-slate-400" />
            </>
          )}
        </button>
      </div>
      {!collapsed && <p className="mt-2 text-center text-[11px] text-slate-400">{tr('Integration Platform v1.4.0')}</p>}
    </div>
  );
}

function RoleBadge({ role, superadmin }: { role: string; superadmin: boolean }) {
  return (
    <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      superadmin ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}
    >
      {superadmin && <ShieldCheck size={11} />} {role}
    </span>
  );
}

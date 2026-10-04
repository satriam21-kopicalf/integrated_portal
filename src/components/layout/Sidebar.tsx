'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown, ChevronsUpDown, KeyRound, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Receipt, ShieldCheck, Users, X,
} from 'lucide-react';
import ChangePasswordDialog from '@/components/ChangePasswordDialog';
import { assetUrl } from '@/lib/assets';
import { initials, ROLE_LABELS, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';

const navigation = [
  { name: 'Dashboard', href: '/overview', icon: LayoutDashboard, description: 'Overview & analytics', superadmin: false },
  { name: 'Sales Transactions', href: '/sales', icon: Receipt, description: 'View & export data', superadmin: false },
  { name: 'User Accounts', href: '/users', icon: Users, description: 'Logins & roles', superadmin: true },
];

const platforms = [
  { name: 'Roastery', href: '#', icon: assetUrl('assets/roastery.png') },
  { name: 'Central Kitchen', href: '#', icon: assetUrl('assets/ck.png') },
  { name: 'Warehouse Management System', href: '#', icon: assetUrl('assets/warehouse.png') },
  { name: 'Operational', href: '#', icon: assetUrl('assets/operational.png') },
  { name: 'Finance', href: '#', icon: assetUrl('assets/finance.png') },
  { name: 'HRMS', href: '#', icon: assetUrl('assets/hr.png') },
];

const COLLAPSED_KEY = 'portal.sidebar.collapsed';
const PLATFORMS_KEY = 'portal.sidebar.platforms';

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

  // restore preferences after mount (avoids hydration mismatches)
  useEffect(() => {
    setCollapsed(readFlag(COLLAPSED_KEY, false));
    setPlatformsOpen(readFlag(PLATFORMS_KEY, true));
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      writeFlag(COLLAPSED_KEY, !c);
      return !c;
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
        <SidebarContent collapsed={collapsed} pathname={pathname} platformsOpen={platformsOpen} onTogglePlatforms={togglePlatforms}>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </SidebarContent>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-[60] bg-slate-900/50 transition-opacity duration-200 lg:hidden ${
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
          onNavigate={onMobileClose}
        >
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close menu"
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
        <Image src={assetUrl('assets/calf-logo.png')} alt="Kopi Calf" fill sizes="36px" className="object-contain p-0.5" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-bold tracking-wide text-slate-900">PORTAL</p>
          <p className="truncate text-xs text-slate-500">Integration Platform</p>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  collapsed, pathname, platformsOpen, onTogglePlatforms, onNavigate, children,
}: {
  collapsed: boolean;
  pathname: string;
  platformsOpen: boolean;
  onTogglePlatforms: () => void;
  onNavigate?: () => void;
  children: React.ReactNode; // header action (collapse / close)
}) {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';
  const items = navigation.filter(item => !item.superadmin || isSuperadmin);
  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className={`flex h-16 flex-shrink-0 items-center border-b border-slate-100 ${collapsed ? 'flex-col justify-center gap-1 px-2 py-2 h-auto' : 'justify-between gap-2 px-4'}`}>
        <Brand compact={collapsed} />
        {children}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Main menu</p>}
        <ul className="space-y-0.5">
          {items.map(item => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.name : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
                    collapsed ? 'justify-center px-0' : 'px-2.5'
                  } ${active ? 'bg-slate-100 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-slate-900" />}
                  <Icon size={18} strokeWidth={1.75} className={active ? 'text-slate-900' : 'text-slate-400'} />
                  {!collapsed && (
                    <span className="min-w-0">
                      <span className="block truncate">{item.name}</span>
                      <span className="block truncate text-xs font-normal text-slate-400">{item.description}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* platforms: superadmin only */}
        {isSuperadmin && <div className="mt-5 border-t border-slate-100 pt-4">
          {collapsed ? (
            <ul className="space-y-1">
              {platforms.map(p => (
                <li key={p.name}>
                  <Link href={p.href} title={p.name} className="flex justify-center rounded-lg py-2 hover:bg-slate-50">
                    <span className="relative h-5 w-5">
                      <Image src={p.icon} alt={p.name} fill sizes="20px" className="object-contain" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <button
                type="button"
                onClick={onTogglePlatforms}
                className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                aria-expanded={platformsOpen}
              >
                Platforms
                <ChevronDown size={14} className={`transition-transform ${platformsOpen ? '' : '-rotate-90'}`} />
              </button>
              {platformsOpen && (
                <ul className="space-y-0.5">
                  {platforms.map(p => (
                    <li key={p.name}>
                      <Link
                        href={p.href}
                        onClick={onNavigate}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                      >
                        <span className="relative h-5 w-5 flex-shrink-0">
                          <Image src={p.icon} alt="" fill sizes="20px" className="object-contain" />
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

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
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
                <Avatar name={user.fullName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{user.fullName}</p>
                  <RoleBadge role={role} superadmin={superadmin} />
                </div>
              </div>
              <dl className="mt-2.5 space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Username</dt><dd className="truncate font-medium text-slate-700">{user.username}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-slate-400">Email</dt><dd className="truncate font-medium text-slate-700">{user.email}</dd></div>
              </dl>
            </div>
            <div className="p-1.5">
              <button
                type="button"
                onClick={() => { setOpen(false); setChanging(true); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <KeyRound size={16} /> Change password
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); logout(); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 ${collapsed ? 'justify-center' : ''}`}
          aria-expanded={open}
          title={collapsed ? `${user.fullName} · ${role}` : undefined}
        >
          <Avatar name={user.fullName} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-slate-900">{user.fullName}</span>
                <span className="block truncate text-xs text-slate-400">{role} · {user.username}</span>
              </span>
              <ChevronsUpDown size={15} className="text-slate-400" />
            </>
          )}
        </button>
      </div>
      {!collapsed && <p className="mt-2 text-center text-[11px] text-slate-400">Integration Platform v1.4.0</p>}
      <ChangePasswordDialog open={changing} onClose={() => setChanging(false)} />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-xs font-semibold text-white">
      {initials(name)}
    </span>
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

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity, BarChart3, BookOpen, Download, Boxes, Calculator, ClipboardPen, FlaskConical, Gauge, MapPin, MapPinCheck, MessageSquareText, Package, Star, Store, Wrench, ChevronRight, ClipboardCheck, ClipboardList, ListChecks, Settings2, ChevronsUpDown, History, KeyRound, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Receipt, ShieldCheck, SlidersHorizontal, Trash2, UserCog, UserRoundPen, Users, X,
} from 'lucide-react';
import { useAccountDrawers } from '@/components/AccountDrawers';
import UserAvatar from '@/components/UserAvatar';
import { PreferenceControls } from '@/components/ui/Preferences';
import { assetUrl } from '@/lib/assets';
import { canAccess, ROLE_LABELS, useAuth } from '@/lib/auth';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

const navigation = [
  { get name() { return tr('Dashboard'); }, href: '/overview', icon: LayoutDashboard, get description() { return tr('Overview & analytics'); } },
  { get name() { return tr('Sales Transactions'); }, href: '/sales', icon: Receipt, get description() { return tr('View & export data'); } },
  { get name() { return tr('Stock Opname'); }, href: '/stock-opname', icon: ClipboardCheck, get description() { return tr('Count stock of your branches'); } },
  { get name() { return tr('Waste'); }, href: '/waste', icon: Trash2, get description() { return tr('Enter the waste of your branch'); } },
];

/** "Cost Control" menu: role cost_control and superadmins (stock opname of every branch, settings, analytics); opens as a
 *  pop-up list. Enter / import SO, ESB export and ESB comparison are left out for now (user decision 2026-10-17; the
 *  pages stay). */
type CcItem = { name: string; href: string; icon: typeof Users; description: string; soon?: boolean; badge?: 'review'; /** brand logo (public/assets) shown instead of the icon */ logo?: string };
const costControl: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Stock opname'); }, get hint() { return tr('Follow and close the counts of every branch'); }, icon: ClipboardCheck, items: [
    { get name() { return tr('Monitor'); }, href: '/cost-control/monitor', icon: Activity, get description() { return tr('Progress of every branch per day'); } },
    { get name() { return tr('Review'); }, href: '/cost-control/reviews', icon: ClipboardList, get description() { return tr('Approve or ask for a recount'); }, badge: 'review' },
    { get name() { return tr('SO report'); }, href: '/cost-control/reports', icon: Download, get description() { return tr('Download reviewed stock opname'); } },
  ] },
  { get title() { return tr('Stock opname settings'); }, get hint() { return tr('What, when and how the branches count'); }, icon: SlidersHorizontal, items: [
    { get name() { return tr('Count lists'); }, href: '/cost-control/lists', icon: ListChecks, get description() { return tr('Items per branch & type'); } },
    { get name() { return tr('Item groups'); }, href: '/cost-control/groups', icon: Boxes, get description() { return tr('Templates assigned to branches'); } },
    { get name() { return tr('Count types'); }, href: '/cost-control/types', icon: Settings2, get description() { return tr('Names, schedules & calendar'); } },
    { get name() { return tr('Premix calculator'); }, href: '/cost-control/premix', icon: FlaskConical, get description() { return tr('WIP recipes & calculator'); } },
    { get name() { return tr('Outlet locations'); }, href: '/cost-control/locations', icon: MapPin, get description() { return tr('Coordinates & check-in radius'); } },
  ] },
  { get title() { return tr('Waste'); }, get hint() { return tr('Follow and review the waste of every branch'); }, icon: Trash2, items: [
    { get name() { return tr('Waste monitor'); }, href: '/cost-control/waste/monitor', icon: Activity, get description() { return tr('Waste entered by every branch'); } },
    { get name() { return tr('Waste review'); }, href: '/cost-control/waste/reviews', icon: ClipboardList, get description() { return tr('Approve or send back'); } },
  ] },
  { get title() { return tr('Analytics'); }, get hint() { return tr('Cost ratios per outlet from ESB data'); }, icon: BarChart3, items: [
    { get name() { return tr('Outlet ratio'); }, href: '/cost-control/ratio', icon: BarChart3, get description() { return tr('COGS, BB & usage ratio per outlet'); } },
    { get name() { return tr('COGS & usage'); }, href: '/cost-control', icon: Calculator, get description() { return tr('Follows Outlet ratio'); }, soon: true },
  ] },
];

/** "Form" menu: the forms outlets / PICs fill in (pages form.*, off for every role until ticked in Roles & pages). */
const forms: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Visit'); }, get hint() { return tr('Check in at the outlet you visit'); }, icon: MapPinCheck, items: [
    { get name() { return tr('PIC Check In'); }, href: '/forms/pic-check-in', icon: MapPinCheck, get description() { return tr('Check in at the outlet'); } },
  ] },
  { get title() { return tr('Outlet & product'); }, get hint() { return tr('Condition of the outlet and the products'); }, icon: Store, items: [
    { get name() { return tr('Monitoring Outlet'); }, href: '/forms/outlet', icon: Store, get description() { return tr('Fill in the outlet checklist'); } },
    { get name() { return tr('Monitoring Product'); }, href: '/forms/product', icon: Package, get description() { return tr('Fill in the product checklist'); } },
  ] },
  { get title() { return tr('Equipment'); }, get hint() { return tr('Tools and heavy tools of the outlet'); }, icon: Wrench, items: [
    { get name() { return tr('Tools & Heavy Tools'); }, href: '/forms/tools', icon: Wrench, get description() { return tr('Report the condition of the tools'); } },
  ] },
];

/** "Monitoring" menu: what the outlets / PICs filled in, for the teams that follow them (pages mon.*). */
const monitoring: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Visit'); }, get hint() { return tr('Who checked in where and when'); }, icon: MapPinCheck, items: [
    { get name() { return tr('PIC Check In'); }, href: '/monitoring/pic-check-in', icon: MapPinCheck, get description() { return tr('Check-ins of every PIC'); } },
  ] },
  { get title() { return tr('Outlet & product'); }, get hint() { return tr('Checklists of every outlet'); }, icon: Store, items: [
    { get name() { return tr('Monitoring Outlet'); }, href: '/monitoring/outlet', icon: Store, get description() { return tr('Outlet checklists & findings'); } },
    { get name() { return tr('Monitoring Product'); }, href: '/monitoring/product', icon: Package, get description() { return tr('Product checklists & findings'); } },
  ] },
  { get title() { return tr('Equipment'); }, get hint() { return tr('Tools and heavy tools of every outlet'); }, icon: Wrench, items: [
    { get name() { return tr('Tools & Heavy Tools'); }, href: '/monitoring/tools', icon: Wrench, get description() { return tr('Condition & repairs per outlet'); } },
  ] },
];

/** "Management" menu: super admins only (the pages and the API check the role too). */
const management: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Accounts & access'); }, get hint() { return tr('Who signs in and what they open'); }, icon: Users, items: [
    { get name() { return tr('User Accounts'); }, href: '/users', icon: Users, get description() { return tr('Logins, roles & branches'); } },
  ] },
  { get title() { return tr('Audit'); }, get hint() { return tr('Everything done in the portal'); }, icon: History, items: [
    { get name() { return tr('Activity Logs'); }, href: '/activity', icon: History, get description() { return tr('Who did what & exports'); } },
  ] },
];

/** "Rating & Review" menu: ratings and reviews of the outlets per platform (pages rating.*, being built). */
const rating: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Maps'); }, get hint() { return tr('What guests say about the outlets'); }, icon: MapPin, items: [
    { get name() { return tr('Google Maps'); }, href: '/rating/google-maps', icon: MapPin, logo: '/assets/googlemaps.png', get description() { return tr('Rating & reviews per outlet'); } },
  ] },
  { get title() { return tr('Online delivery'); }, get hint() { return tr('Ratings on the delivery apps'); }, icon: MessageSquareText, items: [
    { get name() { return tr('ShopeeFood'); }, href: '/rating/shopeefood', icon: Star, logo: '/assets/shopeefood.png', get description() { return tr('Rating & reviews per outlet'); } },
    { get name() { return tr('GoFood'); }, href: '/rating/gofood', icon: Star, logo: '/assets/gofood.png', get description() { return tr('Rating & reviews per outlet'); } },
    { get name() { return tr('GrabFood'); }, href: '/rating/grabfood', icon: Star, logo: '/assets/grabfood.svg', get description() { return tr('Rating & reviews per outlet'); } },
  ] },
];

/** The pop-up menus of the sidebar (same design): which pages, header and footer. */
type PopupConfig = { label: string; idle: string; title: string; subtitle: string; footer: string; icon: typeof Users; review?: boolean };
const POPUPS: Record<'forms' | 'costControl' | 'monitoring' | 'rating' | 'management', PopupConfig & { sections: typeof costControl }> = {
  forms: {
    get label() { return tr('Form'); }, get idle() { return tr('PIC check in, outlet, product & tools'); }, get title() { return tr('Form'); },
    get subtitle() { return tr('Forms the outlets and PICs fill in'); }, get footer() { return tr('All times in WIB · filled in per outlet'); },
    icon: ClipboardPen, sections: forms,
  },
  costControl: {
    get label() { return tr('Cost Control'); }, get idle() { return tr('Stock opname, waste, settings & ratios'); }, get title() { return tr('Cost Control'); },
    get subtitle() { return tr('Stock opname and waste of every branch, settings and cost ratios'); },
    get footer() { return tr('All times in WIB · data from ESB and the stock opname of the branches'); },
    icon: Calculator, sections: costControl, review: true,
  },
  monitoring: {
    get label() { return tr('Monitoring'); }, get idle() { return tr('Check ins, outlets, products & tools'); }, get title() { return tr('Monitoring'); },
    get subtitle() { return tr('What the outlets and PICs filled in'); }, get footer() { return tr('All times in WIB · from the forms of the outlets'); },
    icon: Gauge, sections: monitoring,
  },
  rating: {
    get label() { return tr('Rating & Review'); }, get idle() { return tr('Google Maps & delivery apps'); }, get title() { return tr('Rating & Review'); },
    get subtitle() { return tr('Ratings and reviews of the outlets on Google Maps and the delivery apps'); },
    get footer() { return tr('Per outlet · being built'); },
    icon: Star, sections: rating,
  },
  management: {
    get label() { return tr('Management'); }, get idle() { return tr('User accounts & activity logs'); }, get title() { return tr('Management'); },
    get subtitle() { return tr('Accounts, roles & pages, and the activity of every user'); }, get footer() { return tr('Super admins only'); },
    icon: UserCog, sections: management,
  },
};

const under = (pathname: string, href: string) => pathname === href || (href !== '/cost-control' && pathname.startsWith(`${href}/`));


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

  // restore preferences after mount (avoids hydration mismatches)
  useEffect(() => {
    setCollapsed(readFlag(COLLAPSED_KEY, false));
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      writeFlag(COLLAPSED_KEY, !c);
      return !c;
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
        <SidebarContent collapsed={collapsed} pathname={pathname}>
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
          <p className="text-[15px] font-bold tracking-wide text-slate-900">{tr('OPERATION')}</p>
          <p className="truncate text-xs text-slate-500">{tr('Integrated Platform')}</p>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  collapsed, pathname, onNavigate, children,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  children: React.ReactNode; // header action (collapse / close)
}) {
  const { user } = useAuth();
  const items = navigation.filter(item => user && canAccess(user, item.href));
  // pop-up menus: only the pages this user opens
  const visible = (list: typeof costControl) => list
    .map(s => ({ title: s.title, hint: s.hint, icon: s.icon, items: s.items.filter(i => user && canAccess(user, i.href)) }))
    .filter(s => s.items.length);
  const popups = (['forms', 'costControl', 'monitoring', 'rating', 'management'] as const)
    .map(key => ({ key, config: POPUPS[key], sections: visible(POPUPS[key].sections) }))
    .filter(p => p.sections.length);
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

        {/* Form (outlets / PICs), Cost Control, Monitoring, Management: one pop-up menu each, with the pages the user opens */}
        {popups.map(p => (
          <div key={p.key} className="mt-5 border-t border-slate-100 pt-4">
            {!collapsed && <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{p.config.label}</p>}
            <PopupMenu config={p.config} sections={p.sections} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          </div>
        ))}
      </nav>

      <UserMenu collapsed={collapsed} />
    </div>
  );
}

type NavEntry = { name: string; href: string; icon: typeof Users; description: string };

/** One sidebar entry that opens its pages as a pop-up list (beside the sidebar; centred on small screens): Form, Cost
 *  Control and Monitoring share the design. */
type MenuSection = { title: string; hint: string; icon: typeof Users; items: CcItem[] };

function PopupMenu({ config, sections, pathname, collapsed, onNavigate }: {
  config: PopupConfig; sections: MenuSection[]; pathname: string; collapsed: boolean; onNavigate?: () => void;
}) {
  const Icon = config.icon;
  const { user } = useAuth();
  const guide = !!user && canAccess(user, '/guide');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const current = sections.flatMap(s => s.items).find(i => under(pathname, i.href));
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

  // counts waiting for a decision, shown on Review (only for those who open Review)
  const [waiting, setWaiting] = useState<number | null>(null);
  const canReview = !!config.review && sections.some(sec => sec.items.some(i => i.badge === 'review'));
  useEffect(() => {
    if (!open || !canReview) return;
    const from = new Date(Date.now() + 7 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
    fetch(`/api/so/counts?status=SUBMITTED&date_from=${from}`, { credentials: 'same-origin' })
      .then(r => (r.ok ? r.json() : null))
      .then(b => setWaiting(Array.isArray(b?.data) ? b.data.length : null))
      .catch(() => setWaiting(null));
  }, [open, canReview]);

  const go = () => { setOpen(false); onNavigate?.(); };
  const menu = (
    <div ref={panel} role="menu" aria-label={config.title}
      className={`fixed z-[80] w-[min(44rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ${
        pos ? '' : 'left-1/2 top-1/2 max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto'}`}
      style={pos ? { left: pos.left, top: pos.top } : undefined}>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><Icon size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{config.title}</p>
          <p className="truncate text-xs text-slate-500">{config.subtitle}</p>
        </div>
        {waiting !== null && waiting > 0 && (
          <Link href="/cost-control/reviews" onClick={go} className="hidden flex-shrink-0 items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 sm:inline-flex">
            {tr('{0} waiting for review', waiting)}
          </Link>
        )}
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tr('Close menu')}><X size={16} /></button>
      </div>
      <div className="grid gap-x-3 gap-y-4 p-4 sm:grid-cols-2">
        {sections.map(section => (
          <div key={section.title} className={section.items.length > 3 ? 'sm:row-span-2' : ''}>
            <div className="mb-1.5 flex items-center gap-2 px-2">
              <section.icon size={13} className="text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>
            </div>
            <p className="mb-1 px-2 text-[11px] text-slate-400">{section.hint}</p>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const on = under(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={go} role="menuitem" aria-current={on ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        on ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      {item.logo ? (
                        <span className={`flex h-8 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-white px-2 ring-1 transition-colors ${
                          on ? 'ring-blue-300' : 'ring-slate-200 group-hover:ring-slate-300'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- small brand logo from public/assets */}
                          <img src={item.logo} alt="" className="max-h-4 max-w-full object-contain" />
                        </span>
                      ) : (
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                          on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-slate-700 group-hover:ring-1 group-hover:ring-slate-200'}`}>
                          <Icon size={15} strokeWidth={1.9} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1.5 text-sm ${on ? 'font-semibold text-blue-800' : 'font-medium text-slate-800'}`}>
                          <span className="truncate">{item.name}</span>
                          {item.soon && <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase text-slate-500">{tr('Soon')}</span>}
                        </span>
                        <span className="block truncate text-xs text-slate-400">{item.description}</span>
                      </span>
                      {item.badge === 'review' && waiting !== null && waiting > 0 && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-semibold tabular-nums text-white">{waiting}</span>
                      )}
                      <ChevronRight size={14} className={`flex-shrink-0 ${on ? 'text-blue-400' : 'text-slate-300 group-hover:text-slate-400'}`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-xs text-slate-500">
        <span className="truncate">{config.footer}</span>
        {guide && <Link href="/guide" onClick={go} className="inline-flex flex-shrink-0 items-center gap-1 font-medium text-blue-700 hover:underline"><BookOpen size={13} /> {tr('Guide')}</Link>}
      </div>
    </div>
  );

  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        title={collapsed ? config.label : undefined}
        className={`relative flex w-full items-center gap-3 rounded-lg py-2 text-left text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-2.5'} ${
          active || open ? 'bg-slate-100 font-semibold text-slate-900' : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
        {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-slate-900" />}
        <Icon size={18} strokeWidth={1.75} className={active ? 'text-slate-900' : 'text-slate-400'} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{current ? current.name : config.label}</span>
              <span className="block truncate text-xs font-normal text-slate-400">{current ? config.label : config.idle}</span>
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
      {!collapsed && <p className="mt-2 text-center text-[11px] text-slate-400">{tr('Integrated Platform v1.0.0')}</p>}
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

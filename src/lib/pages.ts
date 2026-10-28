// Pages of the dashboard a role or a user may open (same catalog as integrated_portal_be app/access.py). The backend
// enforces them; here they shape the menu and the page gate. User Accounts and Activity Logs are superadmin-only and
// not part of the catalog.

import { tr } from './i18n';

export type PageKey =
  | 'overview' | 'sales' | 'stock-opname' | 'waste' | 'guide'
  | 'form.pic-check-in' | 'form.outlet' | 'form.product' | 'form.damaged-equipment' | 'form.pengajuan'
  | 'mon.overview' | 'mon.pic-check-in' | 'mon.outlet' | 'mon.product' | 'mon.damaged-equipment' | 'mon.branch-groups'
  | 'mon.pengajuan' | 'mon.pengajuan.verify' | 'mon.pengajuan.finance'
  | 'rating.google-maps' | 'rating.shopeefood' | 'rating.gofood' | 'rating.grabfood'
  | 'cc.monitor' | 'cc.reviews' | 'cc.entry' | 'cc.reports' | 'cc.esb-export' | 'cc.esb-compare' | 'cc.lists' | 'cc.groups' | 'cc.types'
  | 'cc.premix' | 'cc.locations' | 'cc.waste-monitor' | 'cc.waste-review' | 'cc.ratio' | 'cc.cogs';

/** How the page shows in the menu: 'header' = icon in the header (not the sidebar), 'hidden' = no menu entry for now
 * (opened by URL; user decision 2026-10-17), 'soon' = menu entry marked Soon, 'building' = skeleton screen only. */
export type PageState = 'header' | 'hidden' | 'soon' | 'building';

export interface PageInfo { key: PageKey; href: string; label: string; group: string; state?: PageState }

export const PAGES: PageInfo[] = [
  { key: 'overview', href: '/overview', get label() { return tr('Dashboard'); }, get group() { return tr('Main menu'); } },
  { key: 'sales', href: '/sales', get label() { return tr('Sales Transactions'); }, get group() { return tr('Main menu'); } },
  { key: 'stock-opname', href: '/stock-opname', get label() { return tr('Stock Opname (count)'); }, get group() { return tr('Main menu'); } },
  { key: 'waste', href: '/waste', get label() { return tr('Waste (input)'); }, get group() { return tr('Main menu'); }, state: 'building' },
  { key: 'guide', href: '/guide', get label() { return tr('Guide'); }, get group() { return tr('Main menu'); }, state: 'header' },
  { key: 'form.pic-check-in', href: '/forms/pic-check-in', get label() { return tr('PIC Check In (form)'); }, get group() { return tr('Form'); } },
  { key: 'form.product', href: '/forms/product', get label() { return tr('Monitoring Product (form)'); }, get group() { return tr('Form'); } },
  { key: 'form.outlet', href: '/forms/outlet', get label() { return tr('Monitoring Outlet (form)'); }, get group() { return tr('Form'); } },
  { key: 'form.damaged-equipment', href: '/forms/damaged-equipment', get label() { return tr('Damaged Equipment (form)'); }, get group() { return tr('Form'); } },
  { key: 'form.pengajuan', href: '/forms/pengajuan', get label() { return tr('Fund request (form)'); }, get group() { return tr('Form'); } },
  { key: 'cc.monitor', href: '/cost-control/monitor', get label() { return tr('Monitor'); }, get group() { return tr('Cost Control · Stock opname'); } },
  { key: 'cc.reviews', href: '/cost-control/reviews', get label() { return tr('Review'); }, get group() { return tr('Cost Control · Stock opname'); } },
  { key: 'cc.entry', href: '/cost-control/entry', get label() { return tr('Enter / import SO'); }, get group() { return tr('Cost Control · Stock opname'); }, state: 'hidden' },
  { key: 'cc.reports', href: '/cost-control/reports', get label() { return tr('Report Stock Opname'); }, get group() { return tr('Cost Control · Stock opname'); } },
  { key: 'cc.esb-export', href: '/cost-control/esb-export', get label() { return tr('ESB export'); }, get group() { return tr('Cost Control · ESB'); }, state: 'hidden' },
  { key: 'cc.esb-compare', href: '/cost-control/esb-compare', get label() { return tr('ESB comparison'); }, get group() { return tr('Cost Control · ESB'); }, state: 'hidden' },
  { key: 'cc.lists', href: '/cost-control/lists', get label() { return tr('Count Lists'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.groups', href: '/cost-control/groups', get label() { return tr('Items Groups'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.types', href: '/cost-control/types', get label() { return tr('Count Types'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.premix', href: '/cost-control/premix', get label() { return tr('Premix calculator'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.locations', href: '/cost-control/locations', get label() { return tr('Outlet locations'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.waste-monitor', href: '/cost-control/waste/monitor', get label() { return tr('Waste monitor'); }, get group() { return tr('Cost Control · Waste'); }, state: 'building' },
  { key: 'cc.waste-review', href: '/cost-control/waste/reviews', get label() { return tr('Waste review'); }, get group() { return tr('Cost Control · Waste'); }, state: 'building' },
  { key: 'cc.ratio', href: '/cost-control/ratio', get label() { return tr('Outlet ratio'); }, get group() { return tr('Cost Control · Analytics'); } },
  { key: 'cc.cogs', href: '/cost-control', get label() { return tr('COGS & usage'); }, get group() { return tr('Cost Control · Analytics'); }, state: 'soon' },
  { key: 'mon.overview', href: '/monitoring/overview', get label() { return tr('Monitoring overview'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.pic-check-in', href: '/monitoring/pic-check-in', get label() { return tr('PIC Check In'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.product', href: '/monitoring/product', get label() { return tr('Monitoring Product'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.outlet', href: '/monitoring/outlet', get label() { return tr('Monitoring Outlet'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.damaged-equipment', href: '/monitoring/damaged-equipment', get label() { return tr('Damaged Equipment'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.branch-groups', href: '/monitoring/branch-groups', get label() { return tr('Branch groups'); }, get group() { return tr('Monitoring'); } },
  { key: 'mon.pengajuan', href: '/monitoring/pengajuan', get label() { return tr('Fund requests'); }, get group() { return tr('Monitoring'); } },
  // the two approval steps of Pengajuan: rights inside /monitoring/pengajuan, not menu entries of their own
  { key: 'mon.pengajuan.verify', href: '/monitoring/pengajuan#verify', get label() { return tr('Fund requests: verify (Operations)'); }, get group() { return tr('Monitoring'); }, state: 'hidden' },
  { key: 'mon.pengajuan.finance', href: '/monitoring/pengajuan#finance', get label() { return tr('Fund requests: approve & pay (Finance)'); }, get group() { return tr('Monitoring'); }, state: 'hidden' },
  { key: 'rating.google-maps', href: '/rating/google-maps', get label() { return tr('Google Maps'); }, get group() { return tr('Aggregator'); } },
  { key: 'rating.shopeefood', href: '/rating/shopeefood', get label() { return tr('ShopeeFood'); }, get group() { return tr('Aggregator'); }, state: 'building' },
  { key: 'rating.gofood', href: '/rating/gofood', get label() { return tr('GoFood'); }, get group() { return tr('Aggregator'); }, state: 'building' },
  { key: 'rating.grabfood', href: '/rating/grabfood', get label() { return tr('GrabFood'); }, get group() { return tr('Aggregator'); }, state: 'building' },
];

/** The page a path belongs to ('superadmin' for User Accounts & Activity Logs, null for an unknown path). */
export function pageOf(pathname: string): PageKey | 'superadmin' | null {
  if (pathname === '/users' || pathname.startsWith('/users/') || pathname === '/activity' || pathname.startsWith('/activity/')) return 'superadmin';
  if (pathname === '/cost-control') return 'cc.cogs';
  // the longest matching href wins (/cost-control/monitor before /cost-control)
  const match = PAGES.filter(p => p.href !== '/cost-control' && (pathname === p.href || pathname.startsWith(`${p.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.key ?? null;
}

export const STATE_LABEL: Record<PageState, () => string> = {
  header: () => tr('Header icon'), hidden: () => tr('Not in the menu'), soon: () => tr('Soon'), building: () => tr('Being built'),
};

export const CC_PAGES = PAGES.filter(p => p.key.startsWith('cc.')).map(p => p.key);

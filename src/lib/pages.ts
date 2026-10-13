// Pages of the dashboard a role or a user may open (same catalog as integrated_portal_be app/access.py). The backend
// enforces them; here they shape the menu and the page gate. User Accounts and Activity Logs are superadmin-only and
// not part of the catalog.

import { tr } from './i18n';

export type PageKey =
  | 'overview' | 'sales' | 'stock-opname'
  | 'cc.monitor' | 'cc.reviews' | 'cc.esb-export' | 'cc.esb-compare' | 'cc.lists' | 'cc.groups' | 'cc.types'
  | 'cc.premix' | 'cc.ratio' | 'cc.cogs';

export interface PageInfo { key: PageKey; href: string; label: string; group: string }

export const PAGES: PageInfo[] = [
  { key: 'overview', href: '/overview', get label() { return tr('Dashboard'); }, get group() { return tr('Main menu'); } },
  { key: 'sales', href: '/sales', get label() { return tr('Sales Transactions'); }, get group() { return tr('Main menu'); } },
  { key: 'stock-opname', href: '/stock-opname', get label() { return tr('Stock Opname (count)'); }, get group() { return tr('Main menu'); } },
  { key: 'cc.monitor', href: '/cost-control/monitor', get label() { return tr('Monitor'); }, get group() { return tr('Cost Control · Stock opname'); } },
  { key: 'cc.reviews', href: '/cost-control/reviews', get label() { return tr('Review'); }, get group() { return tr('Cost Control · Stock opname'); } },
  { key: 'cc.esb-export', href: '/cost-control/esb-export', get label() { return tr('ESB export'); }, get group() { return tr('Cost Control · ESB'); } },
  { key: 'cc.esb-compare', href: '/cost-control/esb-compare', get label() { return tr('ESB comparison'); }, get group() { return tr('Cost Control · ESB'); } },
  { key: 'cc.lists', href: '/cost-control/lists', get label() { return tr('Count lists'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.groups', href: '/cost-control/groups', get label() { return tr('Item groups'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.types', href: '/cost-control/types', get label() { return tr('Count types'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.premix', href: '/cost-control/premix', get label() { return tr('Premix calculator'); }, get group() { return tr('Cost Control · Stock opname settings'); } },
  { key: 'cc.ratio', href: '/cost-control/ratio', get label() { return tr('Outlet ratio'); }, get group() { return tr('Cost Control · Analytics'); } },
  { key: 'cc.cogs', href: '/cost-control', get label() { return tr('COGS & usage'); }, get group() { return tr('Cost Control · Analytics'); } },
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

export const CC_PAGES = PAGES.filter(p => p.key.startsWith('cc.')).map(p => p.key);

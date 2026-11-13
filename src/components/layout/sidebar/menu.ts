// The menus of the sidebar (portal): the main entries and the module pop-ups (Form, Cost Control, Monitoring, Monitoring
// COTR, Aggregator, Management). Only data: what is shown is filtered per account by inMenu (lib/auth). A new page is
// added here, in lib/pages.ts and in the backend page catalog (integrated_portal_be app/access.py).

import {
  Activity, BarChart3, Bike, Warehouse, CookingPot, Download, Boxes, Calculator, ClipboardPen,
  FlaskConical, Gauge, MapPin, MapPinCheck, MessageSquareText, Package, Star, Store, Wrench, ClipboardCheck, ClipboardList, ListChecks,
  Settings2, History, LayoutDashboard, Receipt, ShieldCheck, SlidersHorizontal, Trash2, UserCog, Users, Wallet, UserRoundCheck,
  PackageCheck, ArrowLeftRight, ShoppingCart,
} from 'lucide-react';
import { tr } from '@/lib/i18n';

export const navigation = [
  { get name() { return tr('Dashboard'); }, href: '/overview', icon: LayoutDashboard, get description() { return tr('Overview & analytics'); } },
  { get name() { return tr('Sales Transactions'); }, href: '/sales', icon: Receipt, get description() { return tr('View & export data'); } },
];

/** "Cost Control" menu: role cost_control and superadmins (stock opname of every branch, settings, analytics); opens as a
 *  pop-up list. Enter / import SO, ESB export and ESB comparison are left out for now (user decision 2026-10-17; the
 *  pages stay). */
export type CcItem = { name: string; href: string; icon: typeof Users; description: string; soon?: boolean; badge?: 'review'; /** brand logo (public/assets) shown instead of the icon */ logo?: string };
export const costControl: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Information Center'); }, get hint() { return tr('How complete and fresh the data of the figures is'); }, icon: Gauge, items: [
    { get name() { return tr('Information Center'); }, href: '/cost-control/info', icon: Gauge, get description() { return tr('ESB & Portal data: sync, SO, waste, GR, prices, recipes'); } },
  ] },
  { get title() { return tr('Stock Opname'); }, get hint() { return tr('Follow and close the counts of every branch'); }, icon: ClipboardCheck, items: [
    { get name() { return tr('Stock Opname Monitor'); }, href: '/cost-control/monitor', icon: Activity, get description() { return tr('Progress of every branch per day'); } },
    { get name() { return tr('Stock Opname Review'); }, href: '/cost-control/reviews', icon: ClipboardList, get description() { return tr('Approve or ask for a recount'); }, badge: 'review' },
    { get name() { return tr('Stock Opname Report'); }, href: '/cost-control/reports', icon: Download, get description() { return tr('Download reviewed stock opname'); } },
  ] },
  { get title() { return tr('Stock Opname Settings'); }, get hint() { return tr('What, when and how the branches count'); }, icon: SlidersHorizontal, items: [
    { get name() { return tr('Count Lists'); }, href: '/cost-control/lists', icon: ListChecks, get description() { return tr('Items per branch & type'); } },
    { get name() { return tr('Items Groups'); }, href: '/cost-control/groups', icon: Boxes, get description() { return tr('Templates assigned to branches'); } },
    { get name() { return tr('Count Types'); }, href: '/cost-control/types', icon: Settings2, get description() { return tr('Names, schedules & calendar'); } },
    { get name() { return tr('Outlet Locations'); }, href: '/cost-control/locations', icon: MapPin, get description() { return tr('Coordinates & check-in radius'); } },
  ] },
  { get title() { return tr('Production & Costing'); }, get hint() { return tr('Recipes, menu costing and raw material prices'); }, icon: FlaskConical, items: [
    { get name() { return tr('Production Calculator'); }, href: '/cost-control/premix', icon: FlaskConical, get description() { return tr('WIP recipes & calculator'); } },
    { get name() { return tr('Sales Calculator by Menu'); }, href: '/cost-control/sales-calculator', icon: Calculator, get description() { return tr('Menu recipe cards, MRP, usage & COGS'); } },
    { get name() { return tr('List & Pricelist Items'); }, href: '/cost-control/pricelist', icon: Receipt, get description() { return tr('Items active / inactive and their prices'); } },
  ] },
  { get title() { return tr('Waste'); }, get hint() { return tr('Follow and review the waste of every branch'); }, icon: Trash2, items: [
    { get name() { return tr('Waste Monitor'); }, href: '/cost-control/waste/monitor', icon: Activity, get description() { return tr('Waste entered by every branch'); } },
    { get name() { return tr('Waste Review'); }, href: '/cost-control/waste/reviews', icon: ClipboardList, get description() { return tr('Approve or send back'); } },
  ] },
  { get title() { return tr('Monitoring Stock'); }, get hint() { return tr('Stock of every branch and the transfers between outlets'); }, icon: Boxes, items: [
    { get name() { return tr('Stock List'); }, href: '/cost-control/stock-list', icon: Boxes, get description() { return tr('Stock per branch from the latest SO'); } },
    { get name() { return tr('Transfer Stock'); }, href: '/cost-control/stock-transfer', icon: ArrowLeftRight, get description() { return tr('Approve transfers, ESB label & export'); } },
  ] },
  { get title() { return tr('Clock In'); }, get hint() { return tr('Outlet visits of the Cost Control team'); }, icon: UserRoundCheck, items: [
    { get name() { return tr('Cost Control Clock In'); }, href: '/cost-control/check-in', icon: UserRoundCheck, get description() { return tr('Clock in & clock out of every Cost Control surveyor'); } },
  ] },
  { get title() { return tr('Analytics'); }, get hint() { return tr('Cost ratios per outlet from ESB data'); }, icon: BarChart3, items: [
    { get name() { return tr('Outlet Ratio'); }, href: '/cost-control/ratio', icon: BarChart3, get description() { return tr('COGS, BB & usage ratio per outlet'); } },
    { get name() { return tr('Good Receipt'); }, href: '/cost-control/goods-receipt', icon: PackageCheck, get description() { return tr('GR of ESB, date & qty corrections with evidence'); } },
    { get name() { return tr('COGS & Usage'); }, href: '/cost-control', icon: Calculator, get description() { return tr('Per outlet between two SO: COGS, usage ratio, waste'); } },
    { get name() { return tr('Purchase Estimate'); }, href: '/cost-control/purchase-plan', icon: ShoppingCart, get description() { return tr('Per outlet: buffer days & % from its own data, what to order'); } },
  ] },
];

/** "Form" menu: the forms outlets / PICs fill in (pages form.*, off for every role until ticked in Roles & pages). */
export const forms: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Stock'); }, get hint() { return tr('Stock opname and waste of your branch'); }, icon: ClipboardCheck, items: [
    { get name() { return tr('Stock Opname'); }, href: '/stock-opname', icon: ClipboardCheck, get description() { return tr('Count stock of your branches'); } },
    { get name() { return tr('Waste'); }, href: '/waste', icon: Trash2, get description() { return tr('Enter the waste of your branch'); } },
    { get name() { return tr('Transfer Stock'); }, href: '/forms/stock-transfer', icon: ArrowLeftRight, get description() { return tr('Take materials from another outlet'); } },
  ] },
  { get title() { return tr('Visit'); }, get hint() { return tr('Check in at the outlet you visit'); }, icon: MapPinCheck, items: [
    { get name() { return tr('PIC Check In'); }, href: '/forms/pic-check-in', icon: MapPinCheck, get description() { return tr('Check in at the outlet'); } },
    { get name() { return tr('Cost Control Clock In'); }, href: '/forms/surveyor-check-in', icon: UserRoundCheck, get description() { return tr('Cost Control visit to the outlet'); } },
  ] },
  { get title() { return tr('Product & Outlet'); }, get hint() { return tr('Condition of the products and the outlet'); }, icon: Store, items: [
    { get name() { return 'Product'; }, href: '/forms/product', icon: Package, get description() { return tr('Fill in the product checklist'); } },
    { get name() { return 'Outlet'; }, href: '/forms/outlet', icon: Store, get description() { return tr('Fill in the outlet checklist'); } },
    { get name() { return 'WW-WR'; }, href: '/forms/wwwr', icon: ShieldCheck, get description() { return tr('SWAT audit of the outlet'); } },
  ] },
  { get title() { return tr('Maintenance'); }, get hint() { return tr('Repairs and procurement of the outlet'); }, icon: Wrench, items: [
    { get name() { return tr('Damaged Equipment'); }, href: '/forms/damaged-equipment', icon: Wrench, get description() { return tr('Repair & procurement requests'); } },
  ] },
  { get title() { return tr('Finance'); }, get hint() { return tr('Petty cash and other requests of the outlet'); }, icon: Wallet, items: [
    { get name() { return tr('Fund Request'); }, href: '/forms/pengajuan', icon: Wallet, get description() { return tr('Petty cash with receipts'); } },
  ] },
];

/** "Operations" menu: what the outlets / PICs filled in, for the teams that follow them (pages mon.*). */
export const monitoring: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Analysis'); }, get hint() { return tr('Every form together, per branch group'); }, icon: BarChart3, items: [
    { get name() { return tr('Overview'); }, href: '/monitoring/overview', icon: BarChart3, get description() { return tr('Check-ins, products & outlets per group'); } },
  ] },
  { get title() { return tr('Visit'); }, get hint() { return tr('Who checked in where and when'); }, icon: MapPinCheck, items: [
    { get name() { return tr('PIC Check In'); }, href: '/monitoring/pic-check-in', icon: MapPinCheck, get description() { return tr('Check-ins of every PIC'); } },
  ] },
  { get title() { return tr('Product & Outlet'); }, get hint() { return tr('Checklists of every outlet'); }, icon: Store, items: [
    { get name() { return 'Product'; }, href: '/monitoring/product', icon: Package, get description() { return tr('Product checklists & findings'); } },
    { get name() { return 'Outlet'; }, href: '/monitoring/outlet', icon: Store, get description() { return tr('Outlet checklists & findings'); } },
    { get name() { return 'WW-WR'; }, href: '/monitoring/wwwr', icon: ShieldCheck, get description() { return tr('SWAT audits, comparison with the PIC & schedule'); } },
  ] },
  { get title() { return tr('Maintenance'); }, get hint() { return tr('Requests of every outlet'); }, icon: Wrench, items: [
    { get name() { return tr('Damaged Equipment'); }, href: '/monitoring/damaged-equipment', icon: Wrench, get description() { return tr('Status, technicians & time per request'); } },
  ] },
  { get title() { return tr('Finance'); }, get hint() { return tr('Requests of the outlets: verify, approve, pay'); }, icon: Wallet, items: [
    { get name() { return tr('Fund Request'); }, href: '/monitoring/pengajuan', icon: Wallet, get description() { return tr('Petty cash, receipts & approvals'); } },
  ] },
  { get title() { return tr('Settings'); }, get hint() { return tr('How the outlets are grouped'); }, icon: Boxes, items: [
    { get name() { return tr('Branch Groups'); }, href: '/monitoring/branch-groups', icon: Boxes, get description() { return tr('CCI, CTG, CTGP … for the assessment'); } },
  ] },
];

/** "Calf On The Road" menu: Calf On The Road, configured by the COTR team (pages cotr.*, prototype 2026-11-01). */
export const cotr: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  // in the order of the work (2026-11-12): the day (dashboard → assignment & closing → drivers on the road), the
  // production and stock behind it, then the monthly pay and the master data set up once
  { get title() { return tr('Daily'); }, get hint() { return tr('Every day, in this order'); }, icon: MapPinCheck, items: [
    { get name() { return tr('Dashboard'); }, href: '/cotr/dashboard', icon: LayoutDashboard, get description() { return tr('One day of every pool: cups, waste, leftover & what waits'); } },
    { get name() { return tr('Storage & Assignment'); }, href: '/cotr/storage', icon: Warehouse, get description() { return tr('Morning assignment, reloads, night closing'); } },
    { get name() { return tr('Monitoring Armada - Driver'); }, href: '/cotr/check-in', icon: MapPinCheck, get description() { return tr('Shifts, sales, stock, cupping & waste of every driver'); } },
  ] },
  { get title() { return tr('Production & Stock'); }, get hint() { return tr('HUB production, pool stock, reports'); }, icon: CookingPot, items: [
    { get name() { return tr('Storage & Production'); }, href: '/cotr/production', icon: CookingPot, get description() { return tr('Stock, goods in, stock opname, batches & waste'); } },
  ] },
  { get title() { return tr('Monthly & Setup'); }, get hint() { return tr('Incentives and payslips, master data'); }, icon: Boxes, items: [
    { get name() { return tr('Incentive Calculator'); }, href: '/cotr/incentive', icon: Calculator, get description() { return tr('Tiers per cup, bonus & attendance'); } },
    { get name() { return tr('Master'); }, href: '/cotr/master', icon: Boxes, get description() { return tr('Employees, areas, pools, fleet & accessories, schedule, menus'); } },
  ] },
];

/** "Management" menu: super admins only (the pages and the API check the role too). */
export const management: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Accounts & Access'); }, get hint() { return tr('Who signs in and what they open'); }, icon: Users, items: [
    { get name() { return tr('User Accounts'); }, href: '/users', icon: Users, get description() { return tr('Logins, roles & branches'); } },
  ] },
  { get title() { return tr('Audit'); }, get hint() { return tr('Everything done in the portal'); }, icon: History, items: [
    { get name() { return tr('Activity Logs'); }, href: '/activity', icon: History, get description() { return tr('Who did what & exports'); } },
  ] },
];

/** "Aggregator" menu: ratings and reviews of the outlets per platform (pages rating.*, being built). */
export const rating: { title: string; hint: string; icon: typeof Users; items: CcItem[] }[] = [
  { get title() { return tr('Maps'); }, get hint() { return tr('What guests say about the outlets'); }, icon: MapPin, items: [
    { get name() { return tr('Google Maps'); }, href: '/rating/google-maps', icon: MapPin, logo: '/assets/googlemaps.png', get description() { return tr('Rating & reviews per outlet'); } },
  ] },
  { get title() { return tr('Online Delivery'); }, get hint() { return tr('Ratings on the delivery apps'); }, icon: MessageSquareText, items: [
    { get name() { return tr('ShopeeFood'); }, href: '/rating/shopeefood', icon: Star, logo: '/assets/shopeefood.png', get description() { return tr('Rating & reviews per outlet'); } },
    { get name() { return tr('GoFood'); }, href: '/rating/gofood', icon: Star, logo: '/assets/gofood.png', get description() { return tr('Rating & reviews per outlet'); } },
    { get name() { return tr('GrabFood'); }, href: '/rating/grabfood', icon: Star, logo: '/assets/grabfood.svg', get description() { return tr('Rating & reviews per outlet'); } },
  ] },
];

/** The pop-up menus of the sidebar (same design): which pages, header and footer. */
export type PopupConfig = { label: string; idle: string; title: string; subtitle: string; footer: string; icon: typeof Users; review?: boolean };
export const POPUPS: Record<'forms' | 'costControl' | 'monitoring' | 'cotr' | 'rating' | 'management', PopupConfig & { sections: typeof costControl }> = {
  forms: {
    get label() { return tr('Form'); }, get idle() { return tr('PIC check in, product, outlet, maintenance & fund requests'); }, get title() { return tr('Form'); },
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
    get label() { return tr('Operations'); }, get idle() { return tr('Check ins, outlets, products & maintenance'); }, get title() { return tr('Operations'); },
    get subtitle() { return tr('What the outlets and PICs filled in'); }, get footer() { return tr('All times in WIB · from the forms of the outlets'); },
    icon: Gauge, sections: monitoring,
  },
  cotr: {
    get label() { return tr('Calf On The Road'); }, get idle() { return tr('Drivers, fleet, pools, menus & production'); }, get title() { return tr('Calf On The Road'); },
    get subtitle() { return tr('Calf On The Road: drivers on the road and what the HUB produces'); },
    get footer() { return tr('Calf On The Road'); },
    icon: Bike, sections: cotr,
  },
  rating: {
    get label() { return tr('Aggregator'); }, get idle() { return tr('Google Maps & delivery apps'); }, get title() { return tr('Aggregator'); },
    get subtitle() { return tr('Ratings and reviews of the outlets on Google Maps and the delivery apps'); },
    get footer() { return tr('Google Maps live · delivery apps being built'); },
    icon: Star, sections: rating,
  },
  management: {
    get label() { return tr('Management'); }, get idle() { return tr('User accounts & activity logs'); }, get title() { return tr('Management'); },
    get subtitle() { return tr('Accounts, roles & pages, and the activity of every user'); }, get footer() { return tr('Super admins only'); },
    icon: UserCog, sections: management,
  },
};

export type PopupKey = keyof typeof POPUPS;
export type MenuSection = { title: string; hint: string; icon: typeof Users; items: CcItem[] };
/** the order of the modules in the sidebar */
export const POPUP_ORDER: PopupKey[] = ['forms', 'costControl', 'monitoring', 'cotr', 'rating', 'management'];

/** Is the page at `href` the one open (or one of its sub-pages)? */
export const under = (pathname: string, href: string) => pathname === href || (href !== '/cost-control' && pathname.startsWith(`${href}/`));

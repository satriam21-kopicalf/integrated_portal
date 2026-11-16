'use client';

// The brand the app wears (2026-11-16): the logo and line of the sidebar and the phone app bar follow what is shown —
// Calf On The Road on its pages, for its accounts and on the Dashboard's COTR tab; Wasgee Tea Lab when the Wasgee
// company (CALF7) is chosen on a brand page (Dashboard, Sales, Cost Control, Monitoring); else Kopi Calf.

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { BRAND_LINE } from '@/components/BrandWatermark';
import { useCotrLook } from '@/cotr/theme';
import { assetUrl } from '@/lib/assets';
import { useCompany } from '@/lib/company';

export type BrandKey = 'calf' | 'wasgee' | 'cotr';
export const BRANDS: Record<BrandKey, { logo: string; name: string; line: string; wide: boolean }> = {
  get calf() { return { logo: assetUrl('assets/calf-logo.png'), name: 'Kopi Calf', line: BRAND_LINE, wide: false }; },
  wasgee: { logo: '/assets/Logo-Wasgee.png', name: 'Wasgee Tea Lab', line: 'Wasgee Tea Lab', wide: true },
  cotr: { logo: '/assets/Logo-COTR.png', name: 'Calf On The Road', line: 'Calf On The Road', wide: false },
};

// the Dashboard's COTR tab is not a company: the page tells it here
let dashboardCotr = false;
const subs = new Set<() => void>();
export function setDashboardCotr(on: boolean) {
  if (dashboardCotr === on) return;
  dashboardCotr = on;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

const SALES_PAGES = ['/overview', '/sales', '/cost-control', '/monitoring'];

export function useBrandLook(): BrandKey {
  const pathname = usePathname() ?? '';
  const cotrLook = useCotrLook();
  const { company } = useCompany();
  const cotrTab = useSyncExternalStore(subscribe, () => dashboardCotr, () => false);
  if (cotrLook || (cotrTab && pathname.startsWith('/overview'))) return 'cotr';
  if (company === 'CALF7' && SALES_PAGES.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/monitoring/branch-groups')) return 'wasgee';
  return 'calf';
}

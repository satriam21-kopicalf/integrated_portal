'use client';

// The brand of the Cost Control menus (2026-11-08): Kopi Calf or Wasgee Tea Lab on top of every Cost Control page; the
// page below is mounted again on a change, so every list, figure and export reads the chosen brand only
// (@/lib/company ccUrl). Nothing shows for an account that sees one brand.

import { Fragment, type ReactNode } from 'react';
import { useCompany } from '@/lib/company';

/** the pages whose brand is chosen in the top bar (desktop TopBar, phone AppBar; 2026-11-18) */
export const brandInTopBar = (path: string) => path.startsWith('/cost-control') || path.startsWith('/monitoring');

export default function CostControlBrand({ children }: { children: ReactNode }) {
  const { company } = useCompany();
  return (
    <>
      <Fragment key={company}>{children}</Fragment>
    </>
  );
}

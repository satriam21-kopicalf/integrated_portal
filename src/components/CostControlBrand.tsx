'use client';

// The brand of the Cost Control menus (2026-11-08): Kopi Calf or Wasgee Tea Lab on top of every Cost Control page; the
// page below is mounted again on a change, so every list, figure and export reads the chosen brand only
// (@/lib/company ccUrl). Nothing shows for an account that sees one brand.

import { Fragment, type ReactNode } from 'react';
import { CompanySwitch, useCompany } from '@/lib/company';

export default function CostControlBrand({ children }: { children: ReactNode }) {
  const { company } = useCompany();
  return (
    <>
      <div className="mx-auto flex max-w-7xl justify-end px-4 pt-3 sm:px-6 lg:pt-5">
        <CompanySwitch className="w-full sm:w-auto" />
      </div>
      <Fragment key={company}>{children}</Fragment>
    </>
  );
}

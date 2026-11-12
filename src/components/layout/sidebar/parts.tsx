'use client';

// Small pieces of the sidebar (design after kopicalf-hrms): the brand, a section label, a main entry.

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BRAND_LINE } from '@/components/BrandWatermark';
import { cx } from '@/components/kc';
import { assetUrl } from '@/lib/assets';
import { tr } from '@/lib/i18n';
import { useCotrLook } from '@/cotr/theme';
import type { navigation } from './menu';

export function Brand({ compact = false }: { compact?: boolean }) {
  // a COTR page or a COTR account (2026-11-13): the logo and the name of Calf On The Road
  const cotr = useCotrLook();
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-neutral-200">
        <Image src={cotr ? '/assets/Logo-COTR.png' : assetUrl('assets/calf-logo.png')} alt={cotr ? 'Calf On The Road' : tr('Kopi Calf')} fill sizes="36px" className="object-contain p-1" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-bold tracking-[0.16em] text-brand-700">PORTAL</p>
          <p className="truncate text-[11px] text-neutral-500">{cotr ? 'Calf On The Road' : BRAND_LINE}</p>
        </div>
      )}
    </div>
  );
}

/** The small uppercase title of a group of entries (hidden when the sidebar is collapsed). */
export function SectionLabel({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-6 bg-neutral-200" aria-hidden />;
  return <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{children}</p>;
}

/** The look of an entry: active = white with a line and the navy icon, idle = quiet grey. */
export const entryClass = (active: boolean, collapsed: boolean) => cx(
  'group relative flex w-full items-center gap-2.5 rounded-lg py-1.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-200',
  collapsed ? 'justify-center px-0' : 'px-2.5',
  active ? 'bg-white font-semibold text-neutral-900 shadow-sm ring-1 ring-neutral-200' : 'font-medium text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900');
export const entryIcon = (active: boolean) => cx('flex-shrink-0', active ? 'text-brand-700' : 'text-neutral-400 group-hover:text-neutral-600');

type NavEntry = (typeof navigation)[number];

export function NavItem({ item, active, collapsed, onNavigate }: { item: NavEntry; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} title={collapsed ? item.name : undefined} aria-current={active ? 'page' : undefined} className={entryClass(active, collapsed)}>
      <Icon size={17} strokeWidth={1.9} className={entryIcon(active)} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
    </Link>
  );
}

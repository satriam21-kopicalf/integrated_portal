'use client';

// Small pieces of the sidebar (design after kopicalf-hrms): the brand, a section label, a main entry.

import { BRANDS, useBrandLook } from '@/lib/brand-look';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/components/kc';
import type { navigation } from './menu';

export function Brand({ compact = false }: { compact?: boolean }) {
  // the brand shown (lib/brand-look, 2026-11-16): Kopi Calf, Wasgee Tea Lab (a wide wordmark) or Calf On The Road
  const b = BRANDS[useBrandLook()];
  if (b.wide && !compact) {
    return (
      <div className="flex min-w-0 flex-col justify-center gap-1 leading-tight">
        {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark from public/assets */}
        <img src={b.logo} alt={b.name} className="h-6 w-auto max-w-[9.5rem] object-contain object-left" />
        <p className="text-[10px] font-bold tracking-[0.16em] text-[color:var(--j-0C66E4)]">PORTAL</p>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-[3px] bg-white ring-1 ring-[color:var(--j-DCDFE4)]">
        <Image src={b.logo} alt={b.name} fill sizes="36px" className="object-contain p-1" />
      </div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="text-[13px] font-bold tracking-[0.16em] text-[color:var(--j-0C66E4)]">PORTAL</p>
          <p className="truncate text-[11px] text-[color:var(--j-626F86)]">{b.line}</p>
        </div>
      )}
    </div>
  );
}

/** The small uppercase title of a group of entries (hidden when the sidebar is collapsed). */
export function SectionLabel({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="mx-auto my-2 h-px w-6 bg-[color:var(--j-DCDFE4)]" aria-hidden />;
  return <p className="mb-1 px-2.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--j-626F86)]">{children}</p>;
}

/** The look of an entry: active = white with a line and the navy icon, idle = quiet grey. */
export const entryClass = (active: boolean, collapsed: boolean) => cx(
  'group relative flex w-full items-center gap-2.5 rounded-[4px] py-1.5 text-left text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--j-85B8FF)]',
  collapsed ? 'justify-center px-0' : 'px-2.5',
  active ? 'bg-[color:var(--j-E9F2FF)] font-semibold text-[color:var(--j-0055CC)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-[color:var(--j-0C66E4)]'
    : 'font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]');
export const entryIcon = (active: boolean) => cx('flex-shrink-0', active ? 'text-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-626F86)] group-hover:text-[color:var(--j-44546F)]');

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

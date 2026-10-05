'use client';

// Drill-down drawers of the Overview. Every analytic opens a drawer with all the data
// behind it; inside, a branch / channel / day / menu / payment method opens its own
// drawer, which keeps the filters of where it came from (a channel opened from a branch
// shows that channel in that branch). Back walks the history, Close leaves it.

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import type { Branch } from '@/components/BranchFilter';
import { GrowthBasis, withParams } from '@/lib/overview';

export type KpiKey = 'sales' | 'nettSales' | 'bills' | 'avgTicket';

/** Query overrides on top of the page filters (dateFrom, dateTo, branch, channel). */
export type Overrides = Record<string, string>;

export type DrillTarget = { overrides?: Overrides } & (
  | { kind: 'kpi'; metric: KpiKey }
  | { kind: 'trend' }
  | { kind: 'growth'; basis: GrowthBasis }
  | { kind: 'channels' }
  | { kind: 'branches' }
  | { kind: 'hours' }
  | { kind: 'menus' }
  | { kind: 'payments' }
  | { kind: 'basket' }
  | { kind: 'deductions' }
  | { kind: 'monthly' }
  | { kind: 'profile'; title: string; subtitle?: string; focus: 'branch' | 'channel' | 'period' }
  | { kind: 'menu'; menuId: string; menuKind: 'menu' | 'package' | 'extra'; name: string }
  | { kind: 'payment'; method: string; label: string }
);

export interface PageFilters {
  from: string;
  to: string;
  branch: string;
  channels: string[];
}

interface DrillState {
  /** query of the page filters (no overrides) */
  baseQuery: string;
  filters: PageFilters;
  branches: Branch[];
  stack: DrillTarget[];
  open: (t: DrillTarget) => void;
  /** opens from inside a drawer: keeps the current drawer's overrides */
  drill: (t: DrillTarget) => void;
  back: () => void;
  close: () => void;
}

const DrillContext = createContext<DrillState | null>(null);

export function DrillProvider({ baseQuery, filters, branches, children }: {
  baseQuery: string; filters: PageFilters; branches: Branch[]; children: ReactNode;
}) {
  const [stack, setStack] = useState<DrillTarget[]>([]);
  const open = useCallback((t: DrillTarget) => setStack([t]), []);
  const drill = useCallback((t: DrillTarget) => setStack(s => {
    const inherited = s[s.length - 1]?.overrides ?? {};
    return [...s, { ...t, overrides: { ...inherited, ...(t.overrides ?? {}) } }].slice(-12);
  }), []);
  const back = useCallback(() => setStack(s => s.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);
  const value = useMemo(() => ({ baseQuery, filters, branches, stack, open, drill, back, close }),
    [baseQuery, filters, branches, stack, open, drill, back, close]);
  return <DrillContext.Provider value={value}>{children}</DrillContext.Provider>;
}

export function useDrill(): DrillState {
  const ctx = useContext(DrillContext);
  if (!ctx) throw new Error('useDrill outside DrillProvider');
  return ctx;
}

/** Optional variant for components that are also used outside the Overview. */
export function useOptionalDrill(): DrillState | null {
  return useContext(DrillContext);
}

/** Query of a target: page filters + its overrides. */
export function targetQuery(base: string, t: DrillTarget): string {
  return withParams(base, t.overrides ?? {});
}

/** Targets for the common entities. */
export const to = {
  branch: (code: string, name: string): DrillTarget => ({ kind: 'profile', focus: 'branch', title: name, subtitle: code, overrides: { branch: code } }),
  channel: (channel: string): DrillTarget => ({ kind: 'profile', focus: 'channel', title: channel, overrides: { channel } }),
  period: (from: string, to2: string, title: string): DrillTarget => ({
    kind: 'profile', focus: 'period', title, overrides: { dateFrom: from, dateTo: to2 },
  }),
};

'use client';

import { ReactNode } from 'react';
import {
  Activity, BarChart3, Clock, CreditCard, Gauge, LineChart, MinusCircle, Receipt, ShoppingBasket, Store, TrendingUp, UtensilsCrossed, X,
} from 'lucide-react';
import { branchesLabel } from '@/components/BranchFilter';
import { buttonSecondary } from '@/components/ui/Dialog';
import Drawer from '@/components/ui/Drawer';
import InfoTip from '@/components/ui/InfoTip';
import type { InfoKey } from '@/lib/metricInfo';
import { channelLabel } from '@/lib/overview';
import { DrillTarget, targetQuery, useDrill } from './DrillContext';
import {
  BasketDrawer, BranchesDrawer, ChannelsDrawer, DeductionsDrawer, HoursDrawer, KpiDrawer, MenusDrawer, MonthlyDrawer, PaymentsDrawer, TrendDrawer,
} from './AnalyticsDrawers';
import { MenuDrawer, PaymentDrawer, ProfileDrawer } from './EntityDrawers';
import { GrowthDrawer } from './GrowthDrawer';
import { rangeText } from './parts';

const KPI_TITLES = { sales: 'Gross sales', nettSales: 'Nett sales', bills: 'Bills', avgTicket: 'Average ticket' };

function head(t: DrillTarget): { title: string; icon: ReactNode } {
  switch (t.kind) {
    case 'kpi': return { title: KPI_TITLES[t.metric], icon: <Gauge size={18} /> };
    case 'trend': return { title: 'Sales trend', icon: <LineChart size={18} /> };
    case 'growth': return { title: 'Gross sales growth', icon: <TrendingUp size={18} /> };
    case 'channels': return { title: 'Channel mix', icon: <BarChart3 size={18} /> };
    case 'branches': return { title: 'Branches', icon: <Store size={18} /> };
    case 'hours': return { title: 'Busy hours', icon: <Clock size={18} /> };
    case 'menus': return { title: 'Menus', icon: <UtensilsCrossed size={18} /> };
    case 'payments': return { title: 'Payment methods', icon: <CreditCard size={18} /> };
    case 'basket': return { title: 'Basket', icon: <ShoppingBasket size={18} /> };
    case 'deductions': return { title: 'Deductions', icon: <MinusCircle size={18} /> };
    case 'monthly': return { title: 'Monthly growth', icon: <TrendingUp size={18} /> };
    case 'profile': return {
      title: t.focus === 'channel' ? channelLabel(t.title) : t.title,
      icon: t.focus === 'branch' ? <Store size={18} /> : t.focus === 'channel' ? <Activity size={18} /> : <Receipt size={18} />,
    };
    case 'menu': return { title: t.name, icon: <UtensilsCrossed size={18} /> };
    case 'payment': return { title: t.label, icon: <CreditCard size={18} /> };
  }
}

function body(t: DrillTarget, q: string): ReactNode {
  switch (t.kind) {
    case 'kpi': return <KpiDrawer q={q} metric={t.metric} />;
    case 'trend': return <TrendDrawer q={q} />;
    case 'growth': return <GrowthDrawer q={q} basis={t.basis} />;
    case 'channels': return <ChannelsDrawer q={q} />;
    case 'branches': return <BranchesDrawer q={q} />;
    case 'hours': return <HoursDrawer q={q} />;
    case 'menus': return <MenusDrawer q={q} />;
    case 'payments': return <PaymentsDrawer q={q} />;
    case 'basket': return <BasketDrawer q={q} />;
    case 'deductions': return <DeductionsDrawer q={q} />;
    case 'monthly': return <MonthlyDrawer q={q} />;
    case 'profile': return <ProfileDrawer q={q} focus={t.focus} />;
    case 'menu': return <MenuDrawer q={q} menuId={t.menuId} menuKind={t.menuKind} />;
    case 'payment': return <PaymentDrawer q={q} method={t.method} />;
  }
}

function infoOf(t: DrillTarget): InfoKey {
  switch (t.kind) {
    case 'kpi': return t.metric;
    case 'trend': case 'growth': case 'channels': case 'branches': case 'hours': case 'menus':
    case 'payments': case 'basket': case 'deductions': case 'monthly': return t.kind;
    case 'menu': return 'menus';
    case 'payment': return 'payments';
    default: return 'sales';
  }
}

/** The drill-down drawer of the Overview (one at a time, with history). */
export default function DrillHost() {
  const { stack, baseQuery, filters, branches, back, close } = useDrill();
  const t = stack[stack.length - 1];
  if (!t) return null;
  const q = targetQuery(baseQuery, t);
  const p = new URLSearchParams(q);
  const from = p.get('dateFrom');
  const until = p.get('dateTo') || from;
  const branch = p.get('branch') ?? '';
  const channels = (p.get('channel') ?? '').split(',').filter(Boolean);
  const context = [
    from ? rangeText(from, until!) : 'Last 30 days to yesterday',
    branchesLabel(branch, branches),
    channels.length ? channels.map(channelLabel).join(', ') : 'All channels',
  ].join(' · ');
  const { title, icon } = head(t);
  const trail = stack.length > 1 ? stack.slice(0, -1).map(s => head(s).title).join(' › ') : null;

  return (
    <Drawer open onClose={close} size="xl" icon={icon} title={title} onBack={stack.length > 1 ? back : undefined} titleExtra={<InfoTip info={infoOf(t)} />}
      description={(
        <>
          {trail && <span className="block text-[11px] text-slate-400">{trail} ›</span>}
          {t.kind === 'profile' && t.subtitle ? `${t.subtitle} · ` : ''}{context}
          {filters.from !== (from ?? filters.from) || filters.branch !== branch ? <span className="ml-1 text-[11px] text-blue-700">(drilled down)</span> : null}
        </>
      )}
      footer={<button type="button" className={buttonSecondary} onClick={close}><X size={16} /> Close</button>}>
      {/* key: a new target starts with fresh state (sort, tabs, chart type) */}
      <div key={`${stack.length}-${q}-${t.kind}`}>{body(t, q)}</div>
    </Drawer>
  );
}

'use client';

import { AlertTriangle, CheckCircle2, ClipboardList, PackageX, Warehouse } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { IssuesResponse, useCostControl } from '@/lib/costControl';

const short = (n: string) => n.replace(/^Kopi Calf (To Go )?/, '');

/**
 * What to fix in ESB before the figures are final: unposted stock opnames (provisional
 * periods), implausible opname lines left out of actual COGS, and stock locations with usage
 * but no POS sales (kept out of the network totals).
 */
export default function DataIssues({ query }: { query: string }) {
  const res = useCostControl<IssuesResponse>('issues', query);
  const d = res.data;
  if (!d) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" />;
  const byStatus = d.pendingOpnames.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
  const dates = [...new Set(d.pendingOpnames.map(p => p.docDate))].sort();
  const clean = !d.pendingOpnames.length && !d.suspectLines.length && !d.withoutSales.length && !d.hppAnomalies.length && !d.usageSpikes.length;
  const month = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  if (clean) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 size={16} /> No data issues in this range: every stock opname is posted in ESB and every stock location has POS sales.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {d.pendingOpnames.length > 0 && (
        <Issue tone="amber" icon={<ClipboardList size={16} />} title={`${formatNumber(d.pendingOpnames.length)} stock opname(s) not posted in ESB yet`}
          text={<>
            {Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(' · ')} · opname date {dates.map(formatDate).join(', ')}.
            Their variance is counted as <b>pending</b>: the figures of these periods are <b>provisional</b> until the opnames are authorized in ESB
            (then the nightly valuation sync updates them automatically).
          </>}>
          <Table head={['Outlet', 'Document', 'Date', 'Status', 'Lines']} rows={d.pendingOpnames.slice(0, 200).map(p => [
            short(p.branchName), <span key="d" className="font-mono">{p.docNum}</span>, formatDate(p.docDate), p.status, formatNumber(p.lines),
          ])} />
        </Issue>
      )}

      {d.suspectLines.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={`${formatNumber(d.suspectLines.length)} implausible opname line(s) left out of actual COGS`}
          text={<>
            Lines of unposted opnames whose variance is above {formatCurrency(d.rule.floor)} and above {Math.round(d.rule.share * 100)}% of the outlet&apos;s
            theoretical COGS in the period — usually a wrong <b>system stock</b> in ESB (e.g. a mis-entered receipt or transfer). Fix the stock in ESB before
            posting the opname, otherwise the loss is booked as shown.
          </>}>
          <Table head={['Outlet', 'Document', 'Product', 'Physical', 'System (ESB)', 'HPP', 'Variance', 'Period theor. COGS']} rows={d.suspectLines.map(l => [
            short(l.branchName), <span key="d" className="font-mono">{l.docNum}</span>, l.productName,
            formatNumber(l.physicalQty), <b key="s" className="text-red-700">{formatNumber(l.systemQty)}</b>, formatCurrency(Math.round(l.hpp)),
            <b key="v" className="text-red-700">{formatCurrency(Math.round(l.variance))}</b>, formatCurrency(Math.round(l.periodTheoreticalCogs)),
          ])} />
        </Issue>
      )}

      {d.usageSpikes.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={`${formatNumber(d.usageSpikes.length)} item usage spike(s) in the ESB valuation`}
          text={<>An item&apos;s theoretical usage per rupiah of sales in a month is more than 3× its usual level — usually a wrong <b>recipe (BOM) quantity</b> in ESB
            for that time. Theoretical and actual COGS of those months are inflated (the later opname then shows a large “gain”); read those months with care
            and correct the BOM in ESB.</>}>
          <Table head={['Month', 'Item', 'Theoretical usage', 'Value', '× usual']} rows={d.usageSpikes.map(u => [
            month(u.month), u.productName, `${formatNumber(Math.round(u.qty))} ${u.unit ?? ''}`, <b key="v" className="text-red-700">{formatCurrency(Math.round(u.value))}</b>, `${u.factor}×`,
          ])} />
        </Issue>
      )}

      {d.hppAnomalies.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={`${formatNumber(d.hppAnomalies.length)} HPP anomaly(ies) in the ESB valuation`}
          text={<>The outlet&apos;s HPP (cost per unit) of an item is more than 3× the network median for the same period — usually a mis-entered
            purchase / receipt price in ESB. The outlet&apos;s COGS of that period is overstated by about the impact shown.</>}>
          <Table head={['Outlet', 'Period from', 'Item', 'HPP', 'Network median', 'Qty used', 'Impact']} rows={d.hppAnomalies.map(h => [
            short(h.branchName), formatDate(h.periodStart), h.productName, <b key="h" className="text-red-700">{formatCurrency(h.hpp)}</b>,
            formatCurrency(h.medianHpp), `${formatNumber(Math.round(h.qty))} ${h.unit ?? ''}`, <b key="i" className="text-red-700">{formatCurrency(Math.round(h.impact))}</b>,
          ])} />
        </Issue>
      )}

      {d.withoutSales.length > 0 && (
        <Issue tone="slate" icon={<Warehouse size={16} />} title={`${formatNumber(d.withoutSales.length)} stock location(s) with usage but no POS sales`}
          text={<>Bulk-order and other stock locations: their stock usage has no POS sales to compare with, so they are <b>left out of the network
            totals, medians and status counts</b> (their revenue is not in the POS).</>}>
          <Table head={['Location', 'Actual COGS (usage)']} rows={d.withoutSales.map(w => [w.branchName, formatCurrency(Math.round(w.actualCogs))])} />
        </Issue>
      )}
    </div>
  );
}

function Issue({ tone, icon, title, text, children }: {
  tone: 'amber' | 'red' | 'slate'; icon: React.ReactNode; title: string; text: React.ReactNode; children: React.ReactNode;
}) {
  const cls = { amber: 'border-amber-200 bg-amber-50/60 text-amber-900', red: 'border-red-200 bg-red-50/60 text-red-900', slate: 'border-slate-200 bg-white text-slate-800' }[tone];
  return (
    <details className={`rounded-xl border px-4 py-3 ${cls}`} open={tone === 'red'}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        {tone === 'slate' ? icon : <AlertTriangle size={16} />}{title}
      </summary>
      <p className="mt-2 text-xs leading-relaxed">{text}</p>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="custom-scrollbar max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full whitespace-nowrap text-xs text-slate-700">
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>{head.map(h => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

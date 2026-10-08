'use client';

import { AlertTriangle, CheckCircle2, ClipboardList, PackageX, Scale, Warehouse } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { IssuesResponse } from '@/lib/costControl';
import { Resource } from '@/lib/overview';
import { locale, tr } from '@/lib/i18n';

const short = (n: string) => n.replace(/^Kopi Calf (To Go )?/, '');
const MODULES: Record<string, string> = {
  simple_manufacturing: 'Simple Manufacturing', goods_receipt: 'Goods Receipt', goods_delivery: 'Goods Delivery',
  simple_purchase: 'Simple Purchase', item_journal: 'Item Journal', simple_transfer: 'Simple Transfer',
  goods_transfer_request: 'Transfer Request',
};
const qtyText = (q: number) => formatNumber(Math.round(q * 1000) / 1000);

/**
 * What to fix in ESB before the figures are final: unposted stock opnames (provisional
 * periods), implausible opname lines left out of actual COGS, and stock locations with usage
 * but no POS sales (kept out of the network totals).
 */
export default function DataIssues({ resource: res }: { resource: Resource<IssuesResponse> }) {
  const d = res.data;
  if (res.error && !d) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <AlertTriangle size={16} className="text-amber-500" /> {tr('Data quality checks could not be loaded (')}{res.error}).
        <button type="button" onClick={res.retry} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">{tr('Try again')}</button>
      </p>
    );
  }
  if (!d) return <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-label={tr('Running data quality checks')} />;
  const byStatus = d.pendingOpnames.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {});
  const dates = [...new Set(d.pendingOpnames.map(p => p.docDate))].sort();
  const qtyErrors = d.quantityErrors ?? [];
  const spikes = d.stockSpikes ?? [];
  const negative = d.bookStock?.items ?? [];
  const openSpikes = spikes.filter(s => s.open).length;
  const clean = !d.pendingOpnames.length && !d.suspectLines.length && !d.withoutSales.length && !d.hppAnomalies.length && !d.usageSpikes.length
    && !qtyErrors.length && !spikes.length && !negative.length;
  const month = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

  if (clean) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 size={16} /> {tr('No data issues in this range: every stock opname is posted in ESB and every stock location has POS sales.')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {d.pendingOpnames.length > 0 && (
        <Issue tone="amber" icon={<ClipboardList size={16} />} title={tr('{0} stock opname(s) not posted in ESB yet', formatNumber(d.pendingOpnames.length))}
          text={<>
            {Object.entries(byStatus).map(([s, n]) => `${n} ${s}`).join(' · ')} {tr('· opname date')} {dates.map(formatDate).join(', ')}{tr('. Their variance is counted as')} <b>{tr('pending')}</b>{tr(': the figures of these periods are')} <b>{tr('provisional')}</b> {tr('until the opnames are authorized in ESB (then the nightly valuation sync updates them automatically).')}
          </>}>
          <Table head={[tr('Outlet'), tr('Document'), tr('Date'), tr('Status'), tr('Lines')]} rows={d.pendingOpnames.slice(0, 200).map(p => [
            short(p.branchName), <span key="d" className="font-mono">{p.docNum}</span>, formatDate(p.docDate), p.status, formatNumber(p.lines),
          ])} />
        </Issue>
      )}

      {d.suspectLines.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={tr('{0} implausible opname line(s) left out of actual COGS', formatNumber(d.suspectLines.length))}
          text={<>
            {tr('Lines of unposted opnames whose variance is above')} {formatCurrency(d.rule.floor)} {tr('and above')} {Math.round(d.rule.share * 100)}{tr('% of the outlet\'s theoretical COGS in the period — usually a wrong')} <b>{tr('system stock')}</b> {tr('in ESB (e.g. a mis-entered receipt or transfer). Fix the stock in ESB before posting the opname, otherwise the loss is booked as shown.')}
          </>}>
          <Table head={[tr('Outlet'), tr('Document'), tr('Product'), tr('Physical'), tr('System (ESB)'), 'HPP', tr('Variance'), tr('Period theor. COGS')]} rows={d.suspectLines.map(l => [
            short(l.branchName), <span key="d" className="font-mono">{l.docNum}</span>, l.productName,
            formatNumber(l.physicalQty), <b key="s" className="text-red-700">{formatNumber(l.systemQty)}</b>, formatCurrency(Math.round(l.hpp)),
            <b key="v" className="text-red-700">{formatCurrency(Math.round(l.variance))}</b>, formatCurrency(Math.round(l.periodTheoreticalCogs)),
          ])} />
        </Issue>
      )}

      {qtyErrors.length > 0 && (
        <Issue tone="red" icon={<Scale size={16} />} title={tr('{0} document line(s) with an implausible quantity in ESB', formatNumber(qtyErrors.length))}
          text={<>{tr('The quantity is more than 200× what is usually entered for that item in the same unit and document type — typically')}
            <b> {tr('grams typed into a KG field')}</b> {tr('(e.g. 25,163 KG instead of 25.163 KG) or pieces into a pack unit. Once authorized it creates')}
            <b> {tr('phantom stock')}</b>{tr(': HPP and COGS of the period are distorted and the next opname shows a huge variance. Correct the document in ESB (or have the opname remove the phantom stock before it is posted).')}</>}>
          <Table head={[tr('Date'), tr('Location'), tr('Document'), tr('Type'), tr('Item'), tr('Entered'), tr('Usual'), '×', tr('Status'), tr('By')]} rows={qtyErrors.map(q => [
            formatDate(q.docDate), short(q.locationName), <span key="d" className="font-mono">{q.docNum}</span>, MODULES[q.module] ?? q.module,
            q.productName, <b key="q" className="text-red-700">{qtyText(q.qty)} {q.unit}</b>, `${qtyText(q.usualQty)} ${q.unit}`,
            `${formatNumber(q.factor)}×`, q.status, q.createdBy ?? '–',
          ])} />
        </Issue>
      )}

      {spikes.length > 0 && (
        <Issue tone="red" icon={<Scale size={16} />}
          title={tr('{0} period(s) with phantom stock in the ESB valuation{1}', formatNumber(spikes.length), openSpikes ? tr(' · {0} still in stock', openSpikes) : '')}
          text={<>{tr('Stock of an item coming in (or going out other than by sales: production material, transfer, item journal) at a location was more than 200× its usual weekly flow there — from the quantity errors above. In those periods the item\'s HPP and COGS are distorted. Rows marked')} <b>{tr('still in the books')}</b> {tr('have not been corrected: phantom stock coming in will show as a large loss at the next opname, phantom stock going out leaves a large negative balance. Correct the document in ESB.')}</>}>
          <Table head={[tr('Period'), tr('Location'), tr('Item'), tr('Flow'), tr('Qty'), tr('Usual / week'), '×', tr('Removed by opname'), tr('Book stock now')]} rows={spikes.map(s => [
            `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}`, short(s.locationName), s.productName,
            s.direction === 'out' ? tr('Out') : tr('In'),
            <b key="i" className="text-red-700">{qtyText(s.inQty)}</b>, qtyText(s.usualInQty), `${formatNumber(s.factor)}×`,
            s.opnameQty ? qtyText(s.opnameQty) : '–',
            s.open ? <b key="o" className="text-red-700">{qtyText(s.latestEndQty)} {tr('· still in the books')}</b> : qtyText(s.latestEndQty),
          ])} />
        </Issue>
      )}

      {negative.length > 0 && d.bookStock && (
        <Issue tone="red" icon={<Scale size={16} />}
          title={tr('Negative book stock {0} at the end of the range', formatCurrency(Math.round(d.bookStock.negative)))}
          text={<>{tr('ESB recorded more of these items going out than coming in, so the book stock is below zero (positive stock:')} {formatCurrency(Math.round(d.bookStock.positive))}{tr('). Usually a receipt or production not entered/authorized yet, or a wrong quantity going out (see phantom stock). Balances below')}
            {' '}{formatCurrency(10000000)} {tr('are listed; correct the source document in ESB.')}</>}>
          <Table head={[tr('Location'), tr('Item'), tr('Book stock'), tr('Value')]} rows={negative.map(n => [
            short(n.locationName), n.productName, qtyText(n.qty), <b key="v" className="text-red-700">{formatCurrency(Math.round(n.value))}</b>,
          ])} />
        </Issue>
      )}

      {d.usageSpikes.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={tr('{0} item usage spike(s) in the ESB valuation', formatNumber(d.usageSpikes.length))}
          text={<>{tr('An item\'s theoretical usage per rupiah of sales in a month is more than 3× its usual level — usually a wrong')} <b>{tr('recipe (BOM) quantity')}</b> {tr('in ESB for that time. Theoretical and actual COGS of those months are inflated (the later opname then shows a large “gain”); read those months with care and correct the BOM in ESB.')}</>}>
          <Table head={[tr('Month'), tr('Item'), tr('Theoretical usage'), tr('Value'), tr('× usual')]} rows={d.usageSpikes.map(u => [
            month(u.month), u.productName, `${formatNumber(Math.round(u.qty))} ${u.unit ?? ''}`, <b key="v" className="text-red-700">{formatCurrency(Math.round(u.value))}</b>, `${u.factor}×`,
          ])} />
        </Issue>
      )}

      {d.hppAnomalies.length > 0 && (
        <Issue tone="red" icon={<PackageX size={16} />} title={tr('{0} HPP anomaly(ies) in the ESB valuation', formatNumber(d.hppAnomalies.length))}
          text={<>{tr('The outlet\'s HPP (cost per unit) of an item is more than 3× the network median for the same period — usually a mis-entered purchase / receipt price in ESB. The outlet\'s COGS of that period is overstated by about the impact shown.')}</>}>
          <Table head={[tr('Outlet'), tr('Period from'), tr('Item'), 'HPP', tr('Network median'), tr('Qty used'), tr('Impact')]} rows={d.hppAnomalies.map(h => [
            short(h.branchName), formatDate(h.periodStart), h.productName, <b key="h" className="text-red-700">{formatCurrency(h.hpp)}</b>,
            formatCurrency(h.medianHpp), `${formatNumber(Math.round(h.qty))} ${h.unit ?? ''}`, <b key="i" className="text-red-700">{formatCurrency(Math.round(h.impact))}</b>,
          ])} />
        </Issue>
      )}

      {d.withoutSales.length > 0 && (
        <Issue tone="slate" icon={<Warehouse size={16} />} title={tr('{0} stock location(s) with usage but no POS sales', formatNumber(d.withoutSales.length))}
          text={<>{tr('Bulk-order and other stock locations: their stock usage has no POS sales to compare with, so they are')} <b>{tr('left out of the network totals, medians and status counts')}</b> {tr('(their revenue is not in the POS).')}</>}>
          <Table head={[tr('Location'), tr('Actual COGS (usage)')]} rows={d.withoutSales.map(w => [w.branchName, formatCurrency(Math.round(w.actualCogs))])} />
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

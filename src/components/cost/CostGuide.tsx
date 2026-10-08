'use client';

import { BookOpen } from 'lucide-react';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { ReliabilityPill } from '@/components/cost/ReliabilityBanner';
import { Basis, bandText, cogsPct, CostSettings, pctText, sales, SummaryResponse } from '@/lib/costControl';
import { formatCurrency, fixed } from '@/lib/format';
import { tr } from '@/lib/i18n';

const rp = (v: number) => formatCurrency(Math.round(v));

/** Everything a cost controller needs to read the page: steps, terms with live examples, thresholds, reliability, workbook terms. */
export default function CostGuide({ summary, settings, basis, onClose }: {
  summary: SummaryResponse | null;
  settings: CostSettings | undefined;
  basis: Basis;
  onClose: () => void;
}) {
  const t = summary?.total;
  const s = t ? sales(t, basis) : 0;
  const per100 = (v: number) => (s ? `Rp ${fixed((v / s * 100), 1).replace('.', ',')}` : '–');
  const basisLabel = basis === 'net' ? 'net sales' : 'subtotal';
  const terms: { term: string; meaning: string; formula: string; example?: string }[] = [
    {
      term: basis === 'net' ? tr('Net sales') : tr('Subtotal'),
      meaning: basis === 'net' ? tr('Sales after all discounts (ESB Nett Sales). The standard basis for ratios.') : tr('Sales before discounts ("Sub Total / Gross Sales" in the workbook). Shows the effect of promotions.'),
      formula: basis === 'net' ? tr('Subtotal − bill, menu, promotion and voucher discounts') : tr('Σ menu price × qty'),
      example: t ? rp(s) : undefined,
    },
    {
      term: tr('Theoretical COGS (recipes)'),
      meaning: tr('What the outlets should have used for what they sold. Set by menu mix, recipes and purchase prices.'),
      formula: tr('Σ menu sold × recipe (ESB BOM) × HPP'),
      example: t ? tr('{0} = {1} of {2}: {3} of every Rp 100', rp(t.theoreticalCogs), pctText(cogsPct(t, basis, 'theoretical')), basisLabel, per100(t.theoreticalCogs)) : undefined,
    },
    {
      term: tr('Actual COGS'),
      meaning: tr('What the outlets really used: recipes + item journals + what the stock opname found missing.'),
      formula: tr('Theoretical + other usage + manufacturing net − stock variance'),
      example: t ? tr('{0} = {1} of {2}: {3} of every Rp 100', rp(t.actualCogs), pctText(cogsPct(t, basis, 'actual')), basisLabel, per100(t.actualCogs)) : undefined,
    },
    {
      term: tr('Excess vs recipes'),
      meaning: tr('The controllable loss: used more than the recipes allow (waste, over-portioning, unrecorded usage, stock loss). Negative = used less.'),
      formula: tr('Actual COGS − theoretical COGS · usage ratio = actual ÷ theoretical × 100'),
      example: t ? tr('{0} · usage ratio {1}', rp(t.actualCogs - t.theoreticalCogs), t.hasOpname ? pctText(t.usageRatio) : '–') : undefined,
    },
    {
      term: tr('Stock variance'),
      meaning: tr('Physical count minus system stock at the stock opname, valued at HPP. Negative = stock missing. Pending = opname still Draft/New in ESB.'),
      formula: tr('Σ (physical − system) × HPP'),
      example: t ? tr('{0} (pending {1})', rp(t.variance), rp(t.pendingVariance)) : undefined,
    },
    {
      term: tr('Other usage'),
      meaning: tr('Stock taken out with an ESB item journal instead of being sold: waste, R&D, marketing, QC, staff meals.'),
      formula: tr('Σ item journal value'),
      example: t ? rp(t.otherUsage) : undefined,
    },
    {
      term: tr('Purchases'),
      meaning: tr('Goods received from Warehouse, CK Espresso, CK Food and suppliers. Differs from usage by the change in stock.'),
      formula: tr('Actual COGS ≈ opening stock + purchases − closing stock'),
      example: t ? tr('{0} = {1} of {2}', rp(t.purchases), pctText(s ? t.purchases / s * 100 : null), basisLabel) : undefined,
    },
  ];

  return (
    <Drawer open onClose={onClose} size="lg" icon={<BookOpen size={18} />} title={tr('How to read Cost Control')}
      description={tr('Terms, formulas, thresholds and how reliable the figures are')}>
      <div className="space-y-2">
        <DrawerSection title={tr('Read the page in four steps')}>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
            <li><b>{tr('Data reliability')}</b> {tr('(top): are the figures final? Provisional = opnames not posted in ESB yet; Check data = an error in ESB distorts them.')}</li>
            <li><b>{tr('Summary')}</b>{tr(': actual COGS against the recipes. The difference —')} <b>{tr('excess vs recipes')}</b> {tr('— is the money an outlet can still save; the recipe cost itself is a menu and pricing decision.')}</li>
            <li><b>{tr('Outlets')}</b>{tr(': sorted by excess in rupiah, so the biggest losses come first. Click an outlet for its items, trend and purchase forecast.')}</li>
            <li><b>{tr('Data quality')}</b>{tr(': the documents to correct in ESB. After the nightly sync the figures update automatically.')}</li>
          </ol>
        </DrawerSection>

        <DrawerSection title={tr('Terms')} description={summary ? tr('Examples: the network in the selected range, ratios on {0}.', basisLabel) : undefined}>
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {terms.map(x => (
              <div key={x.term} className="space-y-1 px-3 py-2.5">
                <dt className="text-sm font-semibold text-slate-900">{x.term}</dt>
                <dd className="text-xs leading-relaxed text-slate-600">{x.meaning}</dd>
                <dd className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">{x.formula}</dd>
                {x.example && <dd className="text-xs text-slate-500">{tr('Now:')} <span className="font-medium tabular-nums text-slate-800">{x.example}</span></dd>}
              </div>
            ))}
          </dl>
        </DrawerSection>

        {settings && (
          <DrawerSection title={tr('Status thresholds')} description={tr('Set by a superadmin in Settings.')}>
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1 font-medium">{tr('Measure')}</th><th className="py-1 font-medium">{tr('Good')}</th><th className="py-1 font-medium">{tr('Watch')}</th><th className="py-1 font-medium">{tr('High')}</th><th className="py-1 font-medium">{tr('Critical')}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {([
                  [tr('Usage vs recipes (± from 100%)'), bandText(settings.usage_bands)],
                  [tr('Actual COGS % of sales'), bandText(settings.cogs_bands)],
                  [tr('Actual − theoretical (pp)'), bandText(settings.variance_bands, ' pp')],
                  [tr('Other usage % of sales'), bandText(settings.waste_bands)],
                ] as const).map(([label, b]) => (
                  <tr key={label}><td className="py-1.5 pr-2">{label}</td>{b.map(v => <td key={v} className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {t && (cogsPct(t, basis, 'theoretical') ?? 0) > settings.cogs_bands.good && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900">
                {tr('The recipes alone cost')} {pctText(cogsPct(t, basis, 'theoretical'))} {tr('of')} {basisLabel}{tr(', above the COGS target of ≤')} {settings.cogs_bands.good}{tr('%. No outlet can reach the target by running better — it needs recipe or price changes, or a target that fits the menu. That is why the outlet status uses')} <b>{tr('usage vs recipes')}</b> {tr('by default.')}
              </p>
            )}
          </DrawerSection>
        )}

        <DrawerSection title={tr('How reliable are the figures')}>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
            <li className="flex gap-2"><ReliabilityPill level="final" /><span>{tr('Every stock opname in the range is posted in ESB and no data issue touches the outlet.')}</span></li>
            <li className="flex gap-2"><ReliabilityPill level="provisional" /><span>{tr('Opnames still Draft/New in ESB (their variance is counted as pending and can change), or no opname in the range (usage vs recipes not measurable).')}</span></li>
            <li className="flex gap-2"><ReliabilityPill level="check" /><span>{tr('An error in ESB distorts the figures: an impossible opname line (left out of actual COGS), a document with an impossible quantity (phantom stock), or an HPP anomaly. Fix the document in ESB.')}</span></li>
          </ul>
          <p className="text-xs leading-relaxed text-slate-500">
            {tr('Checked against the cost control workbook for September 2026: subtotal identical for all 105 outlets (Rp 45,795,696,100), purchases within 0.05%, usage value within 0.7%.')}
          </p>
        </DrawerSection>

        <DrawerSection title={tr('Cost control workbook ↔ this page')} description={tr('"CALF – Rasio Outlet" terms and where to find them here.')}>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500"><tr><th className="py-1 pr-2 font-medium">{tr('Workbook')}</th><th className="py-1 font-medium">{tr('Portal')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100 align-top text-slate-700">
              {([
                [tr('Sub Total (Gross Sales)'), tr('Subtotal (ratio basis "Subtotal") — identical')],
                [tr('Pendapatan (Net Sales)'), tr('Not the same: the workbook deducts MDR / platform commission; the portal uses ESB Nett Sales (after discounts). Ratios on the workbook net are higher.')],
                [tr('COGS Value (Pembelian BB + Espresso + Dimsum)'), tr('Purchases')],
                [tr('COGS Ratio (Gross / Net)'), tr('Purchases ÷ sales (Purchases tile)')],
                [tr('Usage Ratio (Gross)'), tr('Actual COGS % of subtotal')],
                [tr('SO 31 Aug / SO 30 Sep'), tr('Physical opname value; the portal shows the ESB book stock and the opname difference separately (stock variance)')],
                [tr('Waste / Item Journal'), tr('Other usage')],
                [tr('Delta COGS ratio − Usage ratio'), tr('Purchases % − actual COGS % (= stock built up or used down)')],
              ] as const).map(([a, b]) => <tr key={a}><td className="py-1.5 pr-3 font-medium">{a}</td><td className="py-1.5">{b}</td></tr>)}
            </tbody>
          </table>
        </DrawerSection>

        <DrawerSection title={tr('When the figures change')}>
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
            <li>{tr('ESB inventory valuation and stock opnames are synced every night (04:15 WIB); Cost Control is recalculated at 05:10 WIB for the last 10 days and every Sunday 06:00 WIB for the last 40 days.')}</li>
            <li>{tr('Periods follow the opname rhythm: 1–7, 8–14, 15–21, 22–end of month. A date range covers every period starting in it.')}</li>
            <li>{tr('Weekly figures swing with opname timing; compare months for a stable view.')}</li>
          </ul>
        </DrawerSection>
      </div>
    </Drawer>
  );
}

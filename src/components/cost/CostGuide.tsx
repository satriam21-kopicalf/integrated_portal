'use client';

import { BookOpen } from 'lucide-react';
import Drawer, { DrawerSection } from '@/components/ui/Drawer';
import { ReliabilityPill } from '@/components/cost/ReliabilityBanner';
import { Basis, bandText, cogsPct, CostSettings, pctText, sales, SummaryResponse } from '@/lib/costControl';
import { formatCurrency } from '@/lib/format';

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
  const per100 = (v: number) => (s ? `Rp ${(v / s * 100).toFixed(1).replace('.', ',')}` : '–');
  const basisLabel = basis === 'net' ? 'net sales' : 'subtotal';
  const terms: { term: string; meaning: string; formula: string; example?: string }[] = [
    {
      term: basis === 'net' ? 'Net sales' : 'Subtotal',
      meaning: basis === 'net' ? 'Sales after all discounts (ESB Nett Sales). The standard basis for ratios.' : 'Sales before discounts ("Sub Total / Gross Sales" in the workbook). Shows the effect of promotions.',
      formula: basis === 'net' ? 'Subtotal − bill, menu, promotion and voucher discounts' : 'Σ menu price × qty',
      example: t ? rp(s) : undefined,
    },
    {
      term: 'Theoretical COGS (recipes)',
      meaning: 'What the outlets should have used for what they sold. Set by menu mix, recipes and purchase prices.',
      formula: 'Σ menu sold × recipe (ESB BOM) × HPP',
      example: t ? `${rp(t.theoreticalCogs)} = ${pctText(cogsPct(t, basis, 'theoretical'))} of ${basisLabel}: ${per100(t.theoreticalCogs)} of every Rp 100` : undefined,
    },
    {
      term: 'Actual COGS',
      meaning: 'What the outlets really used: recipes + item journals + what the stock opname found missing.',
      formula: 'Theoretical + other usage + manufacturing net − stock variance',
      example: t ? `${rp(t.actualCogs)} = ${pctText(cogsPct(t, basis, 'actual'))} of ${basisLabel}: ${per100(t.actualCogs)} of every Rp 100` : undefined,
    },
    {
      term: 'Excess vs recipes',
      meaning: 'The controllable loss: used more than the recipes allow (waste, over-portioning, unrecorded usage, stock loss). Negative = used less.',
      formula: 'Actual COGS − theoretical COGS · usage ratio = actual ÷ theoretical × 100',
      example: t ? `${rp(t.actualCogs - t.theoreticalCogs)} · usage ratio ${t.hasOpname ? pctText(t.usageRatio) : '–'}` : undefined,
    },
    {
      term: 'Stock variance',
      meaning: 'Physical count minus system stock at the stock opname, valued at HPP. Negative = stock missing. Pending = opname still Draft/New in ESB.',
      formula: 'Σ (physical − system) × HPP',
      example: t ? `${rp(t.variance)} (pending ${rp(t.pendingVariance)})` : undefined,
    },
    {
      term: 'Other usage',
      meaning: 'Stock taken out with an ESB item journal instead of being sold: waste, R&D, marketing, QC, staff meals.',
      formula: 'Σ item journal value',
      example: t ? rp(t.otherUsage) : undefined,
    },
    {
      term: 'Purchases',
      meaning: 'Goods received from Warehouse, CK Espresso, CK Food and suppliers. Differs from usage by the change in stock.',
      formula: 'Actual COGS ≈ opening stock + purchases − closing stock',
      example: t ? `${rp(t.purchases)} = ${pctText(s ? t.purchases / s * 100 : null)} of ${basisLabel}` : undefined,
    },
  ];

  return (
    <Drawer open onClose={onClose} size="lg" icon={<BookOpen size={18} />} title="How to read Cost Control"
      description="Terms, formulas, thresholds and how reliable the figures are">
      <div className="space-y-2">
        <DrawerSection title="Read the page in four steps">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
            <li><b>Data reliability</b> (top): are the figures final? Provisional = opnames not posted in ESB yet; Check data = an error in ESB distorts them.</li>
            <li><b>Summary</b>: actual COGS against the recipes. The difference — <b>excess vs recipes</b> — is the money an outlet can still save; the recipe cost itself is a menu and pricing decision.</li>
            <li><b>Outlets</b>: sorted by excess in rupiah, so the biggest losses come first. Click an outlet for its items, trend and purchase forecast.</li>
            <li><b>Data quality</b>: the documents to correct in ESB. After the nightly sync the figures update automatically.</li>
          </ol>
        </DrawerSection>

        <DrawerSection title="Terms" description={summary ? `Examples: the network in the selected range, ratios on ${basisLabel}.` : undefined}>
          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {terms.map(x => (
              <div key={x.term} className="space-y-1 px-3 py-2.5">
                <dt className="text-sm font-semibold text-slate-900">{x.term}</dt>
                <dd className="text-xs leading-relaxed text-slate-600">{x.meaning}</dd>
                <dd className="rounded bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-700">{x.formula}</dd>
                {x.example && <dd className="text-xs text-slate-500">Now: <span className="font-medium tabular-nums text-slate-800">{x.example}</span></dd>}
              </div>
            ))}
          </dl>
        </DrawerSection>

        {settings && (
          <DrawerSection title="Status thresholds" description="Set by a superadmin in Settings.">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500">
                <tr><th className="py-1 font-medium">Measure</th><th className="py-1 font-medium">Good</th><th className="py-1 font-medium">Watch</th><th className="py-1 font-medium">High</th><th className="py-1 font-medium">Critical</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {([
                  ['Usage vs recipes (± from 100%)', bandText(settings.usage_bands)],
                  ['Actual COGS % of sales', bandText(settings.cogs_bands)],
                  ['Actual − theoretical (pp)', bandText(settings.variance_bands, ' pp')],
                  ['Other usage % of sales', bandText(settings.waste_bands)],
                ] as const).map(([label, b]) => (
                  <tr key={label}><td className="py-1.5 pr-2">{label}</td>{b.map(v => <td key={v} className="whitespace-nowrap py-1.5 pr-2 tabular-nums">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {t && (cogsPct(t, basis, 'theoretical') ?? 0) > settings.cogs_bands.good && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs leading-relaxed text-amber-900">
                The recipes alone cost {pctText(cogsPct(t, basis, 'theoretical'))} of {basisLabel}, above the COGS target of ≤ {settings.cogs_bands.good}%.
                No outlet can reach the target by running better — it needs recipe or price changes, or a target that fits the menu. That is why the outlet status uses <b>usage vs recipes</b> by default.
              </p>
            )}
          </DrawerSection>
        )}

        <DrawerSection title="How reliable are the figures">
          <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
            <li className="flex gap-2"><ReliabilityPill level="final" /><span>Every stock opname in the range is posted in ESB and no data issue touches the outlet.</span></li>
            <li className="flex gap-2"><ReliabilityPill level="provisional" /><span>Opnames still Draft/New in ESB (their variance is counted as pending and can change), or no opname in the range (usage vs recipes not measurable).</span></li>
            <li className="flex gap-2"><ReliabilityPill level="check" /><span>An error in ESB distorts the figures: an impossible opname line (left out of actual COGS), a document with an impossible quantity (phantom stock), or an HPP anomaly. Fix the document in ESB.</span></li>
          </ul>
          <p className="text-xs leading-relaxed text-slate-500">
            Checked against the cost control workbook for September 2026: subtotal identical for all 105 outlets (Rp 45,795,696,100), purchases within 0.05%, usage value within 0.7%.
          </p>
        </DrawerSection>

        <DrawerSection title="Cost control workbook ↔ this page" description='"CALF – Rasio Outlet" terms and where to find them here.'>
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500"><tr><th className="py-1 pr-2 font-medium">Workbook</th><th className="py-1 font-medium">Portal</th></tr></thead>
            <tbody className="divide-y divide-slate-100 align-top text-slate-700">
              {([
                ['Sub Total (Gross Sales)', 'Subtotal (ratio basis "Subtotal") — identical'],
                ['Pendapatan (Net Sales)', 'Not the same: the workbook deducts MDR / platform commission; the portal uses ESB Nett Sales (after discounts). Ratios on the workbook net are higher.'],
                ['COGS Value (Pembelian BB + Espresso + Dimsum)', 'Purchases'],
                ['COGS Ratio (Gross / Net)', 'Purchases ÷ sales (Purchases tile)'],
                ['Usage Ratio (Gross)', 'Actual COGS % of subtotal'],
                ['SO 31 Aug / SO 30 Sep', 'Physical opname value; the portal shows the ESB book stock and the opname difference separately (stock variance)'],
                ['Waste / Item Journal', 'Other usage'],
                ['Delta COGS ratio − Usage ratio', 'Purchases % − actual COGS % (= stock built up or used down)'],
              ] as const).map(([a, b]) => <tr key={a}><td className="py-1.5 pr-3 font-medium">{a}</td><td className="py-1.5">{b}</td></tr>)}
            </tbody>
          </table>
        </DrawerSection>

        <DrawerSection title="When the figures change">
          <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-600">
            <li>ESB inventory valuation and stock opnames are synced every night (04:15 WIB); Cost Control is recalculated at 05:10 WIB for the last 10 days and every Sunday 06:00 WIB for the last 40 days.</li>
            <li>Periods follow the opname rhythm: 1–7, 8–14, 15–21, 22–end of month. A date range covers every period starting in it.</li>
            <li>Weekly figures swing with opname timing; compare months for a stable view.</li>
          </ul>
        </DrawerSection>
      </div>
    </Drawer>
  );
}

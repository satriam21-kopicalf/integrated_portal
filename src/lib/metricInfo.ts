// Where every Overview analytic comes from and how it is calculated (the ⓘ next to each title).
// One place, so cards, drawers and tiles explain the same thing the same way.

export interface MetricInfo {
  title: string;
  /** where the numbers come from */
  source: string[];
  /** what is counted */
  definition: string[];
  /** formulas */
  formula?: string[];
}

const POS = 'ESB POS transactions (integration_esb.transactions_pos_sales), synced from ESB every 15 minutes during trading hours (:05 today + yesterday, :20 / :35 / :50 today, 06:00–24:00 WIB; hourly at night) and re-synced for the last 7 days every night at 02:15 WIB.';
const AGG = 'Pre-aggregated per day × branch × channel × payment method × type (integration_portal.agg_sales_daily), refreshed after every sync (:20, :25, :40, :55 WIB during trading hours, hourly at :20 at night) and for the last 8 days nightly at 02:50 WIB.';
const SALES_RULE = 'Sales = transactions with status "Finished" and a bill number, the same rule as the ESB "Sales Recapitulation" report. Void/Cancelled, Other Cost (Finished without bill number: CUPPING, WASTE…) and open bills are excluded; menu lines cancelled on the bill (Print Cancelled) are not counted.';
const FILTERS = 'Follows the date, branch, channel and comparison filters. Comparison = the chosen comparison period (default: the same number of days just before; nothing before 1 Aug 2025).';
const CHANGE = 'Change % = (this period − comparison) ÷ comparison × 100';

// Cost Control (the ⓘ on the Cost Control page, its table and drawers)
const VALUATION = 'ESB inventory valuation per outlet location × item × opname period (1–7, 8–14, 15–21, 22–end of month): opening stock, purchases/transfers, recipe usage of POS sales (sales HPP), item journals, opname differences, closing stock — at ESB HPP (moving average cost). Synced nightly at 04:15 WIB; Cost Control recalculated at 05:10 WIB (last 10 days) and every Sunday 06:00 WIB (last 40 days).';
const OPNAME = 'ESB stock opname documents: posted (Authorized/Finished) differences are final; Draft/New ones are counted as pending (the period is provisional until they are posted in ESB).';
const COST_SALES = 'Sales of the same outlets and days from the POS aggregates (ESB "Sales" rule: Finished with a bill number).';
const COST_SCOPE = 'Follows the date range (every opname period starting in it) and the branch filter. Network totals only include locations with POS sales; bulk-order / stock locations are listed under Data quality.';
const COST_INFO = {
  costSales: {
    title: 'Sales (ratio basis)',
    source: [COST_SALES],
    definition: ['Net sales = subtotal after all discounts (bill, menu, promotion, voucher) = ESB Nett Sales. Subtotal = before discounts = "Sub Total (Gross Sales)" in the cost control workbook.', 'Switch the ratio basis at the top: net sales (standard) or subtotal (shows the effect of promotions).', COST_SCOPE],
    formula: ['Every ratio on this page = cost ÷ sales of the chosen basis × 100'],
  },
  costActual: {
    title: 'Actual COGS',
    source: [VALUATION, OPNAME],
    definition: ['What the outlets really used: recipe usage of what was sold, plus item journals (waste, R&D, marketing…), plus or minus what the stock opname found missing or extra.', 'A pending opname line with an impossible variance (> max(Rp 50 M, 50% of the outlet\'s recipe cost of the period)) is left out — see Data quality.', 'Same as the workbook "Usage Ratio": opening stock + purchases − closing stock, as a % of sales.', COST_SCOPE],
    formula: ['Actual COGS = theoretical COGS + other usage + manufacturing net − posted variance − pending variance', 'Actual COGS % = actual COGS ÷ sales × 100'],
  },
  costTheoretical: {
    title: 'Theoretical COGS (recipes)',
    source: [VALUATION, 'Recipes = ESB BOM of every menu sold.'],
    definition: ['What the outlets should have used: every menu sold × its recipe (BOM) × the item\'s HPP. Depends on menu mix, recipes and purchase prices — not on how well the outlet is run.', COST_SCOPE],
    formula: ['Theoretical COGS = Σ (menu qty sold × recipe qty × HPP)', 'Theoretical % = theoretical COGS ÷ sales × 100'],
  },
  costExcess: {
    title: 'Excess vs recipes',
    source: [VALUATION, OPNAME],
    definition: ['The controllable loss: how much more (or less) the outlets used than the recipes allow — waste, over-portioning, unrecorded usage or stock loss.', 'Negative = used less than the recipes say (recipe too heavy, unrecorded production/receipts, or an opname still to come).', 'Only meaningful when a stock opname was taken in the period.'],
    formula: ['Excess = actual COGS − theoretical COGS', 'Usage ratio = actual ÷ theoretical × 100 (100% = exactly as the recipes)', 'Status: |usage ratio − 100| against the usage thresholds in Settings'],
  },
  costVariance: {
    title: 'Stock variance',
    source: [OPNAME, VALUATION],
    definition: ['Physical count minus system stock at the stock opname, valued at HPP. Negative = stock missing (loss), positive = more stock than recorded.', 'Pending = opnames still Draft/New in ESB (not posted yet).'],
    formula: ['Stock variance = Σ (physical qty − system qty) × HPP', 'Variance = posted + pending'],
  },
  costOther: {
    title: 'Other usage',
    source: [VALUATION, 'ESB item journals (Item Usage): waste, R&D, marketing, QC, staff meals…'],
    definition: ['Stock taken out with an item journal instead of being sold. Part of actual COGS.'],
    formula: ['Other usage % = other usage ÷ sales × 100'],
  },
  costPurchases: {
    title: 'Purchases',
    source: [VALUATION, 'ESB purchases and transfers into the outlet (from Warehouse, CK Espresso, CK Food) at transfer price.'],
    definition: ['What the outlets received in the period. Same as the workbook "COGS Value" (Pembelian BB + Espresso + Dimsum); its "COGS Ratio" = purchases ÷ sales.', 'Purchases differ from usage by the change in stock: buying ahead raises purchases, not COGS.'],
    formula: ['Purchases % = purchases ÷ sales × 100', 'Actual COGS ≈ opening stock + purchases − closing stock'],
  },
  costStatus: {
    title: 'Outlet status',
    source: ['Thresholds set by a superadmin in Settings (Cost Control).'],
    definition: ['Usage vs recipes (default): how far each outlet\'s actual usage is from its recipes — the part an outlet controls.', 'Actual COGS %: against the COGS target. When the recipes alone cost more than the target, every outlet shows above target whatever it does — fix recipes/prices or the target.', 'Outlets without a stock opname in the period have no usage status.'],
    formula: ['Usage status = |usage ratio − 100| vs usage thresholds', 'COGS status = actual COGS % vs COGS thresholds'],
  },
  costTrend: {
    title: 'COGS trend',
    source: [VALUATION, COST_SALES],
    definition: ['Actual and theoretical COGS as % of sales per opname period or month. The gap between the two lines is the excess vs recipes.', 'Weekly figures swing with opname timing (an opname books the variance of several weeks at once); months are steadier.'],
    formula: ['Actual % = actual COGS ÷ sales × 100', 'Theoretical % = theoretical COGS ÷ sales × 100'],
  },
  costForecast: {
    title: 'Purchase forecast',
    source: [VALUATION, COST_SALES],
    definition: ['Estimated purchases for the next 1 / 2 / 4 weeks per outlet, to plan budgets and orders.', 'Daily usage = actual usage of the lookback window when an opname was taken, else recipe usage; scaled by the sales trend (last 14 days vs the 14 before, capped).'],
    formula: ['Need = daily usage × days × (1 + sales trend) + safety days × daily usage − current stock (not below 0)', 'Spend = need × HPP'],
  },
  costReliability: {
    title: 'Data reliability',
    source: [OPNAME, VALUATION, 'Data quality checks on ESB documents (see Data quality).'],
    definition: ['Final: every opname in the range is posted and no open data issue touches it.', 'Provisional: some opnames are still Draft/New — their variance can still change.', 'Check data: an issue distorts the figures (implausible opname line left out, phantom stock from a wrong quantity, HPP anomaly, …) — fix it in ESB; the portal updates after the nightly sync.'],
  },
  costIssues: {
    title: 'Data quality',
    source: ['ESB stock opname, production, receipt, purchase, transfer and item journal documents; ESB inventory valuation.'],
    definition: ['What to correct in ESB so the figures are final and accurate. Every check names the document to fix.', 'Wrong quantity: > 200× the usual quantity of the item in the same unit and document type (e.g. grams typed into a KG field).', 'Phantom stock: stock coming in > 200× the usual weekly inflow; "still in stock" = not removed yet.'],
  },
} satisfies Record<string, MetricInfo>;

export const INFO = {
  sales: {
    title: 'Gross sales',
    source: [POS, AGG],
    definition: [SALES_RULE, 'Gross sales = the bill subtotal before discounts (Σ price × qty of the menu lines), the ESB "Sub Total".', FILTERS],
    formula: ['Gross sales = Σ subtotal of sales bills', CHANGE],
  },
  nettSales: {
    title: 'Nett sales',
    source: [POS, AGG],
    definition: [SALES_RULE, FILTERS],
    formula: ['Nett sales = subtotal − (bill discount + menu discount + promotion discount + voucher discount)', CHANGE],
  },
  bills: {
    title: 'Bills',
    source: [POS, AGG],
    definition: ['Number of sales transactions (one bill = one transaction).', SALES_RULE, FILTERS],
    formula: ['Bills = count of sales bills', CHANGE],
  },
  avgTicket: {
    title: 'Average ticket',
    source: [POS, AGG],
    definition: ['Average gross sales of one bill.', SALES_RULE, FILTERS],
    formula: ['Avg ticket = Gross sales ÷ Bills', CHANGE],
  },
  today: {
    title: 'Today',
    source: ['ESB POS transactions of today, read directly (not the aggregates); updated after every sync — every 15 minutes during trading hours (06:00–24:00 WIB) — and pushed to the page in real time within ~15 seconds.'],
    definition: [SALES_RULE, 'Compared with yesterday up to the same time of day (outlet clock, salesDateIn). Follows the branch and channel filters, not the date filter.'],
    formula: ['vs yesterday % = (today − yesterday until the same time) ÷ yesterday until the same time × 100', 'Progress = today ÷ yesterday\'s full day × 100'],
  },
  trend: {
    title: 'Sales trend',
    source: [AGG],
    definition: [SALES_RULE, 'Per day, ISO week (Monday start) or month; the comparison period is moved onto the same timeline day by day (dashed line).', FILTERS],
    formula: ['Avg ticket = Gross sales ÷ Bills per bucket', 'Discount % = (Gross sales − Nett sales) ÷ Gross sales × 100', 'Cumulative = running total from the first bucket', 'Moving average = mean of the last 7 buckets', CHANGE],
  },
  growth: {
    title: 'Gross sales growth',
    source: [AGG, 'By hour: integration_portal.agg_sales_hourly (hour of salesDateIn, outlet clock).'],
    definition: [
      'Growth of gross sales (subtotal).',
      'Daily sales: gross sales per day, one colour per weekday; the dashed line is the average per day of the period. Click a bar for that day per branch.',
      'Average sales: one day per branch against the average of the same weekday in the period (that day left out; only days the branch sold count). Pending = open bills of the day; total = gross sales + pending.',
      'Comparison period: the comparison filter of the page; Last year: the same weekdays 52 weeks earlier; Sequential: every day / week / month against the one before it.',
      'By hour: gross sales per day in each hour, so periods of different length compare fairly.',
      FILTERS,
    ],
    formula: [
      'Growth % = (Gross sales − comparison gross sales) ÷ comparison gross sales × 100',
      'Average sales = Σ gross sales on that weekday ÷ days with sales · Variance % = (total sales − average sales) ÷ average sales × 100',
      'Sequential growth % = (Gross sales per day − previous bucket gross sales per day) ÷ previous bucket gross sales per day × 100',
      'Contribution (pp) of a branch / channel = (its gross sales − its comparison gross sales) ÷ total comparison gross sales × 100 — contributions add up to the total growth %',
    ],
  },
  monthly: {
    title: 'Monthly growth',
    source: [AGG],
    definition: [
      'Calendar months inside the selected period (only the selected days count in a partial month).',
      'MoM compares with the whole previous month, YoY with the same month a year earlier; same-store only uses branches that sold on ≥ 90% of the days of both months.',
      SALES_RULE,
    ],
    formula: ['Per day = month gross sales ÷ calendar days counted', 'MoM % = (per day − previous month per day) ÷ previous month per day × 100', 'YoY % = (per day − same month last year per day) ÷ same month last year per day × 100'],
  },
  channels: {
    title: 'Channel mix',
    source: [AGG],
    definition: ['Channel = the ESB visit purpose of the bill (visitPurposeName): Dine In, Takeaway, GoFood, GrabFood, ShopeeFood, Online Order (Esb Order); others are folded into "Other".', SALES_RULE, FILTERS],
    formula: ['Share % = channel gross sales ÷ all gross sales × 100', 'Avg ticket = channel gross sales ÷ channel Bills', 'Discount % = (Gross sales − Nett sales) ÷ Gross sales × 100', CHANGE],
  },
  branches: {
    title: 'Branch leaderboard',
    source: [AGG, 'Branch names: ESB branch master (integration_esb.master_branches).'],
    definition: [SALES_RULE, '"New" = sales in this period but none in the comparison period.', FILTERS],
    formula: ['Avg ticket = Gross sales ÷ Bills', 'Gross sales / day = Gross sales ÷ days with sales', 'Void rate = Void & Cancelled bills ÷ all bills × 100', CHANGE],
  },
  hours: {
    title: 'Busy hours',
    source: ['integration_portal.agg_sales_hourly and its monthly rollup (agg_hourly_monthly): sales bills per day × branch × channel × hour.'],
    definition: ['Hour = hour of the order time (salesDateIn) on the outlet clock.', SALES_RULE, 'Compare branches: averages per day on which the branch had sales.', FILTERS],
    formula: ['Bills / day (weekday × hour) = bills in that slot ÷ number of those weekdays in the period', 'Share of day = bills in the hour ÷ bills of the whole day × 100'],
  },
  menus: {
    title: 'Menus',
    source: ['Menu lines of the sales bills (salesMenus, with their packages and extras) per day × branch × channel × menu (integration_portal.agg_menu_daily, monthly rollup agg_menu_monthly). Names and categories: ESB POS menu master.'],
    definition: ['Only lines of sales bills; cancelled lines are left out. Add-ons (packages / extras such as sugar level) are counted separately from menus.', FILTERS],
    formula: ['Menu sales = Σ price × qty', 'Share % = menu sales ÷ all menu sales × 100', 'Avg price = menu sales ÷ qty'],
  },
  payments: {
    title: 'Payment methods',
    source: [AGG],
    definition: ['Payment method = the first payment of the bill (salesPayments[0] in ESB); split payments count under their first method.', SALES_RULE, FILTERS],
    formula: ['Share % = method gross sales ÷ all gross sales × 100', 'Bill share % = method Bills ÷ all Bills × 100', 'Avg ticket = method gross sales ÷ method Bills'],
  },
  basket: {
    title: 'Basket',
    source: [AGG, 'Per bill: active menu lines, quantity, and whether the bill holds a BEVERAGE and/or FOOD menu (menu category).'],
    definition: [SALES_RULE, FILTERS],
    formula: ['Lines / bill = menu lines ÷ bills', 'Items / bill = Σ qty ÷ bills', 'Bills with food % = bills with food ÷ bills × 100', 'Food attach % = bills with beverage and food ÷ bills with beverage × 100', 'Change in pp = this period % − comparison %'],
  },
  deductions: {
    title: 'Deductions',
    source: [POS, AGG],
    definition: [
      'Void & Cancelled = ESB status Void or Cancelled. Other cost = Finished without a bill number (CUPPING, WASTE…, by payment method). Open = not finished yet.',
      'None of these are sales. Offline = Dine In, Takeaway; Online = GoFood, GrabFood, ShopeeFood, Online Order.',
      '"Review" = branch void rate above the 90th percentile of branches with ≥ 100 bills (and ≥ 3 voids).',
      FILTERS,
    ],
    formula: ['Void rate = Void & Cancelled bills ÷ all bills × 100', 'Void value rate = void value ÷ (gross sales + void value) × 100', 'Share of voids = group void bills ÷ all void bills × 100', 'Change (pp) = void rate − comparison void rate'],
  },
  cost: {
    title: 'Cost control',
    source: ['ESB inventory valuation per outlet location × product × opname period (days 1–7, 8–14, 15–21, 22–end), ESB stock opname documents, and Sales from the aggregates.'],
    definition: ['Theoretical usage = POS sales × BOM; other usage = item journals; variance = stock opname differences (posted, plus pending opnames not authorized yet = provisional).', 'A pending opname line with a variance above max(Rp 50 M, 50% of the outlet theoretical COGS of the period) is implausible (wrong system stock in ESB) and left out; listed under Data quality.', 'Network totals only include locations with POS sales (bulk-order stock locations are listed apart).'],
    formula: ['Actual COGS = theoretical + other usage + manufacturing net − posted variance − pending variance', 'COGS ratio = actual COGS ÷ Net sales (or Subtotal) × 100', 'Usage ratio = actual usage ÷ theoretical usage × 100'],
  },
  ...COST_INFO,
} satisfies Record<string, MetricInfo>;

export type InfoKey = keyof typeof INFO;

/** One line for native title tooltips (KPI tiles). */
export function infoLine(key: InfoKey): string {
  const i: MetricInfo = INFO[key];
  return `${i.title}\n${(i.formula ?? []).join('\n')}\nSource: ${i.source[0]}`;
}

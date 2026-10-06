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

export const INFO = {
  sales: {
    title: 'Sales (subtotal)',
    source: [POS, AGG],
    definition: [SALES_RULE, 'Subtotal = the bill subtotal before discounts (Σ price × qty of the menu lines). Also called gross sales.', FILTERS],
    formula: ['Sales = Σ subtotal of sales bills', CHANGE],
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
    definition: ['Average sales value of one bill.', SALES_RULE, FILTERS],
    formula: ['Avg ticket = Sales ÷ Bills', CHANGE],
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
    formula: ['Avg ticket = Sales ÷ Bills per bucket', 'Discount % = (Sales − Nett sales) ÷ Sales × 100', 'Cumulative = running total from the first bucket', 'Moving average = mean of the last 7 buckets', CHANGE],
  },
  growth: {
    title: 'Sales growth',
    source: [AGG, 'By hour: integration_portal.agg_sales_hourly (hour of salesDateIn, outlet clock).'],
    definition: [
      'Growth of Sales (subtotal / gross sales).',
      'Comparison period: the comparison filter of the page; Last year: the same weekdays 52 weeks earlier; Sequential: every day / week / month against the one before it.',
      'By hour: sales per day in each hour, so periods of different length compare fairly.',
      FILTERS,
    ],
    formula: [
      'Growth % = (Sales − comparison Sales) ÷ comparison Sales × 100',
      'Sequential growth % = (Sales per day − previous bucket Sales per day) ÷ previous bucket Sales per day × 100',
      'Contribution (pp) of a branch / channel = (its Sales − its comparison Sales) ÷ total comparison Sales × 100 — contributions add up to the total growth %',
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
    formula: ['Per day = month Sales ÷ calendar days counted', 'MoM % = (per day − previous month per day) ÷ previous month per day × 100', 'YoY % = (per day − same month last year per day) ÷ same month last year per day × 100'],
  },
  channels: {
    title: 'Channel mix',
    source: [AGG],
    definition: ['Channel = the ESB visit purpose of the bill (visitPurposeName): Dine In, Takeaway, GoFood, GrabFood, ShopeeFood, Online Order (Esb Order); others are folded into "Other".', SALES_RULE, FILTERS],
    formula: ['Share % = channel Sales ÷ all Sales × 100', 'Avg ticket = channel Sales ÷ channel Bills', 'Discount % = (Sales − Nett sales) ÷ Sales × 100', CHANGE],
  },
  branches: {
    title: 'Branch leaderboard',
    source: [AGG, 'Branch names: ESB branch master (integration_esb.master_branches).'],
    definition: [SALES_RULE, '"New" = sales in this period but none in the comparison period.', FILTERS],
    formula: ['Avg ticket = Sales ÷ Bills', 'Sales / day = Sales ÷ days with sales', 'Void rate = Void & Cancelled bills ÷ all bills × 100', CHANGE],
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
    formula: ['Share % = method Sales ÷ all Sales × 100', 'Bill share % = method Bills ÷ all Bills × 100', 'Avg ticket = method Sales ÷ method Bills'],
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
    formula: ['Void rate = Void & Cancelled bills ÷ all bills × 100', 'Void value rate = void value ÷ (sales + void value) × 100', 'Share of voids = group void bills ÷ all void bills × 100', 'Change (pp) = void rate − comparison void rate'],
  },
  cost: {
    title: 'Cost control',
    source: ['ESB inventory valuation per outlet location × product × opname period (days 1–7, 8–14, 15–21, 22–end), ESB stock opname documents, and Sales from the aggregates.'],
    definition: ['Theoretical usage = POS sales × BOM; other usage = item journals; variance = stock opname differences (posted, plus pending opnames not authorized yet = provisional).', 'A pending opname line with a variance above max(Rp 50 M, 50% of the outlet theoretical COGS of the period) is implausible (wrong system stock in ESB) and left out; listed under Data quality.', 'Network totals only include locations with POS sales (bulk-order stock locations are listed apart).'],
    formula: ['Actual COGS = theoretical + other usage + manufacturing net − posted variance − pending variance', 'COGS ratio = actual COGS ÷ Net sales (or Subtotal) × 100', 'Usage ratio = actual usage ÷ theoretical usage × 100'],
  },
} satisfies Record<string, MetricInfo>;

export type InfoKey = keyof typeof INFO;

/** One line for native title tooltips (KPI tiles). */
export function infoLine(key: InfoKey): string {
  const i: MetricInfo = INFO[key];
  return `${i.title}\n${(i.formula ?? []).join('\n')}\nSource: ${i.source[0]}`;
}

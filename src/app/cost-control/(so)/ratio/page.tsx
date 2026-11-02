"use client";

// Outlet ratio (Cost Control): the sheet the team builds by hand in "CALF – Rasio Outlet" (e.g. SEP-W5), from the ESB
// data the portal syncs: gross sales, purchases from Warehouse (BB), Central Kitchen (espresso) and CK Food (dimsum),
// COGS & usage ratios with the stock opname of the day before and the last day. SO values and the MDR of a month can
// be corrected here (with the reason), as the team does in the workbook. Two views of the same figures: every ratio on
// gross sales (subtotal) or on net sales (Pendapatan = gross × (1 − MDR) when the MDR is filled in, else ESB nett).

import { ArrowDown, ArrowUp, BarChart3, Info as InfoIcon, Pencil, Store } from "lucide-react";
import ExcelIconButton from "@/components/ExcelIconButton";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, Field, Input, Page, Panel, SkeletonRows, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import Dialog from "@/so/ui/Dialog";
import { serverMsg, tr } from "@/lib/i18n";

type So = { value: number | null; esb: number | null; doc: string | null; docDate: string | null; docStatus: string | null; date: string;
  override: { value: number; note: string; by: string | null; at: string } | null };
type Row = {
  branchCode: string; branchName: string; gross: number; nett: number; net: number; pendapatan: number | null; mdrPct: number | null; netBasis: string;
  bb: number; espresso: number; dimsum: number; otherPurchases: number; cogs: number; espressoShare: number | null; bbRatio: number | null;
  espressoRatio: number | null; bbRatioGross: number | null; espressoRatioGross: number | null; cogsRatioGross: number | null; cogsRatioNet: number | null; soStart: So; soEnd: So; usage: number | null;
  usageRatioGross: number | null; usageRatioNet: number | null; delta: number | null; deltaGross: number | null; nonSales: number; itemJournal: number;
};
type Total = Omit<Row, "branchCode" | "branchName" | "soStart" | "soEnd" | "pendapatan" | "mdrPct" | "netBasis" | "delta" | "deltaGross"> & {
  soStart: number; soEnd: number; outlets: number; outletsWithSo: number; nonSalesPct: number | null; itemJournalPct: number | null;
  nonSalesPctNet: number | null; itemJournalPctNet: number | null;
};
type Data = { period: { from: string; to: string; soStart: string; soEnd: string; month: string; mdrEditable: boolean }; outlets: Row[]; total: Total };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rp = (v: number | null | undefined) => (v === null || v === undefined ? "-" : Math.round(v).toLocaleString("id-ID"));
const pc = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${(v * 100).toFixed(1)}%`);
const dmy = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  return body as T;
}

/** Periods of the workbook: cumulative from the 1st (1-7, 1-14, 1-21, 1-28) or the whole month. */
function presets(month: Date) {
  const y = month.getFullYear(), m = month.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const cap = (d: number) => {
    const day = new Date(y, m, d);
    return day > today ? today : day;
  };
  return [7, 14, 21, 28].map((d, i) => ({ key: `W${i + 1}`, label: `W${i + 1} (1–${d})`, from: iso(new Date(y, m, 1)), to: iso(cap(d)) }))
    .concat([{ key: "M", label: tr("Whole Month (1–{0})", last), from: iso(new Date(y, m, 1)), to: iso(cap(last)) }]);
}

type SortKey = keyof Row;
type Basis = "gross" | "net";
type Col = { key: SortKey; label: string; kind: "rp" | "pct" | "so" | "mdr"; info: Info };
/** Where a column comes from and how it is computed (the header tooltip; app/ratio.py of the backend). */
type Info = { source: () => string; formula?: () => string };
const INFO: Record<string, Info> = {
  gross: { source: () => tr("ESB POS: subtotal of the sales bills of the outlet in the period (synced daily, agg_sales_daily, type Sales). Same as the workbook column Sub Total (GROSS SALES)."),
    formula: () => tr("Σ subtotal of the sales bills") },
  net: { source: () => tr("Pendapatan when the MDR of the month is filled in, otherwise the ESB nett sales of the sales bills (marked ESB)."),
    formula: () => tr("Gross sales × (1 − MDR %)") },
  mdrPct: { source: () => tr("Entered here by Cost Control per outlet and month (merchant discount rate of the payment channels). Editable when the period is within one month.") },
  bb: { source: () => tr("ESB purchase invoices of the outlet from the supplier Calf Warehouse, by invoice date in the period: raw materials, packaging and supplies.") },
  espresso: { source: () => tr("ESB purchase invoices of the outlet from the supplier Calf Central Kitchen (espresso / premix), by invoice date in the period.") },
  dimsum: { source: () => tr("ESB purchase invoices of the outlet from the supplier Calf Central Kitchen Food (dimsum), by invoice date in the period.") },
  cogs: { source: () => tr("Purchases of the outlet from the three internal suppliers; purchases from other suppliers are not included (Excel column Pembelian lain)."),
    formula: () => tr("Pembelian BB + Espresso + Dimsum") },
  espressoShare: { source: () => tr("Share of espresso in the purchases."), formula: () => tr("Espresso ÷ COGS value") },
  bbRatio: { source: () => tr("Raw materials and dimsum bought against the sales of the view (gross or net)."), formula: () => tr("(Pembelian BB + Dimsum) ÷ sales") },
  espRatio: { source: () => tr("Espresso bought against the sales of the view."), formula: () => tr("Espresso ÷ sales") },
  cogsRatio: { source: () => tr("Purchases against the sales of the view: what was bought, not yet what was used (see Usage ratio)."), formula: () => tr("COGS value ÷ sales") },
  soStart: { source: () => tr("Stock value of the ESB stock opname document of the day before the period (the closest document from 2 days before to 1 day after), or the value corrected here with a reason (Corrected)."),
    formula: () => tr("Σ qty × price of the stock opname lines") },
  soEnd: { source: () => tr("Stock value of the ESB stock opname document of the last day of the period (the closest document from 2 days before to 1 day after), or the value corrected here with a reason (Corrected)."),
    formula: () => tr("Σ qty × price of the stock opname lines") },
  usage: { source: () => tr("What was really used: purchases plus the stock at the start minus the stock at the end, against the sales of the view. Empty when SO awal or SO akhir is missing."),
    formula: () => tr("(COGS value + SO awal − SO akhir) ÷ sales") },
  delta: { source: () => tr("Positive: more was bought than used (stock grows); negative: stock was used up. Near 0: purchases follow the usage."),
    formula: () => tr("COGS ratio − Usage ratio") },
  nonSales: { source: () => tr("ESB POS: subtotal of the bills of type Other cost (non sales, e.g. compliments, staff meals) in the period.") },
  itemJournal: { source: () => tr("ESB item journal documents of the outlet in the period (waste, QC and other stock adjustments), valued at the line price."),
    formula: () => tr("Σ |qty × price| of the item journal lines") },
};
const BASIS_KEY = "portal.ratio.basis";
// the columns of a view; the ratios divide by the sales of the view
const SALES: Record<Basis, Col[]> = {
  gross: [{ key: "gross", label: "Gross sales", kind: "rp", info: INFO.gross }, { key: "mdrPct", label: "MDR", kind: "mdr", info: INFO.mdrPct }],
  net: [{ key: "net", label: "Net sales", kind: "rp", info: INFO.net }, { key: "mdrPct", label: "MDR", kind: "mdr", info: INFO.mdrPct }],
};
const RATIOS: Record<Basis, Record<"bb" | "esp" | "cogs" | "usage" | "delta", SortKey>> = {
  gross: { bb: "bbRatioGross", esp: "espressoRatioGross", cogs: "cogsRatioGross", usage: "usageRatioGross", delta: "deltaGross" },
  net: { bb: "bbRatio", esp: "espressoRatio", cogs: "cogsRatioNet", usage: "usageRatioNet", delta: "delta" },
};
function columns(basis: Basis): Col[] {
  const r = RATIOS[basis];
  return [
    ...SALES[basis],
    { key: "bb", label: "Pembelian BB", kind: "rp", info: INFO.bb },
    { key: "espresso", label: "Espresso", kind: "rp", info: INFO.espresso },
    { key: "dimsum", label: "Dimsum", kind: "rp", info: INFO.dimsum },
    { key: "cogs", label: "COGS value", kind: "rp", info: INFO.cogs },
    { key: "espressoShare", label: "% Esp", kind: "pct", info: INFO.espressoShare },
    { key: r.bb, label: "BB ratio", kind: "pct", info: INFO.bbRatio },
    { key: r.esp, label: "Esp ratio", kind: "pct", info: INFO.espRatio },
    { key: r.cogs, label: "COGS ratio", kind: "pct", info: INFO.cogsRatio },
    { key: "soStart", label: "SO awal", kind: "so", info: INFO.soStart },
    { key: "soEnd", label: "SO akhir", kind: "so", info: INFO.soEnd },
    { key: r.usage, label: "Usage ratio", kind: "pct", info: INFO.usage },
    { key: r.delta, label: "Δ COGS−usage", kind: "pct", info: INFO.delta },
    { key: "nonSales", label: "Non sales", kind: "rp", info: INFO.nonSales },
    { key: "itemJournal", label: "Item journal", kind: "rp", info: INFO.itemJournal },
  ];
}
/** The same column in the other view (the sort follows a switch of view). */
function counterpart(key: SortKey, to: Basis): SortKey {
  const from: Basis = to === "gross" ? "net" : "gross";
  if (key === SALES[from][0].key) return SALES[to][0].key;
  const hit = (Object.keys(RATIOS[from]) as (keyof typeof RATIOS.gross)[]).find((k) => RATIOS[from][k] === key);
  return hit ? RATIOS[to][hit] : key;
}

export default function RatioPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [range, setRange] = useState(() => presets(new Date(new Date().getFullYear(), new Date().getMonth(), 1)).at(-1)!);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [basis, setBasisState] = useState<Basis>("gross");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "cogsRatioGross", desc: true });
  const setBasis = useCallback((b: Basis) => {
    setBasisState(b);
    setSort((s) => ({ ...s, key: counterpart(s.key, b) }));
    try { localStorage.setItem(BASIS_KEY, b); } catch { /* not remembered */ }
  }, []);
  useEffect(() => {
    try { if (localStorage.getItem(BASIS_KEY) === "net") setBasis("net"); } catch { /* default gross */ }
  }, [setBasis]);
  const COLS = useMemo(() => columns(basis), [basis]);
  const cogsKey = RATIOS[basis].cogs;
  const [sheet, setSheet] = useState(false);
  // outlets to look at: COGS ratio (of the view) above a threshold, outlets without both stock opname values
  const [watch, setWatch] = useState<{ cogs: string; so: string }>({ cogs: "", so: "" });
  const [editSo, setEditSo] = useState<{ row: Row; which: "soStart" | "soEnd" } | null>(null);

  const query = `dateFrom=${range.from}&dateTo=${range.to}`;
  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      setData(await call<Data>(`/api/cost-control/ratio?${query}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const val = (r: Row) => { const v = r[sort.key]; return typeof v === "object" && v ? (v as So).value : (v as number | string | null); };
    return (data?.outlets ?? []).filter(r => (!s || r.branchName.toLowerCase().includes(s) || r.branchCode.toLowerCase().includes(s))
      && (!watch.cogs || ((r[cogsKey] as number | null) ?? 0) > Number(watch.cogs) / 100)
      && (!watch.so || (watch.so === "missing" ? r.soStart.value === null || r.soEnd.value === null : r.soStart.value !== null && r.soEnd.value !== null)))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1);
      });
  }, [data, q, sort, watch, cogsKey]);
  const paged = usePaged(rows, rows.length + q + JSON.stringify(sort) + JSON.stringify(watch));

  const saveMdr = async (row: Row, value: string) => {
    const pct = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct >= 100)) { toast(tr("MDR must be between 0 and 100"), "error"); return; }
    if (pct === row.mdrPct) return;
    try {
      await call("/api/cost-control/ratio/mdr", { method: "PUT", body: JSON.stringify({ branchCode: row.branchCode, month: data!.period.month, pct }) });
      void load();
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const t = data?.total;
  const monthLabel = month.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const isDefaultRange = range.key === "M" && iso(month).slice(0, 7) === iso(new Date()).slice(0, 7);
  const chips: ActiveFilter[] = [
    ...(!isDefaultRange ? [{ key: "p", label: `${monthLabel} · ${range.label}`, onRemove: () => { const d = new Date(new Date().getFullYear(), new Date().getMonth(), 1); setMonth(d); setRange(presets(d).at(-1)!); } }] : []),
    ...(watch.cogs ? [{ key: "c", label: basis === "gross" ? tr("COGS gross > {0}%", watch.cogs) : tr("COGS net > {0}%", watch.cogs), onRemove: () => setWatch({ ...watch, cogs: "" }) }] : []),
    ...(watch.so ? [{ key: "s", label: watch.so === "missing" ? tr("Stock opname missing") : tr("Both stock opname values"), onRemove: () => setWatch({ ...watch, so: "" }) }] : []),
  ];
  return (
    <Page title={tr("Outlet Ratio")} subtitle={`${monthLabel} · ${dmy(range.from)} – ${dmy(range.to)} · ${tr("COGS, BB, espresso and usage ratio per outlet, from ESB data")}`}
      actions={<ExcelIconButton label={tr("Download Excel")} href={`/api/cost-control/ratio/export?${query}`} />}
      stats={error ? undefined : (
        <StatStrip label={tr("Summary")} columns={5} gridClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Stat label={basis === "gross" ? tr("Gross sales") : tr("Net sales")} icon={<Store size={13} />} value={t ? rp(basis === "gross" ? t.gross : t.net) : <StatSkeleton />}>
            {t && <p className="truncate">{tr("{0} outlets", t.outlets)} · {basis === "gross" ? tr("net {0}", rp(t.net)) : tr("gross {0}", rp(t.gross))}</p>}
          </Stat>
          <Stat label={tr("COGS Value")} value={t ? rp(t.cogs) : <StatSkeleton />}>
            {t && <p className="truncate">BB {rp(t.bb)} · Esp {rp(t.espresso)}</p>}
          </Stat>
          {basis === "gross" ? (
            <Stat label={tr("COGS Ratio Gross")} emphasis icon={<BarChart3 size={13} />} value={t ? pc(t.cogsRatioGross) : <StatSkeleton />}>
              {t && <p>{tr("net {0} · BB {1}", pc(t.cogsRatioNet), pc(t.bbRatioGross))}</p>}
            </Stat>
          ) : (
            <Stat label={tr("COGS Ratio Net")} emphasis icon={<BarChart3 size={13} />} value={t ? pc(t.cogsRatioNet) : <StatSkeleton />}>
              {t && <p>{tr("gross {0} · BB {1}", pc(t.cogsRatioGross), pc(t.bbRatio))}</p>}
            </Stat>
          )}
          {basis === "gross" ? (
            <Stat label={tr("Usage Ratio Gross")} value={t ? pc(t.usageRatioGross) : <StatSkeleton />}>
              {t && <p>{tr("net {0} · {1} outlets with SO", pc(t.usageRatioNet), t.outletsWithSo)}</p>}
            </Stat>
          ) : (
            <Stat label={tr("Usage Ratio Net")} value={t ? pc(t.usageRatioNet) : <StatSkeleton />}>
              {t && <p>{tr("gross {0} · {1} outlets with SO", pc(t.usageRatioGross), t.outletsWithSo)}</p>}
            </Stat>
          )}
          <Stat label={tr("Non Sales · Item Journal")} value={t ? rp(t.nonSales + t.itemJournal) : <StatSkeleton />}>
            {t && <p>{basis === "gross" ? <>{pc(t.nonSalesPct)} · {pc(t.itemJournalPct)}</> : <>{pc(t.nonSalesPctNet)} · {pc(t.itemJournalPctNet)}</>}</p>}
          </Stat>
        </StatStrip>
      )}>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : (
        <>
          <Panel toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search outlet")} filters={chips} onOpen={() => setSheet(true)}
            extra={<BasisSwitch value={basis} onChange={setBasis} />}
            onClear={() => { const d = new Date(new Date().getFullYear(), new Date().getMonth(), 1); setMonth(d); setRange(presets(d).at(-1)!); setWatch({ cogs: "", so: "" }); }} />}
            footer={<><span>{data ? tr("SO awal {0}, SO akhir {1}", dmy(data.period.soStart), dmy(data.period.soEnd)) : ""}{" · "}{basis === "gross" ? tr("Ratios on gross sales (subtotal)") : tr("Ratios on net sales")}{" · "}{tr("Net = Pendapatan (gross × (1 − MDR)) when the MDR is filled in, otherwise ESB nett sales")}{data ? ` · ${tr("{0} of {1} shown", rows.length, data.outlets.length)}` : ""}</span><PageNav paged={paged} /></>}>
            <div className="overflow-auto md:max-h-[70vh]">
              <table className="m-cards w-full min-w-[1600px] text-xs">
                <thead className={cx(theadClass, "sticky top-0 z-10")}>
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5">{tr("Outlet")}</th>
                    {COLS.map((c, i) => (
                      <th key={c.key} className="whitespace-nowrap px-2 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => setSort(s => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}
                            className="inline-flex items-center gap-0.5 uppercase hover:text-slate-800">
                            {c.label}{sort.key === c.key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                          </button>
                          <HeaderInfo label={c.label} info={c.info} alignRight={i > COLS.length - 4} />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!data ? <SkeletonRows cols={COLS.length + 1} /> : paged.rows.map(r => (
                    <tr key={r.branchCode} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 z-[1] max-w-[15rem] bg-white px-3 py-2">
                        <span className="block truncate font-medium text-slate-900" title={r.branchName}>{r.branchName}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{r.branchCode}</span>
                      </td>
                      {COLS.map(c => (
                        <td key={c.key} className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {c.kind === "rp" ? (c.key === "net" ? <NetCell row={r} /> : rp(r[c.key] as number)) : c.kind === "pct" ? pc(r[c.key] as number | null)
                            : c.kind === "mdr" ? (data.period.mdrEditable ? (
                              <input defaultValue={r.mdrPct ?? ""} placeholder="—" inputMode="decimal" aria-label={`MDR ${r.branchName}`}
                                onBlur={e => void saveMdr(r, e.target.value)} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-7 w-16 rounded border border-slate-200 px-1.5 text-right" />
                            ) : (r.mdrPct === null ? "-" : `${r.mdrPct}%`))
                            : <SoCell so={r[c.key] as So} onEdit={() => setEditSo({ row: r, which: c.key as "soStart" | "soEnd" })} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data && rows.length === 0 && <tr><td colSpan={COLS.length + 1} className="py-10 text-center text-sm text-slate-400">{tr("No outlet matches")}</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      {sheet && <RatioFilters basis={basis} month={month} range={range} watch={watch} onClose={() => setSheet(false)}
        onApply={(m, r, w) => { setMonth(m); setRange(r); setWatch(w); setSheet(false); }} />}
      {editSo && data && <SoDialog row={editSo.row} which={editSo.which} onClose={() => setEditSo(null)} onSaved={() => { setEditSo(null); void load(); }} />}
    </Page>
  );
}

type Range = ReturnType<typeof presets>[number];

function RatioFilters({ basis, month, range, watch, onApply, onClose }: {
  basis: Basis; month: Date; range: Range; watch: { cogs: string; so: string }; onApply: (m: Date, r: Range, w: { cogs: string; so: string }) => void; onClose: () => void;
}) {
  const [m, setM] = useState(month);
  const [r, setR] = useState(range);
  const [w, setW] = useState(watch);
  const list = presets(m);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(m, r, w)}
      onReset={() => { const d = new Date(new Date().getFullYear(), new Date().getMonth(), 1); setM(d); setR(presets(d).at(-1)!); setW({ cogs: "", so: "" }); }}>
      <FilterSection title={tr("Month")}>
        <input type="month" value={iso(m).slice(0, 7)} aria-label={tr("Month")} max={iso(new Date()).slice(0, 7)}
          onChange={e => { if (!e.target.value) return; const [y, mm] = e.target.value.split("-").map(Number); const d = new Date(y, mm - 1, 1); setM(d); setR(presets(d).at(-1)!); }}
          className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />
      </FilterSection>
      <FilterSection title={tr("Period")} hint={tr("Cumulative from the 1st, as the workbook (W1 1–7 … W4 1–28)")}>
        <ChoiceGroup label="" value={r.key} onChange={k => setR(list.find(p => p.key === k) ?? list.at(-1)!)} choices={list.map(p => ({ value: p.key, label: p.label }))} />
      </FilterSection>
      <FilterSection title={basis === "gross" ? tr("COGS ratio gross above") : tr("COGS ratio net above")}>
        <ChoiceGroup label="" value={w.cogs} onChange={v => setW({ ...w, cogs: v })}
          choices={[{ value: "", label: tr("Any") }, ...["30", "35", "40", "45"].map(v => ({ value: v, label: `> ${v}%` }))]} />
      </FilterSection>
      <FilterSection title={tr("Stock Opname")}>
        <ChoiceGroup label="" value={w.so} onChange={v => setW({ ...w, so: v })}
          choices={[{ value: "", label: tr("All") }, { value: "missing", label: tr("SO Awal or Akhir Missing") }, { value: "complete", label: tr("Both Values") }]} />
      </FilterSection>
    </FilterSheet>
  );
}

/** The ⓘ of a header: where the column comes from and its formula, on hover or focus (touch: tap). */
function HeaderInfo({ label, info, alignRight }: { label: string; info: Info; alignRight?: boolean }) {
  return (
    <span className="group/info relative inline-flex normal-case">
      <button type="button" aria-label={tr("About {0}", label)} className="rounded-full p-0.5 text-slate-300 outline-none hover:text-slate-600 focus-visible:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-300">
        <InfoIcon size={12} aria-hidden />
      </button>
      <span role="tooltip" className={cx("pointer-events-none invisible absolute top-full z-30 mt-1.5 w-72 whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-normal leading-relaxed tracking-normal text-slate-100 opacity-0 shadow-lg transition-opacity group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100",
        alignRight ? "right-0" : "left-1/2 -translate-x-1/2")}>
        <span className="mb-1 block font-semibold text-white">{label}</span>
        <span className="block">{info.source()}</span>
        {info.formula && <span className="mt-1.5 block rounded bg-white/10 px-2 py-1 font-mono text-[10.5px] text-white">{info.formula()}</span>}
      </span>
    </span>
  );
}

/** Gross / Net: which sales the ratios of the table divide by. */
function BasisSwitch({ value, onChange }: { value: Basis; onChange: (b: Basis) => void }) {
  return (
    <div role="radiogroup" aria-label={tr("Ratio Basis")} className="inline-flex h-10 flex-shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-1">
      {(["gross", "net"] as Basis[]).map((b) => (
        <button key={b} type="button" role="radio" aria-checked={value === b} onClick={() => onChange(b)}
          className={cx("h-8 rounded-md px-3 text-sm font-medium transition-colors",
            value === b ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>
          {b === "gross" ? tr("Gross sales") : tr("Net sales")}
        </button>
      ))}
    </div>
  );
}

/** Net sales of an outlet, marked when it is the ESB nett sales (no MDR for the month). */
function NetCell({ row }: { row: Row }) {
  return (
    <span title={row.netBasis === "pendapatan" ? tr("Pendapatan: gross × (1 − MDR {0}%)", row.mdrPct ?? 0) : tr("ESB nett sales (no MDR for this month)")}>
      {row.netBasis === "nett" && <span className="mr-1 rounded bg-slate-100 px-1 text-[9px] font-semibold text-slate-500">ESB</span>}
      {rp(row.net)}
    </span>
  );
}

function SoCell({ so, onEdit }: { so: So; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className="group inline-flex items-center gap-1 rounded px-1 hover:bg-slate-100"
      title={so.override ? `${tr("Corrected")}: ${so.override.note}` : so.doc ? `${so.doc} · ${so.docDate} · ${so.docStatus}` : tr("No stock opname document")}>
      {so.override && <Badge tone="violet">{tr("Corrected")}</Badge>}
      <span className={so.value === null ? "text-slate-300" : ""}>{rp(so.value)}</span>
      <Pencil size={11} className="text-slate-300 group-hover:text-slate-600" />
    </button>
  );
}

function SoDialog({ row, which, onClose, onSaved }: { row: Row; which: "soStart" | "soEnd"; onClose: () => void; onSaved: () => void }) {
  const so = row[which];
  const [value, setValue] = useState(so.override ? String(so.override.value) : so.esb !== null ? String(Math.round(so.esb)) : "");
  const [note, setNote] = useState(so.override?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      await call("/api/cost-control/ratio/so-override", { method: "PUT", body: JSON.stringify({ branchCode: row.branchCode, date: so.date, ...body }) });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open size="sm" onClose={onClose} title={tr("{0} · {1}", which === "soStart" ? tr("SO awal") : tr("SO akhir"), row.branchName)}
      description={tr("Stock value on {0}", dmy(so.date))}
      footer={<>
        {so.override && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={() => void send({ value: null, note: "" })}>{tr("Use the ESB value")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!value.trim() || !note.trim()} onClick={() => void send({ value: Number(value.replace(/\./g, "").replace(",", ".")), note })}>{tr("Save correction")}</Button>
      </>}>
      <div className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {so.doc ? tr("ESB stock opname {0} ({1}, {2}): Rp {3}", so.doc, so.docDate ?? "", so.docStatus ?? "", rp(so.esb)) : tr("No ESB stock opname document around this date.")}
        </p>
        <Field label={tr("Value Used (Rp)")} required><Input inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} /></Field>
        <Field label={tr("Reason")} required><Input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("e.g. espresso stock counted separately")} /></Field>
        {so.override && <p className="text-[11px] text-slate-400">{tr("Last corrected by {0}", so.override.by ?? "-")}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}



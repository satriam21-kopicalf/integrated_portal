"use client";

// Aggregator Insight (2026-11-25): what every page is made of — the filters (kept while moving between the pages), how
// fresh the data is, the table (sort, pages, cards on phones) and the Excel.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, Info, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import Floating from "@/components/kc/Floating";
import ChannelLogo from "@/components/ChannelLogo";
import ExcelIconButton from "@/components/ExcelIconButton";
import { SortTh, useSort, type SortDir } from "@/so/ui/Sort";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PeriodField, Row } from "./fields";
import { ago, dayOf, daysAgo, fmtClock, fmtDayShort, nf } from "./time";
import { type JOption, JSelect, jHeadRow, jTable, jTd, jTh, Button, EmptyState as Empty, SearchBox, cx } from "@/jira";

export const PLATFORMS = ["GoFood", "GrabFood", "ShopeeFood"] as const;
/** the artwork of Grab has a wide margin */
const logoH = (p: string) => (p === "GrabFood" ? 20 : 14);
/** The logo of the platform, as everywhere in the portal. */
export const Platform = ({ p }: { p: string }) => <ChannelLogo channel={p} height={logoH(p)} className="min-h-5" />;
export const platformOptions = () => PLATFORMS.map((p) => ({ value: p as string, label: p as string, icon: <ChannelLogo channel={p} height={logoH(p)} /> }));

// ---------------------------------------------------------------- the context of the module: outlets, groups, freshness

export type Outlet = { code: string; name: string; group: string | null; zone: "WIB" | "WITA" | "WIT" };
type Freshness = { synced: string | null; oldest: string | null; global: string | null; histories: string | null; reviews: string | null; daily: string | null; errors: string[] };
export type Ctx = { outlets: Outlet[]; groups: string[]; unmapped: number; reviewsFrom: string | null; freshness: Freshness };
let cached: { at: number; value: Promise<Ctx> } | null = null;
const loadCtx = () => {
  if (!cached || Date.now() - cached.at > 120_000) {
    const value = call<Ctx>("/api/aggregator/context");
    cached = { at: Date.now(), value };
    value.catch(() => { cached = null; });
  }
  return cached.value;
};
export function useCtx(): Ctx | null {
  const [c, setC] = useState<Ctx | null>(null);
  useEffect(() => { let off = false; loadCtx().then((x) => { if (!off) setC(x); }).catch(() => { /* the page works without */ }); return () => { off = true; }; }, []);
  return c;
}

// ---------------------------------------------------------------- filters

export type Filters = { from: string; to: string; platform: string; outlet: string; group: string };
/** the newest data first: today; the earlier days with the period filter (2026-11-25) */
const FIRST = "today";
const KEY = "agg.filters.2";
const base = (): Filters => ({ from: daysAgo(0), to: daysAgo(0), platform: "", outlet: "", group: "" });
type Keep = Filters & { preset?: string };
export type AggFilters = { f: Filters; set: (p: Partial<Filters> & { preset?: string }) => void; reset: () => void; changed: boolean; ready: boolean; preset: string; query: string };

const monthStart = (back: number) => { const [y, m] = daysAgo(0).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 - back, 1)); return d.toISOString().slice(0, 10); };
const monthEnd = (back: number) => { const [y, m] = daysAgo(0).split("-").map(Number); return new Date(Date.UTC(y, m - back, 0)).toISOString().slice(0, 10); };
const PRESETS: Record<string, { label: () => string; range: () => [string, string] }> = {
  today: { label: () => tr("Today"), range: () => [daysAgo(0), daysAgo(0)] }, yesterday: { label: () => tr("Yesterday"), range: () => [daysAgo(1), daysAgo(1)] },
  d7: { label: () => tr("Last 7 days"), range: () => [daysAgo(6), daysAgo(0)] }, d30: { label: () => tr("Last 30 days"), range: () => [daysAgo(29), daysAgo(0)] },
  month: { label: () => tr("This month"), range: () => [monthStart(0), daysAgo(0)] }, last: { label: () => tr("Last month"), range: () => [monthStart(1), monthEnd(1)] },
};

/** The filters, the same on every page of the module while the tab is open. A preset moves with the day. */
export function useFilters(): AggFilters {
  const [k, setK] = useState<Keep>(() => ({ ...base(), preset: FIRST }));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Keep | null;
      if (s) { const r = s.preset && PRESETS[s.preset] ? PRESETS[s.preset].range() : [s.from, s.to]; setK({ ...base(), ...s, from: r[0], to: r[1] }); }
    } catch { /* the defaults */ }
    setReady(true);
  }, []);
  const set = useCallback((p: Partial<Filters> & { preset?: string }) => setK((x) => {
    const n: Keep = { ...x, ...p };
    if ((p.from || p.to) && !p.preset) n.preset = "custom";
    if (n.from > n.to) { if (p.from) n.to = n.from; else n.from = n.to; }
    try { sessionStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private window */ }
    return n;
  }), []);
  const reset = useCallback(() => set({ ...base(), preset: FIRST }), [set]);
  const f: Filters = { from: k.from, to: k.to, platform: k.platform, outlet: k.outlet, group: k.group };
  const query = new URLSearchParams({ dateFrom: k.from, dateTo: k.to, ...(k.platform ? { platform: k.platform } : {}) }).toString();
  return { f, set, reset, ready, query, preset: k.preset ?? "custom", changed: k.preset !== FIRST || !!(k.platform || k.outlet || k.group) };
}

/** Rows of the outlet / branch group chosen. */
export function useScope<T extends { branchCode?: string | null }>(rows: T[] | undefined, f: Filters, ctx: Ctx | null): T[] {
  return useMemo(() => {
    const all = rows ?? [];
    if (!f.outlet && !f.group) return all;
    const inGroup = new Set((ctx?.outlets ?? []).filter((o) => o.group === f.group).map((o) => o.code));
    return all.filter((r) => (!f.outlet || r.branchCode === f.outlet) && (!f.group || (!!r.branchCode && inGroup.has(r.branchCode))));
  }, [rows, f.outlet, f.group, ctx]);
}

export type Extra = { key: string; any?: string; label: string; value: string; onChange: (v: string) => void; options: JOption[] };

/** The head of the table card, one pattern on every screen (2026-11-26): search, one Filter button (the period and every filter in
 *  one panel: a sheet on phones, a popover on wider screens), reset and Excel in one row; what is chosen stays readable as chips.
 *  `lead` (e.g. the day of the schedule) stays in the row; `more` goes into the panel below the filters; `children` = the quick
 *  status chips with their counts. `period` off for a page about now. */
export function FilterBar({ a, ctx, extra = [], period = true, outlet = true, platform = true, lead, note, q, onQ, placeholder, excel, excelOff, excelBusy, more, children }: { lead?: ReactNode; note?: string; q?: string; onQ?: (v: string) => void; placeholder?: string; excel?: () => void; excelOff?: boolean; excelBusy?: boolean; more?: ReactNode; children?: ReactNode; a: AggFilters; ctx: Ctx | null; extra?: Extra[]; period?: boolean; outlet?: boolean; platform?: boolean }) {
  const { f, set, preset } = a;
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const outs = (ctx?.outlets ?? []).filter((o) => !f.group || o.group === f.group).map((o) => ({ value: o.code, label: o.name, hint: o.zone !== "WIB" ? o.zone : o.group ?? undefined }));
  const all: Extra[] = [
    ...(platform ? [{ key: "platform", label: tr("Platform"), value: f.platform, onChange: (v: string) => set({ platform: v }), options: platformOptions(), any: tr("All") }] : []),
    ...(outlet ? [{ key: "group", label: tr("Branch group"), value: f.group, onChange: (v: string) => set({ group: v, outlet: "" }), options: (ctx?.groups ?? []).map((g) => ({ value: g, label: g })), any: tr("All") },
      { key: "outlet", label: tr("Outlet"), value: f.outlet, onChange: (v: string) => set({ outlet: v }), options: outs, any: tr("All") }] : []),
    ...extra,
  ];
  const chosen = all.filter((e) => e.value);
  const periodChanged = period && preset !== FIRST;
  const count = chosen.length + (periodChanged ? 1 : 0);
  const changed = count > 0;
  const clear = () => { a.reset(); extra.forEach((e) => e.onChange("")); };
  const name = PRESETS[preset]?.label() ?? `${fmtDayShort(f.from)} – ${fmtDayShort(f.to)}`;
  const info = period ? `${tr("{0} · all times in WIB", name)}${preset === FIRST ? ` · ${tr("choose a period for earlier days")}` : ""}` : note ?? tr("The situation now · all times in WIB");
  const box = q != null && onQ ? <SearchBox value={q} onChange={onQ} placeholder={placeholder ?? tr("Search")} /> : null;
  const xl = excel && <ExcelIconButton boxed label={tr("Export to Excel")} disabled={excelOff} loading={excelBusy} onClick={excel} className="!h-11 !w-11 sm:!h-10 sm:!w-10" />;
  const chip = "inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-[color:var(--j-E9F2FF)] px-2.5 text-xs text-[color:var(--j-0055CC)]";
  return (
    <div role="group" aria-label={tr("Filter")} className="space-y-2.5 border-b border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        {box && <div className="min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-md">{box}</div>}
        {lead && <div className="min-w-0 flex-1 basis-full sm:basis-72 sm:max-w-sm">{lead}</div>}
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <button ref={btn} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className={cx("flex h-11 flex-1 items-center justify-center gap-2 rounded-[3px] border px-4 text-[15px] font-medium sm:h-10 sm:flex-none sm:text-sm", changed ? "border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)]" : "border-[color:var(--j-DCDFE4)] bg-white text-[color:var(--j-172B4D)] hover:border-[color:var(--j-8590A2)]")}>
            <SlidersHorizontal size={16} /> {tr("Filter")}{count > 0 && <span className="rounded-full bg-[color:var(--j-0C66E4)] px-1.5 text-[11px] font-semibold leading-[18px] text-white">{count}</span>}</button>
          {changed && <button type="button" onClick={clear} aria-label={tr("Clear the filters")} title={tr("Clear the filters")} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)] sm:h-10 sm:w-10"><RotateCcw size={16} /></button>}
          {xl}
        </div>
      </div>
      {(periodChanged || chosen.length > 0) && <ul className="flex flex-wrap gap-1.5">
        {periodChanged && <li><button type="button" onClick={() => a.reset()} aria-label={tr("Remove {0}", tr("Period"))} className={chip}><span className="text-[color:var(--j-0C66E4)]/70">{tr("Period")}:</span><span className="min-w-0 truncate font-semibold">{name}</span><X size={13} className="shrink-0" /></button></li>}
        {chosen.map((e) => <li key={e.key}><button type="button" onClick={() => e.onChange("")} aria-label={tr("Remove {0}", e.label)} className={chip}><span className="text-[color:var(--j-0C66E4)]/70">{e.label}:</span><span className="min-w-0 truncate font-semibold">{e.options.find((o) => o.value === e.value)?.label ?? e.value}</span><X size={13} className="shrink-0" /></button></li>)}
      </ul>}
      <p className="flex items-center gap-1.5 text-xs text-[color:var(--j-626F86)]"><Clock size={12} className="shrink-0" aria-hidden />{info}</p>
      {children && <div className="flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
      <Floating open={open} onClose={() => setOpen(false)} title={tr("Filter")} subtitle={count ? tr("{0} chosen", count) : tr("Nothing chosen: everything is shown")} anchor={btn}
        footer={<><Button variant="secondary" className="flex-1" disabled={!changed} onClick={clear}>{tr("Clear")}</Button><Button className="flex-1" onClick={() => setOpen(false)}>{tr("Show")}</Button></>}>
        <div className="space-y-4 px-4 py-4">
          {period && <Row label={tr("Period")}><PeriodField label={tr("Period")} from={f.from} to={f.to} preset={preset} presets={Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label(), from: p.range()[0], to: p.range()[1] }))} onChange={(from, to, p) => set({ from, to, preset: p })} /></Row>}
          {all.map((e) => <Row key={e.key} label={e.label}><JSelect value={e.value} onChange={e.onChange} placeholder={e.any ?? tr("All")} label={e.label} options={[{ value: "", label: e.any ?? tr("All") }, ...e.options]} /></Row>)}
          {more && <div className="space-y-3 border-t border-[color:var(--j-F1F2F4)] pt-4">{more}</div>}
        </div>
      </Floating>
    </div>
  );
}

// ---------------------------------------------------------------- how fresh the data is

const SOURCES: Record<string, { label: () => string; key: keyof Freshness; limit: number }> = {
  status: { label: () => tr("Status and stock changes"), key: "histories", limit: 60 }, menu: { label: () => tr("Outlets and menus"), key: "global", limit: 180 },
  reviews: { label: () => tr("Reviews"), key: "reviews", limit: 180 }, daily: { label: () => tr("Daily report"), key: "daily", limit: 36 * 60 },
};
/** When the portal last read each source of the page, and how old BotFood's own reading is (2026-11-27: one line that
 *  opens; the choice is kept on the device. A late source keeps the line in amber with what is late, even closed). */
export function FreshLine({ ctx, sources }: { ctx: Ctx | null; sources: ("status" | "menu" | "reviews" | "daily")[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { try { setOpen(localStorage.getItem("agg.fresh.open") === "1"); } catch { /* closed */ } }, []);
  const toggle = () => { setOpen(!open); try { localStorage.setItem("agg.fresh.open", open ? "0" : "1"); } catch { /* private window */ } };
  if (!ctx || now == null) return <p className="h-9 text-xs text-[color:var(--j-626F86)]">…</p>;
  const old = (iso: string | null, min: number) => !iso || now - new Date(iso).getTime() > min * 60_000;
  const facts: [string, string | null, boolean][] = [...sources.map((s): [string, string | null, boolean] => { const at = ctx.freshness[SOURCES[s].key] as string | null; return [SOURCES[s].label(), at, old(at, SOURCES[s].limit)]; }),
    [tr("BotFood read the apps"), ctx.freshness.synced, old(ctx.freshness.synced, 180)]];
  const late = facts.filter((f) => f[2]);
  const bad = late.length > 0 || ctx.freshness.errors.length > 0;
  const newest = facts.map((f) => f[1]).filter(Boolean).sort().pop() ?? null;
  return (
    <section aria-label={tr("Last update")} className={cx("rounded-[3px] border", bad ? "border-[color:var(--j-F5CD47)] bg-[color:var(--j-FFF7D6)]" : "border-[color:var(--j-DCDFE4)] bg-white")}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm sm:min-h-9">
        {bad ? <AlertTriangle size={15} className="shrink-0 text-[#B38600]" aria-hidden /> : <Clock size={14} className="shrink-0 text-[color:var(--j-626F86)]" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-[color:var(--j-172B4D)]">{tr("Last update")}</span>
          <span className="text-[color:var(--j-44546F)]"> · {bad ? tr("{0} late: check the merchant account before acting", late.map((f) => f[0]).join(", ") || tr("a source")) : tr("all sources up to date, {0}", ago(newest))}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-[color:var(--j-0C66E4)]">{open ? tr("Hide") : tr("Details")}</span>
        <ChevronDown size={16} className={cx("shrink-0 text-[color:var(--j-44546F)] transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[color:var(--j-DCDFE4)] px-3 py-2.5 sm:flex sm:flex-wrap sm:gap-x-8">{facts.map(([l, at, o]) => <div key={l} className="min-w-0"><dt className="text-xs text-[color:var(--j-626F86)]">{l}</dt><dd className={cx("text-[13px] font-semibold", o ? "text-[color:var(--j-7F5F01)]" : "text-[color:var(--j-172B4D)]")}>{ago(at)}<span className="ml-1.5 whitespace-nowrap text-xs font-normal text-[color:var(--j-626F86)]">{at ? `${dayOf(at) === daysAgo(0) ? "" : `${fmtDayShort(dayOf(at))}, `}${fmtClock(at)} WIB` : ""}</span></dd></div>)}</dl>}
    </section>
  );
}

// ---------------------------------------------------------------- the table

export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => string | number | null | undefined; first?: SortDir; right?: boolean; className?: string; hide?: boolean;
  /** phones: the title of the card, at its right, or over the whole width */ card?: "title" | "side" | "wide" };
const SIZES = [25, 50, 100];
const SizeCtx = createContext<{ size: number; setSize: (n: number) => void } | null>(null);
/** keeps the rows per page for every table of the module */
export function usePageSize() {
  const [size, set] = useState(25);
  useEffect(() => { try { const n = Number(sessionStorage.getItem("agg.size")); if (SIZES.includes(n)) set(n); } catch { /* default */ } }, []);
  return { size, setSize: (n: number) => { set(n); try { sessionStorage.setItem("agg.size", String(n)); } catch { /* private window */ } } };
}

export function DataTable<T>({ cols, rows, loading, rowKey, onRow, initial, note, empty, resetKey, select, expand, minWidth = 820 }: {
  cols: Col<T>[]; rows: T[]; loading?: boolean; rowKey: (r: T) => string; onRow?: (r: T) => void; initial?: { key: string; dir: SortDir }; note?: ReactNode; empty?: string;
  /** a change of it goes back to page 1 */ resetKey: string;
  select?: { picked: Set<string>; onChange: (s: Set<string>) => void; label: (r: T) => string }; expand?: (r: T) => ReactNode; minWidth?: number;
}) {
  const ctx = useContext(SizeCtx);
  const own = usePageSize();
  const { size, setSize } = ctx ?? own;
  const vis = cols.filter((c) => !c.hide);
  const value = useCallback((r: T, k: string) => cols.find((c) => c.key === k)?.sort?.(r), [cols]);
  const { rows: sorted, sort, toggle, setSort } = useSort<T, string>(rows, value, initial ?? { key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setPage(1); }, [resetKey, size, sort.key, sort.dir]);
  const pages = Math.max(1, Math.ceil(sorted.length / size)), cur = Math.min(page, pages);
  const shown = sorted.slice((cur - 1) * size, cur * size);
  if (loading) return <SkeletonTable cols={vis.length} />;
  if (!rows.length) return <Empty title={empty ?? tr("Nothing in this period")} />;
  const ids = shown.map(rowKey), all = select && ids.every((i) => select.picked.has(i));
  const setMany = (list: string[], on: boolean) => { const n = new Set(select!.picked); list.forEach((i) => (on ? n.add(i) : n.delete(i))); select!.onChange(n); };
  const span = vis.length + (select ? 1 : 0);
  const title = vis.find((c) => c.card === "title") ?? vis[0], side = vis.find((c) => c.card === "side"), rest = vis.filter((c) => c !== title && c !== side);
  const sorts = vis.filter((c) => c.sort && c.label).flatMap((c) => [{ value: `${c.key}|${c.first ?? "asc"}`, label: `${c.label} ${(c.first ?? "asc") === "asc" ? "↑" : "↓"}` }, { value: `${c.key}|${c.first === "desc" ? "asc" : "desc"}`, label: `${c.label} ${c.first === "desc" ? "↑" : "↓"}` }]);
  return (
    <div>
      {select && select.picked.size > 0 && sorted.length > shown.length && all && select.picked.size < sorted.length && (
        <p className="border-b border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-4 py-2 text-xs text-[color:var(--j-0055CC)] sm:px-5">{tr("{0} on this page are chosen.", nf(shown.length))} <button type="button" className="font-semibold underline" onClick={() => setMany(sorted.map(rowKey), true)}>{tr("Choose all {0}", nf(sorted.length))}</button></p>)}
      <div className="md:hidden">
        {(select || sorts.length > 1) && <div className="flex items-center gap-3 border-b border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-4 py-2.5">
          {select && <label className="flex min-h-11 flex-shrink-0 items-center gap-2.5 text-sm text-[color:var(--j-44546F)]"><input type="checkbox" className="h-5 w-5" checked={!!all} onChange={(e) => setMany(ids, e.target.checked)} />{tr("All")}</label>}
          {sorts.length > 1 && <><span className="ml-auto flex-shrink-0 text-xs text-[color:var(--j-626F86)]">{tr("Sort by")}</span><div className="min-w-0 max-w-[13rem] flex-1"><JSelect value={sort.key ? `${sort.key}|${sort.dir}` : ""} onChange={(v) => { const [key, dir] = v.split("|"); setSort({ key, dir: dir as SortDir }); }} label={tr("Sort by")} placeholder={tr("Choose")} options={sorts} /></div></>}
        </div>}
        <ul className="divide-y divide-[color:var(--j-DCDFE4)]">{shown.map((r) => {
          const id = rowKey(r), click = onRow ? () => onRow(r) : expand ? () => setOpen(open === id ? null : id) : undefined;
          return (
            <li key={id} className={cx("px-4 py-3.5", select?.picked.has(id) && "bg-[color:var(--j-E9F2FF)]")}>
              <div className="flex items-start gap-3">
                {select && <input type="checkbox" className="mt-0.5 h-5 w-5 flex-shrink-0" aria-label={select.label(r)} checked={select.picked.has(id)} onChange={(e) => setMany([id], e.target.checked)} />}
                {click ? <button type="button" onClick={click} className="min-w-0 flex-1 text-left text-[15px]">{title.render(r)}</button> : <div className="min-w-0 flex-1 text-[15px]">{title.render(r)}</div>}
                {side && <div className="max-w-[45%] flex-shrink-0 text-right text-sm">{side.render(r)}</div>}
                {click && <ChevronRight size={18} className={cx("mt-0.5 flex-shrink-0 text-[color:var(--j-8590A2)]", !onRow && open === id && "rotate-90")} aria-hidden />}
              </div>
              {rest.length > 0 && <dl className={cx("mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5", select && "pl-8")}>{rest.map((c) => <div key={c.key} className={cx("min-w-0", (c.card === "wide" || !c.label) && "col-span-2")}>{c.label && <dt className="mb-0.5 text-[11px] text-[color:var(--j-626F86)]">{c.label}</dt>}<dd className="break-words text-sm text-[color:var(--j-172B4D)]">{c.render(r)}</dd></div>)}</dl>}
              {expand && open === id && <div className="mt-3 rounded-[3px] bg-[color:var(--j-F7F8F9)] p-3">{expand(r)}</div>}
            </li>);
        })}</ul>
      </div>
      <div className="hidden max-h-[70vh] overflow-auto md:block">
        <table className={jTable} style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-2px_0_#e5e5e5]"><tr className={cx(jHeadRow, "border-b-0")}>
            {select && <th className={cx(jTh, "w-9")}><input type="checkbox" aria-label={tr("Choose all shown")} checked={!!all} onChange={(e) => setMany(ids, e.target.checked)} /></th>}
            {vis.map((c) => c.sort ? <SortTh key={c.key} k={c.key} sort={sort} onSort={toggle} first={c.first} align={c.right ? "right" : "left"} pad={jTh}>{c.label}</SortTh> : <th key={c.key} className={cx(jTh, c.right && "text-right")}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const id = rowKey(r), click = onRow ? () => onRow(r) : expand ? () => setOpen(open === id ? null : id) : undefined;
              return [
                <tr key={id} onClick={click} className={cx("border-b border-[color:var(--j-F1F2F4)] align-top hover:bg-[color:var(--j-F7F8F9)]", click && "cursor-pointer", select?.picked.has(id) && "bg-[color:var(--j-E9F2FF)]")}>
                  {select && <td className={jTd} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={select.label(r)} checked={select.picked.has(id)} onChange={(e) => setMany([id], e.target.checked)} /></td>}
                  {vis.map((c) => <td key={c.key} data-label={c.label} className={cx(jTd, c.right && "text-right tabular-nums", c.className)}>{c.render(r)}</td>)}
                </tr>,
                expand && open === id && <tr key={`${id}x`} className="border-b border-[color:var(--j-F1F2F4)] bg-[color:var(--j-F7F8F9)]"><td colSpan={span} className="px-5 py-3">{expand(r)}</td></tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2.5 border-t border-[color:var(--j-DCDFE4)] px-4 py-3 text-xs text-[color:var(--j-626F86)] sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:py-2.5">
        {note ? <span className="flex max-w-3xl items-start gap-1.5"><Info size={13} className="mt-0.5 shrink-0 text-[color:var(--j-626F86)]" aria-hidden /><span>{note}</span></span> : <span />}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 lg:shrink-0">
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">{tr("Rows per page")}
            <span className="inline-flex overflow-hidden rounded border border-[color:var(--j-DCDFE4)]" role="group">{SIZES.map((n) => <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={cx("h-9 px-2.5 tabular-nums lg:h-7 lg:px-2", size === n ? "bg-[color:var(--j-0C66E4)] font-semibold text-white" : "bg-white text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]")}>{n}</button>)}</span></label>
          <span className="whitespace-nowrap tabular-nums">{tr("{0}–{1} of {2}", nf((cur - 1) * size + 1), nf(Math.min(cur * size, sorted.length)), nf(sorted.length))}</span>
          {pages > 1 && <span className="flex w-full items-center justify-center gap-1.5 lg:w-auto lg:gap-1">
            <Nav label={tr("First page")} off={cur <= 1} go={() => setPage(1)}><ChevronsLeft size={15} /></Nav><Nav label={tr("Previous Page")} off={cur <= 1} go={() => setPage(cur - 1)}><ChevronLeft size={15} /></Nav>
            <span className="px-1 tabular-nums">{cur} / {pages}</span>
            <Nav label={tr("Next Page")} off={cur >= pages} go={() => setPage(cur + 1)}><ChevronRight size={15} /></Nav><Nav label={tr("Last page")} off={cur >= pages} go={() => setPage(pages)}><ChevronsRight size={15} /></Nav></span>}
        </div>
      </div>
    </div>
  );
}
const Nav = ({ label, off, go, children }: { label: string; off: boolean; go: () => void; children: ReactNode }) => <Button variant="secondary" size="sm" className="!h-10 px-2.5 lg:!h-8 lg:px-1.5" disabled={off} onClick={go} aria-label={label}>{children}</Button>;

/** The outlet of a row: its full name (2026-11-27: never shortened), its code, the zone when not WIB. */
export function OutletCell({ name, code, ctx }: { name: string; code?: string | null; ctx: Ctx | null }) {
  const o = code ? ctx?.outlets.find((x) => x.code === code) : null;
  return <span className="block min-w-0"><span className="font-medium text-[color:var(--j-172B4D)]">{name}</span>
    <span className="block text-[11px] text-[color:var(--j-626F86)]">{code ?? tr("not matched to our outlet")}{o?.group ? ` · ${o.group}` : ""}{o && o.zone !== "WIB" ? ` · ${o.zone}` : ""}</span></span>;
}

/** Label, bar, number. */
export function Bars({ rows, onPick, empty }: { rows: { key: string; label: string; n: number; sub?: string }[]; onPick?: (key: string) => void; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Empty title={empty ?? tr("Nothing in this period")} />;
  return <ul className="divide-y divide-[color:var(--j-F1F2F4)]">{rows.map((r) => {
    const body = <><span className="min-w-0 truncate text-[color:var(--j-172B4D)]" title={r.label}>{r.label}{r.sub && <span className="ml-1.5 text-[11px] text-[color:var(--j-626F86)]">{r.sub}</span>}</span><span className="h-2.5 rounded-sm bg-[color:var(--j-091E420F)]"><span className="block h-2.5 rounded-sm bg-[color:var(--j-0C66E4)]" style={{ width: `${(r.n / max) * 100}%` }} /></span><span className="text-right tabular-nums text-[color:var(--j-44546F)]">{nf(r.n)}</span></>;
    const cls = "grid w-full grid-cols-[minmax(0,1fr)_minmax(4rem,1.2fr)_3.5rem] items-center gap-3 px-4 py-2.5 text-left text-sm sm:px-5";
    return <li key={r.key}>{onPick ? <button type="button" onClick={() => onPick(r.key)} className={cx(cls, "hover:bg-[color:var(--j-F7F8F9)]")}>{body}</button> : <div className={cls}>{body}</div>}</li>;
  })}</ul>;
}

/** Nobody is scheduled: one line instead of an empty column. */
export const noMembers = <T extends { member?: string | null }>(rows: T[]) => !rows.some((r) => r.member);

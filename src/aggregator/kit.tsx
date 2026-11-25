"use client";

// Aggregator Insight (2026-11-25): what every page is made of — the filters (kept while moving between the pages), how
// fresh the data is, the table (sort, pages, cards on phones) and the Excel.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock, RotateCcw } from "lucide-react";
import { Button, Empty, Input, cx } from "@/so/ui";
import { JSelect, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { SortTh, useSort, type SortDir } from "@/so/ui/Sort";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { ago, daysAgo, fmtPeriod, fmtStamp, nf } from "./time";

export const PLATFORMS = ["GoFood", "GrabFood", "ShopeeFood"] as const;
const DOT: Record<string, string> = { GoFood: "bg-emerald-600", GrabFood: "bg-green-500", ShopeeFood: "bg-orange-500" };
export const Platform = ({ p }: { p: string }) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={cx("h-2 w-2 shrink-0 rounded-full", DOT[p] ?? "bg-neutral-400")} aria-hidden />{p}</span>;

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
const KEY = "agg.filters";
const base = (): Filters => ({ from: daysAgo(6), to: daysAgo(0), platform: "", outlet: "", group: "" });
type Keep = Filters & { preset?: string };
export type AggFilters = { f: Filters; set: (p: Partial<Filters> & { preset?: string }) => void; reset: () => void; changed: boolean; ready: boolean; preset: string; query: string };

const monthStart = (back: number) => { const [y, m] = daysAgo(0).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 - back, 1)); return d.toISOString().slice(0, 10); };
const monthEnd = (back: number) => { const [y, m] = daysAgo(0).split("-").map(Number); return new Date(Date.UTC(y, m - back, 0)).toISOString().slice(0, 10); };
const PRESETS: Record<string, { label: () => string; range: () => [string, string] }> = {
  today: { label: () => tr("Today"), range: () => [daysAgo(0), daysAgo(0)] }, yesterday: { label: () => tr("Yesterday"), range: () => [daysAgo(1), daysAgo(1)] },
  "7": { label: () => tr("Last 7 days"), range: () => [daysAgo(6), daysAgo(0)] }, "30": { label: () => tr("Last 30 days"), range: () => [daysAgo(29), daysAgo(0)] },
  month: { label: () => tr("This month"), range: () => [monthStart(0), daysAgo(0)] }, last: { label: () => tr("Last month"), range: () => [monthStart(1), monthEnd(1)] },
};

/** The filters, the same on every page of the module while the tab is open. A preset moves with the day. */
export function useFilters(): AggFilters {
  const [k, setK] = useState<Keep>(() => ({ ...base(), preset: "7" }));
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
  const reset = useCallback(() => set({ ...base(), preset: "7" }), [set]);
  const f: Filters = { from: k.from, to: k.to, platform: k.platform, outlet: k.outlet, group: k.group };
  const query = new URLSearchParams({ dateFrom: k.from, dateTo: k.to, ...(k.platform ? { platform: k.platform } : {}) }).toString();
  return { f, set, reset, ready, query, preset: k.preset ?? "custom", changed: k.preset !== "7" || !!(k.platform || k.outlet || k.group) };
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

export type Extra = { key: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] };

/** The filter card: period, platform, group, outlet and those of the page. `period` off for a page about now. */
export function FilterBar({ a, ctx, extra = [], period = true, outlet = true, platform = true, lead, note }: { lead?: ReactNode; note?: string; a: AggFilters; ctx: Ctx | null; extra?: Extra[]; period?: boolean; outlet?: boolean; platform?: boolean }) {
  const { f, set, preset } = a;
  const custom = preset === "custom";
  const [more, setMore] = useState(false);
  const active = [platform && f.platform, outlet && f.group, outlet && f.outlet, ...extra.map((e) => e.value)].filter(Boolean).length;
  const changed = (period && preset !== "7") || active > 0;
  const outs = (ctx?.outlets ?? []).filter((o) => !f.group || o.group === f.group).map((o) => ({ value: o.code, label: o.name.replace(/^Kopi Calf (To Go )?/, ""), hint: o.zone !== "WIB" ? o.zone : o.group ?? undefined }));
  const box = "min-w-0";
  return (
    <section aria-label={tr("Filter")} className="relative z-20 rounded-2xl border border-neutral-200/70 bg-white p-3 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] sm:p-4">
      <div className="flex items-center gap-2 sm:hidden">
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex h-10 flex-1 items-center justify-between gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm">
          <span className="min-w-0 truncate text-left">{period ? fmtPeriod(f.from, f.to) : tr("Filter")}{active > 0 && <span className="ml-2 rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold text-white">{active}</span>}</span>
          <ChevronDown size={16} className={cx("shrink-0 text-neutral-400 transition", more && "rotate-180")} /></button>
      </div>
      <div className={cx("gap-2 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))]", more ? "mt-2 grid grid-cols-2" : "hidden sm:grid")}>
        {lead}
        {period && <div className={box}><Label t={tr("Period")} /><JSelect value={preset} label={tr("Period")} placeholder={tr("Period")} onChange={(v) => { if (v === "custom") set({ preset: "custom" }); else { const [from, to] = PRESETS[v].range(); set({ from, to, preset: v }); } }}
          options={[...Object.entries(PRESETS).map(([value, p]) => ({ value, label: p.label() })), { value: "custom", label: tr("Choose dates") }]} /></div>}
        {period && custom && <div className={cx(box, "col-span-2")}><Label t={tr("From – to")} /><div className="flex items-center gap-1.5"><Input type="date" value={f.from} max={daysAgo(0)} aria-label={tr("From")} onChange={(e) => e.target.value && set({ from: e.target.value })} className="h-9" /><span className="text-neutral-400">–</span>
          <Input type="date" value={f.to} max={daysAgo(0)} aria-label={tr("To")} onChange={(e) => e.target.value && set({ to: e.target.value })} className="h-9" /></div></div>}
        {platform && <div className={box}><Label t={tr("Platform")} /><JSelect value={f.platform} onChange={(v) => set({ platform: v })} placeholder={tr("All platforms")} label={tr("Platform")} options={[{ value: "", label: tr("All platforms") }, ...PLATFORMS.map((p) => ({ value: p, label: p }))]} /></div>}
        {outlet && <div className={box}><Label t={tr("Branch group")} /><JSelect value={f.group} onChange={(v) => set({ group: v, outlet: "" })} placeholder={tr("All groups")} label={tr("Branch group")} options={[{ value: "", label: tr("All groups") }, ...(ctx?.groups ?? []).map((g) => ({ value: g, label: g }))]} /></div>}
        {outlet && <div className={box}><Label t={tr("Outlet")} /><JSelect value={f.outlet} onChange={(v) => set({ outlet: v })} placeholder={tr("All outlets")} label={tr("Outlet")} options={[{ value: "", label: tr("All outlets") }, ...outs]} /></div>}
        {extra.map((e) => <div key={e.key} className={box}><Label t={e.label} /><JSelect value={e.value} onChange={e.onChange} placeholder={tr("All")} label={e.label} options={[{ value: "", label: tr("All") }, ...e.options]} /></div>)}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        {period ? <span><span className="hidden font-medium text-neutral-700 sm:inline">{fmtPeriod(f.from, f.to)} · </span>{tr("all times in WIB")}</span> : <span>{note ?? tr("The situation now · all times in WIB")}</span>}
        {changed && <button type="button" onClick={() => { a.reset(); extra.forEach((e) => e.onChange("")); }} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"><RotateCcw size={12} /> {tr("Clear the filters")}</button>}
      </div>
    </section>
  );
}
export const Label = ({ t }: { t: string }) => <span className="mb-1 block text-[11px] font-semibold text-neutral-500">{t}</span>;

// ---------------------------------------------------------------- how fresh the data is

const SOURCES: Record<string, { label: () => string; key: keyof Freshness; limit: number }> = {
  status: { label: () => tr("Status and stock changes"), key: "histories", limit: 60 }, menu: { label: () => tr("Outlets and menus"), key: "global", limit: 180 },
  reviews: { label: () => tr("Reviews"), key: "reviews", limit: 180 }, daily: { label: () => tr("Daily report"), key: "daily", limit: 36 * 60 },
};
/** One line: when the portal last read each source of the page, and how old BotFood's own reading is. */
export function FreshLine({ ctx, sources }: { ctx: Ctx | null; sources: ("status" | "menu" | "reviews" | "daily")[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!ctx || now == null) return <p className="h-5 text-xs text-neutral-400">…</p>;
  const old = (iso: string | null, min: number) => !iso || now - new Date(iso).getTime() > min * 60_000;
  const bad = sources.some((s) => old(ctx.freshness[SOURCES[s].key] as string | null, SOURCES[s].limit)) || old(ctx.freshness.synced, 180) || ctx.freshness.errors.length > 0;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-xs", bad ? "bg-amber-50 text-amber-900" : "bg-neutral-100/70 text-neutral-600")}>
      {bad ? <AlertTriangle size={14} className="shrink-0" aria-hidden /> : <Clock size={13} className="shrink-0" aria-hidden />}
      {sources.map((s) => { const at = ctx.freshness[SOURCES[s].key] as string | null; return <span key={s} title={fmtStamp(at)}>{SOURCES[s].label()}: <b className="font-semibold">{ago(at)}</b></span>; })}
      <span title={fmtStamp(ctx.freshness.synced)}>{tr("BotFood read the apps")}: <b className="font-semibold">{ago(ctx.freshness.synced)}</b></span>
      {bad && <span>{tr("Check the merchant account before acting.")}</span>}
    </p>
  );
}

// ---------------------------------------------------------------- the table

export type Col<T> = { key: string; label: string; render: (r: T) => ReactNode; sort?: (r: T) => string | number | null | undefined; first?: SortDir; right?: boolean; className?: string; hide?: boolean };
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
  const { rows: sorted, sort, toggle } = useSort<T, string>(rows, value, initial ?? { key: null, dir: "asc" });
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
  return (
    <div>
      {select && select.picked.size > 0 && sorted.length > shown.length && all && select.picked.size < sorted.length && (
        <p className="border-b border-brand-100 bg-brand-50/60 px-4 py-2 text-xs text-brand-900 sm:px-5">{tr("{0} on this page are chosen.", nf(shown.length))} <button type="button" className="font-semibold underline" onClick={() => setMany(sorted.map(rowKey), true)}>{tr("Choose all {0}", nf(sorted.length))}</button></p>)}
      <div className="max-h-[70vh] overflow-auto max-md:max-h-none">
        <table className={cx("m-cards", jTable)} style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-2px_0_#e5e5e5]"><tr className={cx(jHeadRow, "border-b-0")}>
            {select && <th className={cx(jTh, "w-9")}><input type="checkbox" aria-label={tr("Choose all shown")} checked={!!all} onChange={(e) => setMany(ids, e.target.checked)} /></th>}
            {vis.map((c) => c.sort ? <SortTh key={c.key} k={c.key} sort={sort} onSort={toggle} first={c.first} align={c.right ? "right" : "left"} pad={jTh}>{c.label}</SortTh> : <th key={c.key} className={cx(jTh, c.right && "text-right")}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {shown.map((r) => {
              const id = rowKey(r), click = onRow ? () => onRow(r) : expand ? () => setOpen(open === id ? null : id) : undefined;
              return [
                <tr key={id} onClick={click} className={cx("border-b border-neutral-100 align-top hover:bg-neutral-50", click && "cursor-pointer", select?.picked.has(id) && "bg-brand-50/40")}>
                  {select && <td className={jTd} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={select.label(r)} checked={select.picked.has(id)} onChange={(e) => setMany([id], e.target.checked)} /></td>}
                  {vis.map((c) => <td key={c.key} data-label={c.label} className={cx(jTd, c.right && "text-right tabular-nums", c.className)}>{c.render(r)}</td>)}
                </tr>,
                expand && open === id && <tr key={`${id}x`} className="border-b border-neutral-100 bg-neutral-50/70"><td colSpan={span} className="px-5 py-3">{expand(r)}</td></tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-2.5 text-xs text-neutral-500 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <span className="max-w-3xl">{note}</span>
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
          <label className="inline-flex items-center gap-1.5 whitespace-nowrap">{tr("Rows per page")}
            <span className="inline-flex overflow-hidden rounded border border-neutral-200" role="group">{SIZES.map((n) => <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={cx("h-7 px-2 tabular-nums", size === n ? "bg-brand-700 font-semibold text-white" : "bg-white text-neutral-600 hover:bg-neutral-100")}>{n}</button>)}</span></label>
          <span className="whitespace-nowrap tabular-nums">{tr("{0}–{1} of {2}", nf((cur - 1) * size + 1), nf(Math.min(cur * size, sorted.length)), nf(sorted.length))}</span>
          {pages > 1 && <span className="inline-flex items-center gap-1">
            <Nav label={tr("First page")} off={cur <= 1} go={() => setPage(1)}><ChevronsLeft size={15} /></Nav><Nav label={tr("Previous Page")} off={cur <= 1} go={() => setPage(cur - 1)}><ChevronLeft size={15} /></Nav>
            <span className="px-1 tabular-nums">{cur} / {pages}</span>
            <Nav label={tr("Next Page")} off={cur >= pages} go={() => setPage(cur + 1)}><ChevronRight size={15} /></Nav><Nav label={tr("Last page")} off={cur >= pages} go={() => setPage(pages)}><ChevronsRight size={15} /></Nav></span>}
        </div>
      </div>
    </div>
  );
}
const Nav = ({ label, off, go, children }: { label: string; off: boolean; go: () => void; children: ReactNode }) => <Button variant="secondary" size="sm" className="px-1.5" disabled={off} onClick={go} aria-label={label}>{children}</Button>;

/** The outlet of a row: short name, its code, the zone when not WIB. */
export function OutletCell({ name, code, ctx }: { name: string; code?: string | null; ctx: Ctx | null }) {
  const o = code ? ctx?.outlets.find((x) => x.code === code) : null;
  return <span className="block min-w-0"><span className="font-medium text-neutral-900">{name.replace(/^Kopi Calf,? ?(To Go )?/, "") || name}</span>
    <span className="block text-[11px] text-neutral-400">{code ?? tr("not matched to our outlet")}{o?.group ? ` · ${o.group}` : ""}{o && o.zone !== "WIB" ? ` · ${o.zone}` : ""}</span></span>;
}

/** Label, bar, number. */
export function Bars({ rows, onPick, empty }: { rows: { key: string; label: string; n: number; sub?: string }[]; onPick?: (key: string) => void; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Empty title={empty ?? tr("Nothing in this period")} />;
  return <ul className="divide-y divide-neutral-100">{rows.map((r) => {
    const body = <><span className="min-w-0 truncate text-neutral-800" title={r.label}>{r.label}{r.sub && <span className="ml-1.5 text-[11px] text-neutral-400">{r.sub}</span>}</span><span className="h-2.5 rounded-sm bg-neutral-100"><span className="block h-2.5 rounded-sm bg-brand-600" style={{ width: `${(r.n / max) * 100}%` }} /></span><span className="text-right tabular-nums text-neutral-700">{nf(r.n)}</span></>;
    const cls = "grid w-full grid-cols-[minmax(0,1fr)_minmax(4rem,1.2fr)_3.5rem] items-center gap-3 px-4 py-2.5 text-left text-sm sm:px-5";
    return <li key={r.key}>{onPick ? <button type="button" onClick={() => onPick(r.key)} className={cx(cls, "hover:bg-neutral-50")}>{body}</button> : <div className={cls}>{body}</div>}</li>;
  })}</ul>;
}

/** Nobody is scheduled: one line instead of an empty column. */
export const noMembers = <T extends { member?: string | null }>(rows: T[]) => !rows.some((r) => r.member);

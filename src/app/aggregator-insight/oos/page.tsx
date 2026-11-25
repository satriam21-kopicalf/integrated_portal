"use client";

// Aggregator Insight → Out of Stock (page agg.oos, 2026-11-24; redone 2026-11-25): what is out on the delivery apps now, and
// in a period how often each item went out and for how long — only the minutes inside the opening hours of the outlet.

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { ErrorState, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { Lozenge, QuickChips, WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Tip } from "@/aggregator/info";
import { Bars, DataTable, FilterBar, FreshLine, OutletCell, Platform, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { downloadSheets } from "@/aggregator/ui";
import { ago, dayOf, fmtPeriod, fmtSpan, fmtStamp, nf, xlStamp } from "@/aggregator/time";

type Now = { outlet: string; branchCode: string | null; platform: string; category: string; item: string; since: string | null };
type Per = { outlet: string; branchCode: string | null; platform: string; category: string; item: string; times: number; minutes: number; remarks: string; last: string | null; stillOut: boolean; hoursKnown: boolean };
type Res = { summary: { inactiveLong: number; staleDays: number; dataFrom: string | null }; current: Now[]; items: Per[] };
type Tab = "now" | "period" | "item" | "category" | "outlet";

export default function OutOfStock() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [packaging, setPackaging] = useState(false);
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("now");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [only, setOnly] = useState<"period" | "all">("period");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/oos?${a.query}${packaging ? "&packaging=true" : ""}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query, packaging, version]);
  const t = q.trim().toLowerCase();
  const match = (r: { outlet: string; item: string; category: string }) => (!cat || r.category === cat) && (!t || `${r.outlet} ${r.item} ${r.category}`.toLowerCase().includes(t));
  const nowAll = useScope(data?.current, a.f, ctx), perAll = useScope(data?.items, a.f, ctx);
  const inPeriod = (r: Now) => { const d = r.since ? dayOf(r.since) : ""; return d >= a.f.from && d <= a.f.to; };
  const now = nowAll.filter((r) => match(r) && (only === "all" || inPeriod(r))), per = perAll.filter(match);
  const cats = [...new Set([...(data?.current ?? []), ...(data?.items ?? [])].map((r) => r.category))].sort();
  const group = (k: (r: Now) => string) => Object.entries(now.reduce<Record<string, number>>((m, r) => { m[k(r)] = (m[k(r)] ?? 0) + 1; return m; }, {})).map(([key, n]) => ({ key, label: key, n })).sort((x, y) => y.n - x.n);
  const items = (() => {
    const m = new Map<string, { item: string; category: string; outlets: Set<string>; platforms: Set<string> }>();
    for (const r of now) { const x = m.get(r.item) ?? { item: r.item, category: r.category, outlets: new Set(), platforms: new Set() }; x.outlets.add(r.outlet); x.platforms.add(r.platform); m.set(r.item, x); }
    return [...m.values()].map((x) => ({ item: x.item, category: x.category, outlets: x.outlets.size, platforms: [...x.platforms] }));
  })();
  const s = data?.summary;
  const minutes = perAll.reduce((x, r) => x + r.minutes, 0);
  const key = `${a.query}${a.f.outlet}${a.f.group}${cat}${t}${tab}${packaging}${only}`;
  const O = (r: { outlet: string; branchCode: string | null }) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} />;
  const nowCols: Col<Now>[] = [
    { key: "outlet", card: "wide", label: tr("Outlet"), sort: (r) => r.outlet, render: O }, { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "item", card: "title", label: tr("Item"), sort: (r) => r.item, className: "text-neutral-900", render: (r) => r.item }, { key: "category", label: tr("Category"), sort: (r) => r.category, className: "text-xs text-neutral-500", render: (r) => r.category },
    { key: "since", label: tr("Out since (WIB)"), sort: (r) => r.since, className: "whitespace-nowrap", render: (r) => <>{fmtStamp(r.since).replace(" WIB", "")}<span className="block text-[11px] text-neutral-400">{ago(r.since)}</span></> },
  ];
  const perCols: Col<Per>[] = [
    { key: "outlet", card: "wide", label: tr("Outlet"), sort: (r) => r.outlet, render: O }, { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "item", card: "title", label: tr("Item"), sort: (r) => r.item, render: (r) => <><span className="text-neutral-900">{r.item}</span><span className="block text-[11px] text-neutral-400">{r.category}</span></> },
    { key: "times", label: tr("Times out"), sort: (r) => r.times, first: "desc", right: true, render: (r) => `${nf(r.times)}×` },
    { key: "minutes", card: "side", label: tr("Time out"), sort: (r) => r.minutes, first: "desc", right: true, render: (r) => <span className="whitespace-nowrap">{fmtSpan(r.minutes)}<span className="block text-[11px] text-neutral-400">{r.hoursKnown ? tr("opening hours") : tr("day and night")}</span></span> },
    { key: "last", label: tr("Last out (WIB)"), sort: (r) => r.last, first: "desc", className: "whitespace-nowrap", render: (r) => <>{r.last ? fmtStamp(r.last).replace(" WIB", "") : "—"}{r.stillOut && <span className="ml-1.5"><Lozenge tone="red">{tr("Still out")}</Lozenge></span>}</> },
    { key: "remarks", label: tr("Remarks"), className: "text-xs text-neutral-500", hide: !per.some((r) => r.remarks), render: (r) => r.remarks },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Out of Stock ${a.f.from} - ${a.f.to}`, [
        { sheet: "Summary", title: `Out of Stock · ${fmtPeriod(a.f.from, a.f.to)}${a.f.platform ? ` · ${a.f.platform}` : ""} · WIB`, header: [tr("Measure"), tr("Value")], rows: [[tr("Items out now"), now.length], [tr("Outlets with an item out"), new Set(now.map((r) => r.outlet)).size], [tr("Times out in the period"), per.reduce((x, r) => x + r.times, 0)], [tr("Hours out in the period"), Math.round(per.reduce((x, r) => x + r.minutes, 0) / 6) / 10]] },
        { sheet: "Out now", header: [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Out since (WIB)")], rows: now.map((r) => [r.outlet, r.platform, r.category, r.item, xlStamp(r.since)]) },
        { sheet: "In the period", header: [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Times out"), tr("Minutes out"), tr("Counted"), tr("Last out (WIB)"), tr("Still out"), tr("Remarks")], rows: per.map((r) => [r.outlet, r.platform, r.category, r.item, r.times, r.minutes, r.hoursKnown ? tr("opening hours") : tr("day and night"), xlStamp(r.last), r.stillOut ? tr("Yes") : "", r.remarks]) },
        { sheet: "Per category", header: [tr("Category"), tr("Items out now")], rows: group((r) => r.category).map((x) => [x.key, x.n]) },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Items out now")], rows: group((r) => r.outlet).map((x) => [x.key, x.n]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const filter = (
    <FilterBar a={a} ctx={ctx} extra={[{ key: "cat", label: tr("Category"), value: cat, onChange: setCat, options: cats.map((c) => ({ value: c, label: c })) }]} q={q} onQ={setQ} placeholder={tr("Search outlet, item or category")} excel={() => void exportXlsx()} excelOff={!data}>{tab !== "period" && <QuickChips<"period" | "all"> value={only} onChange={setOnly} label={tr("Out since")} items={[{ key: "period", label: tr("Went out in the period"), dot: "bg-red-500", count: nowAll.filter(inPeriod).length }, { key: "all", label: tr("All still out"), count: nowAll.length }]} />}
              <label className="flex min-h-9 items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={packaging} onChange={(e) => setPackaging(e.target.checked)} /> {tr("Include packaging")}</label></FilterBar>
  );
  const card = <section className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white">{filter}</section>;
  return (
    <Page title={tr("Out of Stock")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Items out of stock on the delivery apps, per outlet, platform and category")} media={<Package size={19} />}>
      <FreshLine ctx={ctx} sources={["menu", "status"]} />
      {err ? <>{card}<ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /></> : (
        <>
          <StatStrip columns={4} label={tr("Out of stock")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Items out now")} info={<Tip k="oosNow" />} value={s ? nf(nowAll.length) : <StatSkeleton />} />
            <Stat label={tr("Outlets with an item out")} value={s ? nf(new Set(nowAll.map((r) => r.outlet)).size) : <StatSkeleton />} />
            <Stat label={tr("Times out in the period")} info={<Tip k="oosTimes" />} value={s ? nf(perAll.reduce((x, r) => x + r.times, 0)) : <StatSkeleton />}>{s && <p>{tr("{0} items", nf(perAll.length))}</p>}</Stat>
            <Stat label={tr("Average time out")} info={<Tip k="oosAvg" />} value={s ? (perAll.length ? fmtSpan(minutes / perAll.length) : "—") : <StatSkeleton />}>{s && <p>{tr("per item and outlet")}</p>}</Stat>
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "now", label: tr("Out now"), count: data ? now.length : null }, { key: "period", label: tr("In the period"), count: data ? perAll.length : null }, { key: "item", label: tr("Per item") }, { key: "category", label: tr("Per category") }, { key: "outlet", label: tr("Per outlet") }]}>
            {filter}
            {tab === "category" ? <Bars rows={group((r) => r.category)} onPick={(k) => { setCat(k); setTab("now"); }} empty={tr("Nothing out of stock")} />
              : tab === "outlet" ? <Bars rows={group((r) => r.outlet)} onPick={(k) => { setQ(k); setTab("now"); }} empty={tr("Nothing out of stock")} />
              : tab === "item" ? <DataTable key={tab} rows={items} loading={!data} rowKey={(r) => r.item} resetKey={key} initial={{ key: "n", dir: "desc" }} minWidth={620} empty={tr("Nothing out of stock")} onRow={(r) => { setQ(r.item); setTab("now"); }} note={tr("The situation now.")}
                cols={[{ key: "i", card: "title", label: tr("Item"), sort: (r) => r.item, render: (r) => <><span className="font-medium text-neutral-900">{r.item}</span><span className="block text-[11px] text-neutral-400">{r.category}</span></> }, { key: "n", label: tr("Outlets"), sort: (r) => r.outlets, first: "desc", right: true, render: (r) => nf(r.outlets) }, { key: "p", label: tr("Platform"), render: (r) => <span className="flex flex-wrap gap-3">{r.platforms.map((p) => <Platform key={p} p={p} />)}</span> }]} />
              : tab === "now" ? <DataTable key={tab} cols={nowCols} rows={now} loading={!data} rowKey={(r) => `${r.outlet}${r.platform}${r.item}${r.category}`} resetKey={key} initial={{ key: "since", dir: "desc" }} empty={tr("Nothing out of stock")}
                note={s ? tr("{0} items inactive for over {1} days are left out: switched off, not out of stock.", nf(s.inactiveLong), s.staleDays) : undefined} />
              : <DataTable key={tab} cols={perCols} rows={per} loading={!data} rowKey={(r) => `${r.outlet}${r.platform}${r.item}`} resetKey={key} initial={{ key: "minutes", dir: "desc" }} minWidth={940}
                note={<span className={cx(s?.dataFrom && a.f.from < s.dataFrom.slice(0, 10) && "text-amber-800")}>{tr("Stock changes are kept from {0}; earlier days hold nothing. Outlets without hours count day and night.", fmtStamp(s?.dataFrom))}</span>} />}
          </WorkCard>
        </>
      )}
    </Page>
  );
}

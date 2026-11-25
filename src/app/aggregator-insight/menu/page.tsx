"use client";

// Aggregator Insight → Price & Menu (page agg.menu, 2026-11-25): the prices that differ between outlets of a platform, the
// menus most outlets have and one misses, the price changes, and what sells better on a platform than elsewhere.

import { useCallback, useEffect, useState } from "react";
import { Download, ListChecks } from "lucide-react";
import { Button, ErrorState, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { Toolbar, WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { downloadSheets } from "@/aggregator/ui";
import { DataTable, FilterBar, FreshLine, OutletCell, Platform, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { fmtPeriod, fmtStamp, nf, pct, rp, xlStamp } from "@/aggregator/time";

type Spread = { platform: string; menu: string; outlets: number; usual: number; min: number; max: number; different: number; who: { outlet: string; price: number }[] };
type Missing = { platform: string; outlet: string; branchCode: string | null; menu: string; have: number; of: number };
type Change = { at: string; menu: string; platform: string; outlet: string; branchCode: string | null; old: number; new: number };
type Res = { summary: { items: number; spread: number; differ: number; missing: number; changes: number }; spread: Spread[]; missing: Missing[]; changes: Change[] };
type Fit = { menu: string; qty: number; amount: number; share: number; shareElsewhere: number; lift: number | null };
type FitRes = { from: string; to: string; data: Fit[] };
type Tab = "spread" | "missing" | "outlet" | "changes" | "fit";

export default function PriceMenu() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [fit, setFit] = useState<FitRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("missing");
  const [q, setQ] = useState("");
  const [version, setVersion] = useState(0);
  const { platform, outlet } = a.f;
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/menu${platform ? `?platform=${platform}` : ""}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, platform, version]);
  useEffect(() => {
    if (tab !== "fit" || !a.ready) return;
    let off = false;
    setFit(null);
    call<FitRes>(`/api/aggregator/menu/fit?${new URLSearchParams({ ...(platform ? { platform } : {}), ...(outlet ? { branch: outlet } : {}) })}`).then((r) => { if (!off) setFit(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [tab, a.ready, platform, outlet, version]);
  const t = q.trim().toLowerCase();
  const has = useCallback((...v: string[]) => !t || v.some((x) => x.toLowerCase().includes(t)), [t]);
  const spread = (data?.spread ?? []).filter((r) => has(r.menu, r.platform, ...r.who.map((w) => w.outlet)));
  const missAll = useScope(data?.missing, a.f, ctx), changesAll = useScope(data?.changes, a.f, ctx);
  const missing = missAll.filter((r) => has(r.menu, r.outlet)), changes = changesAll.filter((r) => has(r.menu, r.outlet));
  const fits = (fit?.data ?? []).filter((r) => has(r.menu));
  const perOutlet = Object.values(missing.reduce<Record<string, { outlet: string; branchCode: string | null; n: number; platforms: Set<string> }>>((m, r) => { const x = (m[r.outlet] ??= { outlet: r.outlet, branchCode: r.branchCode, n: 0, platforms: new Set() }); x.n++; x.platforms.add(r.platform); return m; }, {}));
  const s = data?.summary;
  const key = `${platform}${outlet}${a.f.group}${t}${tab}`;
  const spreadCols: Col<Spread>[] = [
    { key: "menu", label: tr("Menu"), sort: (r) => r.menu, render: (r) => <span className="font-medium text-neutral-900">{r.menu}</span> }, { key: "p", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "usual", label: tr("Usual price"), sort: (r) => r.usual, right: true, render: (r) => rp(r.usual) }, { key: "min", label: tr("Lowest"), sort: (r) => r.min, right: true, render: (r) => rp(r.min) }, { key: "max", label: tr("Highest"), sort: (r) => r.max, right: true, render: (r) => rp(r.max) },
    { key: "d", label: tr("Outlets that differ"), sort: (r) => r.different, first: "desc", right: true, render: (r) => tr("{0} of {1}", r.different, r.outlets) },
  ];
  const missCols: Col<Missing>[] = [
    { key: "o", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> }, { key: "p", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "menu", label: tr("Menu"), sort: (r) => r.menu, render: (r) => <span className="text-neutral-900">{r.menu}</span> }, { key: "have", label: tr("Outlets that have it"), sort: (r) => r.have / r.of, first: "desc", right: true, render: (r) => <>{tr("{0} of {1}", r.have, r.of)}<span className="block text-[11px] text-neutral-400">{pct((r.have / r.of) * 100, 0)}</span></> },
  ];
  const changeCols: Col<Change>[] = [
    { key: "at", label: tr("Time (WIB)"), sort: (r) => r.at, first: "desc", className: "whitespace-nowrap", render: (r) => fmtStamp(r.at).replace(" WIB", "") }, { key: "o", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "p", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> }, { key: "menu", label: tr("Menu"), sort: (r) => r.menu, render: (r) => r.menu }, { key: "old", label: tr("Old"), sort: (r) => r.old, right: true, render: (r) => rp(r.old) },
    { key: "new", label: tr("New"), sort: (r) => r.new, right: true, render: (r) => <>{rp(r.new)}<span className={cx("block text-[11px]", r.new < r.old ? "text-red-700" : "text-emerald-700")}>{r.old ? `${r.new > r.old ? "+" : ""}${pct(((r.new - r.old) / r.old) * 100)}` : ""}</span></> },
  ];
  const fitCols: Col<Fit>[] = [
    { key: "menu", label: tr("Menu"), sort: (r) => r.menu, render: (r) => <span className="font-medium text-neutral-900">{r.menu}</span> }, { key: "qty", label: tr("Portions"), sort: (r) => r.qty, first: "desc", right: true, render: (r) => nf(r.qty) }, { key: "amount", label: tr("Sales"), sort: (r) => r.amount, first: "desc", right: true, render: (r) => rp(r.amount) },
    { key: "share", label: tr("Share here %"), sort: (r) => r.share, first: "desc", right: true, render: (r) => pct(r.share, 2) }, { key: "else", label: tr("Share elsewhere %"), sort: (r) => r.shareElsewhere, first: "desc", right: true, render: (r) => pct(r.shareElsewhere, 2) },
    { key: "lift", label: tr("Strength"), sort: (r) => r.lift ?? 999, first: "desc", right: true, render: (r) => <span className={cx("font-semibold", r.lift == null ? "text-neutral-400" : r.lift >= 1.3 ? "text-emerald-700" : r.lift <= 0.7 ? "text-red-700" : "")}>{r.lift == null ? tr("only here") : `${nf(r.lift, 2)}×`}</span> },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets("Price & Menu", [
        { sheet: "Summary", title: `Price & Menu${platform ? ` · ${platform}` : ""} · ${fmtStamp(ctx?.freshness.global)}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Menu items read"), data.summary.items], [tr("Menus with different prices"), data.summary.spread], [tr("Outlet prices that differ"), data.summary.differ], [tr("Menus missing at an outlet"), missing.length]] },
        { sheet: "Different prices", header: [tr("Platform"), tr("Menu"), tr("Usual price"), tr("Outlet"), tr("Price"), tr("Difference")], rows: spread.flatMap((r) => r.who.map((w) => [r.platform, r.menu, r.usual, w.outlet, w.price, w.price - r.usual])) },
        { sheet: "Missing menus", header: [tr("Outlet"), tr("Platform"), tr("Menu"), tr("Outlets that have it"), tr("Outlets")], rows: missing.map((r) => [r.outlet, r.platform, r.menu, r.have, r.of]) },
        { sheet: "Price changes", header: [tr("Time (WIB)"), tr("Outlet"), tr("Platform"), tr("Menu"), tr("Old"), tr("New")], rows: changes.map((r) => [xlStamp(r.at), r.outlet, r.platform, r.menu, r.old, r.new]) },
        ...(fit ? [{ sheet: "What fits", title: fmtPeriod(fit.from, fit.to), header: [tr("Menu"), tr("Portions"), tr("Sales"), tr("Share here %"), tr("Share elsewhere %"), tr("Strength")], rows: fits.map((r) => [r.menu, r.qty, Math.round(r.amount), r.share, r.shareElsewhere, r.lift]) }] : []),
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Page title={tr("Price & Menu")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Prices and menus that are not the same at every outlet, and what sells on each platform")} media={<ListChecks size={19} />}
      actions={<Button variant="secondary" size="sm" disabled={!data} onClick={() => void exportXlsx()}><Download size={14} /> {tr("Excel")}</Button>}>
      <FreshLine ctx={ctx} sources={["menu"]} />
      <FilterBar a={a} ctx={ctx} period={false} note={tab === "fit" ? (fit ? tr("Sales of {0}", fmtPeriod(fit.from, fit.to)) : "…") : tab === "changes" ? tr("Price changes since 25 Nov 2026 · all times in WIB") : undefined} />
      {err ? <ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /> : (
        <>
          <StatStrip columns={4} label={tr("Price & Menu")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Menu items read")} value={s ? nf(s.items) : <StatSkeleton />} />
            <Stat label={tr("Menus missing at an outlet")} value={s ? nf(missAll.length) : <StatSkeleton />}>{s && <p>{tr("{0} outlets", nf(new Set(missAll.map((r) => r.outlet)).size))}</p>}</Stat>
            <Stat label={tr("Menus with different prices")} value={s ? nf(s.spread) : <StatSkeleton />}>{s && <p>{tr("{0} outlet prices", nf(s.differ))}</p>}</Stat>
            <Stat label={tr("Price changes")} value={s ? nf(changesAll.length) : <StatSkeleton />}><p>{tr("since 25 Nov 2026")}</p></Stat>
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "missing", label: tr("Missing menus"), count: s ? missAll.length : null }, { key: "outlet", label: tr("Missing per outlet") }, { key: "spread", label: tr("Different prices"), count: s ? s.spread : null }, { key: "changes", label: tr("Price changes"), count: s ? changesAll.length : null }, { key: "fit", label: tr("What fits") }]}>
            <Toolbar><div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder={tr("Search menu or outlet")} /></div></Toolbar>
            {tab === "missing" ? <DataTable key={tab} cols={missCols} rows={missing} loading={!data} rowKey={(r) => `${r.outlet}${r.platform}${r.menu}`} resetKey={key} initial={{ key: "o", dir: "asc" }} minWidth={700} empty={tr("No menu is missing")} note={tr("A menu at least 80% of the outlets of the platform have. Seasonal or limited menus may be missing on purpose.")} />
              : tab === "outlet" ? <DataTable key={tab} rows={perOutlet} loading={!data} rowKey={(r) => r.outlet} resetKey={key} initial={{ key: "n", dir: "desc" }} minWidth={520} empty={tr("No menu is missing")} onRow={(r) => { setQ(r.outlet); setTab("missing"); }}
                cols={[{ key: "o", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> }, { key: "p", label: tr("Platform"), render: (r) => <span className="flex flex-wrap gap-3">{[...r.platforms].map((p) => <Platform key={p} p={p} />)}</span> }, { key: "n", label: tr("Missing menus"), sort: (r) => r.n, first: "desc", right: true, render: (r) => nf(r.n) }]} />
              : tab === "spread" ? <DataTable key={tab} cols={spreadCols} rows={spread} loading={!data} rowKey={(r) => `${r.platform}${r.menu}`} resetKey={key} initial={{ key: "d", dir: "desc" }} empty={tr("Every outlet has the same price")} note={tr("The usual price is the one most outlets have; a different price may be a promo or another city.")}
                expand={(r) => <ul className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">{r.who.map((w) => <li key={w.outlet} className="flex justify-between gap-3"><span className="truncate">{w.outlet}</span><span className={cx("tabular-nums", w.price < r.usual ? "text-red-700" : "text-emerald-700")}>{rp(w.price)}</span></li>)}</ul>} />
              : tab === "changes" ? <DataTable key={tab} cols={changeCols} rows={changes} loading={!data} rowKey={(r) => `${r.at}${r.outlet}${r.platform}${r.menu}`} resetKey={key} initial={{ key: "at", dir: "desc" }} empty={tr("No price change seen yet")} />
              : <DataTable key={tab} cols={fitCols} rows={fits} loading={!fit} rowKey={(r) => r.menu} resetKey={key} initial={{ key: "amount", dir: "desc" }} note={<>{tr("The last 30 days. Strength = the share of the menu here against its share on the other channels; 1.3× or more sells clearly better here, 0.7× or less worse.")}{a.f.group && !outlet ? ` ${tr("The branch group does not apply here; choose an outlet.")}` : ""}</>} />}
          </WorkCard>
        </>
      )}
    </Page>
  );
}

"use client";

// Aggregator Insight → Price & Menu (page agg.menu, 2026-11-25): the prices that differ between outlets of a platform, the
// menus most outlets have and one misses, the price changes, and what sells better on a platform than elsewhere.

import { useEffect, useMemo, useState } from "react";
import { Download, ListChecks } from "lucide-react";
import { Button, ErrorState, PageNav, SearchBox, cx, usePaged, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, JSelect, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PLATFORMS, downloadSheets } from "@/aggregator/ui";

type Spread = { platform: string; menu: string; outlets: number; usual: number; min: number; max: number; different: number; who: { outlet: string; price: number }[] };
type Missing = { platform: string; outlet: string; menu: string; have: number; of: number };
type Change = { at: string; menu: string; platform: string; outlet: string; old: number; new: number };
type Res = { summary: { items: number; spread: number; differ: number; missing: number; changes: number }; spread: Spread[]; missing: Missing[]; changes: Change[] };
type Fit = { menu: string; qty: number; amount: number; share: number; shareElsewhere: number; lift: number | null };
type FitRes = { from: string; to: string; data: Fit[]; outlets: { code: string; name: string }[] };
type Tab = "spread" | "missing" | "changes" | "fit";
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const nf = (v: number) => Math.round(v).toLocaleString("id-ID");

export default function PriceMenu() {
  const toast = useToast();
  const [platform, setPlatform] = useState("");
  const [branch, setBranch] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [fit, setFit] = useState<FitRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("spread");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const load = () => { setData(null); setErr(null); call<Res>(`/api/aggregator/menu${platform ? `?platform=${platform}` : ""}`).then(setData).catch((e) => setErr(e.message)); };
  useEffect(load, [platform]);
  useEffect(() => {
    if (tab !== "fit") return;
    let off = false;
    const p = new URLSearchParams({ ...(platform ? { platform } : {}), ...(branch ? { branch } : {}) });
    call<FitRes>(`/api/aggregator/menu/fit?${p}`).then((r) => { if (!off) setFit(r); }).catch((e) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [tab, platform, branch]);
  const t = q.trim().toLowerCase();
  const has = (...v: string[]) => !t || v.some((x) => x.toLowerCase().includes(t));
  const spread = useMemo(() => (data?.spread ?? []).filter((r) => has(r.menu, r.platform, ...r.who.map((w) => w.outlet))), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = useMemo(() => (data?.missing ?? []).filter((r) => has(r.menu, r.outlet, r.platform)), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const changes = useMemo(() => (data?.changes ?? []).filter((r) => has(r.menu, r.outlet, r.platform)), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const fits = useMemo(() => (fit?.data ?? []).filter((r) => has(r.menu)), [fit, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const pm = usePaged(missing, `${platform}${t}${tab}`, 50);
  const s = data?.summary;
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets("Price & Menu", [
        { sheet: "Summary", title: `Price & Menu${platform ? ` · ${platform}` : ""}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Menu items read"), data.summary.items], [tr("Menus with different prices"), data.summary.spread], [tr("Outlet prices that differ"), data.summary.differ], [tr("Menus missing at an outlet"), data.summary.missing]] },
        { sheet: "Different prices", header: [tr("Platform"), tr("Menu"), tr("Usual price"), tr("Outlet"), tr("Price"), tr("Difference")], rows: data.spread.flatMap((r) => r.who.map((w) => [r.platform, r.menu, r.usual, w.outlet, w.price, w.price - r.usual])) },
        { sheet: "Missing menus", header: [tr("Outlet"), tr("Platform"), tr("Menu"), tr("Outlets that have it"), tr("Outlets")], rows: data.missing.map((r) => [r.outlet, r.platform, r.menu, r.have, r.of]) },
        { sheet: "Price changes", header: [tr("Time"), tr("Outlet"), tr("Platform"), tr("Menu"), tr("Old"), tr("New")], rows: data.changes.map((r) => [r.at.slice(0, 16).replace("T", " "), r.outlet, r.platform, r.menu, r.old, r.new]) },
        ...(fit ? [{ sheet: "What fits", header: [tr("Menu"), tr("Portions"), tr("Sales"), tr("Share here %"), tr("Share elsewhere %"), tr("Strength")], rows: fit.data.map((r) => [r.menu, r.qty, Math.round(r.amount), r.share, r.shareElsewhere, r.lift]) }] : []),
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const HEAD: Record<Tab, string[]> = {
    spread: [tr("Menu"), tr("Platform"), tr("Usual price"), tr("Lowest"), tr("Highest"), tr("Outlets that differ")], missing: [tr("Outlet"), tr("Platform"), tr("Menu"), tr("Outlets that have it")],
    changes: [tr("Time"), tr("Outlet"), tr("Platform"), tr("Menu"), tr("Old"), tr("New")], fit: [tr("Menu"), tr("Portions"), tr("Sales"), tr("Share here %"), tr("Share elsewhere %"), tr("Strength")],
  };
  return (
    <Page title={tr("Price & Menu")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Prices and menus that are not the same at every outlet, and what sells on each platform")} media={<ListChecks size={19} />}
      actions={<Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={4} label={tr("Price & Menu")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Menu items read")} value={s ? nf(s.items) : <StatSkeleton />} />
            <Stat label={tr("Menus with different prices")} value={s ? nf(s.spread) : <StatSkeleton />}>{s && <p>{tr("{0} outlet prices", nf(s.differ))}</p>}</Stat>
            <Stat label={tr("Menus missing at an outlet")} value={s ? nf(s.missing) : <StatSkeleton />} />
            <Stat label={tr("Price changes")} value={s ? nf(s.changes) : <StatSkeleton />}><p>{tr("since 25 Nov 2026")}</p></Stat>
          </StatStrip>
          <WorkCard active={tab} onTab={setTab} tabs={[{ key: "spread", label: tr("Different prices"), count: data?.summary.spread ?? null }, { key: "missing", label: tr("Missing menus"), count: data?.summary.missing ?? null }, { key: "changes", label: tr("Price changes") }, { key: "fit", label: tr("What fits") }]}
            left={<select value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm" aria-label={tr("Platform")}><option value="">{tr("All platforms")}</option>{PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}</select>}>
            <Toolbar>
              <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search menu or outlet")} /></div>
              {tab === "fit" && <div className="w-full sm:w-72"><JSelect value={branch} onChange={setBranch} placeholder={tr("Every outlet")} options={[{ value: "", label: tr("Every outlet") }, ...(fit?.outlets ?? []).map((o) => ({ value: o.code, label: o.name }))]} /></div>}
            </Toolbar>
            <div className="overflow-x-auto">
              <table className={cx(jTable, "min-w-[760px]")}>
                <thead><tr className={jHeadRow}>{HEAD[tab].map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                <tbody>
                  {!data || (tab === "fit" && !fit) ? <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">…</td></tr>
                    : tab === "spread" ? spread.slice(0, 300).map((r) => {
                      const k = `${r.platform}${r.menu}`;
                      return [
                        <tr key={k} onClick={() => setOpen(open === k ? null : k)} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50">
                          <td className={cx(jTd, "font-medium text-neutral-900")}>{r.menu}</td><td className={jTd}>{r.platform}</td><td className={cx(jTd, "tabular-nums")}>{rp(r.usual)}</td><td className={cx(jTd, "tabular-nums")}>{rp(r.min)}</td>
                          <td className={cx(jTd, "tabular-nums")}>{rp(r.max)}</td><td className={cx(jTd, "tabular-nums")}>{tr("{0} of {1}", r.different, r.outlets)}</td></tr>,
                        open === k && <tr key={`${k}w`} className="border-b border-neutral-100 bg-neutral-50/60"><td colSpan={6} className="px-5 py-2 text-xs text-neutral-700">
                          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{r.who.map((w) => <li key={w.outlet} className="flex justify-between gap-3"><span className="truncate">{w.outlet}</span><span className={cx("tabular-nums", w.price < r.usual ? "text-red-700" : "text-emerald-700")}>{rp(w.price)}</span></li>)}</ul></td></tr>,
                      ];
                    }) : tab === "missing" ? pm.rows.map((r) => <tr key={`${r.outlet}${r.platform}${r.menu}`} className="border-b border-neutral-100"><td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td><td className={jTd}>{r.menu}</td><td className={cx(jTd, "tabular-nums")}>{tr("{0} of {1}", r.have, r.of)}</td></tr>)
                      : tab === "changes" ? (changes.length ? changes.map((r, i) => <tr key={i} className="border-b border-neutral-100"><td className={cx(jTd, "whitespace-nowrap")}>{r.at.slice(0, 16).replace("T", " ")}</td><td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td><td className={jTd}>{r.menu}</td><td className={cx(jTd, "tabular-nums")}>{rp(r.old)}</td><td className={cx(jTd, "tabular-nums")}>{rp(r.new)}</td></tr>)
                        : <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("No price change seen yet")}</td></tr>)
                        : fits.map((r) => <tr key={r.menu} className="border-b border-neutral-100"><td className={cx(jTd, "font-medium text-neutral-900")}>{r.menu}</td><td className={cx(jTd, "tabular-nums")}>{nf(r.qty)}</td><td className={cx(jTd, "tabular-nums")}>{rp(r.amount)}</td><td className={cx(jTd, "tabular-nums")}>{r.share}</td><td className={cx(jTd, "tabular-nums")}>{r.shareElsewhere}</td>
                          <td className={cx(jTd, "tabular-nums font-semibold", r.lift == null ? "text-neutral-400" : r.lift >= 1.3 ? "text-emerald-700" : r.lift <= 0.7 ? "text-red-700" : "")}>{r.lift == null ? tr("only here") : `${r.lift}×`}</td></tr>)}
                </tbody>
              </table>
            </div>
            <CardFooter><span className="text-xs text-neutral-500">{tab === "fit" ? tr("The last 30 days. Strength = the share of the menu here against its share on the other channels; 1.3× or more sells clearly better here, 0.7× or less worse.") : tab === "missing" ? tr("A menu at least 80% of the outlets of the platform have. Seasonal or limited menus may be missing on purpose.") : tr("The usual price is the one most outlets have; a different price may be a promo or another city.")}</span>{tab === "missing" && <PageNav paged={pm} />}</CardFooter>
          </WorkCard>
        </div>
      )}
    </Page>
  );
}

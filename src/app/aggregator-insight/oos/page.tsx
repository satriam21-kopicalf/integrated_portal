"use client";

// Aggregator Insight → Out of Stock (page agg.oos, 2026-11-24): what is out on the delivery apps now, per outlet,
// platform and category, and in a period how often each item went out and for how long (BotFood change events, kept
// from 24 Nov 2026). Packaging is left out unless asked.

import { useEffect, useMemo, useState } from "react";
import { Download, Package } from "lucide-react";
import { Button, ErrorState, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PeriodBar, daysAgo, downloadSheets, hours } from "@/aggregator/ui";

type Now = { outlet: string; platform: string; category: string; item: string; since: string | null };
type Per = { outlet: string; platform: string; category: string; item: string; times: number; minutes: number; remarks: string };
type Res = {
  summary: { outNow: number; inactiveLong: number; staleDays: number; outletsWithOos: number; itemsInPeriod: number; timesInPeriod: number; minutesInPeriod: number; dataFrom: string | null };
  byCategory: { category: string; n: number }[]; byOutlet: { outlet: string; n: number }[]; current: Now[]; items: Per[];
};
type Tab = "now" | "period" | "category" | "outlet";

const since = (iso: string | null) => (iso ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

function Bars({ rows, max }: { rows: { label: string; n: number }[]; max: number }) {
return (
  <ul className="space-y-1.5 p-4">
    {rows.length === 0 ? <li className="text-sm text-neutral-500">{tr("Nothing out of stock")}</li> : rows.map((r) => (
      <li key={r.label} className="grid grid-cols-[minmax(0,14rem)_1fr_3rem] items-center gap-3 text-sm">
        <span className="truncate text-neutral-800" title={r.label}>{r.label}</span>
        <span className="h-2.5 rounded-sm bg-neutral-100"><span className="block h-2.5 rounded-sm bg-amber-500" style={{ width: `${(r.n / max) * 100}%` }} /></span>
        <span className="text-right tabular-nums text-neutral-700">{r.n}</span>
      </li>
    ))}
  </ul>
);
}

export default function OutOfStock() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [platform, setPlatform] = useState("");
  const [packaging, setPackaging] = useState(false);
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("now");
  const [q, setQ] = useState("");
  const load = () => {
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/oos?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}${packaging ? "&packaging=true" : ""}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform, packaging]);

  const t = q.trim().toLowerCase();
  const match = (...v: string[]) => !t || v.some((x) => x.toLowerCase().includes(t));
  const now = useMemo(() => (data?.current ?? []).filter((r) => match(r.outlet, r.item, r.category)), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const per = useMemo(() => (data?.items ?? []).filter((r) => match(r.outlet, r.item, r.category)), [data, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const s = data?.summary;
  const maxCat = Math.max(1, ...(data?.byCategory ?? []).map((c) => c.n));
  const maxOut = Math.max(1, ...(data?.byOutlet ?? []).map((c) => c.n));

  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Out of Stock ${from} - ${to}`, [
        { sheet: "Summary", title: `Out of Stock ${from} – ${to}${platform ? ` · ${platform}` : ""}`, header: [tr("Measure"), tr("Value")], rows: [
          [tr("Items out now"), data.summary.outNow], [tr("Outlets with an item out"), data.summary.outletsWithOos],
          [tr("Items out in the period"), data.summary.itemsInPeriod], [tr("Times out in the period"), data.summary.timesInPeriod],
          [tr("Hours out in the period"), Math.round(data.summary.minutesInPeriod / 6) / 10],
        ] },
        { sheet: "Per category", header: [tr("Category"), tr("Items out now")], rows: data.byCategory.map((c) => [c.category, c.n]) },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Items out now")], rows: data.byOutlet.map((c) => [c.outlet, c.n]) },
        { sheet: "Out now", header: [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Out since")], rows: data.current.map((r) => [r.outlet, r.platform, r.category, r.item, since(r.since)]) },
        { sheet: "In the period", header: [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Times out"), tr("Minutes out"), tr("Remarks")],
          rows: data.items.map((r) => [r.outlet, r.platform, r.category, r.item, r.times, r.minutes, r.remarks]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Page title={tr("Out of Stock")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Items out of stock on the delivery apps, per outlet, platform and category")} media={<Package size={19} />}
      actions={<Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={4} label={tr("Out of stock")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Items out now")} value={s ? s.outNow.toLocaleString("id-ID") : <StatSkeleton />} />
            <Stat label={tr("Outlets with an item out")} value={s ? s.outletsWithOos : <StatSkeleton />} />
            <Stat label={tr("Times out in the period")} value={s ? s.timesInPeriod.toLocaleString("id-ID") : <StatSkeleton />} />
            <Stat label={tr("Hours out in the period")} value={s ? hours(s.minutesInPeriod) : <StatSkeleton />} />
          </StatStrip>
          <WorkCard active={tab} onTab={setTab} label={tr("Views")}
            tabs={[{ key: "now", label: tr("Out now"), count: data?.current.length ?? null }, { key: "period", label: tr("In the period"), count: data?.items.length ?? null },
              { key: "category", label: tr("Per category") }, { key: "outlet", label: tr("Per outlet") }]}
            left={<PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />}>
            <Toolbar>
              <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet, item or category")} /></div>
              <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={packaging} onChange={(e) => setPackaging(e.target.checked)} /> {tr("Include packaging")}</label>
            </Toolbar>
            {!data ? <p className="px-5 py-8 text-center text-sm text-neutral-500">…</p>
              : tab === "category" ? <Bars rows={data.byCategory.map((c) => ({ label: c.category, n: c.n }))} max={maxCat} />
              : tab === "outlet" ? <Bars rows={data.byOutlet.map((c) => ({ label: c.outlet, n: c.n }))} max={maxOut} />
              : (
                <div className="overflow-x-auto">
                  <table className={jTable}>
                    <thead><tr className={jHeadRow}>
                      {(tab === "now" ? [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Out since")]
                        : [tr("Outlet"), tr("Platform"), tr("Category"), tr("Item"), tr("Times out"), tr("Time out"), tr("Remarks")]).map((h) => <th key={h} className={jTh}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(tab === "now" ? now : per).length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("Nothing out of stock")}</td></tr>
                        : tab === "now" ? now.slice(0, 500).map((r, i) => (
                          <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td>
                            <td className={cx(jTd, "text-neutral-600")}>{r.category}</td><td className={jTd}>{r.item}</td><td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{since(r.since)}</td>
                          </tr>
                        )) : per.slice(0, 500).map((r, i) => (
                          <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50">
                            <td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td>
                            <td className={cx(jTd, "text-neutral-600")}>{r.category}</td><td className={jTd}>{r.item}</td>
                            <td className={cx(jTd, "tabular-nums")}>{r.times}</td><td className={jTd}>{hours(r.minutes)}</td><td className={cx(jTd, "text-xs text-neutral-500")}>{r.remarks}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            <CardFooter><span className="text-xs text-neutral-500">{tr("The history of stock changes is kept from {0}.", s?.dataFrom ? since(s.dataFrom) : "—")} {s ? tr("{0} items inactive for over {1} days are left out: switched off, not out of stock.", s.inactiveLong.toLocaleString("id-ID"), s.staleDays) : ""}</span></CardFooter>
          </WorkCard>
        </div>
      )}
    </Page>
  );
}

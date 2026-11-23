"use client";
/* eslint-disable @next/next/no-img-element -- the small brand logos are static svg files */

// Social Media → Overview (page social.analytics, 2026-11-23): the analysis of every mention of Kopi Calf collected by
// the portal (YouTube search, the official TikTok account, Google News) — the headline figures, the mentions per month
// and platform, the reach per month, the sentiment per platform, the accounts that reached most and the posts with the
// most views. From 1 January by default. Colours: the validated categorical order of the portal (SERIES_COLORS), fixed
// per platform; sentiment in the status colours, always labelled.

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Eye, Heart, Megaphone, ThumbsUp } from "lucide-react";
import { ErrorState, cx } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { FilterRow, MonitorFilterSheet, QuickPeriod } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar, dmy, wibDay } from "@/so/ui/Filters";
import { jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import EChart, { type ChartOption } from "@/components/charts/EChart";
import HBarChart from "@/components/charts/HBarChart";
import { base, categoryAxis, tipRow, tipTitle, tooltip, valueAxis, INK } from "@/lib/chartTheme";
import { SERIES_COLORS, compactNumber } from "@/lib/overview";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";

type Month = { month: string; platform: string; posts: number; views: number; likes: number; comments: number };
type Data = { from: string; to: string;
  total: { posts: number; views: number; likes: number; comments: number; positive: number; negative: number; authors: number };
  monthly: Month[]; keywords?: { keyword: string; posts: number; views: number }[]; sentiment: { platform: string; sentiment: string | null; n: number }[];
  authors: { author: string; platform: string; posts: number; views: number; likes: number }[];
  top: { platform: string; post_id: string; author: string | null; text: string | null; views: number; likes: number | null; comments: number | null; createdAt: string | null }[] };

const PLATFORMS = [
  { key: "tiktok", label: "TikTok", file: "tiktok", color: SERIES_COLORS[0] },
  { key: "youtube", label: "YouTube", file: "youtube", color: SERIES_COLORS[1] },
  { key: "news", label: "Google News", file: "googlenews", color: SERIES_COLORS[2] },
];
const FEEL = [
  { key: "positive", label: () => tr("Positive"), color: "#1baf7a" },
  { key: "neutral", label: () => tr("Neutral"), color: "#cbd5e1" },
  { key: "negative", label: () => tr("Negative"), color: "#e34948" },
];
const logo = (file: string, size = 14) => <img src={`/assets/brand/${file}.svg`} alt="" width={size} height={size} className="flex-shrink-0" />;
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString(locale()));
const startOfYear = () => `${wibDay(0).slice(0, 4)}-01-01`;
const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(locale(), { month: "short", year: "2-digit" });

export default function SocialOverviewPage() {
  const [period, setPeriod] = useState({ from: startOfYear(), to: wibDay(0) });
  const [draft, setDraft] = useState(period);
  const [sheet, setSheet] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Data>(`/api/social/overview?dateFrom=${period.from}&dateTo=${period.to}`).then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [period]);

  const months = useMemo(() => {
    if (!data) return [];
    const out: string[] = [];
    const d = new Date(`${data.from.slice(0, 7)}-01T00:00:00`);
    const last = data.to.slice(0, 7);
    while (true) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push(ym);
      if (ym >= last || out.length > 36) break;
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [data]);
  const cell = (ym: string, pf: string) => data?.monthly.find((m) => m.month === ym && m.platform === pf);

  const mentionsOption = useMemo((): ChartOption | null => data && ({
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary, fontSize: 12 } },
    tooltip: tooltip({ trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { axisValue: string; dataIndex: number }[]) => {
      const ym = months[ps[0].dataIndex];
      const rows = PLATFORMS.map((p) => tipRow(p.color, n(cell(ym, p.key)?.posts ?? 0), p.label)).join("");
      return tipTitle(monthName(ym)) + rows;
    } }),
    xAxis: categoryAxis(months.map(monthName)),
    yAxis: valueAxis(compactNumber),
    series: PLATFORMS.map((p) => ({ name: p.label, type: "bar", stack: "m", barMaxWidth: 28, itemStyle: { color: p.color, borderColor: "#fff", borderWidth: 1, borderRadius: 2 },
      data: months.map((ym) => cell(ym, p.key)?.posts ?? 0) })),
  }), [data, months]); // eslint-disable-line react-hooks/exhaustive-deps

  const reachOption = useMemo((): ChartOption | null => data && ({
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary, fontSize: 12 } },
    tooltip: tooltip({ trigger: "axis", formatter: (ps: { dataIndex: number }[]) => {
      const ym = months[ps[0].dataIndex];
      return tipTitle(monthName(ym)) + PLATFORMS.filter((p) => p.key !== "news").map((p) => tipRow(p.color, n(cell(ym, p.key)?.views ?? 0), p.label, "line")).join("");
    } }),
    xAxis: categoryAxis(months.map(monthName), { boundaryGap: false }),
    yAxis: valueAxis(compactNumber),
    series: PLATFORMS.filter((p) => p.key !== "news").map((p) => ({ name: p.label, type: "line", smooth: false, symbol: "circle", symbolSize: 8, showSymbol: true,
      lineStyle: { width: 2, color: p.color }, itemStyle: { color: p.color, borderColor: "#fff", borderWidth: 2 },
      data: months.map((ym) => cell(ym, p.key)?.views ?? 0) })),
  }), [data, months]); // eslint-disable-line react-hooks/exhaustive-deps

  const feelOption = useMemo((): ChartOption | null => {
    if (!data) return null;
    const rows = PLATFORMS.filter((p) => data.sentiment.some((s) => s.platform === p.key));
    const of = (pf: string, k: string) => data.sentiment.filter((s) => s.platform === pf && (s.sentiment ?? "neutral") === k).reduce((a, s) => a + s.n, 0);
    const all = (pf: string) => data.sentiment.filter((s) => s.platform === pf).reduce((a, s) => a + s.n, 0) || 1;
    return {
      ...base,
      grid: { left: 8, right: 24, top: 32, bottom: 4, containLabel: true },
      legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary, fontSize: 12 } },
      tooltip: tooltip({ trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { dataIndex: number }[]) => {
        const pf = rows[ps[0].dataIndex];
        return tipTitle(pf.label) + FEEL.map((f) => tipRow(f.color, `${n(of(pf.key, f.key))} (${Math.round((of(pf.key, f.key) / all(pf.key)) * 100)}%)`, f.label())).join("");
      } }),
      xAxis: { type: "value", max: 100, axisLabel: { formatter: "{value}%", color: INK.muted, fontSize: 11 }, splitLine: { lineStyle: { color: INK.grid } } },
      yAxis: { type: "category", data: rows.map((p) => p.label), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: INK.secondary, fontSize: 12 } },
      series: FEEL.map((f) => ({ name: f.label(), type: "bar", stack: "s", barWidth: 18, itemStyle: { color: f.color, borderColor: "#fff", borderWidth: 1 },
        data: rows.map((p) => Math.round((of(p.key, f.key) / all(p.key)) * 1000) / 10) })),
    };
  }, [data]);

  const t = data?.total;
  const filters: ActiveFilter[] = period.from !== startOfYear() || period.to !== wibDay(0)
    ? [{ key: "p", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod({ from: startOfYear(), to: wibDay(0) }) }] : [];

  return (
    <Page title={tr("Social Media Overview")} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr("the analysis of every mention of Kopi Calf")}`}
      stats={<>
        <FilterToolbar filters={filters} onOpen={() => { setDraft(period); setSheet(true); }} onClear={() => setPeriod({ from: startOfYear(), to: wibDay(0) })} />
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Mentions")} icon={<Megaphone size={13} />} value={t ? n(t.posts) : <StatSkeleton />}>{t && <p>{tr("{0} accounts", n(t.authors))}</p>}</Stat>
          <Stat label={tr("Views")} icon={<Eye size={13} />} value={t ? compactNumber(t.views) : <StatSkeleton />}>{t && <p className="tabular-nums">{n(t.views)}</p>}</Stat>
          <Stat label={tr("Likes")} icon={<Heart size={13} />} value={t ? compactNumber(t.likes) : <StatSkeleton />}>{t && <p>{tr("{0} comments", n(t.comments))}</p>}</Stat>
          <Stat label={tr("Positive sentiment")} icon={<ThumbsUp size={13} />} value={t ? `${t.posts ? Math.round((t.positive / t.posts) * 100) : 0}%` : <StatSkeleton />}>
            {t && <p>{tr("{0} positive · {1} negative", n(t.positive), n(t.negative))}</p>}</Stat>
        </StatStrip>
      </>}>
      {sheet && (
        <MonitorFilterSheet active={filters.length} onClose={() => setSheet(false)} onReset={() => setDraft({ from: startOfYear(), to: wibDay(0) })}
          onApply={() => { setPeriod(draft); setSheet(false); }}>
          <FilterRow icon={<CalendarRange size={15} />} label={tr("Period")} value={`${dmy(draft.from)} – ${dmy(draft.to)}`}>
            <QuickPeriod value={draft} onChange={setDraft} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {error ? <ErrorState message={error} /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title={tr("Mentions per month")} description={tr("Posts, videos and articles that name Kopi Calf, per platform")}>
              <div className="p-3">{mentionsOption ? <EChart option={mentionsOption} height={280} ariaLabel={tr("Mentions per month")} /> : <div className="skeleton h-[280px] rounded-lg" />}</div>
            </Panel>
            <Panel title={tr("Reach per month")} description={tr("Views of the videos per platform (news articles have no views)")}>
              <div className="p-3">{reachOption ? <EChart option={reachOption} height={280} ariaLabel={tr("Reach per month")} /> : <div className="skeleton h-[280px] rounded-lg" />}</div>
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title={tr("Sentiment per platform")} description={tr("Share of positive, neutral and negative mentions (word list, a first signal)")}>
              <div className="p-3">{feelOption ? <EChart option={feelOption} height={180} ariaLabel={tr("Sentiment per platform")} /> : <div className="skeleton h-[180px] rounded-lg" />}</div>
            </Panel>
            <Panel title={tr("Accounts with the most reach")} description={tr("Views of their mentions in the period")}>
              <div className="p-3">{data ? (data.authors.length ? <HBarChart ariaLabel={tr("Accounts with the most reach")}
                items={data.authors.map((a) => ({ key: `${a.platform}:${a.author}`, label: a.author, value: a.views, display: compactNumber(a.views),
                  color: PLATFORMS.find((p) => p.key === a.platform)?.color, tip: { rows: [[tr("Mentions"), n(a.posts)], [tr("Likes"), n(a.likes)]] } }))} />
                : <p className="py-6 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p>) : <div className="skeleton h-[180px] rounded-lg" />}</div>
            </Panel>
          </div>
          <Panel title={tr("Mentions per keyword")} description={tr("A post that names several keywords counts for each of them")}>
            <div className="p-3">{data ? ((data.keywords ?? []).length ? <HBarChart ariaLabel={tr("Mentions per keyword")}
              items={(data.keywords ?? []).map((k) => ({ key: k.keyword, label: k.keyword, value: k.posts, display: n(k.posts), tip: { rows: [[tr("Views"), n(k.views)]] } }))} />
              : <p className="py-6 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p>) : <div className="skeleton h-[180px] rounded-lg" />}</div>
          </Panel>
          <Panel title={tr("Posts with the most views")} description={tr("Open one on its platform")}>
            {!data ? <div className="skeleton m-4 h-40 rounded-lg" /> : (
              <div className="overflow-x-auto">
                <table className={cx(jTable, "m-cards min-w-[760px]")}>
                  <thead><tr className={jHeadRow}><th className={jTh}>{tr("Post")}</th><th className={cx(jTh, "text-right")}>{tr("Views")}</th>
                    <th className={cx(jTh, "text-right")}>{tr("Likes")}</th><th className={cx(jTh, "text-right")}>{tr("Comments")}</th><th className={jTh}>{tr("Date")}</th></tr></thead>
                  <tbody>
                    {data.top.map((p) => {
                      const pf = PLATFORMS.find((x) => x.key === p.platform);
                      return (
                        <tr key={`${p.platform}:${p.post_id}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                          <td className={cx(jTd, "max-w-[34rem]")} data-label={tr("Post")}><span className="flex items-start gap-2">{pf && logo(pf.file, 16)}
                            <span className="min-w-0"><span className="block text-[11px] font-semibold text-neutral-500">{p.author ?? "—"}</span>
                              <span className="line-clamp-2 text-neutral-900">{p.text}</span></span></span></td>
                          <td className={cx(jTd, "text-right font-semibold tabular-nums")} data-label={tr("Views")}>{n(p.views)}</td>
                          <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Likes")}>{n(p.likes)}</td>
                          <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Comments")}>{n(p.comments)}</td>
                          <td className={cx(jTd, "whitespace-nowrap text-neutral-600")} data-label={tr("Date")}>{p.createdAt ? dmy(p.createdAt.slice(0, 10)) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}

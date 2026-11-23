"use client";
/* eslint-disable @next/next/no-img-element -- the small brand logos are static svg files */

// Social Media → Overview (page social.analytics, 2026-11-23), laid out after a media-monitoring dashboard the user
// pointed to: sentiment cards against the period before, a card per channel (TikTok / YouTube / Google News), the tone
// per keyword (Kopi Calf, the founders, Teman Calf …) with a donut, the tone per source, the words used most, the cities
// named, keyword x week (the visibility heatmap) and the trending posts. One axis per chart: the favourability index of a
// source is in its tooltip, not on a second axis. Colours: sentiment in the status colours, always labelled; the channels
// in the validated categorical order of the portal.

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight, ExternalLink, Heart, MapPin, Minus, Tag, TrendingDown, TrendingUp } from "lucide-react";
import { ErrorState, cx } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { DrillDrawer, PostPreview, type Drill } from "@/social/shared";
import { FilterRow, MonitorFilterSheet, QuickPeriod } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar, dmy, wibDay } from "@/so/ui/Filters";
import { Lozenge } from "@/so/ui/Jira";
import EChart, { type ChartOption } from "@/components/charts/EChart";
import { base, tipRow, tipTitle, tooltip, INK } from "@/lib/chartTheme";
import { SERIES_COLORS, compactNumber } from "@/lib/overview";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";

type Feel = "positive" | "neutral" | "negative";
type Data = { from: string; to: string; days: number;
  sentiment: Record<Feel, { now: number; before: number }>;
  channels: { platform: string; posts: number; views: number }[];
  keywordTone: { keyword: string; sentiment: Feel; n: number }[];
  media: { source: string; platform: string; n: number; positive: number; negative: number }[];
  words: { word: string; n: number }[]; cities: { city: string; n: number; share: number }[];
  heat: { keyword: string; week: string; n: number }[];
  trending: { platform: string; post_id: string; source: string; author: string | null; url: string | null; text: string | null; createdAt: string | null;
    views: number | null; likes: number | null; comments: number | null; sentiment: Feel | null; keywords: string[] | null; site: string | null }[] };

const FEEL: { key: Feel; label: () => string; color: string; soft: string; ink: string }[] = [
  { key: "positive", label: () => tr("Positive"), color: "#1baf7a", soft: "bg-emerald-50", ink: "text-emerald-700" },
  { key: "neutral", label: () => tr("Neutral"), color: "#2a78d6", soft: "bg-blue-50", ink: "text-blue-700" },
  { key: "negative", label: () => tr("Negative"), color: "#e34948", soft: "bg-red-50", ink: "text-red-700" },
];
const CHANNEL = [
  { key: "tiktok", label: "TikTok", file: "tiktok", note: () => tr("videos of the official account") },
  { key: "youtube", label: "YouTube", file: "youtube", note: () => tr("videos that name Kopi Calf") },
  { key: "news", label: "Google News", file: "googlenews", note: () => tr("online articles") },
];
const logo = (file: string, size = 14) => <img src={`/assets/brand/${file}.svg`} alt="" width={size} height={size} className="flex-shrink-0" />;
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString(locale()));
const startOfYear = () => `${wibDay(0).slice(0, 4)}-01-01`;
const initials = (s: string) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

export default function SocialOverviewPage() {
  const [period, setPeriod] = useState({ from: startOfYear(), to: wibDay(0) });
  const [draft, setDraft] = useState(period);
  const [sheet, setSheet] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drill | null>(null);
  const [preview, setPreview] = useState<{ platform: string; id: string } | null>(null);
  const range = { dateFrom: period.from, dateTo: period.to };
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Data>(`/api/social/insights?dateFrom=${period.from}&dateTo=${period.to}`).then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [period]);
  const filters: ActiveFilter[] = period.from !== startOfYear() || period.to !== wibDay(0)
    ? [{ key: "p", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod({ from: startOfYear(), to: wibDay(0) }) }] : [];

  // the tone per keyword: the keywords by count, the one picked (the first by default)
  const keywords = useMemo(() => {
    const m = new Map<string, Record<Feel, number>>();
    (data?.keywordTone ?? []).forEach((r) => { const x = m.get(r.keyword) ?? { positive: 0, neutral: 0, negative: 0 }; x[r.sentiment] += r.n; m.set(r.keyword, x); });
    return [...m.entries()].map(([k, v]) => ({ keyword: k, ...v, total: v.positive + v.neutral + v.negative })).sort((a, b) => b.total - a.total);
  }, [data]);
  const chosen = keywords.find((k) => k.keyword === pick) ?? keywords[0];

  const donut = useMemo((): ChartOption | null => chosen ? ({
    ...base,
    tooltip: tooltip({ trigger: "item", formatter: (x: { name: string; value: number; percent: number; color: string }) => tipRow(x.color, `${n(x.value)} (${x.percent}%)`, x.name) }),
    series: [{ type: "pie", radius: ["58%", "82%"], center: ["50%", "50%"], avoidLabelOverlap: true, padAngle: 1,
      itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 4 }, label: { show: false },
      data: FEEL.map((f) => ({ name: f.label(), value: chosen[f.key], itemStyle: { color: f.color } })).filter((x) => x.value > 0) }],
  }) : null, [chosen]);

  const mediaTone = useMemo((): ChartOption | null => {
    if (!data?.media.length) return null;
    const rows = data.media;
    return {
      ...base,
      grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, icon: "roundRect", itemWidth: 10, itemHeight: 10, textStyle: { color: INK.secondary, fontSize: 12 } },
      tooltip: tooltip({ trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: { dataIndex: number }[]) => {
        const r = rows[ps[0].dataIndex];
        const neutral = r.n - r.positive - r.negative;
        const fav = r.n ? ((r.positive - r.negative) / r.n).toFixed(2) : "0";
        return tipTitle(r.source) + tipRow(FEEL[0].color, n(r.positive), tr("Positive")) + tipRow(FEEL[1].color, n(neutral), tr("Neutral"))
          + tipRow(FEEL[2].color, n(r.negative), tr("Negative")) + `<div style="margin-top:4px;color:${INK.secondary}">${tr("Favourability index")}: <b>${fav}</b></div>`;
      } }),
      xAxis: { type: "category", data: rows.map((r) => r.source), axisTick: { show: false }, axisLine: { lineStyle: { color: INK.axis } },
        axisLabel: { color: INK.secondary, fontSize: 11, interval: 0, width: 90, overflow: "truncate" } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: INK.grid } }, axisLabel: { color: INK.muted, fontSize: 11 } },
      series: [
        { name: tr("Positive"), key: "positive" }, { name: tr("Neutral"), key: "neutral" }, { name: tr("Negative"), key: "negative" },
      ].map((s, i) => ({ name: s.name, type: "bar", stack: "t", barMaxWidth: 36, itemStyle: { color: FEEL[i].color, borderColor: "#fff", borderWidth: 1 },
        label: i === 2 ? { show: true, position: "top", color: INK.primary, fontWeight: 600, fontSize: 11, formatter: (x: { dataIndex: number }) => String(rows[x.dataIndex].n) } : undefined,
        data: rows.map((r) => (s.key === "positive" ? r.positive : s.key === "negative" ? r.negative : r.n - r.positive - r.negative)) })),
    };
  }, [data]);

  const heatAxes = useMemo(() => data?.heat.length ? {
    weeks: [...new Set(data.heat.map((h) => h.week))].sort(),
    kws: keywords.map((k) => k.keyword).filter((k) => data.heat.some((h) => h.keyword === k)).slice(0, 9).reverse(),
  } : null, [data, keywords]);
  const heat = useMemo((): ChartOption | null => {
    if (!data?.heat.length || !heatAxes) return null;
    const { weeks, kws } = heatAxes;
    const max = Math.max(...data.heat.map((h) => h.n), 1);
    return {
      ...base,
      grid: { left: 8, right: 16, top: 8, bottom: 24, containLabel: true },
      tooltip: tooltip({ formatter: (x: { data: [number, number, number] }) => tipTitle(`${kws[x.data[1]]} · ${tr("week of {0}", dmy(weeks[x.data[0]]))}`) + `<b>${n(x.data[2])}</b> ${tr("mentions")}` }),
      xAxis: { type: "category", data: weeks.map((w) => dmy(w).slice(0, 5)), splitArea: { show: false }, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: INK.muted, fontSize: 10 } },
      yAxis: { type: "category", data: kws, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: INK.secondary, fontSize: 11 } },
      visualMap: { show: false, min: 0, max, inRange: { color: ["#eef4fd", "#2a78d6"] } },
      series: [{ type: "heatmap", data: data.heat.filter((h) => kws.includes(h.keyword)).map((h) => [weeks.indexOf(h.week), kws.indexOf(h.keyword), h.n]),
        label: { show: weeks.length <= 16, color: INK.primary, fontSize: 10 }, itemStyle: { borderColor: "#fff", borderWidth: 2 } }],
    };
  }, [data, heatAxes]);

  return (
    <Page title={tr("Social Media Overview")} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr("the analysis of every mention of Kopi Calf")}`}
      stats={<FilterToolbar filters={filters} onOpen={() => { setDraft(period); setSheet(true); }} onClear={() => setPeriod({ from: startOfYear(), to: wibDay(0) })} />}>
      {sheet && (
        <MonitorFilterSheet active={filters.length} onClose={() => setSheet(false)} onReset={() => setDraft({ from: startOfYear(), to: wibDay(0) })}
          onApply={() => { setPeriod(draft); setSheet(false); }}>
          <FilterRow icon={<CalendarRange size={15} />} label={tr("Period")} value={`${dmy(draft.from)} – ${dmy(draft.to)}`}>
            <QuickPeriod value={draft} onChange={setDraft} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {drill && <DrillDrawer drill={drill} onClose={() => setDrill(null)} />}
      {preview && <PostPreview platform={preview.platform} id={preview.id} onClose={() => setPreview(null)} />}
      {error ? <ErrorState message={error} /> : (
        <>
          {/* sentiment against the period before, then a card per channel: the Stat cards of every page; a tap lists the mentions */}
          <StatStrip label={tr("Sentiment")} columns={3} gridClassName="grid-cols-2 sm:grid-cols-3">
            {FEEL.map((f) => {
              const s = data?.sentiment[f.key];
              const ch = s && s.before ? (s.now - s.before) / s.before : null;
              const good = ch === null ? null : f.key === "negative" ? ch <= 0 : ch >= 0;
              return (
                <Stat key={f.key} label={tr("{0} mention", f.label())} icon={<Heart size={13} className={f.ink} />} emphasis={f.key === "negative" && !!s?.now}
                  value={s ? <span className="inline-flex items-baseline gap-2">{compactNumber(s.now)}
                    {ch !== null && <span className={cx("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold", good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
                      {ch > 0 ? <TrendingUp size={12} /> : ch < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}{Math.abs(ch * 100).toFixed(1)}%</span>}</span> : <StatSkeleton />}
                  onClick={s ? () => setDrill({ ...range, sentiment: f.key, title: tr("{0} mention", f.label()), icon: <Heart size={18} /> }) : undefined}>
                  {s && <p>{tr("{0} in the {1} days before", n(s.before), data!.days)}</p>}
                </Stat>
              );
            })}
          </StatStrip>
          <StatStrip label={tr("Channels")} columns={3} gridClassName="grid-cols-2 sm:grid-cols-3">
            {CHANNEL.map((c) => {
              const x = data?.channels.find((r) => r.platform === c.key);
              return (
                <Stat key={c.key} label={c.label} icon={logo(c.file, 13)} value={data ? tr("{0} posts", n(x?.posts ?? 0)) : <StatSkeleton />}
                  onClick={data ? () => setDrill({ ...range, platform: c.key, posts: true, title: c.label, description: c.note(), icon: logo(c.file, 18) }) : undefined}>
                  {data && <p>{c.key === "news" ? c.note() : `${tr("{0} views", compactNumber(x?.views ?? 0))} · ${c.note()}`}</p>}
                </Stat>
              );
            })}
          </StatStrip>

          {/* tone per keyword */}
          <Panel title={tr("Keyword tone analysis")} description={tr("The tone of the mentions per keyword: Kopi Calf, its brands and its founders")}>
            {!data ? <div className="skeleton m-4 h-64 rounded-lg" /> : !chosen ? <p className="px-4 py-8 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p> : (
              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {keywords.map((k) => (
                    <li key={k.keyword}>
                      <button type="button" onClick={() => setPick(k.keyword)}
                        className={cx("flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors", k.keyword === chosen.keyword ? "border-brand-600 bg-brand-50" : "border-neutral-200 hover:bg-neutral-50")}>
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11px] font-bold text-white">{initials(k.keyword)}</span>
                        <span className="min-w-0 flex-1 truncate text-neutral-900">{k.keyword}</span>
                        <span className="flex-shrink-0 text-xs tabular-nums text-neutral-600">{tr("{0} posts", n(k.total))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col items-center justify-center">
                  <button type="button" onClick={() => setDrill({ ...range, keyword: chosen.keyword, title: chosen.keyword, description: tr("Every mention labelled {0}", chosen.keyword), icon: <Tag size={18} /> })}
                    className="inline-flex items-center gap-1 text-base font-semibold text-neutral-900 hover:text-brand-700">{chosen.keyword}<ChevronRight size={16} /></button>
                  {donut && <EChart option={donut} height={240} ariaLabel={tr("Tone of {0}", chosen.keyword)} className="w-full" />}
                </div>
                <div className="space-y-2">
                  {FEEL.map((f) => {
                    const pct = chosen.total ? (chosen[f.key] / chosen.total) * 100 : 0;
                    return (
                      <button type="button" key={f.key} onClick={() => setDrill({ ...range, keyword: chosen.keyword, sentiment: f.key, title: `${chosen.keyword} · ${f.label()}`, icon: <Tag size={18} /> })}
                        className="block w-full rounded-lg border border-neutral-200 px-4 py-3 text-left hover:border-brand-300 hover:bg-neutral-50">
                        <p className="flex justify-between text-sm"><span className="text-neutral-800">{f.label()}</span><span className={cx("font-semibold tabular-nums", f.ink)}>{pct.toFixed(1)}%</span></p>
                        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: f.color }} /></span>
                        <p className="mt-1 text-xs text-neutral-500">{tr("{0} posts", n(chosen[f.key]))}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <Panel title={tr("Media tone analysis")} description={tr("The tone of the mentions per source; the favourability index is in the tooltip")}>
              <div className="p-3">{!data ? <div className="skeleton h-[300px] rounded-lg" /> : mediaTone ? <EChart option={mediaTone} height={300} ariaLabel={tr("Media tone analysis")}
                  onClick={(e) => { const m = data.media[e.dataIndex]; if (m) setDrill({ ...range, who: m.source, posts: true, title: m.source, description: tr("Mentions from this source"), icon: <Tag size={18} /> }); }} />
                : <p className="py-8 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p>}</div>
            </Panel>
            <Panel title={tr("Word cloud analysis")} description={tr("The words used most in the mentions")}>
              {!data ? <div className="skeleton m-4 h-[300px] rounded-lg" /> : <WordCloud words={data.words}
                onPick={(w) => setDrill({ ...range, q: w, title: `"${w}"`, description: tr("Mentions that use this word"), icon: <Tag size={18} /> })} />}
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
            <Panel title={tr("Cities named")} description={tr("The cities the mentions name (new outlets, events)")}>
              {!data ? <div className="skeleton m-4 h-40 rounded-lg" /> : data.cities.length === 0 ? <p className="px-4 py-8 text-center text-sm text-neutral-500">—</p> : (
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {data.cities.map((c) => (
                    <button type="button" key={c.city} onClick={() => setDrill({ ...range, q: c.city, title: c.city, description: tr("Mentions that name this city"), icon: <MapPin size={18} /> })}
                      className="rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:border-brand-300 hover:bg-neutral-50">
                      <p className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-1.5 text-neutral-900"><MapPin size={13} className="text-neutral-400" />{c.city}</span>
                        <span className="text-xs italic text-neutral-500">{c.share}%</span></p>
                      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-700" style={{ width: `${c.share}%` }} /></span>
                      <p className="mt-1 text-xs text-neutral-500">{tr("{0} mentions", n(c.n))}</p>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <Panel title={tr("Keyword visibility")} description={tr("Mentions per keyword and week")}>
              <div className="p-3">{!data ? <div className="skeleton h-[300px] rounded-lg" /> : heat ? <EChart option={heat} height={300} ariaLabel={tr("Keyword visibility")} onClick={(e) => {
                  const v = e.data as [number, number, number] | undefined;
                  if (!v || !heatAxes) return;
                  const wk = heatAxes.weeks[v[0]], kw = heatAxes.kws[v[1]];
                  const end = new Date(`${wk}T00:00:00`); end.setDate(end.getDate() + 6);
                  setDrill({ dateFrom: wk, dateTo: end.toISOString().slice(0, 10), keyword: kw, title: kw, description: tr("week of {0}", dmy(wk)), icon: <Tag size={18} /> });
                }} />
                : <p className="py-8 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p>}</div>
            </Panel>
          </div>

          <Panel title={tr("Trending highlights")} description={tr("The newest mentions and their reach")}>
            {!data ? <div className="skeleton m-4 h-64 rounded-lg" /> : (
              <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-4">
                {data.trending.map((t) => <Highlight key={`${t.platform}:${t.post_id}`} t={t} onOpen={() => setPreview({ platform: t.platform, id: t.post_id })} />)}
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}

/** The words used most, sized by how often (the most used larger and darker), in the colours of the portal. */
function WordCloud({ words, onPick }: { words: { word: string; n: number }[]; onPick: (w: string) => void }) {
  if (!words.length) return <p className="px-4 py-8 text-center text-sm text-neutral-500">—</p>;
  const max = words[0].n, min = words.at(-1)!.n;
  const shuffled = [...words].sort((a, b) => (a.word.charCodeAt(1) % 7) - (b.word.charCodeAt(1) % 7));
  return (
    <div className="flex min-h-[300px] flex-wrap content-center items-center justify-center gap-x-3 gap-y-1 p-4">
      {shuffled.map((w) => {
        const k = max === min ? 0.5 : (w.n - min) / (max - min);
        return <button type="button" key={w.word} title={tr("{0} mentions", w.n)} onClick={() => onPick(w.word)} className="font-semibold leading-tight hover:underline"
          style={{ fontSize: `${12 + k * 22}px`, color: SERIES_COLORS[w.word.length % 5], opacity: 0.55 + k * 0.45 }}>{w.word}</button>;
      })}
    </div>
  );
}

function Highlight({ t, onOpen }: { t: Data["trending"][number]; onOpen: () => void }) {
  const at = t.createdAt ? new Date(t.createdAt) : null;
  const ch = CHANNEL.find((c) => c.key === t.platform);
  const site = t.site ? t.site.replace(/^https?:\/\//, "").replace(/\/$/, "") : ch?.label;
  const kws = t.keywords ?? [];
  const [title, ...rest] = (t.text ?? "").split("\n").filter(Boolean);
  return (
    <article role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="flex cursor-pointer flex-col rounded-lg border border-neutral-200 bg-white transition-colors hover:border-brand-300 hover:shadow-sm">
      <header className="flex items-start gap-3 border-b border-neutral-100 p-3">
        <span className="w-14 flex-shrink-0 overflow-hidden rounded-md border border-neutral-200 text-center">
          <span className="block bg-red-500 py-0.5 text-[11px] font-semibold text-white">{at ? at.toLocaleDateString(locale(), { month: "short", timeZone: "Asia/Jakarta" }) : "—"}</span>
          <span className="block text-xl font-bold leading-7 text-neutral-900">{at ? at.toLocaleDateString(locale(), { day: "numeric", timeZone: "Asia/Jakarta" }) : "—"}</span>
          <span className="block pb-0.5 text-[10px] text-neutral-500">{at?.getFullYear() ?? ""}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-xs text-brand-700">{ch && logo(ch.file, 12)}{site}</span>
          <span className="block truncate text-sm font-semibold text-neutral-900">{t.author ?? "—"}</span>
          {t.views !== null && <span className="block text-[11px] text-neutral-500">{tr("{0} views", compactNumber(t.views))}{t.likes !== null ? ` · ${tr("{0} likes", compactNumber(t.likes))}` : ""}</span>}
        </span>
        {t.url && <a href={t.url} target="_blank" rel="noreferrer" aria-label={tr("Open")} onClick={(e) => e.stopPropagation()} className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-800 text-white hover:bg-brand-900"><ExternalLink size={14} /></a>}
      </header>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-semibold text-neutral-900">{title ?? "—"}</p>
        {rest.length > 0 && <p className="mt-1 line-clamp-3 text-xs text-neutral-600">{rest.join(" ")}</p>}
        {kws.length > 0 && <p className="mt-auto flex flex-wrap gap-1 pt-3">{kws.slice(0, 2).map((k) => <Lozenge key={k} tone="blue">{k}</Lozenge>)}
          {kws.length > 2 && <Lozenge tone="grey">{tr("+{0} more", kws.length - 2)}</Lozenge>}</p>}
      </div>
    </article>
  );
}

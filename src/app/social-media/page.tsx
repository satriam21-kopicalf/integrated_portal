"use client";
/* eslint-disable @next/next/no-img-element -- the small brand logos are static svg files */

// Social Media → Social Media Analytics (page social.analytics, backend migration 135, 2026-11-23): what the public says about
// Kopi Calf, collected by the portal itself on our VPS — YouTube (videos and their comments), Google News and the
// official TikTok account — without an API key or a third-party service. Searching Instagram, Threads, X and LinkedIn
// needs a login and is not collected.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Megaphone, Tag, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button, ErrorState, cx } from "@/so/ui";
import { PostPreview, contentDate } from "@/social/shared";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";

type Post = { platform: string; post_id: string; source: string; url: string | null; author: string | null; text: string | null;
  createdAt: string | null; likes: number | null; comments: number | null; views: number | null; sentiment: "positive" | "negative" | "neutral" | null;
  /** migration 137: every keyword the post names */ keywords?: string[]; dateApprox?: boolean };
type Summary = { platforms: { platform: string; posts: number; views: number; likes: number; comments: number; positive: number; negative: number }[];
  daily: { day: string; posts: number }[]; authors: { author: string; platform: string; posts: number; views: number }[];
  runs: { source: string; startedAt: string; finishedAt: string | null; found: number | null; added: number | null; error: string | null }[];
  schedule: { source: string; enabled: boolean; everyHours: number; lastRunAt: string | null; nextRunAt: string; backfillFrom: string | null }[] };
type Tab = "all" | "youtube" | "tiktok" | "news";
type Feel = "" | "positive" | "negative" | "neutral";

/** the real logos of the platforms (simple-icons, CC0, in their brand colour): public/assets/brand */
const logo = (file: string, size = 16) => <img src={`/assets/brand/${file}.svg`} alt="" width={size} height={size} className="flex-shrink-0" />;
const PLATFORM: Record<string, { label: string; file: string }> = {
  youtube: { label: "YouTube", file: "youtube" }, tiktok: { label: "TikTok", file: "tiktok" },
  news: { label: "Google News", file: "googlenews" }, instagram: { label: "Instagram", file: "instagram" },
};
const FEEL: Record<string, { label: () => string; tone: LozengeTone }> = {
  positive: { label: () => tr("Positive"), tone: "green" }, negative: { label: () => tr("Negative"), tone: "red" }, neutral: { label: () => tr("Neutral"), tone: "grey" },
};
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString(locale()));
const PAGE = 50;

export default function SocialMediaPage() {
  const [period, setPeriod] = useState({ from: wibDay(-29), to: wibDay(0) });
  const [keyword, setKeyword] = useState("");
  const [kwDraft, setKwDraft] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  useEffect(() => { call<{ data: string[] }>("/api/social/keywords").then((r) => setKeywords(r.data)).catch(() => setKeywords([])); }, []);
  const [tab, setTab] = useState<Tab>("all");
  const [feel, setFeel] = useState<Feel>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sum, setSum] = useState<Summary | null>(null);
  const [rows, setRows] = useState<{ total: number; data: Post[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState(period);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<{ platform: string; id: string } | null>(null);
  const range = `dateFrom=${period.from}&dateTo=${period.to}`;
  useEffect(() => {
    let alive = true;
    // every list defaulted: a backend one release behind (no schedule yet) never breaks the page
    call<Partial<Summary>>(`/api/social/summary?${range}`).then((r) => { if (alive) setSum({ platforms: r.platforms ?? [], daily: r.daily ?? [], authors: r.authors ?? [], runs: r.runs ?? [], schedule: r.schedule ?? [] }); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [range, tick]);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(0), [tab, feel, debounced, range, keyword]);
  useEffect(() => {
    let alive = true;
    setRows(null);
    const p = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, limit: String(PAGE), offset: String(page * PAGE) });
    if (tab !== "all") p.set("platform", tab);
    if (feel) p.set("sentiment", feel);
    if (debounced.trim()) p.set("q", debounced.trim());
    if (keyword) p.set("keyword", keyword);
    call<{ total: number; data: Post[] }>(`/api/social/posts?${p}`).then((r) => { if (alive) setRows(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [tab, feel, debounced, period, page, tick, keyword]);
  const tot = useMemo(() => {
    const ps = sum?.platforms ?? [];
    const pick = tab === "all" ? ps : ps.filter((p) => p.platform === tab);
    return pick.reduce((a, p) => ({ posts: a.posts + p.posts, views: a.views + p.views, positive: a.positive + p.positive, negative: a.negative + p.negative }),
      { posts: 0, views: 0, positive: 0, negative: 0 });
  }, [sum, tab]);
  const count = (p: string) => sum ? (sum.platforms.find((x) => x.platform === p)?.posts ?? 0) : null;
  const filters: ActiveFilter[] = period.from !== wibDay(-29) || period.to !== wibDay(0)
    ? [{ key: "period", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod({ from: wibDay(-29), to: wibDay(0) }) }] : [];
  if (keyword) filters.push({ key: "keyword", label: `${tr("Keyword")}: ${keyword}`, onRemove: () => setKeyword("") });
  return (
    <Page title={tr("Social Media Analytics")} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr("what the public says about Kopi Calf")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Mentions")} icon={<Megaphone size={13} />} value={sum ? n(tot.posts) : <StatSkeleton />} onClick={sum ? () => setFeel("") : undefined} />
          <Stat label={tr("Views")} icon={<Eye size={13} />} value={sum ? n(tot.views) : <StatSkeleton />} />
          <Stat label={tr("Positive")} icon={<ThumbsUp size={13} />} value={sum ? n(tot.positive) : <StatSkeleton />} active={feel === "positive"} onClick={sum ? () => setFeel("positive") : undefined} />
          <Stat label={tr("Negative")} icon={<ThumbsDown size={13} />} value={sum ? n(tot.negative) : <StatSkeleton />} emphasis={tot.negative > 0} active={feel === "negative"} onClick={sum ? () => setFeel("negative") : undefined} />
        </StatStrip>
      }>
      {sheet && (
        <MonitorFilterSheet active={filters.length} onClose={() => setSheet(false)} onReset={() => { setDraft({ from: wibDay(-29), to: wibDay(0) }); setKwDraft(""); }}
          onApply={() => { setPeriod(draft); setKeyword(kwDraft); setSheet(false); }}>
          <FilterRow icon={<Tag size={15} />} label={tr("Keyword")} value={kwDraft || null} onClear={() => setKwDraft("")}>
            <ComboFilter value={kwDraft} onChange={setKwDraft} allLabel={tr("All keywords")} placeholder={tr("Search keyword")}
              options={keywords.map((k) => ({ value: k, label: k }))} />
          </FilterRow>
          <FilterRow icon={<Eye size={15} />} label={tr("Period")} value={`${dmy(draft.from)} – ${dmy(draft.to)}`}>
            <QuickPeriod value={draft} onChange={setDraft} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {error && <ErrorState message={error} onRetry={() => { setError(null); setTick((t) => t + 1); }} />}
      <WorkCard label={tr("Platform")} active={tab} onTab={setTab} tabs={[
        { key: "all", label: tr("All platforms"), icon: <Megaphone size={15} />, count: sum ? sum.platforms.reduce((a, p) => a + p.posts, 0) : null },
        { key: "youtube", label: "YouTube", icon: logo("youtube", 15), count: count("youtube") },
        { key: "tiktok", label: "TikTok", icon: logo("tiktok", 15), count: count("tiktok") },
        { key: "news", label: "Google News", icon: logo("googlenews", 15), count: count("news") },
      ]}>
        <Toolbar>
          <QuickChips label={tr("Sentiment")} value={feel} onChange={setFeel} items={[
            { key: "" as Feel, label: tr("All") }, { key: "positive" as Feel, label: tr("Positive"), dot: "bg-emerald-500" },
            { key: "negative" as Feel, label: tr("Negative"), dot: "bg-red-500" }, { key: "neutral" as Feel, label: tr("Neutral"), dot: "bg-neutral-400" }]} />
          <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search text or account")} filters={filters}
            onOpen={() => { setDraft(period); setKwDraft(keyword); setSheet(true); }} onClear={() => { setPeriod({ from: wibDay(-29), to: wibDay(0) }); setKeyword(""); }} />
        </Toolbar>
        {!rows ? <div className="p-4"><div className="skeleton h-64 rounded-lg" /></div> : rows.data.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-500">{tr("No mention in this period")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cx(jTable, "m-cards min-w-[920px]")}>
              <thead><tr className={jHeadRow}><th className={cx(jTh, "w-28")}>{tr("Platform")}</th><th className={jTh}>{tr("Mention")}</th>
                <th className={jTh}>{tr("Sentiment")}</th><th className={cx(jTh, "text-right")}>{tr("Views")}</th><th className={cx(jTh, "text-right")}>{tr("Likes")}</th><th className={cx(jTh, "text-right")}>{tr("Comments")}</th>
                <th className={jTh}>{tr("Date")}</th></tr></thead>
              <tbody>
                {rows.data.map((p) => {
                  const pf = PLATFORM[p.platform];
                  return (
                    <tr key={`${p.platform}:${p.post_id}`} onClick={() => setOpen({ platform: p.platform, id: p.post_id })}
                      className="group cursor-pointer border-b border-neutral-100 align-top hover:bg-neutral-50">
                      <td className={jTd} data-label={tr("Platform")}><span className="inline-flex items-center gap-1.5">
                        {pf ? logo(pf.file) : <Megaphone size={15} />}<span className="text-neutral-700">{pf?.label ?? p.platform}</span></span>
                        {p.source === "comment" && <span className="mt-0.5 block text-[11px] text-neutral-400">{tr("comment")}</span>}</td>
                      <td className={cx(jTd, "max-w-[34rem]")} data-label={tr("Mention")}>
                        <span className="block text-[11px] font-semibold text-neutral-500">{p.author ?? "—"}</span>
                        <span className="line-clamp-3 whitespace-pre-line text-neutral-900">{p.text}</span>
                        {(p.keywords?.length ?? 0) > 0 && <span className="mt-1 flex flex-wrap gap-1">{p.keywords!.map((k) => <Lozenge key={k} tone="blue">{k}</Lozenge>)}</span>}
                        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 group-hover:underline">{tr("See details")}</span>
                      </td>
                      <td className={jTd} data-label={tr("Sentiment")}>{p.sentiment ? <Lozenge tone={FEEL[p.sentiment].tone}>{FEEL[p.sentiment].label()}</Lozenge> : "—"}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Views")}>{n(p.views)}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Likes")}>{n(p.likes)}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Comments")}>{n(p.comments)}</td>
                      <td className={cx(jTd, "whitespace-nowrap text-neutral-600")} data-label={tr("Date")}>{contentDate(p.createdAt, p.dateApprox)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows && <CardFooter><span>{tr("{0} of {1} mentions", Math.min((page + 1) * PAGE, rows.total), rows.total)}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((x) => x - 1)}>{tr("Previous")}</Button>
            <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= rows.total} onClick={() => setPage((x) => x + 1)}>{tr("Next")}</Button>
          </span></CardFooter>}
      </WorkCard>

      {open && <PostPreview platform={open.platform} id={open.id} onClose={() => setOpen(null)} />}
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title={tr("Most influential accounts")} description={tr("The accounts whose mentions reached the most views in the period")}>
          {!sum ? <div className="skeleton m-4 h-40 rounded-lg" /> : sum.authors.length === 0 ? <p className="px-4 py-6 text-sm text-neutral-500">{tr("No mention in this period")}</p> : (
            <div className="overflow-x-auto">
              <table className={cx(jTable, "m-cards")}>
                <thead><tr className={jHeadRow}><th className={cx(jTh, "w-10")}>#</th><th className={jTh}>{tr("Account")}</th>
                  <th className={cx(jTh, "text-right")}>{tr("Mentions")}</th><th className={cx(jTh, "w-[38%]")}>{tr("Views")}</th></tr></thead>
                <tbody>
                  {sum.authors.map((a, i) => {
                    const pf = PLATFORM[a.platform];
                    const top = sum.authors[0]?.views || 1;
                    return (
                      <tr key={`${a.platform}:${a.author}`} className="border-b border-neutral-100">
                        <td className={cx(jTd, "tabular-nums text-neutral-400")} data-label="#">{i + 1}</td>
                        <td className={jTd} data-label={tr("Account")}><span className="flex min-w-0 items-center gap-2">{pf && logo(pf.file)}
                          <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{a.author}</span>
                            <span className="block text-[11px] text-neutral-500">{pf?.label ?? a.platform}</span></span></span></td>
                        <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Mentions")}>{n(a.posts)}</td>
                        <td className={jTd} data-label={tr("Views")}><span className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.max(2, (a.views / top) * 100)}%` }} /></span>
                          <span className="w-20 text-right tabular-nums text-neutral-700">{n(a.views)}</span></span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Schedule sum={sum} />
      </div>
    </Page>
  );
}

/** The schedule of every source (migration 136): runs by itself; folded by default, read only (2026-11-23, the
 *  user: no Collect Now, the scheduler keeps the data up to date). */
function Schedule({ sum }: { sum: Summary | null }) {
  const [open, setOpen] = useState(false);
  const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
  const latest = sum?.schedule.map((x) => x.lastRunAt).filter(Boolean).sort().at(-1) ?? null;
  return (
    <section className="h-fit overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-neutral-900">{tr("Data collection schedule")}</span>
          <span className="block text-xs text-neutral-500">{tr("Automatic · updated {0}", at(latest))}</span>
        </span>
        <span className="flex items-center gap-1">{sum?.schedule.map((x) => PLATFORM[x.source] && <span key={x.source}>{logo(PLATFORM[x.source].file, 14)}</span>)}</span>
        <ChevronDown size={16} className={cx("text-neutral-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && sum && (
        <div className="border-t border-neutral-200">
          <ul className="divide-y divide-neutral-100">
            {sum.schedule.map((x) => {
              const last = sum.runs.find((r) => r.source === x.source);
              const pf = PLATFORM[x.source];
              return (
                <li key={x.source} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2 font-medium text-neutral-900">{pf && logo(pf.file)}{pf?.label ?? x.source}</span>
                    {x.enabled ? <Lozenge tone="green">{tr("Every {0} h", x.everyHours)}</Lozenge> : <Lozenge tone="grey">{tr("Off")}</Lozenge>}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {tr("Last")}: {at(x.lastRunAt)}{last && (last.error ? <> · <span className="text-red-700">{tr("Failed")}</span></>
                      : !last.finishedAt ? <> · {tr("Running")}</> : <> · {tr("{0} found, {1} new", last.found ?? 0, last.added ?? 0)}</>)}
                    {x.enabled && <> · {tr("Next")}: {at(x.nextRunAt)}</>}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-neutral-100 px-4 py-2.5 text-[11px] text-neutral-500">{tr("Without an API key. Instagram, Threads, X and LinkedIn need a login and are not collected.")}</p>
        </div>
      )}
    </section>
  );
}

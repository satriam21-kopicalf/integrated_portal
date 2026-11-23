"use client";
/* eslint-disable @next/next/no-img-element -- the small brand logos are static svg files */

// Social Media → Social Media Analytics (page social.analytics, backend migration 135, 2026-11-23): what the public says about
// Kopi Calf, collected by the portal itself on our VPS — YouTube (videos and their comments), Google News and the
// official TikTok account — without an API key or a third-party service. Searching Instagram, Threads, X and LinkedIn
// needs a login and is not collected.

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, Megaphone, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button, ErrorState, cx, useToast } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { FilterRow, MonitorFilterSheet, QuickPeriod } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";

type Post = { platform: string; post_id: string; source: string; url: string | null; author: string | null; text: string | null;
  createdAt: string | null; likes: number | null; comments: number | null; views: number | null; sentiment: "positive" | "negative" | "neutral" | null };
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
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—");
const PAGE = 50;

export default function SocialMediaPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [period, setPeriod] = useState({ from: wibDay(-29), to: wibDay(0) });
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
  const range = `dateFrom=${period.from}&dateTo=${period.to}`;
  useEffect(() => {
    let alive = true;
    call<Summary>(`/api/social/summary?${range}`).then((r) => { if (alive) setSum(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [range, tick]);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(0), [tab, feel, debounced, range]);
  useEffect(() => {
    let alive = true;
    setRows(null);
    const p = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, limit: String(PAGE), offset: String(page * PAGE) });
    if (tab !== "all") p.set("platform", tab);
    if (feel) p.set("sentiment", feel);
    if (debounced.trim()) p.set("q", debounced.trim());
    call<{ total: number; data: Post[] }>(`/api/social/posts?${p}`).then((r) => { if (alive) setRows(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [tab, feel, debounced, period, page, tick]);
  const tot = useMemo(() => {
    const ps = sum?.platforms ?? [];
    const pick = tab === "all" ? ps : ps.filter((p) => p.platform === tab);
    return pick.reduce((a, p) => ({ posts: a.posts + p.posts, views: a.views + p.views, positive: a.positive + p.positive, negative: a.negative + p.negative }),
      { posts: 0, views: 0, positive: 0, negative: 0 });
  }, [sum, tab]);
  const count = (p: string) => sum ? (sum.platforms.find((x) => x.platform === p)?.posts ?? 0) : null;
  const filters: ActiveFilter[] = period.from !== wibDay(-29) || period.to !== wibDay(0)
    ? [{ key: "period", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod({ from: wibDay(-29), to: wibDay(0) }) }] : [];
  const admin = user?.role === "superadmin" || user?.role === "admin";
  const runNow = async () => {  // every source now (the schedule panel runs one, or reaches back to 1 January)
    try { await call("/api/social/run", { method: "POST" }); toast(tr("Collecting in the background: refresh in a few minutes")); }
    catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Page title={tr("Social Media Analytics")} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr("what the public says about Kopi Calf")}`}
      actions={admin ? <Button variant="secondary" onClick={() => void runNow()}><RefreshCw size={15} /> {tr("Collect now")}</Button> : undefined}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Mentions")} icon={<Megaphone size={13} />} value={sum ? n(tot.posts) : <StatSkeleton />} onClick={sum ? () => setFeel("") : undefined} />
          <Stat label={tr("Views")} icon={<Eye size={13} />} value={sum ? n(tot.views) : <StatSkeleton />} />
          <Stat label={tr("Positive")} icon={<ThumbsUp size={13} />} value={sum ? n(tot.positive) : <StatSkeleton />} active={feel === "positive"} onClick={sum ? () => setFeel("positive") : undefined} />
          <Stat label={tr("Negative")} icon={<ThumbsDown size={13} />} value={sum ? n(tot.negative) : <StatSkeleton />} emphasis={tot.negative > 0} active={feel === "negative"} onClick={sum ? () => setFeel("negative") : undefined} />
        </StatStrip>
      }>
      {sheet && (
        <MonitorFilterSheet active={filters.length} onClose={() => setSheet(false)} onReset={() => setDraft({ from: wibDay(-29), to: wibDay(0) })}
          onApply={() => { setPeriod(draft); setSheet(false); }}>
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
            onOpen={() => { setDraft(period); setSheet(true); }} onClear={() => setPeriod({ from: wibDay(-29), to: wibDay(0) })} />
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
                    <tr key={`${p.platform}:${p.post_id}`} className="border-b border-neutral-100 align-top hover:bg-neutral-50">
                      <td className={jTd} data-label={tr("Platform")}><span className="inline-flex items-center gap-1.5">
                        {pf ? logo(pf.file) : <Megaphone size={15} />}<span className="text-neutral-700">{pf?.label ?? p.platform}</span></span>
                        {p.source === "comment" && <span className="mt-0.5 block text-[11px] text-neutral-400">{tr("comment")}</span>}</td>
                      <td className={cx(jTd, "max-w-[34rem]")} data-label={tr("Mention")}>
                        <span className="block text-[11px] font-semibold text-neutral-500">{p.author ?? "—"}</span>
                        <span className="line-clamp-3 whitespace-pre-line text-neutral-900">{p.text}</span>
                        {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                          {tr("Open")} <ExternalLink size={11} /></a>}
                      </td>
                      <td className={jTd} data-label={tr("Sentiment")}>{p.sentiment ? <Lozenge tone={FEEL[p.sentiment].tone}>{FEEL[p.sentiment].label()}</Lozenge> : "—"}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Views")}>{n(p.views)}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Likes")}>{n(p.likes)}</td>
                      <td className={cx(jTd, "text-right tabular-nums")} data-label={tr("Comments")}>{n(p.comments)}</td>
                      <td className={cx(jTd, "whitespace-nowrap text-neutral-600")} data-label={tr("Date")}>{when(p.createdAt)}</td>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr("Most influential accounts")} description={tr("By views in the period")}>
          {!sum ? <div className="skeleton m-4 h-32 rounded-lg" /> : sum.authors.length === 0 ? <p className="px-4 py-6 text-sm text-neutral-500">—</p> : (
            <ul className="divide-y divide-neutral-100">
              {sum.authors.map((a) => (
                <li key={`${a.platform}:${a.author}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{a.author}</span>
                    <span className="flex items-center gap-1 text-[11px] text-neutral-500">{PLATFORM[a.platform] && logo(PLATFORM[a.platform].file, 12)}{PLATFORM[a.platform]?.label ?? a.platform} · {tr("{0} mentions", a.posts)}</span></span>
                  <span className="flex-shrink-0 tabular-nums text-neutral-700">{n(a.views)} {tr("views")}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Schedule sum={sum} admin={admin} onChanged={() => setTick((t) => t + 1)} />
      </div>
    </Page>
  );
}

/** The schedule of every source (migration 136): on / off, every how many hours, the last run and its result, the next
 *  run; superadmin / admin change it, run a source now or reach back to 1 January. */
function Schedule({ sum, admin, onChanged }: { sum: Summary | null; admin: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
  const save = async (source: string, enabled: boolean, everyHours: number) => {
    setBusy(source);
    try { await call(`/api/social/schedule/${source}`, { method: "PUT", json: { enabled, everyHours } }); toast(tr("Schedule saved")); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const run = async (source: string | null, backfillFrom?: string) => {
    setBusy(source ?? "all");
    try { await call("/api/social/run", { method: "POST", json: { source, backfillFrom: backfillFrom ?? null } }); toast(tr("Collecting in the background: refresh in a few minutes")); setTimeout(onChanged, 4000); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  return (
    <Panel title={tr("Data collection schedule")} description={tr("The portal checks every 5 minutes which source is due, without an API key. Instagram, Threads, X and LinkedIn need a login and are not collected.")}
      actions={admin ? <Button size="sm" variant="secondary" loading={busy === "all"} onClick={() => void run(null, "2026-01-01")}>{tr("Collect since 1 January")}</Button> : undefined}>
      {!sum ? <div className="skeleton m-4 h-32 rounded-lg" /> : (
        <ul className="divide-y divide-neutral-100">
          {sum.schedule.map((x) => {
            const last = sum.runs.find((r) => r.source === x.source);
            const pf = PLATFORM[x.source];
            return (
              <li key={x.source} className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-2 font-medium text-neutral-900">{pf && logo(pf.file)}{pf?.label ?? x.source}</span>
                  {x.enabled ? <Lozenge tone="green">{tr("Every {0} h", x.everyHours)}</Lozenge> : <Lozenge tone="grey">{tr("Off")}</Lozenge>}
                  {x.backfillFrom && <Lozenge tone="blue">{tr("Backfill from {0}", dmy(x.backfillFrom))}</Lozenge>}
                  {admin && <span className="ml-auto flex items-center gap-1.5">
                    <select aria-label={tr("Interval")} value={x.everyHours} disabled={busy === x.source} onChange={(e) => void save(x.source, x.enabled, Number(e.target.value))}
                      className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs">
                      {[1, 3, 6, 12, 24].map((h) => <option key={h} value={h}>{tr("Every {0} h", h)}</option>)}
                    </select>
                    <Button size="sm" variant="secondary" disabled={busy === x.source} onClick={() => void save(x.source, !x.enabled, x.everyHours)}>{x.enabled ? tr("Turn off") : tr("Turn on")}</Button>
                    <Button size="sm" variant="secondary" loading={busy === x.source} onClick={() => void run(x.source)}><RefreshCw size={13} /></Button>
                  </span>}
                </div>
                <p className="text-xs text-neutral-500">
                  {tr("Last")}: {at(x.lastRunAt)}{last && (last.error ? <> · <span className="text-red-700">{tr("Failed")}: {last.error.slice(0, 80)}</span></>
                    : !last.finishedAt ? <> · {tr("Running")}</> : <> · {tr("{0} found, {1} new", last.found ?? 0, last.added ?? 0)}</>)}
                  {x.enabled && <> · {tr("Next")}: {at(x.nextRunAt)}</>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

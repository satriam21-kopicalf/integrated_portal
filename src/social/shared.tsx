"use client";
/* eslint-disable @next/next/no-img-element -- the small brand logos are static svg files */

// Social Media (2026-11-23): the pieces both pages share — the platforms with their real logos, the sentiment, the
// preview of one mention and the drawer listing the mentions behind any analysis of the Overview (a sentiment, a
// channel, a keyword, a source, a word, a city, a week), each opening its preview.

import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Megaphone } from "lucide-react";
import { Button, ErrorState, cx } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { Lozenge, type LozengeTone } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { compactNumber } from "@/lib/overview";
import { locale, tr } from "@/lib/i18n";

export type Feel = "positive" | "neutral" | "negative";
export type Post = { platform: string; post_id: string; source: string; url: string | null; author: string | null; text: string | null;
  createdAt: string | null; likes: number | null; comments: number | null; views: number | null; sentiment: Feel | null; keywords?: string[];
  /** the date is the age the search showed ("3mo ago"), not the exact upload */ dateApprox?: boolean };
type Full = Post & { transcript?: string | null; transcriptError?: string | null; keyword: string | null; shares: number | null; firstSeen: string | null; lastSeen: string | null; raw: Record<string, unknown> };

/** the real logos of the platforms (simple-icons, CC0, in their brand colour): public/assets/brand */
export const PLATFORM: Record<string, { label: string; file: string }> = {
  youtube: { label: "YouTube", file: "youtube" }, tiktok: { label: "TikTok", file: "tiktok" },
  news: { label: "Google News", file: "googlenews" }, instagram: { label: "Instagram", file: "instagram" },
};
export const logo = (file: string, size = 16) => <img src={`/assets/brand/${file}.svg`} alt="" width={size} height={size} className="flex-shrink-0" />;
export const FEEL: Record<Feel, { label: () => string; tone: LozengeTone; color: string }> = {
  positive: { label: () => tr("Positive"), tone: "green", color: "#1baf7a" },
  neutral: { label: () => tr("Neutral"), tone: "grey", color: "#2a78d6" },
  negative: { label: () => tr("Negative"), tone: "red", color: "#e34948" },
};
const SOURCE: Record<string, () => string> = {
  search: () => tr("Search result"), comment: () => tr("Comment"), account: () => tr("Official account"), "google-news": () => tr("News article"), hashtag: () => tr("Hashtag"),
};
export const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString(locale()));
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "—");
/** The date of a content (2026-11-23): exact as published, "≈ month year" when only its age was known, "date unknown" —
 *  never the day it was collected. */
export function contentDate(iso: string | null | undefined, approx?: boolean, long = false): string {
  if (!iso) return tr("Date unknown");
  const d = new Date(iso);
  if (approx) return `≈ ${d.toLocaleDateString(locale(), { month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}`;
  return long ? d.toLocaleString(locale(), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })
    : d.toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
}
const full = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale(), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");

/** A strip of figures in one ruled row (the summary of a drawer). */
function Figures({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className={cx("grid divide-x divide-[color:var(--j-DCDFE4)] overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white", items.length === 4 ? "grid-cols-2 sm:grid-cols-4 max-sm:[&>*:nth-child(3)]:border-l-0 max-sm:[&>*:nth-child(n+3)]:border-t" : "grid-cols-3")}>
      {items.map(([k, v]) => (
        <div key={k} className="px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--j-626F86)]">{k}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--j-172B4D)]">{v}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h3 className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--j-626F86)]">{title}</h3>{aside}</div>
      {children}
    </section>
  );
}

/** One mention in full: the player of the video, the figures, the whole text, the keywords and the details. */
export function PostPreview({ platform, id, onClose, onBack }: { platform: string; id: string; onClose: () => void; onBack?: () => void }) {
  const [d, setD] = useState<Full | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setD(null);
    call<Full>(`/api/social/post?platform=${encodeURIComponent(platform)}&id=${encodeURIComponent(id)}`)
      .then((r) => { if (alive) setD(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [platform, id]);
  const pf = PLATFORM[platform];
  const video = d && d.source !== "comment" ? (platform === "youtube" ? `https://www.youtube-nocookie.com/embed/${d.post_id}`
    : platform === "tiktok" ? `https://www.tiktok.com/player/v1/${d.post_id}?music_info=1&description=1&rel=0` : null) : null;
  const kws = d ? (d.keywords?.length ? d.keywords : d.keyword ? [d.keyword] : []) : [];
  const site = typeof d?.raw?.site === "string" ? (d.raw.site as string).replace(/^https?:\/\//, "").replace(/\/$/, "") : null;
  const [title, ...body] = (d?.text ?? "").split("\n");
  return (
    <Drawer open iconPlain onClose={onClose} onBack={onBack} size="lg" icon={pf ? logo(pf.file, 18) : <Megaphone size={18} />} title={d?.author ?? (pf?.label ?? platform)}
      description={d ? `${pf?.label ?? platform} · ${(SOURCE[d.source] ?? (() => d.source))()} · ${contentDate(d.createdAt, d.dateApprox)}` : undefined}
      footer={d?.url ? <a href={d.url} target="_blank" rel="noreferrer"><Button><ExternalLink size={15} /> {tr("Open on {0}", pf?.label ?? platform)}</Button></a> : undefined}>
      {error ? <ErrorState message={error} /> : !d ? <div className="space-y-3"><div className="skeleton h-48 rounded-[3px]" /><div className="skeleton h-24 rounded-[3px]" /></div> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-1.5">
            {d.sentiment && <Lozenge tone={FEEL[d.sentiment].tone}>{FEEL[d.sentiment].label()}</Lozenge>}
            {kws.map((k) => <Lozenge key={k} tone="blue">{k}</Lozenge>)}
          </div>
          {video && (
            platform === "tiktok" ? (
              // the official TikTok player (the URL TikTok's own oEmbed gives, player/v1; embed/v2 could show another video),
              // at its own size 325 x 578
              <div className="mx-auto w-full max-w-[325px] overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
                <iframe src={video} title={title || tr("Video")} width="325" height="578" className="block h-[578px] w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              </div>
            ) : (
              <div className="aspect-video w-full overflow-hidden rounded-[3px] bg-black">
                <iframe src={video} title={title || tr("Video")} className="h-full w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
              </div>
            )
          )}
          {platform !== "news" && <Figures items={[[tr("Views"), num(d.views)], [tr("Likes"), num(d.likes)], [tr("Comments"), num(d.comments)], [tr("Shares"), num(d.shares)]]} />}
          <Section title={platform === "news" ? tr("Article") : tr("Caption")}>
            <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] p-4">
              {title && <p className="text-[15px] font-semibold leading-snug text-[color:var(--j-172B4D)]">{title}</p>}
              {body.join("\n").trim() && <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[color:var(--j-44546F)]">{body.join("\n").trim()}</p>}
            </div>
          </Section>
          {platform === "tiktok" && d.source !== "comment" && (
            <Section title={tr("What is said in the video")} aside={<span className="text-[11px] text-[color:var(--j-626F86)]">{tr("Transcribed on our server")}</span>}>
              <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-4">
                {d.transcript ? <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[color:var(--j-44546F)]">{d.transcript}</p>
                  : <p className="text-sm text-[color:var(--j-626F86)]">{d.transcriptError ? tr("The audio of this video could not be read.") : tr("Not transcribed yet: the newest videos are done first, a few every minute.")}</p>}
              </div>
            </Section>
          )}
          <Section title={tr("Details")}>
            <dl className="divide-y divide-[color:var(--j-F1F2F4)] overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] text-sm">
              {([
                [tr("Platform"), <span key="p" className="flex items-center gap-1.5">{pf && logo(pf.file, 14)}{pf?.label ?? platform}</span>],
                [tr("Account / source"), d.author ?? "—"],
                ...(site ? [[tr("Site"), site]] as [string, React.ReactNode][] : []),
                [tr("Kind"), (SOURCE[d.source] ?? (() => d.source))()],
                [tr("Published"), d.dateApprox ? `${contentDate(d.createdAt, true)} · ${tr("approximate, from the age YouTube shows")}` : contentDate(d.createdAt, false, true)],
                [tr("First found"), full(d.firstSeen)],
                [tr("Figures updated"), full(d.lastSeen)],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[9.5rem_1fr] gap-3 px-3 py-2"><dt className="text-[color:var(--j-626F86)]">{k}</dt><dd className="min-w-0 break-words text-[color:var(--j-172B4D)]">{v}</dd></div>
              ))}
            </dl>
            {platform === "youtube" && <p className="text-[11px] text-[color:var(--j-626F86)]">{tr("YouTube likes and comments need a login from our server: only the views are collected.")}</p>}
          </Section>
        </div>
      )}
    </Drawer>
  );
}

/** What a drawer lists: the filters of /api/social/posts, a title and an optional line under it. */
export type Drill = { title: string; description?: string; icon?: React.ReactNode; dateFrom: string; dateTo: string;
  platform?: string; sentiment?: Feel; keyword?: string; who?: string; q?: string; posts?: boolean };

/** The mentions behind one analysis of the Overview: their figures, then the list; a mention opens its preview. */
export function DrillDrawer({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  const [rows, setRows] = useState<{ total: number; sums?: Record<"views" | "likes" | "comments" | Feel, number>; data: Post[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    let alive = true;
    const p = new URLSearchParams({ dateFrom: drill.dateFrom, dateTo: drill.dateTo, limit: String(limit) });
    if (drill.platform) p.set("platform", drill.platform);
    if (drill.sentiment) p.set("sentiment", drill.sentiment);
    if (drill.keyword) p.set("keyword", drill.keyword);
    if (drill.who) p.set("who", drill.who);
    if (drill.q) p.set("q", drill.q);
    if (drill.posts) p.set("kind", "post");
    call<{ total: number; sums?: Record<"views" | "likes" | "comments" | Feel, number>; data: Post[] }>(`/api/social/posts?${p}`).then((r) => { if (alive) setRows(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [drill, limit]);
  if (open) return <PostPreview platform={open.platform} id={open.post_id} onClose={onClose} onBack={() => setOpen(null)} />;
  // the totals of every mention of the filter (the server), not of the page listed
  const sum = (k: "views" | "likes" | "comments") => rows?.sums?.[k] ?? 0;
  const feel = (k: Feel) => rows?.sums?.[k] ?? 0;
  return (
    <Drawer open iconPlain onClose={onClose} size="lg" icon={drill.icon ?? <Megaphone size={18} />} title={drill.title}
      description={drill.description ?? `${day(drill.dateFrom)} – ${day(drill.dateTo)}`}>
      {error ? <ErrorState message={error} /> : !rows ? <div className="space-y-3"><div className="skeleton h-16 rounded-[3px]" /><div className="skeleton h-64 rounded-[3px]" /></div> : (
        <div className="space-y-5">
          <Figures items={[[tr("Mentions"), num(rows.total)], [tr("Views"), compactNumber(sum("views"))], [tr("Likes"), compactNumber(sum("likes"))],
            [tr("Comments"), compactNumber(sum("comments"))]]} />
          {rows.total > 0 && (
            <div>
              <div className="flex h-2 overflow-hidden rounded-full bg-[color:var(--j-091E420F)]" title={tr("Sentiment of the mentions")}>
                {(["positive", "neutral", "negative"] as Feel[]).map((k) => <span key={k} style={{ width: `${(feel(k) / rows.total) * 100}%`, background: FEEL[k].color }} />)}
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-[color:var(--j-44546F)]">{(["positive", "neutral", "negative"] as Feel[]).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: FEEL[k].color }} />{FEEL[k].label()} {num(feel(k))}</span>))}</p>
            </div>
          )}
          <Section title={tr("Mentions")} aside={<span className="text-xs text-[color:var(--j-626F86)]">{tr("{0} of {1}", rows.data.length, rows.total)}</span>}>
            {rows.data.length === 0 ? <p className="rounded-[3px] border border-dashed border-[color:var(--j-DCDFE4)] px-4 py-8 text-center text-sm text-[color:var(--j-626F86)]">{tr("No mention in this period")}</p> : (
              <ul className="divide-y divide-[color:var(--j-F1F2F4)] overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)]">
                {rows.data.map((p) => {
                  const pf = PLATFORM[p.platform];
                  const [first] = (p.text ?? "").split("\n");
                  return (
                    <li key={`${p.platform}:${p.post_id}`}>
                      <button type="button" onClick={() => setOpen(p)} className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-[color:var(--j-F7F8F9)]">
                        <span className="pt-0.5">{pf ? logo(pf.file, 16) : <Megaphone size={16} />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-[11px] text-[color:var(--j-626F86)]"><span className="truncate font-semibold text-[color:var(--j-44546F)]">{p.author ?? "—"}</span><span>· {contentDate(p.createdAt, p.dateApprox)}</span></span>
                          <span className="line-clamp-2 text-sm text-[color:var(--j-172B4D)]">{first || "—"}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--j-626F86)]">
                            {p.sentiment && <Lozenge tone={FEEL[p.sentiment].tone}>{FEEL[p.sentiment].label()}</Lozenge>}
                            {p.views !== null && <span>{tr("{0} views", compactNumber(p.views))}</span>}
                            {p.likes !== null && <span>· {tr("{0} likes", compactNumber(p.likes))}</span>}
                          </span>
                        </span>
                        <ArrowLeft size={14} className="mt-1 rotate-180 text-[color:var(--j-8590A2)]" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {rows.data.length < rows.total && <Button variant="secondary" className="w-full" onClick={() => setLimit((l) => l + 30)}>{tr("Show more")}</Button>}
          </Section>
        </div>
      )}
    </Drawer>
  );
}

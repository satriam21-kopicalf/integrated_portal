"use client";

// Aggregator Insight → Reviews & Rating (page agg.reviews, 2026-11-25): the customers' reviews BotFood keeps, per outlet,
// platform and topic; a low review becomes a complaint ticket. BotFood rarely gives the order time: the time shown is then
// when BotFood received the review. It gives no merchant reply: replied or not is not shown.

import { useEffect, useState } from "react";
import { MessageSquareText, Star } from "lucide-react";
import { useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Tip } from "@/aggregator/info";
import { Bars, DataTable, FilterBar, FreshLine, OutletCell, Platform, noMembers, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { downloadSheets } from "@/aggregator/ui";
import TicketDrawer from "@/aggregator/Ticket";
import { dayOf, fmtClock, fmtDay, fmtPeriod, nf, pct, xlStamp } from "@/aggregator/time";
import { Page, Stat, StatSkeleton, StatStrip, Lozenge, QuickChips, WorkCard, Button, ErrorState, cx } from "@/jira";

type Row = { id: string; at: string; timeKind: "order" | "received"; outlet: string; branchCode: string | null; platform: string; rating: number; comment: string | null; item: string | null; orderId: string | null; topic: string | null; member: string | null; complaintId: number | null };
type Out = { outlet: string; branchCode: string | null; n: number; avg: number | null; low: number };
type Day = { day: string; n: number; avg: number | null };
type Res = { summary: { n: number; avg: number | null; low: number; withComment: number; noTicket: number; limit: number; byOrderTime: number }; byRating: { rating: number; n: number }[]; byPlatform: { platform: string; n: number; avg: number | null; low: number }[];
  byOutlet: Out[]; topics: { topic: string; n: number }[]; days: Day[]; rows: Row[] };
type Tab = "reviews" | "outlet" | "topic" | "day";
type Only = "all" | "low" | "noticket";
const tone = (r: number) => (r <= 2 ? "red" : r === 3 ? "amber" : "green") as "red" | "amber" | "green";

export default function Reviews() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reviews");
  const [only, setOnly] = useState<Only>("low");
  const [topic, setTopic] = useState("");
  const [stars, setStars] = useState("");
  const [q, setQ] = useState("");
  const [version, setVersion] = useState(0);
  const [handle, setHandle] = useState<number | null>(null);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/reviews?${a.query}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query, version]);
  const t = q.trim().toLowerCase();
  const scoped = useScope(data?.rows, a.f, ctx), outs = useScope(data?.byOutlet, a.f, ctx);
  const rows = scoped.filter((r) => (only === "all" || r.rating <= 3) && (only !== "noticket" || !r.complaintId) && (!topic || r.topic === topic) && (!stars || r.rating === Number(stars))
    && (!t || `${r.outlet} ${r.comment ?? ""} ${r.item ?? ""} ${r.orderId ?? ""} ${r.member ?? ""}`.toLowerCase().includes(t)));
  const low = scoped.filter((r) => r.rating <= 3);
  const narrowed = !!(a.f.outlet || a.f.group);
  const total = outs.reduce((x, o) => x + o.n, 0), lowSum = outs.reduce((x, o) => x + o.low, 0);
  const avg = total ? outs.reduce((x, o) => x + (o.avg ?? 0) * o.n, 0) / total : null;
  const topics = Object.entries(low.reduce<Record<string, number>>((m, r) => { const k = r.topic ?? "—"; m[k] = (m[k] ?? 0) + 1; return m; }, {})).map(([key, n]) => ({ key, label: key, n })).sort((x, y) => y.n - x.n);
  const s = data?.summary;
  const key = `${a.query}${a.f.outlet}${a.f.group}${only}${topic}${stars}${t}${tab}`;
  const ticket = async (r: Row) => {
    try {
      const x = await call<{ id: number }>("/api/aggregator/complaints", { method: "POST", json: { reviewId: r.id } });
      setData((d) => (d ? { ...d, rows: d.rows.map((y) => (y.id === r.id ? { ...y, complaintId: x.id } : y)) } : d));
      setHandle(x.id); // 2026-11-27: handled right here: the ticket drawer (action, evidence, reply)
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const cols: Col<Row>[] = [
    { key: "at", label: tr("Time (WIB)"), sort: (r) => r.at, first: "desc", className: "whitespace-nowrap", render: (r) => <>{fmtDay(dayOf(r.at))}<span className="block text-[11px] text-[color:var(--j-626F86)]">{fmtClock(r.at)} · {r.timeKind === "order" ? tr("ordered") : tr("received")}</span></> },
    { key: "outlet", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "rating", card: "side", label: tr("Rating"), sort: (r) => r.rating, render: (r) => <Lozenge tone={tone(r.rating)}>{r.rating} ★</Lozenge> },
    { key: "comment", card: "wide", label: tr("Comment"), className: "max-w-[26rem]", render: (r) => <><span className="block text-[color:var(--j-172B4D)]">{r.comment || <span className="text-[color:var(--j-626F86)]">{tr("no comment")}</span>}</span>{r.item && <span className="block text-[11px] text-[color:var(--j-626F86)]">{r.item}</span>}{r.orderId && <span className="block text-[11px] text-[color:var(--j-626F86)]">{tr("Order no.")} {r.orderId}</span>}</> },
    { key: "topic", label: tr("Topic"), sort: (r) => r.topic, className: "text-[color:var(--j-44546F)]", render: (r) => r.topic ?? "—" },
    { key: "member", label: tr("Handled by"), sort: (r) => r.member, hide: noMembers(scoped), render: (r) => r.member ?? "—" },
    { key: "ticket", label: tr("Complaint"), sort: (r) => r.complaintId, render: (r) => r.complaintId ? <button type="button" onClick={(e) => { e.stopPropagation(); setHandle(r.complaintId!); }} className="text-xs font-semibold text-[color:var(--j-0C66E4)] hover:underline">#{r.complaintId}</button> : r.rating <= 3 ? <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => void ticket(r)}><MessageSquareText size={13} /> {tr("Handle")}</Button> : <span className="text-[color:var(--j-8590A2)]">—</span> },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Reviews ${a.f.from} - ${a.f.to}`, [
        { sheet: "Summary", title: `Reviews · ${fmtPeriod(a.f.from, a.f.to)}${a.f.platform ? ` · ${a.f.platform}` : ""} · WIB`, header: [tr("Measure"), tr("Value")], rows: [[tr("Reviews"), total], [tr("Average rating"), avg ? Math.round(avg * 100) / 100 : null], [tr("Low (3 or less)"), lowSum], [tr("Low without a ticket"), low.filter((r) => !r.complaintId).length], ...(narrowed ? [] : data.byRating.map((x) => [`${x.rating} ★`, x.n]))] },
        { sheet: "Per day", header: [tr("Date"), tr("Reviews"), tr("Average rating")], rows: narrowed ? [] : data.days.map((x) => [x.day, x.n, x.avg]) },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Reviews"), tr("Average rating"), tr("Low (3 or less)")], rows: outs.map((x) => [x.outlet, x.n, x.avg, x.low]) },
        { sheet: "Topics", header: [tr("Topic"), tr("Low (3 or less)")], rows: topics.map((x) => [x.key, x.n]) },
        { sheet: "Reviews", header: [tr("Time (WIB)"), tr("Time of"), tr("Outlet"), tr("Platform"), tr("Rating"), tr("Topic"), tr("Comment"), tr("Item"), tr("Order no."), tr("Handled by"), tr("Complaint")],
          rows: rows.map((r) => [xlStamp(r.at), r.timeKind === "order" ? tr("ordered") : tr("received"), r.outlet, r.platform, r.rating, r.topic, r.comment, r.item, r.orderId, r.member, r.complaintId]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const filter = (
    <FilterBar a={a} ctx={ctx} extra={[{ key: "stars", label: tr("Rating"), value: stars, onChange: setStars, options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ★` })) }, { key: "topic", label: tr("Topic"), value: topic, onChange: setTopic, options: (data?.topics ?? []).map((x) => ({ value: x.topic, label: x.topic })) }]} q={(tab === "reviews" || tab === "outlet") ? q : undefined} onQ={setQ} placeholder={tr("Search outlet, comment, item or order")} excel={() => void exportXlsx()} excelOff={!data}>{(tab === "reviews" || tab === "outlet") && <>{tab === "reviews" && <QuickChips<Only> value={only} onChange={setOnly} label={tr("Filter")} items={[{ key: "low", label: tr("Low (3 or less)"), dot: "bg-red-500", count: low.length }, { key: "noticket", label: tr("Without a ticket"), count: low.filter((r) => !r.complaintId).length }, { key: "all", label: tr("All with a comment"), count: scoped.length }]} />}</>}</FilterBar>
  );
  const card = <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">{filter}</section>;
  return (
    <Page title={tr("Reviews & Rating")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The reviews of the customers on the delivery apps, from BotFood")} media={<Star size={19} />}>
      <FreshLine ctx={ctx} sources={["reviews"]} />
      {err ? <>{card}<ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /></> : (
        <>
          <StatStrip columns={4} label={tr("Reviews")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Reviews")} info={<Tip k="reviews" />} value={s ? nf(total) : <StatSkeleton />}>{s && !narrowed && <p>{tr("{0} with a comment", nf(s.withComment))}</p>}</Stat>
            <Stat label={tr("Average rating")} info={<Tip k="rating" />} value={s ? nf(avg, 2) : <StatSkeleton />}>{data && !narrowed && <p>{data.byPlatform.map((p) => `${p.platform} ${nf(p.avg, 2)}`).join(" · ")}</p>}</Stat>
            <Stat label={tr("Low (3 or less)")} info={<Tip k="low" />} value={s ? nf(lowSum) : <StatSkeleton />}>{s && total > 0 && <p>{pct((lowSum / total) * 100)}</p>}</Stat>
            <Stat label={tr("Low without a ticket")} value={s ? nf(low.filter((r) => !r.complaintId).length) : <StatSkeleton />} />
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "reviews", label: tr("Reviews"), count: data ? rows.length : null }, { key: "outlet", label: tr("Per outlet"), count: data ? outs.length : null }, { key: "day", label: tr("Per day") }, { key: "topic", label: tr("Topics of low reviews") }]}>
            {filter}
            {tab === "topic" ? <Bars rows={topics} onPick={(k) => { setTopic(k); setOnly("low"); setTab("reviews"); }} empty={tr("No low review in this period")} />
              : tab === "day" ? <DataTable key={tab} rows={data?.days ?? []} loading={!data} rowKey={(r) => r.day} resetKey={key} initial={{ key: "d", dir: "desc" }} minWidth={420} note={narrowed ? tr("Per day counts every outlet of the platform chosen.") : undefined}
                cols={[{ key: "d", label: tr("Date"), sort: (r) => r.day, first: "desc", render: (r) => fmtDay(r.day) }, { key: "n", label: tr("Reviews"), sort: (r) => r.n, right: true, render: (r) => nf(r.n) }, { key: "a", label: tr("Average rating"), sort: (r) => r.avg, right: true, render: (r) => nf(r.avg, 2) }]} />
              : tab === "outlet" ? <DataTable key={tab} rows={outs.filter((o) => !t || o.outlet.toLowerCase().includes(t))} loading={!data} rowKey={(r) => `${r.branchCode}${r.outlet}`} resetKey={key} initial={{ key: "low", dir: "desc" }} minWidth={560} onRow={(r) => { setQ(r.outlet); setOnly("all"); setTab("reviews"); }}
                cols={[{ key: "o", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> }, { key: "n", label: tr("Reviews"), sort: (r) => r.n, first: "desc", right: true, render: (r) => nf(r.n) }, { key: "a", label: tr("Average rating"), sort: (r) => r.avg, right: true, render: (r) => nf(r.avg, 2) },
                  { key: "low", card: "side", label: tr("Low (3 or less)"), sort: (r) => r.low, first: "desc", right: true, render: (r) => <span className={cx(r.low > 0 && "font-semibold text-red-700")}>{nf(r.low)}</span> }, { key: "p", label: tr("Low %"), sort: (r) => (r.n ? r.low / r.n : 0), first: "desc", right: true, render: (r) => pct(r.n ? (r.low / r.n) * 100 : null) }]} />
              : <DataTable key={tab} cols={cols} rows={rows} loading={!data} rowKey={(r) => r.id} resetKey={key} initial={{ key: "at", dir: "desc" }} minWidth={1020}
                note={s ? tr("The order time is known for {0} of {1} reviews; the others show when BotFood received them. Listed: every low review and every review with a comment (the latest {2}).", nf(s.byOrderTime), nf(s.n), nf(s.limit)) : undefined} />}
          </WorkCard>
        </>
      )}
      {handle != null && <TicketDrawer id={handle} topics={(data?.topics ?? []).map((x) => x.topic)} onClose={() => setHandle(null)} onSaved={() => { setHandle(null); setVersion((v) => v + 1); }} />}
    </Page>
  );
}

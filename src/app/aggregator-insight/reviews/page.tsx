"use client";

// Aggregator Insight → Reviews & Rating (page agg.reviews, 2026-11-25): the customers' reviews BotFood keeps, per outlet,
// platform and topic; a low review becomes a complaint ticket. BotFood gives no merchant reply: replied or not is not shown.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, MessageSquareText, Star } from "lucide-react";
import { Button, ErrorState, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, Lozenge, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PeriodBar, daysAgo, downloadSheets } from "@/aggregator/ui";

type Row = { id: string; at: string; outlet: string; platform: string; rating: number; comment: string | null; item: string | null; orderId: string | null; topic: string | null; member: string | null; complaintId: number | null };
type Out = { outlet: string; n: number; avg: number | null; low: number };
type Res = { summary: { n: number; avg: number | null; low: number; withComment: number; noTicket: number; limit: number }; byRating: { rating: number; n: number }[];
  byPlatform: { platform: string; n: number; avg: number | null; low: number }[]; byOutlet: Out[]; topics: { topic: string; n: number }[]; rows: Row[] };
type Tab = "reviews" | "outlet" | "topic";
type Only = "all" | "low" | "noticket";

const when = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
const nf = (n: number) => n.toLocaleString("id-ID");

export default function Reviews() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("reviews");
  const [only, setOnly] = useState<Only>("low");
  const [topic, setTopic] = useState("");
  const [q, setQ] = useState("");
  const load = () => {
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/reviews?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform]);
  const t = q.trim().toLowerCase();
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (only === "all" || r.rating <= 3) && (only !== "noticket" || !r.complaintId) && (!topic || r.topic === topic)
    && (!t || `${r.outlet} ${r.comment ?? ""} ${r.item ?? ""} ${r.orderId ?? ""} ${r.member ?? ""}`.toLowerCase().includes(t))), [data, only, topic, t]);
  const outs = useMemo(() => (data?.byOutlet ?? []).filter((o) => !t || o.outlet.toLowerCase().includes(t)), [data, t]);
  const s = data?.summary;
  const ticket = async (r: Row) => {
    try {
      const x = await call<{ id: number }>("/api/aggregator/complaints", { method: "POST", json: { reviewId: r.id } });
      setData((d) => (d ? { ...d, rows: d.rows.map((y) => (y.id === r.id ? { ...y, complaintId: x.id } : y)), summary: { ...d.summary, noTicket: Math.max(0, d.summary.noTicket - 1) } } : d));
      toast(tr("Complaint #{0} made", x.id));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Reviews ${from} - ${to}`, [
        { sheet: "Summary", title: `Reviews ${from} – ${to}${platform ? ` · ${platform}` : ""}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Reviews"), data.summary.n], [tr("Average rating"), data.summary.avg],
          [tr("Low (3 or less)"), data.summary.low], [tr("Low without a ticket"), data.summary.noTicket], ...data.byRating.map((x) => [`${x.rating} ★`, x.n])] },
        { sheet: "Per platform", header: [tr("Platform"), tr("Reviews"), tr("Average rating"), tr("Low (3 or less)")], rows: data.byPlatform.map((x) => [x.platform, x.n, x.avg, x.low]) },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Reviews"), tr("Average rating"), tr("Low (3 or less)")], rows: data.byOutlet.map((x) => [x.outlet, x.n, x.avg, x.low]) },
        { sheet: "Topics", header: [tr("Topic"), tr("Low (3 or less)")], rows: data.topics.map((x) => [x.topic, x.n]) },
        { sheet: "Reviews", header: [tr("Time"), tr("Outlet"), tr("Platform"), tr("Rating"), tr("Topic"), tr("Comment"), tr("Item"), tr("Order no."), tr("Handled by"), tr("Complaint")],
          rows: data.rows.map((r) => [r.at.slice(0, 16).replace("T", " "), r.outlet, r.platform, r.rating, r.topic, r.comment, r.item, r.orderId, r.member, r.complaintId]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Page title={tr("Reviews & Rating")} eyebrow={tr("Aggregator Insight")} subtitle={tr("The reviews of the customers on the delivery apps, from BotFood")} media={<Star size={19} />}
      actions={<Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={4} label={tr("Reviews")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Reviews")} value={s ? nf(s.n) : <StatSkeleton />} />
            <Stat label={tr("Average rating")} value={s ? s.avg ?? "—" : <StatSkeleton />}>{data && <p>{data.byPlatform.map((p) => `${p.platform} ${p.avg ?? "—"}`).join(" · ")}</p>}</Stat>
            <Stat label={tr("Low (3 or less)")} value={s ? nf(s.low) : <StatSkeleton />}>{s && s.n > 0 && <p>{((s.low / s.n) * 100).toFixed(1)}%</p>}</Stat>
            <Stat label={tr("Low without a ticket")} value={s ? nf(s.noTicket) : <StatSkeleton />} />
          </StatStrip>
          <WorkCard active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "reviews", label: tr("Reviews"), count: rows.length }, { key: "outlet", label: tr("Per outlet") }, { key: "topic", label: tr("Topics of low reviews") }]}
            left={<PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />}>
            <Toolbar>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet, comment, item or order")} /></div>
                {tab === "reviews" && <QuickChips value={only} onChange={setOnly} label={tr("Filter")} items={[{ key: "low", label: tr("Low (3 or less)"), count: s?.low ?? null }, { key: "noticket", label: tr("Without a ticket"), count: s?.noTicket ?? null }, { key: "all", label: tr("All with a comment") }]} />}
              </div>
              {topic && <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setTopic("")}>{topic} ×</button>}
            </Toolbar>
            {!data ? <p className="px-5 py-8 text-center text-sm text-neutral-500">…</p> : tab === "topic" ? (
              <ul className="divide-y divide-neutral-100">
                {data.topics.length === 0 && <li className="px-5 py-8 text-center text-sm text-neutral-500">{tr("No low review in this period")}</li>}
                {data.topics.map((x) => (
                  <li key={x.topic}><button type="button" onClick={() => { setTopic(x.topic); setTab("reviews"); setOnly("low"); }} className="grid w-full grid-cols-[minmax(0,14rem)_1fr_3rem] items-center gap-3 px-5 py-2.5 text-left text-sm hover:bg-neutral-50">
                    <span className="truncate text-neutral-800">{x.topic}</span>
                    <span className="h-2.5 rounded-sm bg-neutral-100"><span className="block h-2.5 rounded-sm bg-amber-500" style={{ width: `${(x.n / Math.max(1, data.topics[0].n)) * 100}%` }} /></span>
                    <span className="text-right tabular-nums">{x.n}</span></button></li>
                ))}
              </ul>
            ) : (
              <div className="overflow-x-auto">
                <table className={cx(jTable, "min-w-[900px]")}>
                  <thead><tr className={jHeadRow}>{(tab === "outlet" ? [tr("Outlet"), tr("Reviews"), tr("Average rating"), tr("Low (3 or less)")]
                    : [tr("Time"), tr("Outlet"), tr("Platform"), tr("Rating"), tr("Comment"), tr("Topic"), tr("Handled by"), tr("Complaint")]).map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(tab === "outlet" ? outs : rows).length === 0 ? <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("Nothing in this period")}</td></tr>
                      : tab === "outlet" ? outs.map((o) => (
                        <tr key={o.outlet} className="border-b border-neutral-100 hover:bg-neutral-50"><td className={cx(jTd, "font-medium text-neutral-900")}>{o.outlet}</td><td className={cx(jTd, "tabular-nums")}>{nf(o.n)}</td>
                          <td className={cx(jTd, "tabular-nums")}>{o.avg ?? "—"}</td><td className={cx(jTd, "tabular-nums", o.low > 0 && "text-red-700")}>{o.low}</td></tr>
                      )) : rows.slice(0, 400).map((r) => (
                        <tr key={r.id} className="border-b border-neutral-100 align-top hover:bg-neutral-50">
                          <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{when(r.at)}</td><td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td><td className={jTd}>{r.platform}</td>
                          <td className={jTd}><Lozenge tone={r.rating <= 2 ? "red" : r.rating === 3 ? "amber" : "green"}>{r.rating} ★</Lozenge></td>
                          <td className={cx(jTd, "max-w-[24rem]")}><span className="block text-neutral-900">{r.comment || <span className="text-neutral-400">{tr("no comment")}</span>}</span>
                            {r.item && <span className="block truncate text-[11px] text-neutral-500">{r.item}</span>}{r.orderId && <span className="block text-[11px] text-neutral-400">{r.orderId}</span>}</td>
                          <td className={cx(jTd, "text-neutral-600")}>{r.topic ?? ""}</td><td className={cx(jTd, "text-neutral-600")}>{r.member ?? "—"}</td>
                          <td className={jTd}>{r.complaintId ? <Link href="/aggregator-insight/complaints" className="text-xs font-semibold text-brand-700 hover:underline">#{r.complaintId}</Link>
                            : r.rating <= 3 ? <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => void ticket(r)}><MessageSquareText size={13} /> {tr("Make a ticket")}</Button> : null}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            <CardFooter><span className="text-xs text-neutral-500">{tr("Every low review and every review with a comment, the latest {0}. The topic is read from the words of the comment. BotFood does not give the merchant's reply.", s?.limit ?? 800)}</span></CardFooter>
          </WorkCard>
        </div>
      )}
    </Page>
  );
}

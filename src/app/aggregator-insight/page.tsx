"use client";

// Aggregator Insight → Overview (page agg.overview, 2026-11-24; redone 2026-11-25): what needs work now, the last 7 days,
// who handles the outlets today, and how fresh the data of BotFood is.

import Link from "next/link";
import { useEffect, useState } from "react";
import Drawer from "@/components/kc/Drawer";
import { AlertTriangle, CalendarDays, ChevronRight, Database, LayoutDashboard } from "lucide-react";
import { ErrorState, cx } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { JSelect, Lozenge } from "@/so/ui/Jira";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import type { Handle, Status } from "@/aggregator/shared";
import { Bars, FreshLine, useCtx } from "@/aggregator/kit";
import { ago, daysAgo, fmtPeriod, fmtStamp, nf, pct } from "@/aggregator/time";

type Brief = { from: string; to: string; reviews: { n: number; avg: number | null; low: number; noTicket: number }; topics: { topic: string; n: number }[]; complaints: { open: number; progress: number; done: number };
  voids: { n: number; noReason: number; pct: number | null; amount: number }; worst: { outlet: string; low: number; avg: number | null; n: number }[]; menu: { spread: number; missing: number } };
const SOURCE: Record<string, () => string> = { histories: () => tr("Status and stock changes"), global: () => tr("Outlets and menus"), reviews: () => tr("Reviews"), daily: () => tr("Daily report") };

export default function AggregatorOverview() {
  const ctx = useCtx();
  const [st, setSt] = useState<Status | null>(null);
  const [h, setH] = useState<Handle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  useEffect(() => { let off = false; call<Brief>("/api/aggregator/brief").then((r) => { if (!off) setBrief(r); }).catch(() => { /* the rest of the page stays */ }); return () => { off = true; }; }, []);
  const load = () => {
    setErr(null);
    call<Status>("/api/aggregator/status").then(setSt).catch((e: Error) => setErr(e.message));
    call<Handle>("/api/aggregator/handle").then(setH).catch(() => setH(null));
  };
  useEffect(load, []);
  const handled = h ? h.outlets.filter((o) => Object.values(o.slots).some((x) => x.userId)).length : null;
  const perMember = h ? Object.entries(h.outlets.reduce<Record<string, number>>((m, o) => { for (const x of Object.values(o.slots)) if (x.userId && x.name) m[x.name] = (m[x.name] ?? 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]) : [];
  const failed = st ? Object.entries(st.pulls).filter(([, p]) => p.error) : [];
  const todo: { href: string; label: string; n: number | null; sub: string }[] = [
    { href: "complaints", label: tr("Complaints not done"), n: brief ? brief.complaints.open + brief.complaints.progress : null, sub: brief ? tr("{0} not answered yet", nf(brief.complaints.open)) : "" },
    { href: "reviews", label: tr("Low reviews without a ticket"), n: brief ? brief.reviews.noTicket : null, sub: brief ? tr("of {0} low · rating {1}", nf(brief.reviews.low), nf(brief.reviews.avg, 2)) : "" },
    { href: "void", label: tr("Voids without a reason"), n: brief ? brief.voids.noReason : null, sub: brief ? tr("of {0} voids · {1} of the orders", nf(brief.voids.n), pct(brief.voids.pct, 2)) : "" },
    { href: "menu", label: tr("Menus missing at an outlet"), n: brief ? brief.menu.missing : null, sub: brief ? tr("{0} menus with different prices", nf(brief.menu.spread)) : "" },
  ];
  return (
    <Page title={tr("Aggregator Insight")} subtitle={tr("The work and reports of the Aggregator team")} media={<LayoutDashboard size={19} />}>
      <FreshLine ctx={ctx} sources={["status", "menu", "reviews"]} />
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <>
          {st && !st.configured && <Alert tone="amber">{tr("The BotFood connection is not set on the server yet.")}</Alert>}
          {failed.length > 0 && <Alert tone="red">{failed.map(([k, p]) => <span key={k} className="block">{tr("Last {0} pull failed: {1}", SOURCE[k]?.() ?? k, p.error ?? "")}</span>)}</Alert>}
          <StatStrip columns={4} label={tr("Now")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Outlets on the apps, open now")} value={st ? <>{nf(st.open)} <span className="text-sm font-normal text-neutral-500">/ {nf(st.channels)}</span></> : <StatSkeleton />}><p>{tr("outlet × platform")}</p></Stat>
            <Stat label={tr("Items out of stock")} value={st ? nf(st.outOfStock) : <StatSkeleton />}><p>{tr("long inactive ones included")}</p></Stat>
            <Stat label={tr("Outlets handled today")} value={h ? <>{nf(handled)} <span className="text-sm font-normal text-neutral-500">/ {nf(h.outlets.length)}</span></> : <StatSkeleton />} />
            <Stat label={tr("Reviews kept")} value={st ? nf(st.reviews) : <StatSkeleton />}>{st?.reviewsFrom && <p>{tr("since {0}", fmtStamp(st.reviewsFrom).split(",")[0])}</p>}</Stat>
          </StatStrip>
          <Panel title={tr("To work on")} description={tr("The last 7 days, {0}", fmtPeriod(brief?.from ?? daysAgo(6), brief?.to ?? daysAgo(0)))}>
            <div className="grid grid-cols-1 gap-px bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
              {todo.map((x) => <Link key={x.href} href={`/aggregator-insight/${x.href}`} className="group flex items-start justify-between gap-2 bg-white px-4 py-3.5 hover:bg-neutral-50 sm:px-5"><span className="min-w-0"><span className="block text-xs font-semibold text-neutral-500">{x.label}</span>
                <span className={cx("mt-1 block text-2xl font-semibold tabular-nums", x.n ? "text-neutral-900" : "text-emerald-700")}>{x.n == null ? "…" : nf(x.n)}</span><span className="mt-0.5 block text-xs text-neutral-500">{x.sub}</span></span><ChevronRight size={16} className="mt-1 shrink-0 text-neutral-300 group-hover:text-brand-700" /></Link>)}
            </div>
          </Panel>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title={tr("Topics of low reviews")} description={tr("The last 7 days")}>{brief ? <Bars rows={brief.topics.map((x) => ({ key: x.topic, label: x.topic, n: x.n }))} /> : <SkeletonList rows={5} />}</Panel>
            <Panel title={tr("Outlets with the most low reviews")} description={tr("The last 7 days")}>{brief ? <Bars rows={brief.worst.filter((x) => x.low).map((x) => ({ key: x.outlet, label: x.outlet.replace(/^Kopi Calf (To Go )?/, ""), n: x.low, sub: tr("of {0} · {1} ★", nf(x.n), nf(x.avg, 2)) }))} /> : <SkeletonList rows={5} />}</Panel>
            <Panel title={tr("Handle schedule today")} description={tr("The outlets each member of the team works on today")} actions={<Link href="/aggregator-insight/schedule" className="text-sm font-medium text-brand-700 hover:underline">{tr("Handle Schedule")}</Link>}>
              {!h ? <SkeletonList rows={4} /> : perMember.length === 0 ? (
                <Link href="/aggregator-insight/schedule" className="flex items-center gap-3 px-4 py-5 text-sm text-neutral-600 hover:bg-neutral-50 sm:px-5"><CalendarDays size={18} className="text-neutral-400" /><span className="flex-1">{tr("No outlet is assigned yet. Set the handle schedule of the team.")}</span><ChevronRight size={15} className="text-neutral-300" /></Link>
              ) : <Bars rows={[...perMember.map(([name, c]) => ({ key: name, label: name, n: c })), ...(h.outlets.length - (handled ?? 0) > 0 ? [{ key: "-", label: tr("Not handled"), n: h.outlets.length - (handled ?? 0) }] : [])]} />}
            </Panel>
            <Panel title={tr("Data freshness")} description={tr("BotFood is a signal with its own delay; the official status is the merchant account.")}>
              <dl className="divide-y divide-neutral-100 text-sm">
                {Object.keys(SOURCE).map((k) => { const at = ctx?.freshness[k as "global"] ?? null; return <Fact key={k} k={tr("Portal read: {0}", SOURCE[k]())} v={ago(at)} sub={at ? fmtStamp(at) : undefined} />; })}
                <Fact k={tr("BotFood read the platforms (median)")} v={ago(st?.syncedMedian)} sub={st?.syncedMedian ? fmtStamp(st.syncedMedian) : undefined} />
                <Fact k={tr("BotFood read the platforms (oldest)")} v={ago(st?.syncedOldest)} sub={st?.syncedOldest ? fmtStamp(st.syncedOldest) : undefined} />
                <Fact k={tr("Outlets not matched to ours")} v={st ? <button type="button" onClick={() => setMapOpen(true)} className="inline-flex items-center gap-2 hover:underline"><Lozenge tone={st.unmapped ? "amber" : "green"}>{nf(st.unmapped)}</Lozenge><span className="text-xs text-brand-700">{tr("Match outlets")}</span></button> : "—"} />
              </dl>
            </Panel>
          </div>
        </>
      )}
      {mapOpen && <MatchDrawer onClose={() => { setMapOpen(false); load(); }} />}
    </Page>
  );
}
const Alert = ({ tone, children }: { tone: "amber" | "red"; children: React.ReactNode }) => <div className={cx("flex gap-2 rounded-lg border px-4 py-3 text-sm", tone === "red" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900")}><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{children}</span></div>;
const Fact = ({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) => <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"><dt className="text-neutral-500">{k}</dt><dd className="text-right font-medium text-neutral-900">{v}{sub && <span className="block text-[11px] font-normal text-neutral-400">{sub}</span>}</dd></div>;

type MapRow = { bfBranchId: number; bfName: string; branchCode: string | null; matched: "auto" | "manual"; branchName: string | null };

/** BotFood outlet → our outlet: matched by name automatically; the ones without a single match are chosen here. */
function MatchDrawer({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<MapRow[] | null>(null);
  const [outs, setOuts] = useState<{ value: string; label: string; hint?: string }[]>([]);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => call<{ map: MapRow[]; outlets: { branch_code: string; branch_name: string }[] }>("/api/aggregator/branch-map")
    .then((r) => { setRows(r.map); setOuts(r.outlets.map((o) => ({ value: o.branch_code, label: o.branch_name, hint: o.branch_code }))); })
    .catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const save = (id: number, code: string) => call(`/api/aggregator/branch-map/${id}`, { method: "PUT", json: { branchCode: code || null } }).then(load).catch((e) => setErr(e.message));
  const shown = (rows ?? []).filter((r) => all || !r.branchCode);
  return (
    <Drawer open size="lg" title={tr("Match the BotFood outlets")} description={tr("Each BotFood outlet to our outlet, so its figures count for the right branch and member.")} onClose={onClose} icon={<Database size={18} />}>
      <div className="space-y-4">
        <label className="flex min-h-11 items-center gap-2.5 text-sm text-neutral-700 sm:min-h-0"><input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={all} onChange={(e) => setAll(e.target.checked)} /> {tr("Show the matched ones too")}</label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!rows ? <SkeletonList rows={6} /> : shown.length === 0 ? <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">{tr("Every BotFood outlet is matched.")}</p> : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {shown.map((r) => (
              <li key={r.bfBranchId} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_1.3fr] sm:items-center">
                <span className="text-sm font-medium text-neutral-900"><span className="block text-[11px] font-normal text-neutral-500">{tr("Name in BotFood")}</span>{r.bfName}{r.matched === "manual" && <span className="ml-2 text-[11px] font-normal text-neutral-400">{tr("by hand")}</span>}</span>
                <JSelect value={r.branchCode ?? ""} onChange={(v) => save(r.bfBranchId, v)} options={outs} label={tr("Our outlet")} placeholder={tr("Choose our outlet")} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}

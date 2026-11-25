"use client";

// Aggregator Insight → Opening & Closing (page agg.opening, 2026-11-24; redone 2026-11-25): per outlet, platform and day —
// opened on time or late, not opened, closed early, paused. BotFood reads the apps about every hour, so its times are
// limits: seen open at 08:51 = open at 08:51 at the latest. A POS order of the platform proves it was open by then.

import { useEffect, useState } from "react";
import { Clock, Download, Save, Store } from "lucide-react";
import Drawer from "@/components/kc/Drawer";
import { Button, ErrorState, Input, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard } from "@/so/ui/Jira";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { DataTable, FilterBar, FreshLine, OutletCell, Platform, noMembers, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { downloadSheets } from "@/aggregator/ui";
import { fmtDay, fmtPeriod, fmtSpan, nf, pct } from "@/aggregator/time";

type Status = "on_time" | "late" | "not_opened" | "waiting" | "no_hours" | "no_data";
type Row = { day: string; channelId: number; outlet: string; branchCode: string | null; platform: string; openTime: string | null; closeTime: string | null; status: Status; openedAt: string | null; closedAt: string | null;
  lateMin: number | null; earlyMin: number | null; pauseMin: number; member: string | null; source: "report" | "live"; itemsPct: number | null; /** "order": a POS order proves it was open by then */ evidence: "botfood" | "order" };
type Res = { summary: { byOrder: number; grace: number; reportFrom: string }; rows: Row[]; noHours: { outlet: string; branchCode: string | null; platforms: string[] }[] };
const STATUS: Record<Status, { label: () => string; tone: LozengeTone }> = {
  on_time: { label: () => tr("On time"), tone: "green" }, late: { label: () => tr("Late"), tone: "amber" }, not_opened: { label: () => tr("Not opened"), tone: "red" },
  waiting: { label: () => tr("Not yet"), tone: "grey" }, no_hours: { label: () => tr("No hours"), tone: "grey" }, no_data: { label: () => tr("No data"), tone: "grey" },
};
type Only = "all" | "on_time" | "late" | "not_opened" | "early" | "pause";
type Tab = "outlet" | "days" | "hours";
type Per = { key: string; outlet: string; branchCode: string | null; platform: string; days: number; on: number; late: number; lateAvg: number | null; proven: number; no: number; early: number; pause: number; rate: number; member: string | null };

export default function OpeningClosing() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("outlet");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<Only>("all");
  const [grace, setGrace] = useState("");
  const [hoursOpen, setHoursOpen] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/opening?${a.query}`).then((r) => { if (!off) { setData(r); setGrace(String(r.summary.grace)); } }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query, version]);
  const scoped = useScope(data?.rows, a.f, ctx);
  const t = q.trim().toLowerCase();
  const hit = (o: string, m?: string | null) => !t || o.toLowerCase().includes(t) || (m ?? "").toLowerCase().includes(t);
  const is = (r: Row, k: Only) => k === "all" || (k === "early" ? !!r.earlyMin : k === "pause" ? r.pauseMin > 0 : r.status === k);
  const n = (k: Only) => scoped.filter((r) => is(r, k)).length;
  const counted = scoped.filter((r) => ["on_time", "late", "not_opened"].includes(r.status));
  const rows = scoped.filter((r) => is(r, only) && hit(r.outlet, r.member));
  const per = (() => {
    const m = new Map<string, Per & { lateSum: number }>();
    for (const r of counted) {
      const k = `${r.outlet}|${r.platform}`;
      const p = m.get(k) ?? { key: k, outlet: r.outlet, branchCode: r.branchCode, platform: r.platform, days: 0, on: 0, late: 0, lateAvg: null, lateSum: 0, proven: 0, no: 0, early: 0, pause: 0, rate: 0, member: null };
      p.days++; if (r.status === "on_time") p.on++; if (r.status === "late") { p.late++; p.lateSum += r.lateMin ?? 0; if (r.evidence === "order") p.proven++; } if (r.status === "not_opened") p.no++;
      if (r.earlyMin) p.early++; p.pause += r.pauseMin; if (r.member && !(p.member ?? "").includes(r.member)) p.member = p.member ? `${p.member}, ${r.member}` : r.member;
      m.set(k, p);
    }
    return [...m.values()].map((p) => ({ ...p, rate: p.days ? (p.on / p.days) * 100 : 0, lateAvg: p.late ? p.lateSum / p.late : null }));
  })();
  const perShown = per.filter((p) => hit(p.outlet, p.member));
  const noHours = useScope(data?.noHours, a.f, ctx).filter((x) => hit(x.outlet));
  const hideMember = noMembers(scoped);
  const s = data?.summary;
  const on = counted.filter((r) => r.status === "on_time").length;
  const pauseSum = scoped.reduce((x, r) => x + r.pauseMin, 0);
  const key = `${a.query}${a.f.outlet}${a.f.group}${only}${t}${tab}`;
  const hoursText = (r: Row) => (r.openTime ? `${r.openTime} – ${r.closeTime ?? "?"}` : "—");
  const cols: Col<Row>[] = [
    { key: "day", label: tr("Date"), sort: (r) => r.day, first: "desc", className: "whitespace-nowrap text-neutral-600", render: (r) => <>{fmtDay(r.day)}{r.source === "live" && <span className="ml-1.5"><Lozenge tone="blue">{tr("Today, live")}</Lozenge></span>}</> },
    { key: "outlet", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "hours", label: tr("Opening hours"), sort: (r) => r.openTime, className: "whitespace-nowrap tabular-nums text-neutral-600", render: hoursText },
    { key: "opened", label: tr("Open at the latest"), sort: (r) => r.openedAt, className: "whitespace-nowrap", render: (r) => <span className="tabular-nums">{r.openedAt ?? (r.status === "on_time" ? tr("before opening") : "—")}<span className="block text-[11px] text-neutral-400">{r.openedAt ? (r.evidence === "order" ? tr("first POS order") : tr("seen by BotFood")) : ""}</span></span> },
    { key: "status", label: tr("Status"), sort: (r) => r.status, render: (r) => <><Lozenge tone={STATUS[r.status].tone}>{STATUS[r.status].label()}</Lozenge>{r.lateMin ? <span className="block whitespace-nowrap text-[11px] text-amber-800">{tr("at most {0}", fmtSpan(r.lateMin))}</span> : null}</> },
    { key: "early", label: tr("Closed early"), sort: (r) => r.earlyMin ?? 0, first: "desc", className: "whitespace-nowrap", render: (r) => r.earlyMin ? <span className="text-red-700">{fmtSpan(r.earlyMin)}<span className="block text-[11px] text-neutral-400">{tr("last open {0}", r.closedAt ?? "—")}</span></span> : <span className="text-neutral-300">—</span> },
    { key: "pause", label: tr("Paused"), sort: (r) => r.pauseMin, first: "desc", right: true, render: (r) => (r.pauseMin ? fmtSpan(r.pauseMin) : <span className="text-neutral-300">—</span>) },
    { key: "items", label: tr("Items active"), sort: (r) => r.itemsPct, right: true, render: (r) => pct(r.itemsPct, 0) },
    { key: "member", label: tr("Handled by"), sort: (r) => r.member, hide: hideMember, render: (r) => r.member ?? "—" },
  ];
  const perCols: Col<Per>[] = [
    { key: "outlet", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "days", label: tr("Days"), sort: (r) => r.days, first: "desc", right: true, render: (r) => nf(r.days) },
    { key: "rate", label: tr("On time, at least"), sort: (r) => r.rate, right: true, render: (r) => <span className={cx("font-semibold", r.rate >= 80 ? "text-emerald-700" : r.rate >= 50 ? "text-amber-700" : "text-red-700")}>{pct(r.rate, 0)}<span className="block text-[11px] font-normal text-neutral-400">{tr("{0} of {1} days", r.on, r.days)}</span></span> },
    { key: "late", label: tr("Late, at most"), sort: (r) => r.late, first: "desc", right: true, render: (r) => r.late ? <>{tr("{0} days", r.late)}<span className="block text-[11px] text-neutral-400">{tr("{0} proven by orders", r.proven)}</span></> : "—" },
    { key: "avg", label: tr("Average late"), sort: (r) => r.lateAvg ?? 0, first: "desc", right: true, render: (r) => (r.lateAvg ? fmtSpan(r.lateAvg) : "—") },
    { key: "no", label: tr("Not opened"), sort: (r) => r.no, first: "desc", right: true, render: (r) => r.no || "—" },
    { key: "early", label: tr("Closed early"), sort: (r) => r.early, first: "desc", right: true, render: (r) => (r.early ? tr("{0} days", r.early) : "—") },
    { key: "pause", label: tr("Paused"), sort: (r) => r.pause, first: "desc", right: true, render: (r) => (r.pause ? fmtSpan(r.pause) : "—") },
    { key: "member", label: tr("Handled by"), sort: (r) => r.member, hide: hideMember, render: (r) => r.member ?? "—" },
  ];
  const exportXlsx = async () => {
    if (!data) return;
    try {
      await downloadSheets(`Opening & Closing ${a.f.from} - ${a.f.to}`, [
        { sheet: "Summary", title: `Opening & Closing · ${fmtPeriod(a.f.from, a.f.to)}${a.f.platform ? ` · ${a.f.platform}` : ""} · WIB · ${tr("grace {0} min", data.summary.grace)}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Outlet-days counted"), counted.length], [tr("On time"), on],
          [tr("On time % (at least)"), counted.length ? Math.round((on / counted.length) * 1000) / 10 : null], [tr("Late"), n("late")], [tr("Not opened"), n("not_opened")], [tr("Closed early"), n("early")], [tr("Pause (minutes)"), pauseSum], [tr("Outlets without hours"), noHours.length]] },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Platform"), tr("Days"), tr("On time"), tr("On time %"), tr("Late"), tr("Average late (min)"), tr("Not opened"), tr("Closed early"), tr("Pause (minutes)"), tr("Handled by")],
          rows: perShown.map((p) => [p.outlet, p.platform, p.days, p.on, Math.round(p.rate * 10) / 10, p.late, p.lateAvg ? Math.round(p.lateAvg) : null, p.no, p.early, p.pause, p.member]) },
        { sheet: "Per day", header: [tr("Date"), tr("Outlet"), tr("Platform"), tr("Opening hour"), tr("Closing hour"), tr("Open at the latest"), tr("Evidence"), tr("Status"), tr("Late (min)"), tr("Last open"), tr("Closed early (min)"), tr("Pause (min)"), tr("Items active %"), tr("Handled by")],
          rows: rows.map((r) => [r.day, r.outlet, r.platform, r.openTime, r.closeTime, r.openedAt, r.evidence === "order" ? "POS" : "BotFood", STATUS[r.status].label(), r.lateMin, r.closedAt, r.earlyMin, r.pauseMin, r.itemsPct, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const saveGrace = () => call("/api/aggregator/opening/grace", { method: "PUT", json: { minutes: Number(grace) } }).then(() => { toast(tr("Saved")); setVersion((v) => v + 1); }).catch((e: Error) => toast(e.message, "error"));
  return (
    <Page title={tr("Opening & Closing")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Opening on time, closing early and pauses per outlet and platform")} media={<Store size={19} />}
      actions={<><Button variant="secondary" size="sm" onClick={() => setHoursOpen(true)}><Clock size={14} /> {tr("Outlet hours")}</Button><Button variant="secondary" size="sm" disabled={!data} onClick={() => void exportXlsx()}><Download size={14} /> {tr("Excel")}</Button></>}>
      <FreshLine ctx={ctx} sources={["status", "daily"]} />
      <FilterBar a={a} ctx={ctx} />
      {err ? <ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /> : (
        <>
          <StatStrip columns={5} label={tr("Period")} gridClassName="grid-cols-2 lg:grid-cols-5">
            <Stat label={tr("On time, at least")} value={s ? (counted.length ? pct((on / counted.length) * 100, 0) : "—") : <StatSkeleton />}>{s && <p>{tr("{0} of {1} outlet-days", nf(on), nf(counted.length))}</p>}</Stat>
            <Stat label={tr("Late, at most")} value={s ? nf(n("late")) : <StatSkeleton />}>{s && <p>{tr("{0} proven by orders", nf(scoped.filter((r) => r.status === "late" && r.evidence === "order").length))}</p>}</Stat>
            <Stat label={tr("Not opened")} value={s ? nf(n("not_opened")) : <StatSkeleton />} />
            <Stat label={tr("Closed early")} value={s ? nf(n("early")) : <StatSkeleton />} />
            <Stat label={tr("Paused in all")} value={s ? fmtSpan(pauseSum) : <StatSkeleton />}>{s && <p>{tr("{0} outlet-days", nf(n("pause")))}</p>}</Stat>
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "outlet", label: tr("Per outlet"), count: data ? per.length : null }, { key: "days", label: tr("Per day"), count: data ? scoped.length : null }, { key: "hours", label: tr("Without hours"), count: data ? noHours.length : null }]}>
            <Toolbar>
              <div className="flex flex-wrap items-center gap-2"><div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet or member")} /></div>
                {tab === "days" && <QuickChips<Only> value={only} onChange={setOnly} label={tr("Status")} items={[{ key: "all", label: tr("All") }, { key: "on_time", label: tr("On time"), dot: "bg-emerald-500", count: n("on_time") }, { key: "late", label: tr("Late"), dot: "bg-amber-400", count: n("late") },
                  { key: "not_opened", label: tr("Not opened"), dot: "bg-red-500", count: n("not_opened") }, { key: "early", label: tr("Closed early"), count: n("early") }, { key: "pause", label: tr("Paused"), count: n("pause") }]} />}
                <label className="flex items-center gap-2 whitespace-nowrap text-xs text-neutral-600 sm:ml-auto">{tr("Grace (min)")}<span className="block w-20"><Input type="number" min={0} max={180} value={grace} onChange={(e) => setGrace(e.target.value)} className="h-8" /></span>
                  <Button size="sm" variant="ghost" disabled={!grace || Number(grace) === s?.grace} onClick={() => void saveGrace()}>{tr("Save")}</Button></label></div>
            </Toolbar>
            {tab === "outlet" ? <DataTable key={tab} cols={perCols} rows={perShown} loading={!data} rowKey={(r) => r.key} resetKey={key} initial={{ key: "rate", dir: "asc" }} minWidth={940} onRow={(r) => { setQ(r.outlet); setTab("days"); setOnly("all"); }}
                note={tr("BotFood reads the apps about every hour, so late and closed early are the most it can be. An order of the platform proves the outlet was open.")} />
              : tab === "days" ? <DataTable key={tab} cols={cols} rows={rows} loading={!data} rowKey={(r) => `${r.day}${r.channelId}`} resetKey={key} initial={{ key: "day", dir: "desc" }} minWidth={1080}
                note={tr("Past days come from the daily report of BotFood, today is live. Do not judge a member on times only seen by BotFood.")} />
              : <DataTable key={tab} cols={[{ key: "o", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> }, { key: "p", label: tr("Platform"), render: (r) => <span className="flex flex-wrap gap-3">{r.platforms.map((p) => <Platform key={p} p={p} />)}</span> },
                { key: "a", label: "", right: true, render: (r) => r.branchCode ? <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setHoursOpen(true)}>{tr("Enter the hours")}</button> : <span className="text-xs text-amber-800">{tr("Match the outlet first (Overview)")}</span> }]}
                rows={noHours} loading={!data} rowKey={(r) => r.branchCode ?? r.outlet} resetKey={key} minWidth={560} empty={tr("Every outlet has its hours")} note={tr("BotFood has no opening hours for these outlets: they are left out of every figure until the hours are entered.")} />}
          </WorkCard>
        </>
      )}
      {hoursOpen && <HoursDrawer onClose={() => setHoursOpen(false)} onSaved={() => { setHoursOpen(false); setVersion((v) => v + 1); }} zone={(c) => ctx?.outlets.find((o) => o.code === c)?.zone ?? "WIB"} />}
    </Page>
  );
}

type Hour = { code: string; name: string; botfood: string | null; open: string | null; close: string | null; by: string | null };

/** The hours of the outlets BotFood has none for: entered by the team on the outlet's own clock, used at once for every day. */
function HoursDrawer({ onClose, onSaved, zone }: { onClose: () => void; onSaved: () => void; zone: (code: string) => string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Hour[] | null>(null);
  const [edit, setEdit] = useState<Record<string, { open: string; close: string }>>({});
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<{ data: Hour[] }>("/api/aggregator/hours").then((r) => setRows(r.data)).catch((e) => toast((e as Error).message, "error")); }, [toast]);
  const shown = (rows ?? []).filter((r) => (all || !r.botfood) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())));
  const val = (r: Hour) => edit[r.code] ?? { open: r.open ?? "", close: r.close ?? "" };
  const put = (list: Hour[], v: { open: string; close: string }) => setEdit((x) => ({ ...x, ...Object.fromEntries(list.map((r) => [r.code, v])) }));
  const save = async () => {
    setBusy(true);
    try { await call("/api/aggregator/hours", { method: "PUT", json: { rows: Object.entries(edit).map(([code, v]) => ({ code, open: v.open || null, close: v.close || null })) } }); toast(tr("Saved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const empty = shown.filter((r) => !val(r).open);
  const [same, setSame] = useState({ open: "07:00", close: "22:00" });
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Clock size={18} />} title={tr("Outlet hours")} description={tr("On the outlet's own clock; every day is worked out again")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!Object.keys(edit).length} onClick={() => void save()}><Save size={14} /> {tr("Save {0} outlets", Object.keys(edit).length)}</Button></>}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet")} /></div>
          <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {tr("Show those with BotFood hours too")}</label></div>
        {empty.length > 1 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-sm"><span className="text-neutral-600">{tr("The same hours for the {0} empty ones shown", empty.length)}</span>
          <span className="block w-28"><Input type="time" aria-label={tr("Opening hour")} value={same.open} onChange={(e) => setSame({ ...same, open: e.target.value })} className="h-9" /></span>–<span className="block w-28"><Input type="time" aria-label={tr("Closing hour")} value={same.close} onChange={(e) => setSame({ ...same, close: e.target.value })} className="h-9" /></span>
          <Button size="sm" variant="secondary" disabled={!same.open} onClick={() => put(empty, same)}>{tr("Fill in")}</Button></div>}
        {!rows ? <SkeletonList rows={8} /> : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {shown.map((r) => (
              <li key={r.code} className={cx("flex flex-wrap items-center gap-2 px-3 py-2 text-sm", edit[r.code] && "bg-brand-50/40")}>
                <span className="min-w-0 flex-1 basis-full sm:basis-40"><span className="block truncate font-medium text-neutral-900">{r.name}{zone(r.code) !== "WIB" && <span className="ml-1.5 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-800">{zone(r.code)}</span>}</span><span className="block text-[11px] text-neutral-500">{r.botfood ? `BotFood ${r.botfood}` : r.by ?? tr("not entered yet")}</span></span>
                <span className="block w-28"><Input type="time" value={val(r).open} aria-label={`${r.name} ${tr("Opening hour")}`} onChange={(e) => put([r], { ...val(r), open: e.target.value })} className="h-9" /></span>
                <span className="text-neutral-400">–</span>
                <span className="block w-28"><Input type="time" value={val(r).close} aria-label={`${r.name} ${tr("Closing hour")}`} onChange={(e) => put([r], { ...val(r), close: e.target.value })} className="h-9" /></span>
              </li>))}
          </ul>)}
      </div>
    </Drawer>
  );
}

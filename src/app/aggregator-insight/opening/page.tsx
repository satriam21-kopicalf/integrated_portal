"use client";

// Aggregator Insight → Opening & Closing (page agg.opening, 2026-11-24; redone 2026-11-25): per outlet, platform and day —
// opened on time or late, not opened, closed early, paused. BotFood reads the apps about every hour, so its times are
// limits: seen open at 08:51 = open at 08:51 at the latest. A POS order of the platform proves it was open by then.

import { useEffect, useRef, useState } from "react";
import { Clock, Save, Store } from "lucide-react";
import { useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { Tip } from "@/aggregator/info";
import { DataTable, FilterBar, FreshLine, OutletCell, Platform, noMembers, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { downloadSheets } from "@/aggregator/ui";
import StatusNow from "@/aggregator/StatusNow";
import { daysAgo, fmtDay, fmtPeriod, fmtSpan, fmtStamp, nf, pct } from "@/aggregator/time";
import Drawer, { Page, Stat, StatSkeleton, StatStrip, Lozenge, type LozengeTone, QuickChips, WorkCard, Button, ErrorState, cx, DateField, Facts, Group, Row as Line, TimeField, ctl } from "@/jira";

type Status = "on_time" | "late" | "not_opened" | "waiting" | "no_hours" | "no_data";
type Row = { day: string; channelId: number; outlet: string; branchCode: string | null; platform: string; openTime: string | null; closeTime: string | null; status: Status; openedAt: string | null; closedAt: string | null;
  lateMin: number | null; earlyMin: number | null; pauseMin: number; member: string | null; source: "report" | "live"; hours: string[]; /** "ok" checked, the same; "team" checked, other hours; "app" read from the merchant app; "botfood" typed into BotFood */ hoursFrom: "ok" | "team" | "app" | "botfood" | null; itemsPct: number | null; /** "order": a POS order proves it was open by then */ evidence: "botfood" | "order" };
type Res = { summary: { byOrder: number; grace: number; reportFrom: string }; rows: Row[]; noHours: { outlet: string; branchCode: string | null; platforms: string[] }[] };
const STATUS: Record<Status, { label: () => string; tone: LozengeTone }> = {
  on_time: { label: () => tr("On time"), tone: "green" }, late: { label: () => tr("Late"), tone: "amber" }, not_opened: { label: () => tr("Not opened"), tone: "red" },
  waiting: { label: () => tr("Not yet"), tone: "grey" }, no_hours: { label: () => tr("No hours"), tone: "grey" }, no_data: { label: () => tr("No data"), tone: "grey" },
};
const FROM: Record<"ok" | "team" | "app" | "botfood", () => string> = { ok: () => tr("checked by the team"), team: () => tr("corrected by the team"), app: () => tr("merchant app"), botfood: () => tr("BotFood setting") };
type Check = { code: string; branchCode: string; name: string; platform: string; app: string | null; kinds: number; from: "app" | "botfood" | null; state: "unchecked" | "ok" | "diff" | "recheck"; status: "ok" | "diff" | null; open: string | null; close: string | null; by: string | null; at: string | null; validFrom: string | null };
const STATE: Record<Check["state"], { label: () => string; tone: LozengeTone }> = { unchecked: { label: () => tr("Not checked yet"), tone: "amber" }, recheck: { label: () => tr("Check again"), tone: "red" }, ok: { label: () => tr("The same"), tone: "green" }, diff: { label: () => tr("Different"), tone: "blue" } };
type CheckOnly = "todo" | "all" | Check["state"];
type Only = "all" | "on_time" | "late" | "not_opened" | "early" | "pause";
type Tab = "now" | "outlet" | "days" | "hours";
type Per = { key: string; outlet: string; branchCode: string | null; platform: string; days: number; on: number; late: number; lateAvg: number | null; proven: number; no: number; early: number; pause: number; rate: number; member: string | null };

export default function OpeningClosing() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("now");
  const nowExcel = useRef<() => void>(() => undefined);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<Only>("all");
  const [grace, setGrace] = useState("");
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [checkOnly, setCheckOnly] = useState<CheckOnly>("todo");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!a.ready) return;
    let off = false;
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/opening?${a.query}`).then((r) => { if (!off) { setData(r); setGrace(String(r.summary.grace)); } }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [a.ready, a.query, version]);
  const put = (r: { data: Omit<Check, "branchCode">[] }) => setChecks(r.data.map((x) => ({ ...x, branchCode: x.code })));
  useEffect(() => { let off = false; call<{ data: Omit<Check, "branchCode">[] }>("/api/aggregator/hours").then((r) => { if (!off) put(r); }).catch(() => { if (!off) setChecks([]); }); return () => { off = true; }; }, []);
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
  const checkAll = useScope(checks ?? undefined, a.f, ctx).filter((x) => (!a.f.platform || x.platform === a.f.platform));
  const isCheck = (x: Check, k: CheckOnly) => k === "all" || (k === "todo" ? x.state === "unchecked" || x.state === "recheck" : x.state === k);
  const checkN = (k: CheckOnly) => checkAll.filter((x) => isCheck(x, k)).length;
  const checkRows = checkAll.filter((x) => isCheck(x, checkOnly) && hit(x.name, x.by));
  const noHours = data?.noHours ?? [];
  const hideMember = noMembers(scoped);
  const checkTodo = checkN("todo");
  const s = data?.summary;
  const on = counted.filter((r) => r.status === "on_time").length;
  const pauseSum = scoped.reduce((x, r) => x + r.pauseMin, 0);
  const key = `${a.query}${a.f.outlet}${a.f.group}${only}${t}${tab}${checkOnly}`;
  useEffect(() => { setPicked(new Set()); }, [key]);
  const saveChecks = async (rows: { code: string; platform: string; status: "ok" | "diff"; open?: string; close?: string; validFrom?: string }[]) => {
    setBusy(true);
    try { put(await call<{ data: Omit<Check, "branchCode">[] }>("/api/aggregator/hours", { method: "PUT", json: { rows } })); toast(tr("Saved")); setEditing(null); setPicked(new Set()); setVersion((v) => v + 1); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const checkCols: Col<Check>[] = [
    { key: "o", card: "title", label: tr("Outlet"), sort: (x) => x.name, render: (x) => <OutletCell name={x.name} code={x.code} ctx={ctx} /> },
    { key: "p", label: tr("Platform"), sort: (x) => x.platform, render: (x) => <Platform p={x.platform} /> },
    { key: "app", label: tr("Hours in BotFood"), sort: (x) => x.app, className: "whitespace-nowrap tabular-nums", render: (x) => <>{x.app ? x.app.split("; ").map((h) => <span key={h} className="block">{h}</span>) : "—"}<span className="block text-[11px] text-[#626F86]">{x.from === "botfood" ? tr("BotFood setting, not the app") : x.from === "app" ? tr("read from the app") : ""}{x.kinds > 1 ? ` · ${tr("{0} kinds in 14 days", x.kinds)}` : ""}</span></> },
    { key: "real", label: tr("Hours in the merchant app"), className: "whitespace-nowrap tabular-nums", render: (x) => x.status === "diff" ? <b className="font-semibold">{x.open} - {x.close}</b> : x.status === "ok" ? tr("the same") : <span className="text-[#626F86]">{tr("not checked")}</span> },
    { key: "state", card: "side", label: tr("Status"), sort: (x) => ["recheck", "unchecked", "diff", "ok"].indexOf(x.state), render: (x) => <Lozenge tone={STATE[x.state].tone}>{STATE[x.state].label()}</Lozenge> },
    { key: "by", label: tr("Checked by"), sort: (x) => x.at, first: "desc", className: "text-xs text-[#44546F]", render: (x) => x.by ? <>{x.by}<span className="block text-[11px] text-[#626F86]">{fmtStamp(x.at)}</span></> : "—" },
  ];
  const cols: Col<Row>[] = [
    { key: "day", label: tr("Date"), sort: (r) => r.day, first: "desc", className: "whitespace-nowrap text-[#44546F]", render: (r) => <>{fmtDay(r.day)}{r.source === "live" && <span className="ml-1.5"><Lozenge tone="blue">{tr("Today, live")}</Lozenge></span>}</> },
    { key: "outlet", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "hours", label: tr("Opening hours"), sort: (r) => r.openTime, className: "whitespace-nowrap tabular-nums text-[#44546F]", render: (r) => <>{r.hours.length ? r.hours.map((h) => <span key={h} className="block">{h}</span>) : "—"}{r.hoursFrom && <span className="block text-[11px] text-[#626F86]">{FROM[r.hoursFrom]()}</span>}</> },
    { key: "opened", label: tr("Open at the latest"), sort: (r) => r.openedAt, className: "whitespace-nowrap", render: (r) => <span className="tabular-nums">{r.openedAt ?? (r.status === "on_time" ? tr("before opening") : "—")}<span className="block text-[11px] text-[#626F86]">{r.openedAt ? (r.evidence === "order" ? tr("first POS order") : tr("seen by BotFood")) : ""}</span></span> },
    { key: "status", card: "side", label: tr("Status"), sort: (r) => r.status, render: (r) => <><Lozenge tone={STATUS[r.status].tone}>{STATUS[r.status].label()}</Lozenge>{r.lateMin ? <span className="block whitespace-nowrap text-[11px] text-amber-800">{tr("at most {0}", fmtSpan(r.lateMin))}</span> : null}</> },
    { key: "early", label: tr("Closed early"), sort: (r) => r.earlyMin ?? 0, first: "desc", className: "whitespace-nowrap", render: (r) => r.earlyMin ? <span className="text-red-700">{fmtSpan(r.earlyMin)}<span className="block text-[11px] text-[#626F86]">{tr("last open {0}", r.closedAt ?? "—")}</span></span> : <span className="text-[#8590A2]">—</span> },
    { key: "pause", label: tr("Paused"), sort: (r) => r.pauseMin, first: "desc", right: true, render: (r) => (r.pauseMin ? fmtSpan(r.pauseMin) : <span className="text-[#8590A2]">—</span>) },
    { key: "items", label: tr("Items active"), sort: (r) => r.itemsPct, right: true, render: (r) => pct(r.itemsPct, 0) },
    { key: "member", label: tr("Handled by"), sort: (r) => r.member, hide: hideMember, render: (r) => r.member ?? "—" },
  ];
  const perCols: Col<Per>[] = [
    { key: "outlet", card: "title", label: tr("Outlet"), sort: (r) => r.outlet, render: (r) => <OutletCell name={r.outlet} code={r.branchCode} ctx={ctx} /> },
    { key: "platform", label: tr("Platform"), sort: (r) => r.platform, render: (r) => <Platform p={r.platform} /> },
    { key: "days", label: tr("Days"), sort: (r) => r.days, first: "desc", right: true, render: (r) => nf(r.days) },
    { key: "rate", card: "side", label: tr("On time, at least"), sort: (r) => r.rate, right: true, render: (r) => <span className={cx("font-semibold", r.rate >= 80 ? "text-emerald-700" : r.rate >= 50 ? "text-amber-700" : "text-red-700")}>{pct(r.rate, 0)}<span className="block text-[11px] font-normal text-[#626F86]">{tr("{0} of {1} days", r.on, r.days)}</span></span> },
    { key: "late", label: tr("Late, at most"), sort: (r) => r.late, first: "desc", right: true, render: (r) => r.late ? <>{tr("{0} days", r.late)}<span className="block text-[11px] text-[#626F86]">{tr("{0} proven by orders", r.proven)}</span></> : "—" },
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
          [tr("On time % (at least)"), counted.length ? Math.round((on / counted.length) * 1000) / 10 : null], [tr("Late"), n("late")], [tr("Not opened"), n("not_opened")], [tr("Closed early"), n("early")], [tr("Pause (minutes)"), pauseSum], [tr("Outlets without hours"), noHours.length], [tr("Hours not checked in the merchant app"), checkTodo]] },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Platform"), tr("Days"), tr("On time"), tr("On time %"), tr("Late"), tr("Average late (min)"), tr("Not opened"), tr("Closed early"), tr("Pause (minutes)"), tr("Handled by")],
          rows: perShown.map((p) => [p.outlet, p.platform, p.days, p.on, Math.round(p.rate * 10) / 10, p.late, p.lateAvg ? Math.round(p.lateAvg) : null, p.no, p.early, p.pause, p.member]) },
        { sheet: "Per day", header: [tr("Date"), tr("Outlet"), tr("Platform"), tr("Opening hour"), tr("Closing hour"), tr("Hours from"), tr("Open at the latest"), tr("Evidence"), tr("Status"), tr("Late (min)"), tr("Last open"), tr("Closed early (min)"), tr("Pause (min)"), tr("Items active %"), tr("Handled by")],
          rows: rows.map((r) => [r.day, r.outlet, r.platform, r.openTime, r.closeTime, r.hoursFrom ? FROM[r.hoursFrom]() : null, r.openedAt, r.evidence === "order" ? "POS" : "BotFood", STATUS[r.status].label(), r.lateMin, r.closedAt, r.earlyMin, r.pauseMin, r.itemsPct, r.member]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const saveGrace = () => call("/api/aggregator/opening/grace", { method: "PUT", json: { minutes: Number(grace) } }).then(() => { toast(tr("Saved")); setVersion((v) => v + 1); }).catch((e: Error) => toast(e.message, "error"));
  const filter = (
    <FilterBar a={a} ctx={ctx} q={q} onQ={setQ} placeholder={tr("Search outlet or member")} period={tab !== "now"} excel={() => (tab === "now" ? nowExcel.current() : void exportXlsx())} excelOff={tab !== "now" && !data} more={<label className="flex w-full items-center gap-2 text-sm text-[#44546F]"><span>{tr("Grace before late (minutes)")}</span><span className="ml-auto block w-20"><input type="number" inputMode="numeric" min={0} max={180} value={grace} onChange={(e) => setGrace(e.target.value)} className={cx(ctl, "text-right tabular-nums")} /></span>
                  <Button size="sm" variant="ghost" disabled={!grace || Number(grace) === s?.grace} onClick={() => void saveGrace()}>{tr("Save")}</Button></label>}>{tab === "hours" && <QuickChips<CheckOnly> value={checkOnly} onChange={setCheckOnly} label={tr("Status")} items={[{ key: "todo", label: tr("To check"), dot: "bg-amber-400", count: checkN("todo") }, { key: "recheck", label: tr("Check again"), dot: "bg-red-500", count: checkN("recheck") }, { key: "ok", label: tr("The same"), dot: "bg-emerald-500", count: checkN("ok") }, { key: "diff", label: tr("Different"), dot: "bg-blue-500", count: checkN("diff") }, { key: "all", label: tr("All"), count: checkN("all") }]} />}
                {tab === "days" && <QuickChips<Only> value={only} onChange={setOnly} label={tr("Status")} items={[{ key: "all", label: tr("All") }, { key: "on_time", label: tr("On time"), dot: "bg-emerald-500", count: n("on_time") }, { key: "late", label: tr("Late"), dot: "bg-amber-400", count: n("late") },
                  { key: "not_opened", label: tr("Not opened"), dot: "bg-red-500", count: n("not_opened") }, { key: "early", label: tr("Closed early"), count: n("early") }, { key: "pause", label: tr("Paused"), count: n("pause") }]} />}
</FilterBar>
  );
  const card = <section className="overflow-hidden rounded-[3px] border border-[#DCDFE4] bg-white">{filter}</section>;
  return (
    <Page title={tr("Opening & Closing")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Opening on time, closing early and pauses per outlet and platform")} media={<Store size={19} />}
      actions={<><Button variant="secondary" size="sm" onClick={() => { setTab("hours"); setCheckOnly("todo"); }}><Clock size={14} /> {tr("Check the hours")}{checks && checkTodo > 0 ? ` (${nf(checkTodo)})` : ""}</Button></>}>
      <FreshLine ctx={ctx} sources={["status", "daily"]} />
      {err ? <>{card}<ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /></> : (
        <>
          {tab !== "now" && <StatStrip columns={5} label={tr("Period")} gridClassName="grid-cols-2 lg:grid-cols-5">
            <Stat label={tr("On time, at least")} info={<Tip k="onTime" />} value={s ? (counted.length ? pct((on / counted.length) * 100, 0) : "—") : <StatSkeleton />}>{s && <p>{tr("{0} of {1} outlet-days", nf(on), nf(counted.length))}</p>}</Stat>
            <Stat label={tr("Late, at most")} info={<Tip k="late" />} value={s ? nf(n("late")) : <StatSkeleton />}>{s && <p>{tr("{0} proven by orders", nf(scoped.filter((r) => r.status === "late" && r.evidence === "order").length))}</p>}</Stat>
            <Stat label={tr("Not opened")} info={<Tip k="notOpened" />} value={s ? nf(n("not_opened")) : <StatSkeleton />} />
            <Stat label={tr("Closed early")} info={<Tip k="early" />} value={s ? nf(n("early")) : <StatSkeleton />} />
            <Stat label={tr("Paused in all")} info={<Tip k="pause" />} value={s ? fmtSpan(pauseSum) : <StatSkeleton />}>{s && <p>{tr("{0} outlet-days", nf(n("pause")))}</p>}</Stat>
          </StatStrip>}
          {tab === "hours" && picked.size > 0 && (
            <section aria-label={tr("Confirm")} className="sticky top-16 z-[15] flex flex-wrap items-center gap-2 rounded-[3px] border border-[#85B8FF] bg-white p-3 shadow-lg sm:p-4">
              <p className="mr-auto text-sm font-semibold text-[#172B4D]">{tr("{0} checked in the merchant app: the same as BotFood?", nf(picked.size))}</p>
              <Button variant="secondary" onClick={() => setPicked(new Set())}>{tr("Cancel")}</Button>
              <Button loading={busy} onClick={() => void saveChecks([...picked].map((k) => { const [code, platform] = k.split("|"); return { code, platform, status: "ok" }; }))}><Save size={14} /> {tr("Yes, the same")}</Button>
            </section>)}
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "now", label: tr("Status now") }, { key: "outlet", label: tr("Per outlet"), count: data ? per.length : null }, { key: "days", label: tr("Per day"), count: data ? scoped.length : null }, { key: "hours", label: tr("Merchant app hours"), count: checks ? checkTodo : null }]}>
            {filter}
            {tab === "now" ? <StatusNow a={a} ctx={ctx} q={q} excelRef={(fn) => { nowExcel.current = fn; }} />
              : tab === "outlet" ? <DataTable key={tab} cols={perCols} rows={perShown} loading={!data} rowKey={(r) => r.key} resetKey={key} initial={{ key: "rate", dir: "asc" }} minWidth={940} onRow={(r) => { setQ(r.outlet); setTab("days"); setOnly("all"); }}
                note={tr("BotFood reads the apps about every hour, so late and closed early are the most it can be. An order of the platform proves the outlet was open.")} />
              : tab === "days" ? <DataTable key={tab} cols={cols} rows={rows} loading={!data} rowKey={(r) => `${r.day}${r.channelId}`} resetKey={key} initial={{ key: "day", dir: "desc" }} minWidth={1080}
                note={tr("Past days come from the daily report of BotFood, today is live. Do not judge a member on times only seen by BotFood.")} />
              : <DataTable key={tab} cols={checkCols} rows={checkRows} loading={!checks} rowKey={(x) => `${x.code}|${x.platform}`} resetKey={key} initial={{ key: "state", dir: "asc" }} minWidth={900} onRow={setEditing} empty={tr("Every outlet is checked")}
                select={{ picked, onChange: setPicked, label: (x) => `${x.name} ${x.platform}` }} note={tr("The hours of the merchant app decide what is late. Open the merchant app, compare, and confirm or correct. The times are on the outlet's own clock. Corrected hours hold until the next check.")} />}
          </WorkCard>
        </>
      )}
      {editing && <CheckDrawer key={`${editing.code}${editing.platform}`} row={editing} busy={busy} zone={ctx?.outlets.find((o) => o.code === editing.code)?.zone ?? "WIB"} onClose={() => setEditing(null)} onSave={(v) => void saveChecks([{ code: editing.code, platform: editing.platform, ...v }])} />}
    </Page>
  );
}

/** One outlet and platform against the merchant app: the same, or the hours the app really shows from a date on. */
function CheckDrawer({ row, busy, zone, onClose, onSave }: { row: Check; busy: boolean; zone: string; onClose: () => void; onSave: (v: { status: "ok" | "diff"; open?: string; close?: string; validFrom?: string }) => void }) {
  const [status, setStatus] = useState<"ok" | "diff">(row.status ?? (row.app ? "ok" : "diff"));
  const [open, setOpen] = useState(row.open ?? row.app?.slice(0, 5) ?? "");
  const [close, setClose] = useState(row.close ?? row.app?.slice(-5) ?? "");
  const [from, setFrom] = useState(daysAgo(0));
  const bad = status === "diff" && !(open && close && open < close);
  return (
    <Drawer open onClose={onClose} icon={<Clock size={18} />} title={tr("Check the merchant app")} description={tr("Open the merchant app of this outlet and compare its opening hours")}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={bad} onClick={() => onSave(status === "ok" ? { status } : { status, open, close, validFrom: from })}><Save size={14} /> {tr("Save")}</Button></>}>
      <Group title={tr("In BotFood now")}>
        <Facts rows={[[tr("Outlet"), row.name], [tr("Platform"), <Platform key="p" p={row.platform} />], [tr("Hours in BotFood"), row.app ?? "—"], [tr("Where from"), row.from === "botfood" ? tr("BotFood setting, not the app") : row.from === "app" ? tr("read from the app") : "—"], [tr("Clock"), zone],
          ...(row.by ? [[tr("Last check"), `${row.by} · ${fmtStamp(row.at)}`] as [string, string]] : [])]} />
        {row.state === "recheck" && <p className="rounded-[3px] bg-red-50 px-3 py-2 text-sm text-red-800">{tr("The hours in BotFood have changed since the last check.")}</p>}
      </Group>
      <Group title={tr("In the merchant app")}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tr("In the merchant app")}>{(["ok", "diff"] as const).map((x) => <button key={x} type="button" role="radio" aria-checked={status === x} disabled={x === "ok" && !row.app} onClick={() => setStatus(x)} className={cx("h-11 rounded-[3px] border text-sm font-medium disabled:opacity-40 sm:h-10", status === x ? "border-[#0C66E4] bg-[#0C66E4] text-white" : "border-[#DCDFE4] text-[#44546F] hover:bg-[#F7F8F9]")}>{x === "ok" ? tr("The same") : tr("Different")}</button>)}</div>
        {status === "diff" && <>
          <div className="grid grid-cols-2 gap-2"><Line label={tr("Opening hour")} required><TimeField label={tr("Opening hour")} prefix={tr("Opens at")} value={open} onChange={setOpen} /></Line><Line label={tr("Closing hour")} required><TimeField label={tr("Closing hour")} prefix={tr("Closes at")} value={close} onChange={setClose} /></Line></div>
          <Line label={tr("Holds from")} required hint={tr("The days from this date are worked out again")} error={open && close && open >= close ? tr("The closing hour must be after the opening hour") : null}><DateField label={tr("Holds from")} value={from} max={daysAgo(0)} onChange={setFrom} /></Line>
        </>}
      </Group>
    </Drawer>
  );
}

"use client";

// Aggregator Insight → Opening & Closing (page agg.opening, 2026-11-24): per outlet, platform and day — opened on time
// or late, not opened, closed early, paused — with the member of the team handling the outlet that day. Past days come
// from BotFood's own daily report, today is worked out live from its change events. "According to BotFood": its times
// are when it saw the change, so a grace period applies (set here).

import { useEffect, useMemo, useState } from "react";
import { Download, Store } from "lucide-react";
import { Button, ErrorState, Input, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { CardFooter, Lozenge, type LozengeTone, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { PeriodBar, daysAgo, downloadSheets, hours } from "@/aggregator/ui";

type Row = {
  day: string; outlet: string; branchCode: string | null; platform: string; openTime: string | null; closeTime: string | null;
  status: "on_time" | "late" | "not_opened" | "waiting" | "no_hours" | "no_data"; openedAt: string | null;
  lateMin: number | null; earlyMin: number | null; pauseMin: number; member: string | null; source: "report" | "live"; itemsPct: number | null; /** "order": the first POS order of the platform proves it was open by then */ evidence: "botfood" | "order";
};
type Res = { summary: { byOrder: number; grace: number; counted: number; onTime: number; late: number; notOpened: number; earlyClose: number; pauseMin: number; noHours: number; reportFrom: string }; rows: Row[] };

const STATUS: Record<Row["status"], { label: () => string; tone: LozengeTone }> = {
  on_time: { label: () => tr("On time"), tone: "green" }, late: { label: () => tr("Late"), tone: "amber" },
  not_opened: { label: () => tr("Not opened"), tone: "red" }, waiting: { label: () => tr("Not yet"), tone: "grey" },
  no_hours: { label: () => tr("No hours"), tone: "grey" }, no_data: { label: () => tr("No data"), tone: "grey" },
};
type Only = "all" | "late" | "not_opened" | "early" | "pause";

export default function OpeningClosing() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [platform, setPlatform] = useState("");
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<Only>("all");
  const [grace, setGrace] = useState("");
  const load = () => {
    setData(null); setErr(null);
    call<Res>(`/api/aggregator/opening?dateFrom=${from}&dateTo=${to}${platform ? `&platform=${platform}` : ""}`)
      .then((r) => { setData(r); setGrace(String(r.summary.grace)); }).catch((e) => setErr(e.message));
  };
  useEffect(load, [from, to, platform]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => (only === "all" || (only === "late" && r.status === "late") || (only === "not_opened" && r.status === "not_opened")
      || (only === "early" && !!r.earlyMin) || (only === "pause" && r.pauseMin > 0))
      && (!t || r.outlet.toLowerCase().includes(t) || (r.member ?? "").toLowerCase().includes(t)))
      .sort((a, b) => b.day.localeCompare(a.day) || a.outlet.localeCompare(b.outlet) || a.platform.localeCompare(b.platform));
  }, [data, q, only]);
  const s = data?.summary;
  const pct = s && s.counted ? Math.round((s.onTime / s.counted) * 100) : null;

  const exportXlsx = async () => {
    if (!data) return;
    const per = new Map<string, { days: number; on: number; late: number; no: number; early: number; pause: number; member: string }>();
    for (const r of data.rows) {
      if (!["on_time", "late", "not_opened"].includes(r.status)) continue;
      const k = `${r.outlet}|${r.platform}`;
      const p = per.get(k) ?? { days: 0, on: 0, late: 0, no: 0, early: 0, pause: 0, member: "" };
      p.days++; if (r.status === "on_time") p.on++; if (r.status === "late") p.late++; if (r.status === "not_opened") p.no++;
      if (r.earlyMin) p.early++; p.pause += r.pauseMin; if (r.member && !p.member.includes(r.member)) p.member = p.member ? `${p.member}, ${r.member}` : r.member;
      per.set(k, p);
    }
    const t = data.summary;
    try {
      await downloadSheets(`Opening & Closing ${from} - ${to}`, [
        { sheet: "Summary", title: `Opening & Closing ${from} – ${to}${platform ? ` · ${platform}` : ""} (menurut BotFood, toleransi ${t.grace} menit)`,
          header: [tr("Measure"), tr("Value")], rows: [
            [tr("Outlet-days counted"), t.counted], [tr("On time"), t.onTime], [tr("On time % (at least)"), t.counted ? Math.round((t.onTime / t.counted) * 1000) / 10 : null],
            [tr("Late"), t.late], [tr("Not opened"), t.notOpened], [tr("Closed early"), t.earlyClose], [tr("Pause (minutes)"), t.pauseMin],
          ] },
        { sheet: "Per outlet", header: [tr("Outlet"), tr("Platform"), tr("Days"), tr("On time"), tr("On time %"), tr("Late"), tr("Not opened"), tr("Closed early"), tr("Pause (minutes)"), tr("Handled by")],
          rows: [...per.entries()].sort().map(([k, p]) => [...k.split("|"), p.days, p.on, p.days ? Math.round((p.on / p.days) * 1000) / 10 : null, p.late, p.no, p.early, p.pause, p.member]) },
        { sheet: "Data", header: [tr("Date"), tr("Outlet"), tr("Platform"), tr("Opening hour"), tr("Closing hour"), tr("Opened at"), tr("Status"), tr("Late (min)"), tr("Closed early (min)"), tr("Pause (min)"), tr("Items available %"), tr("Handled by"), tr("Source"), tr("Evidence")],
          rows: data.rows.map((r) => [r.day, r.outlet, r.platform, r.openTime, r.closeTime, r.openedAt, STATUS[r.status].label(), r.lateMin, r.earlyMin, r.pauseMin, r.itemsPct, r.member, r.source === "report" ? "BotFood report" : "Live", r.evidence === "order" ? "POS order" : "BotFood"]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const saveGrace = () => call("/api/aggregator/opening/grace", { method: "PUT", json: { minutes: Number(grace) } }).then(() => { toast(tr("Saved")); load(); }).catch((e) => toast(e.message, "error"));

  return (
    <Page title={tr("Opening & Closing")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Opening on time, closing early and pauses per outlet and platform, according to BotFood")} media={<Store size={19} />}
      actions={<Button variant="secondary" size="sm" disabled={!data} onClick={exportXlsx}><Download size={14} /> {tr("Excel")}</Button>}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <div className="space-y-4">
          <StatStrip columns={5} label={tr("Period")} gridClassName="grid-cols-2 lg:grid-cols-5">
            <Stat label={tr("On time, at least")} value={s ? `≥ ${pct ?? "—"}%` : <StatSkeleton />} />
            <Stat label={tr("Late, at most")} value={s ? s.late : <StatSkeleton />} />
            <Stat label={tr("Not opened")} value={s ? s.notOpened : <StatSkeleton />} />
            <Stat label={tr("Closed early")} value={s ? s.earlyClose : <StatSkeleton />} />
            <Stat label={tr("Pauses")} value={s ? hours(s.pauseMin) : <StatSkeleton />} />
          </StatStrip>
          {s && <p className="text-xs text-neutral-600">{tr("BotFood sees an opening late, so a late row is an upper bound. A POS order of the platform before that time proves the outlet was open: {0} outlet-days became on time this way. Do not judge a member of the team on late rows marked BotFood only.", s.byOrder)}</p>}
          <WorkCard tabs={[{ key: "list", label: tr("Outlet-days"), count: data?.rows.length ?? null }]} active="list" onTab={() => {}}
            left={<PeriodBar from={from} to={to} onFrom={setFrom} onTo={setTo} platform={platform} onPlatform={setPlatform} />}>
            <Toolbar>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet or member")} /></div>
                <QuickChips value={only} onChange={setOnly} label={tr("Filter")} items={[
                  { key: "all", label: tr("All") }, { key: "late", label: tr("Late"), count: s?.late ?? null },
                  { key: "not_opened", label: tr("Not opened"), count: s?.notOpened ?? null }, { key: "early", label: tr("Closed early"), count: s?.earlyClose ?? null },
                  { key: "pause", label: tr("Paused") },
                ]} />
              </div>
              <label className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap text-xs text-neutral-600">{tr("Grace (min)")}
                <Input type="number" min={0} max={180} value={grace} onChange={(e) => setGrace(e.target.value)} className="h-8 !w-20" />
                <Button size="sm" variant="ghost" disabled={!grace || Number(grace) === s?.grace} onClick={saveGrace}>{tr("Save")}</Button></label>
            </Toolbar>
            <div className="overflow-x-auto">
              <table className={jTable}>
                <thead><tr className={jHeadRow}>
                  {[tr("Date"), tr("Outlet"), tr("Platform"), tr("Hours"), tr("Opened"), tr("Status"), tr("Closed early"), tr("Pause"), tr("Items"), tr("Handled by")].map((h) => <th key={h} className={jTh}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {!data ? <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-neutral-500">…</td></tr>
                    : rows.length === 0 ? <tr><td colSpan={10} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("Nothing in this period")}</td></tr>
                    : rows.slice(0, 500).map((r) => (
                      <tr key={`${r.day}${r.outlet}${r.platform}`} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{r.day.slice(8)}/{r.day.slice(5, 7)}{r.source === "live" && <span className="ml-1 text-[10px] text-brand-600">{tr("live")}</span>}</td>
                        <td className={cx(jTd, "font-medium text-neutral-900")}>{r.outlet}</td>
                        <td className={jTd}>{r.platform}</td>
                        <td className={cx(jTd, "whitespace-nowrap text-neutral-600")}>{r.openTime ? `${r.openTime}–${r.closeTime ?? ""}` : "—"}</td>
                        <td className={jTd}>{r.openedAt ?? (r.status === "on_time" ? tr("before") : "—")}</td>
                        <td className={jTd}><Lozenge tone={STATUS[r.status].tone}>{STATUS[r.status].label()}{r.lateMin ? ` ≤ ${r.lateMin}m` : ""}</Lozenge>{r.evidence === "order" ? <span className="ml-1.5 text-[10px] text-emerald-700">{tr("POS order")}</span> : r.status === "late" ? <span className="ml-1.5 text-[10px] text-neutral-400">{tr("BotFood only")}</span> : null}</td>
                        <td className={jTd}>{r.earlyMin ? <span className="text-red-700">{hours(r.earlyMin)}</span> : ""}</td>
                        <td className={jTd}>{r.pauseMin ? hours(r.pauseMin) : ""}</td>
                        <td className={cx(jTd, "text-neutral-600")}>{r.itemsPct != null ? `${Math.round(r.itemsPct)}%` : ""}</td>
                        <td className={cx(jTd, "text-neutral-600")}>{r.member ?? <span className="text-neutral-300">—</span>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <CardFooter><span className="text-xs text-neutral-500">
              {tr("{0} of {1} rows", Math.min(rows.length, 500), rows.length)} · {tr("Times as BotFood saw them; grace {0} min. Past days: BotFood daily report (from {1}); today: live.", s?.grace ?? 15, s?.reportFrom ?? "—")}
            </span></CardFooter>
          </WorkCard>
        </div>
      )}
    </Page>
  );
}

"use client";

// Monitoring → Damaged Equipment → Overview: the analysis of every request sent in the period (GET /api/de/overview):
// KPIs, the weekly trend (in vs done), where the requests stand, the time per stage, urgency vs target, category groups
// and categories, internal vs vendor and the technicians, the outlets with most requests, repeated damage and the
// reasons of reject / on hold.

import { AlertTriangle, BarChart3, CheckCircle2, Clock, Repeat, Wallet, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, cx, Empty, ErrorState, fmtNumber, Panel } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { Segmented } from "@/so/ui/Simple";
import { dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type Status, type Urgency, STATUS_LABEL, URGENCY_LABEL, fmtHours, fmtRp } from "./de";

type Row = { name: string; count: number; open: number; cost: number; avgHours: number | null };
type Data = {
  period: { from: string; to: string };
  kpi: { total: number; open: number; done: number; rejected: number; onHold: number; avgHours: number | null; onTimePct: number | null; overdue: number;
    cost: number; targetAdjusted: number; duplicates: number; repair: number; procurement: number };
  trend: { week: string; in: number; done: number }[];
  status: { status: Status; label: string; count: number }[];
  stages: { status: Status; label: string; avgHours: number | null }[];
  groups: Row[]; categories: Row[];
  branches: { code: string; name: string; count: number; open: number; cost: number }[];
  repeats: { branchCode: string; branchName: string; category: string; item: string; count: number; numbers: string[] }[];
  urgency: { urgency: Urgency; count: number; done: number; onTime: number; pct: number | null; avgHours: number | null }[];
  modes: Record<"INTERNAL" | "VENDOR", { jobs: number; done: number; avgHours: number | null; cost: number }>;
  technicians: { name: string; kind: "INTERNAL" | "VENDOR"; jobs: number; done: number; avgHours: number | null }[];
  reasons: { number: string; status: Status; note: string; at: string }[];
};
const DOT: Partial<Record<Status, string>> = { PENDING: "bg-slate-400", VALIDATION: "bg-sky-500", REVIEW: "bg-violet-500", ON_HOLD: "bg-amber-500",
  ACCEPTED: "bg-blue-500", IN_PROGRESS: "bg-blue-700", HANDOVER: "bg-cyan-500", DONE: "bg-emerald-500", REJECTED: "bg-red-500" };
type Range = "30" | "90" | "180" | "365";

export default function DeOverview({ bgroups }: { bgroups: { id: string; code: string }[] }) {
  const [range, setRange] = useState<Range>("90");
  const [group, setGroup] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setD(await call<Data>(`/api/de/overview?dateFrom=${wibDay(-(Number(range) - 1))}&dateTo=${wibDay(0)}${group ? `&group=${encodeURIComponent(group)}` : ""}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [range, group]);
  useEffect(() => { void load(); }, [load]);
  const k = d?.kpi;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">{d ? tr("Requests sent {0} – {1}", dmy(d.period.from), dmy(d.period.to)) : tr("Loading…")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {bgroups.length > 0 && (
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={tr("Branch group")}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
              <option value="">{tr("All branch groups")}</option>
              {bgroups.map((g) => <option key={g.id} value={g.id}>{g.code}</option>)}
            </select>
          )}
          <Segmented label={tr("Period")} value={range} onChange={setRange}
            options={[{ value: "30", label: tr("30 days") }, { value: "90", label: tr("90 days") }, { value: "180", label: tr("6 months") }, { value: "365", label: tr("1 year") }]} />
        </div>
      </div>

      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : (
        <>
          <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
            <Stat label={tr("Requests")} emphasis icon={<BarChart3 size={13} />} value={k ? fmtNumber(k.total) : <StatSkeleton />}>
              {k && <p>{tr("{0} maintenance · {1} procurement", fmtNumber(k.repair), fmtNumber(k.procurement))}</p>}
            </Stat>
            <Stat label={tr("Done")} icon={<CheckCircle2 size={13} />} value={k ? fmtNumber(k.done) : <StatSkeleton />}>
              {k && <p>{tr("average {0} · {1} still open", fmtHours(k.avgHours), fmtNumber(k.open))}</p>}
            </Stat>
            <Stat label={tr("On target")} icon={<Clock size={13} />} value={k ? (k.onTimePct === null ? "—" : `${k.onTimePct}%`) : <StatSkeleton />}>
              {k && <p>{tr("of the done requests · {0} open past target · {1} targets adjusted", fmtNumber(k.overdue), fmtNumber(k.targetAdjusted))}</p>}
            </Stat>
            <Stat label={tr("Cost")} icon={<Wallet size={13} />} value={k ? fmtRp(k.cost) : <StatSkeleton />}>
              {k && <p>{tr("actual, else estimate · {0} rejected ({1} duplicate)", fmtNumber(k.rejected), fmtNumber(k.duplicates))}</p>}
            </Stat>
          </StatStrip>

          {d && d.kpi.total === 0 ? (
            <Panel><Empty icon={<BarChart3 size={28} />} title={tr("No request in the period")}>{tr("The analysis appears as soon as requests are sent.")}</Empty></Panel>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Panel title={tr("Weekly trend")} description={tr("Requests in vs done per week")}
                  actions={<span className="flex items-center gap-3 text-[11px] text-slate-500"><Legend color="bg-blue-600" label={tr("In")} /><Legend color="bg-emerald-500" label="Done" /></span>}>
                  {!d ? <Skel /> : <Trend rows={d.trend} />}
                </Panel>
                <Panel title={tr("Where the requests stand")} description={tr("Current status of the requests of the period")}>
                  {!d ? <Skel /> : <StatusMix rows={d.status} total={d.kpi.total} />}
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={tr("Average time per stage")} description={tr("Where the requests wait longest")}>
                  {!d ? <Skel /> : <Bars rows={d.stages.map((s) => ({ key: s.status, label: s.label, value: s.avgHours ?? 0, text: fmtHours(s.avgHours), bar: DOT[s.status] ?? "bg-blue-600" }))} />}
                </Panel>
                <Panel title={tr("Urgency vs target")} description={tr("Done on target per urgency")}>
                  {!d ? <Skel /> : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-2">{tr("Urgency")}</th><th className="px-2 py-2 text-right">{tr("Requests")}</th><th className="px-2 py-2 text-right">Done</th><th className="px-2 py-2">{tr("On target")}</th><th className="px-4 py-2 text-right">{tr("Average")}</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {d.urgency.map((u) => (
                          <tr key={u.urgency}>
                            <td className="px-4 py-2 text-slate-800">{URGENCY_LABEL[u.urgency]()}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{u.count}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{u.done}</td>
                            <td className="px-2 py-2"><Pct pct={u.pct} /></td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-600">{fmtHours(u.avgHours)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={tr("Category groups")} description={tr("Requests with an item of the group, average time and cost")}>
                  {!d ? <Skel /> : <RowTable rows={d.groups} />}
                </Panel>
                <Panel title={tr("Top categories")} description={tr("The 10 categories asked most")}>
                  {!d ? <Skel /> : <RowTable rows={d.categories} />}
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Panel title={tr("Internal vs vendor")} description={tr("Jobs, average time and cost per kind of technician")}>
                  {!d ? <Skel /> : (
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                      {(["INTERNAL", "VENDOR"] as const).map((m) => (
                        <div key={m} className="space-y-1 px-4 py-4">
                          <Badge tone={m === "VENDOR" ? "amber" : "blue"}>{m === "VENDOR" ? tr("Vendor") : tr("Internal")}</Badge>
                          <p className="text-2xl font-semibold tabular-nums text-slate-900">{d.modes[m].jobs}<span className="ml-1 text-xs font-normal text-slate-400">{tr("jobs")}</span></p>
                          <p className="text-xs text-slate-500">{tr("{0} done · average {1}", d.modes[m].done, fmtHours(d.modes[m].avgHours))}</p>
                          <p className="text-sm font-semibold tabular-nums text-slate-800">{fmtRp(d.modes[m].cost)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title={tr("Technicians")} description={tr("Jobs and average time per technician")}>
                  {!d ? <Skel /> : d.technicians.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-400">—</p> : (
                    <ul className="divide-y divide-slate-100">
                      {d.technicians.map((t) => (
                        <li key={t.name} className="flex items-center gap-3 px-4 py-2 text-sm">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{t.name.slice(0, 1).toUpperCase()}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900">{t.name}</span>
                            <span className="text-[11px] text-slate-500">{t.kind === "VENDOR" ? tr("Vendor") : tr("Internal")}</span></span>
                          <span className="text-right text-xs"><span className="block font-semibold tabular-nums text-slate-900">{tr("{0} jobs", t.jobs)}</span>
                            <span className="text-slate-400">{tr("{0} done · {1}", t.done, fmtHours(t.avgHours))}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title={tr("Outlets with most requests")} description={tr("Top 10 in the period")}>
                  {!d ? <Skel /> : (
                    <Bars rows={d.branches.map((b) => ({ key: b.code, label: b.name, value: b.count, text: `${b.count}${b.open ? ` · ${tr("{0} open", b.open)}` : ""}`, bar: "bg-blue-600" }))} />
                  )}
                </Panel>
                <Panel title={tr("Repeated damage")} description={tr("The same item of an outlet asked again within 90 days")}>
                  {!d ? <Skel /> : d.repeats.length === 0 ? <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-slate-400"><CheckCircle2 size={15} /> {tr("No repeated damage")}</p> : (
                    <ul className="divide-y divide-slate-100">
                      {d.repeats.map((x) => (
                        <li key={`${x.branchCode}-${x.category}-${x.item}`} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                          <Repeat size={15} className="mt-0.5 flex-shrink-0 text-amber-600" />
                          <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{x.item} <span className="font-normal text-slate-500">· {x.category}</span></span>
                            <span className="block truncate text-[11px] text-slate-500">{x.branchName} · {x.numbers.join(", ")}</span></span>
                          <Badge tone="amber">{tr("{0}×", x.count)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <Panel title={tr("Reasons of reject / on hold")} description={tr("The latest notes of the team")}>
                {!d ? <Skel /> : d.reasons.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-400">—</p> : (
                  <ul className="divide-y divide-slate-100">
                    {d.reasons.map((x, i) => (
                      <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                        {x.status === "REJECTED" ? <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-red-500" /> : <Wrench size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />}
                        <span className="min-w-0 flex-1"><span className="block text-slate-800">{x.note}</span>
                          <span className="text-[11px] text-slate-500">{x.number} · {STATUS_LABEL[x.status]()} · {wibDateTime(x.at)}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}

const Skel = () => <div className="skeleton m-4 h-40 rounded-lg" />;
const Legend = ({ color, label }: { color: string; label: string }) => <span className="inline-flex items-center gap-1.5"><span className={cx("h-2.5 w-2.5 rounded-sm", color)} />{label}</span>;

function Pct({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-500")} style={{ width: `${pct}%` }} /></span>
      <span className="text-xs font-semibold tabular-nums text-slate-800">{pct}%</span>
    </span>
  );
}

function Bars({ rows }: { rows: { key: string; label: string; value: number; text: string; bar: string }[] }) {
  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-slate-400">—</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2 px-4 py-4">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs" title={`${r.label}: ${r.text}`}>
          <span className="truncate text-slate-700">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded bg-slate-100"><span className={cx("block h-full rounded", r.bar)} style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

function RowTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-slate-400">—</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-2">{tr("Name")}</th><th className="px-2 py-2">{tr("Requests")}</th><th className="px-2 py-2 text-right">{tr("Average")}</th><th className="px-4 py-2 text-right">{tr("Cost")}</th></tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.name}>
            <td className="max-w-[10rem] truncate px-4 py-2 text-slate-800">{r.name}</td>
            <td className="px-2 py-2">
              <span className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded bg-slate-100"><span className="block h-full rounded bg-blue-600" style={{ width: `${(r.count / max) * 100}%` }} /></span>
                <span className="text-xs font-semibold tabular-nums">{r.count}</span>{r.open > 0 && <span className="text-[11px] text-slate-400">{tr("{0} open", r.open)}</span>}</span>
            </td>
            <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600">{fmtHours(r.avgHours)}</td>
            <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-800">{r.cost ? fmtRp(r.cost) : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusMix({ rows, total }: { rows: Data["status"]; total: number }) {
  const shown = rows.filter((r) => r.count > 0);
  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-slate-100">
        {shown.map((r) => <span key={r.status} className={DOT[r.status]} style={{ width: `${(r.count / Math.max(1, total)) * 100}%` }} title={`${STATUS_LABEL[r.status]()}: ${r.count}`} />)}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {rows.map((r) => (
          <li key={r.status} className={cx("flex items-center gap-2", !r.count && "opacity-40")}>
            <span className={cx("h-2.5 w-2.5 rounded-full", DOT[r.status])} /><span className="flex-1 text-slate-700">{STATUS_LABEL[r.status]()}</span>
            <span className="font-semibold tabular-nums text-slate-900">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Trend({ rows }: { rows: Data["trend"] }) {
  if (!rows.length) return <p className="px-4 py-6 text-center text-sm text-slate-400">—</p>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.in, r.done)));
  return (
    <div className="px-4 py-4">
      <div className="flex h-40 items-end gap-2 overflow-x-auto border-b border-slate-200">
        {rows.map((r) => (
          <div key={r.week} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1" title={`${dmy(r.week)}: ${r.in} / ${r.done}`}>
            <div className="flex h-32 w-full items-end justify-center gap-0.5">
              <span className="w-2.5 rounded-t bg-blue-600" style={{ height: `${(r.in / max) * 100}%` }} />
              <span className="w-2.5 rounded-t bg-emerald-500" style={{ height: `${(r.done / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 overflow-x-auto">
        {rows.map((r) => <span key={r.week} className="min-w-[2.25rem] flex-1 text-center text-[10px] tabular-nums text-slate-400">{dmy(r.week).slice(0, 5)}</span>)}
      </div>
    </div>
  );
}

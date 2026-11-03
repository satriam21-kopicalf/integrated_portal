"use client";

// Monitoring → Overview (page mon.overview; integrated_portal_be app/monitoring_overview.py, 2026-11-03): the assessment
// of every PIC from their daily forms — PIC Check In days, the average score of their own Monitoring Product and
// Monitoring Outlet visits — set against the SWAT audits (Form WW-WR): how far their ratings agree with the team, the
// items they passed and the team found UNDER, the action plans still open at their outlets. Then the same per outlet.
// The net sales of the outlets are to join the assessment later.

import { AlertTriangle, CalendarDays, ClipboardCheck, Layers, MapPinCheck, Package, Scale, ShieldCheck, Store, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { scoreTone } from "@/so/features/visit/visit";
import { tr } from "@/lib/i18n";

type Pic = { id: string; name: string; branches: number; checkins: number; checkinDays: number; outside: number; productVisits: number; productScore: number | null;
  outletVisits: number; outletScore: number | null; under: number; swatAudits: number; conformity: number | null; overrated: number; openActions: number };
type Outlet = { code: string; name: string; groupCode: string | null; checkins: number; pics: number; productVisits: number; productScore: number | null; outletVisits: number;
  outletScore: number | null; under: number; swatAudits: number; swatScore: number | null; openActions: number; visited: boolean };
type Result = { period: { from: string; to: string }; summary: { outlets: number; visited: number; checkins: number; productScore: number | null; outletScore: number | null; pics: number; under: number };
  swat: { audits: number; conformity: number | null; overrated: number; openActions: number }; picAssessment: Pic[]; branches: Outlet[];
  groupOptions: { id: string; code: string; name: string }[] };
type F = { period: Period; group: string };
const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, group: "" });

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

export default function MonitoringOverviewPage() {
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"pics" | "outlets">("pics");
  useEffect(() => {
    let live = true;
    setRes(null);
    const qs = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.group ? { group: f.group } : {}) });
    call<Result>(`/api/monitoring/overview?${qs}`).then((r) => { if (live) { setRes(r); setError(null); } }).catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [f]);
  const s = res?.summary;
  const w = res?.swat;
  const pics = useMemo(() => (res?.picAssessment ?? []).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const outlets = useMemo(() => (res?.branches ?? []).filter((o) => !q || `${o.name} ${o.code}`.toLowerCase().includes(q.toLowerCase())), [res, q]);
  const pagedPics = usePaged(pics, q + view + JSON.stringify(f), 25);
  const pagedOutlets = usePaged(outlets, q + view + JSON.stringify(f), 25);
  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(periodLabel(f.period, def.period) ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.group ? [{ key: "g", label: `${tr("Group")} ${res?.groupOptions.find((g) => g.id === f.group)?.code ?? ""}`, onRemove: () => setF({ ...f, group: "" }) }] : []),
  ];
  return (
    <Page title={tr("Monitoring overview")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("the assessment of every PIC: daily forms against the SWAT audits")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Outlets visited")} emphasis icon={<MapPinCheck size={13} />} value={s ? `${fmtNumber(s.visited)}/${fmtNumber(s.outlets)}` : <StatSkeleton />}>
            {s && <p>{tr("{0} check-ins · {1} PICs", fmtNumber(s.checkins), fmtNumber(s.pics))}</p>}
          </Stat>
          <Stat label={tr("PIC scores")} icon={<Package size={13} />} value={s ? <span><span className={scoreTone(s.productScore)}>{pct(s.productScore)}</span> <span className="text-slate-300">·</span> <span className={scoreTone(s.outletScore)}>{pct(s.outletScore)}</span></span> : <StatSkeleton />}>
            <p>{tr("Product · Outlet, own visits")}</p>
          </Stat>
          <Stat label={tr("Agreement with SWAT")} icon={<Scale size={13} />} value={w ? <span className={scoreTone(w.conformity)}>{pct(w.conformity)}</span> : <StatSkeleton />}>
            {w && <p>{tr("{0} audits · {1} overrated", fmtNumber(w.audits), fmtNumber(w.overrated))}</p>}
          </Stat>
          <Stat label={tr("Open action plans")} icon={<ClipboardCheck size={13} />} value={w ? <span className={w.openActions ? "text-amber-700" : undefined}>{fmtNumber(w.openActions)}</span> : <StatSkeleton />}>
            <p>{tr("from the SWAT audits, until the revisit")}</p>
          </Stat>
        </StatStrip>
      }>
      <Panel title={view === "pics" ? tr("Assessment per PIC") : tr("Per outlet")}
        description={view === "pics" ? tr("Lowest agreement with the SWAT team first; a PIC without an audit yet comes last") : tr("Daily forms and SWAT audits of every outlet")}
        actions={<div className="flex rounded-lg bg-slate-100 p-1">
          {([["pics", tr("PIC"), UsersRound], ["outlets", tr("Outlet"), Store]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
              className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium", view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}><Icon size={13} /> {label}</button>
          ))}
        </div>}
        toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={view === "pics" ? tr("Search PIC") : tr("Search outlet")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <><span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> {tr("Net sales of the outlets will join the assessment later")}</span><PageNav paged={view === "pics" ? pagedPics : pagedOutlets} /></> : undefined}>
        {error ? <ErrorState message={error} /> : !res ? <SkeletonRows cols={8} /> : view === "pics" ? (
          pics.length === 0 ? <Empty icon={<UsersRound size={28} />} title={tr("No PIC activity in this period")} /> : (
            <div className="overflow-x-auto">
              <table className="m-cards w-full min-w-[980px] text-sm">
                <thead className={theadClass}><tr>
                  <th className="py-2.5 pl-5 pr-3">{tr("PIC")}</th><th className="px-3 py-2.5 text-right">{tr("Check-in days")}</th>
                  <th className="px-3 py-2.5 text-right">Product</th><th className="px-3 py-2.5 text-right">Outlet</th><th className="px-3 py-2.5 text-right">UNDER</th>
                  <th className="px-3 py-2.5 text-right">{tr("SWAT audits")}</th><th className="px-3 py-2.5 text-right">{tr("Overrated")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Open plans")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Agreement with SWAT")}</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedPics.rows.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 pl-5 pr-3" data-label={tr("PIC")}><span className="block font-medium text-slate-900">{p.name}</span><span className="text-[11px] text-slate-400">{tr("{0} outlets", p.branches)}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Check-in days")}>{p.checkinDays}{p.outside ? <span className="block text-[10px] text-red-600">{tr("{0} outside radius", p.outside)}</span> : null}</td>
                      <td className="px-3 py-2.5 text-right" data-label="Product"><Score v={p.productScore} n={p.productVisits} /></td>
                      <td className="px-3 py-2.5 text-right" data-label="Outlet"><Score v={p.outletScore} n={p.outletVisits} /></td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.under ? "text-red-600" : "text-slate-400")} data-label="UNDER">{p.under}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("SWAT audits")}>{p.swatAudits || <span className="text-slate-300">0</span>}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.overrated ? "font-semibold text-red-600" : "text-slate-400")} data-label={tr("Overrated")}>{p.overrated}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.openActions ? "text-amber-700" : "text-slate-400")} data-label={tr("Open plans")}>{p.openActions}</td>
                      <td className="px-3 py-2.5 pr-5 text-right" data-label={tr("Agreement with SWAT")}>{p.conformity === null ? <span className="text-xs text-slate-400">{tr("Not audited yet")}</span> : <Meter v={p.conformity} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="m-cards w-full min-w-[980px] text-sm">
              <thead className={theadClass}><tr>
                <th className="py-2.5 pl-5 pr-3">{tr("Outlet")}</th><th className="px-3 py-2.5 text-right">{tr("Check-ins")}</th>
                <th className="px-3 py-2.5 text-right">Product</th><th className="px-3 py-2.5 text-right">Outlet</th><th className="px-3 py-2.5 text-right">UNDER</th>
                <th className="px-3 py-2.5 text-right">{tr("SWAT audits")}</th><th className="px-3 py-2.5 text-right">{tr("SWAT score")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Open plans")}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pagedOutlets.rows.map((o) => (
                  <tr key={o.code} className={o.visited ? undefined : "text-slate-400"}>
                    <td className="py-2.5 pl-5 pr-3" data-label={tr("Outlet")}><span className="block font-medium text-slate-900">{o.name}</span><span className="text-[11px] text-slate-400">{o.code}{o.groupCode ? ` · ${o.groupCode}` : ""}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Check-ins")}>{o.checkins}</td>
                    <td className="px-3 py-2.5 text-right" data-label="Product"><Score v={o.productScore} n={o.productVisits} /></td>
                    <td className="px-3 py-2.5 text-right" data-label="Outlet"><Score v={o.outletScore} n={o.outletVisits} /></td>
                    <td className={cx("px-3 py-2.5 text-right tabular-nums", o.under ? "text-red-600" : "text-slate-400")} data-label="UNDER">{o.under}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("SWAT audits")}>{o.swatAudits}</td>
                    <td className="px-3 py-2.5 text-right" data-label={tr("SWAT score")}><span className={cx("font-semibold tabular-nums", scoreTone(o.swatScore))}>{pct(o.swatScore)}</span></td>
                    <td className={cx("px-3 py-2.5 pr-5 text-right tabular-nums", o.openActions ? "text-amber-700" : "text-slate-400")} data-label={tr("Open plans")}>{o.openActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {tr("Overrated: items the PIC passed and the SWAT team found UNDER")}</span>
        <Link href="/monitoring/wwwr" className="text-blue-700 hover:underline">Monitoring WW-WR →</Link>
      </p>
      {sheet && res && <OverviewFilters value={f} groups={res.groupOptions} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Page>
  );
}

function Score({ v, n }: { v: number | null; n: number }) {
  return <span><span className={cx("font-semibold tabular-nums", scoreTone(v))}>{pct(v)}</span><span className="block text-[10px] text-slate-400">{tr("{0} visits", n)}</span></span>;
}

function Meter({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden h-1.5 w-20 rounded-full bg-slate-100 sm:block"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${v}%` }} /></span>
      <span className={cx("w-12 text-right font-semibold tabular-nums", scoreTone(v))}>{v}%</span>
    </span>
  );
}

function OverviewFilters({ value, groups, onApply, onClose }: { value: F; groups: { id: string; code: string }[]; onApply: (v: F) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  const def = NO_F();
  const period = periodLabel(d.period, def.period);
  return (
    <MonitorFilterSheet active={[period, d.group].filter(Boolean).length} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 30 days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={366} />
      </FilterRow>
      {groups.length > 0 && (
        <FilterRow icon={<Layers size={15} />} label={tr("Branch group")} value={groups.find((g) => g.id === d.group)?.code ?? null} onClear={() => setD({ ...d, group: "" })}>
          <Segments value={d.group} onChange={(v) => setD({ ...d, group: v })} choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code }))]} />
        </FilterRow>
      )}
    </MonitorFilterSheet>
  );
}

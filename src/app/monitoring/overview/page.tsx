"use client";

// Monitoring → Overview (page mon.overview; integrated_portal_be app/monitoring_overview.py, 2026-11-03): the assessment
// of every PIC from their daily forms — PIC Check In days, the average score of their own Monitoring Product and
// Monitoring Outlet visits — set against the SWAT audits (Form WW-WR): how far their ratings agree with the team, the
// items they passed and the team found UNDER, the action plans still open at their outlets. Then the same per outlet.
// Net sales: the outlets against their own month before (Sales Transactions), no target set by hand.

import { SkeletonTable } from "@/components/kc/Skeleton";
import { AlertTriangle, CalendarDays, ClipboardCheck, Layers, MapPinCheck, Package, Scale, ShieldCheck, Store, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Empty, ErrorState, Page, PageNav, Panel, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { scoreTone } from "@/so/features/visit/visit";
import { tr } from "@/lib/i18n";

type Pic = { id: string; name: string; branches: number; checkins: number; checkinDays: number; outside: number; productVisits: number; productScore: number | null;
  outletVisits: number; outletScore: number | null; under: number; swatAudits: number; conformity: number | null; overrated: number; openActions: number;
  /** the PIC score (2026-11-04): check-ins against the target (6-1 working days), punctuality by the deadline of the outlet
   *  (punctualityLegacy: the workbook's 11:00 WIB), Product / Outlet (done and score), SWAT, net sales against the month before */
  outlets: number; checkinTarget: number; checkinRate: number | null; punctualDays: number; punctuality: number | null; punctualityLegacy: number | null;
  visitTarget: number; visitRate: number | null; productDone: number | null; outletDone: number | null; productPart: number | null; outletPart: number | null;
  salesScore: number | null; salesOutlets: number; score: number | null };
type Outlet = { code: string; name: string; groupCode: string | null; checkins: number; pics: number; productVisits: number; productScore: number | null; outletVisits: number;
  outletScore: number | null; under: number; swatAudits: number; swatScore: number | null; openActions: number; visited: boolean };
type Result = { period: { from: string; to: string }; summary: { outlets: number; visited: number; checkins: number; productScore: number | null; outletScore: number | null; pics: number; under: number };
  swat: { audits: number; conformity: number | null; overrated: number; openActions: number }; picAssessment: Pic[]; branches: Outlet[];
  weights: Record<"checkin" | "punctuality" | "product" | "outlet" | "swat" | "sales", number>; workingDays: number;
  groupOptions: { id: string; code: string; name: string }[] };
type F = { period: Period; group: string };
const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, group: "" });

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

export default function MonitoringOverviewPage() {
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"pics" | "outlets">("pics");
  const [open, setOpen] = useState<Pic | null>(null);
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
    <Page title={tr("Monitoring Overview")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("the assessment of every PIC: daily forms against the SWAT audits")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Outlets Visited")} emphasis icon={<MapPinCheck size={13} />} value={s ? `${fmtNumber(s.visited)}/${fmtNumber(s.outlets)}` : <StatSkeleton />}>
            {s && <p>{tr("{0} check-ins · {1} PICs", fmtNumber(s.checkins), fmtNumber(s.pics))}</p>}
          </Stat>
          <Stat label={tr("PIC Scores")} icon={<Package size={13} />} value={s ? <span><span className={scoreTone(s.productScore)}>{pct(s.productScore)}</span> <span className="text-neutral-300">·</span> <span className={scoreTone(s.outletScore)}>{pct(s.outletScore)}</span></span> : <StatSkeleton />}>
            <p>{tr("Product · Outlet, own visits")}</p>
          </Stat>
          <Stat label={tr("Agreement with SWAT")} icon={<Scale size={13} />} value={w ? <span className={scoreTone(w.conformity)}>{pct(w.conformity)}</span> : <StatSkeleton />}>
            {w && <p>{tr("{0} audits · {1} overrated", fmtNumber(w.audits), fmtNumber(w.overrated))}</p>}
          </Stat>
          <Stat label={tr("Open Action Plans")} icon={<ClipboardCheck size={13} />} value={w ? <span className={w.openActions ? "text-amber-700" : undefined}>{fmtNumber(w.openActions)}</span> : <StatSkeleton />}>
            <p>{tr("from the SWAT audits, until the revisit")}</p>
          </Stat>
        </StatStrip>
      }>
      <Panel title={view === "pics" ? tr("Assessment per PIC") : tr("Per outlet")}
        description={view === "pics" ? tr("Lowest PIC score first; tap a row to see how the score is made") : tr("Daily forms and SWAT audits of every outlet")}
        actions={<div className="flex rounded-lg bg-neutral-100 p-1">
          {([["pics", tr("PIC"), UsersRound], ["outlets", tr("Outlet"), Store]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
              className={cx("inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium", view === k ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}><Icon size={13} /> {label}</button>
          ))}
        </div>}
        toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={view === "pics" ? tr("Search PIC") : tr("Search outlet")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <><span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> {tr("Check-in deadlines, form items and net sales per outlet: Monitoring OPS → Branch Groups")}</span><PageNav paged={view === "pics" ? pagedPics : pagedOutlets} /></> : undefined}>
        {error ? <ErrorState message={error} /> : !res ? <SkeletonTable cols={8} /> : view === "pics" ? (
          pics.length === 0 ? <Empty icon={<UsersRound size={28} />} title={tr("No PIC activity in this period")} /> : (
            <div className="overflow-x-auto">
              <table className="m-cards w-full min-w-[1260px] text-sm">
                <thead className={theadClass}><tr>
                  <th className="py-2.5 pl-5 pr-3">{tr("PIC")}</th><th className="px-3 py-2.5 text-right">{tr("PIC Score")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Check-Ins")}</th><th className="px-3 py-2.5 text-right">{tr("On Time")}</th>
                  <th className="px-3 py-2.5 text-right">Product</th><th className="px-3 py-2.5 text-right">Outlet</th><th className="px-3 py-2.5 text-right">UNDER</th>
                  <th className="px-3 py-2.5 text-right">{tr("Net Sales")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("SWAT Audits")}</th><th className="px-3 py-2.5 text-right">{tr("Overrated")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Open Plans")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Agreement with SWAT")}</th>
                </tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {pagedPics.rows.map((p) => (
                    <tr key={p.id} onClick={() => setOpen(p)} className="cursor-pointer hover:bg-brand-50/40">
                      <td className="py-2.5 pl-5 pr-3" data-label={tr("PIC")}><span className="block font-medium text-neutral-900">{p.name}</span><span className="text-[11px] text-neutral-400">{tr("{0} outlets", p.branches)}</span></td>
                      <td className="px-3 py-2.5 text-right" data-label={tr("PIC Score")}><span className={cx("text-base font-bold tabular-nums", scoreTone(p.score))}>{pct(p.score)}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Check-Ins")}>
                        <span className={cx("font-semibold", scoreTone(p.checkinRate))}>{pct(p.checkinRate)}</span>
                        <span className="block text-[10px] text-neutral-400">{p.checkins}/{p.checkinTarget}{p.outside ? ` · ${tr("{0} outside radius", p.outside)}` : ""}</span></td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("On Time")}>
                        <span className={cx("font-semibold", scoreTone(p.punctuality))}>{pct(p.punctuality)}</span>
                        <span className="block text-[10px] text-neutral-400">{tr("{0} of {1} days", p.punctualDays, p.checkinDays)}</span>
                        {p.punctualityLegacy != null && p.punctualityLegacy !== p.punctuality && <span className="block text-[10px] text-neutral-400">{tr("11:00 rule: {0}", pct(p.punctualityLegacy))}</span>}</td>
                      <td className="px-3 py-2.5 text-right" data-label="Product"><Score v={p.productScore} n={p.productVisits} /></td>
                      <td className="px-3 py-2.5 text-right" data-label="Outlet"><Score v={p.outletScore} n={p.outletVisits} /></td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.under ? "text-red-600" : "text-neutral-400")} data-label="UNDER">{p.under}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Net Sales")}>
                        {p.salesScore == null ? <span className="text-xs text-neutral-400">{tr("No history")}</span> : <span className={cx("font-semibold", scoreTone(p.salesScore))}>{pct(p.salesScore)}</span>}
                        {p.salesScore != null && <span className="block text-[10px] text-neutral-400">{tr("{0} outlets vs the month before", p.salesOutlets)}</span>}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("SWAT Audits")}>{p.swatAudits || <span className="text-neutral-300">0</span>}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.overrated ? "font-semibold text-red-600" : "text-neutral-400")} data-label={tr("Overrated")}>{p.overrated}</td>
                      <td className={cx("px-3 py-2.5 text-right tabular-nums", p.openActions ? "text-amber-700" : "text-neutral-400")} data-label={tr("Open Plans")}>{p.openActions}</td>
                      <td className="px-3 py-2.5 pr-5 text-right" data-label={tr("Agreement with SWAT")}>{p.conformity === null ? <span className="text-xs text-neutral-400">{tr("Not audited yet")}</span> : <Meter v={p.conformity} />}</td>
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
                <th className="px-3 py-2.5 text-right">{tr("SWAT Audits")}</th><th className="px-3 py-2.5 text-right">{tr("SWAT Score")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Open Plans")}</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {pagedOutlets.rows.map((o) => (
                  <tr key={o.code} className={o.visited ? undefined : "text-neutral-400"}>
                    <td className="py-2.5 pl-5 pr-3" data-label={tr("Outlet")}><span className="block font-medium text-neutral-900">{o.name}</span><span className="text-[11px] text-neutral-400">{o.code}{o.groupCode ? ` · ${o.groupCode}` : ""}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Check-ins")}>{o.checkins}</td>
                    <td className="px-3 py-2.5 text-right" data-label="Product"><Score v={o.productScore} n={o.productVisits} /></td>
                    <td className="px-3 py-2.5 text-right" data-label="Outlet"><Score v={o.outletScore} n={o.outletVisits} /></td>
                    <td className={cx("px-3 py-2.5 text-right tabular-nums", o.under ? "text-red-600" : "text-neutral-400")} data-label="UNDER">{o.under}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("SWAT Audits")}>{o.swatAudits}</td>
                    <td className="px-3 py-2.5 text-right" data-label={tr("SWAT Score")}><span className={cx("font-semibold tabular-nums", scoreTone(o.swatScore))}>{pct(o.swatScore)}</span></td>
                    <td className={cx("px-3 py-2.5 pr-5 text-right tabular-nums", o.openActions ? "text-amber-700" : "text-neutral-400")} data-label={tr("Open Plans")}>{o.openActions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {tr("Overrated: items the PIC passed and the SWAT team found UNDER")}</span>
        <Link href="/monitoring/wwwr" className="text-brand-700 hover:underline">WW-WR →</Link>
      </p>
      {open && res && <ScoreDrawer p={open} weights={res.weights} workingDays={res.workingDays} onClose={() => setOpen(null)} />}
      {sheet && res && <OverviewFilters value={f} groups={res.groupOptions} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Page>
  );
}

/** How the PIC score is made: each part, its weight and its value (parts without data are left out). */
function ScoreDrawer({ p, weights, workingDays, onClose }: { p: Pic; weights: Result["weights"]; workingDays: number; onClose: () => void }) {
  const parts: { key: keyof Result["weights"]; label: string; value: number | null; how: string }[] = [
    { key: "checkin", label: tr("PIC Check-In"), value: p.checkinRate, how: tr("{0} of {1}: {2} outlets × check-ins per day of the branch group × {3} working days (6 on, 1 free day a week)", p.checkins, p.checkinTarget, p.outlets, workingDays) },
    { key: "punctuality", label: tr("On Time"), value: p.punctuality,
      how: tr("First check-in of the day by the deadline of its outlet (CCI 10:00, CTGP 10:15, CTG 10:30, or the outlet's own, on the outlet's clock): {0} of {1} days", p.punctualDays, p.checkinDays)
        + (p.punctualityLegacy != null ? ` · ${tr("11:00 rule: {0}", pct(p.punctualityLegacy))}` : "") },
    { key: "product", label: tr("Product"), value: p.productPart,
      how: tr("Visits {0} ({1} of {2}) and score {3}, averaged", pct(p.productDone), p.productVisits, p.visitTarget / 2, pct(p.productScore)) },
    { key: "outlet", label: tr("Outlet"), value: p.outletPart,
      how: tr("Visits {0} ({1} of {2}) and score {3}, averaged", pct(p.outletDone), p.outletVisits, p.visitTarget / 2, pct(p.outletScore)) },
    { key: "swat", label: tr("Agreement with SWAT"), value: p.conformity, how: p.swatAudits ? tr("{0} SWAT audits · {1} items overrated", p.swatAudits, p.overrated) : tr("Not audited yet") },
    { key: "sales", label: tr("Net Sales"), value: p.salesScore,
      how: p.salesScore == null ? tr("The outlets of the PIC have no sales in this period or none in the month before") : tr("Net sales per selling day of {0} outlets against their own of the month before (Sales Transactions), at most 100", p.salesOutlets) },
  ];
  return (
    <Drawer open onClose={onClose} size="md" icon={<Scale size={18} />} title={p.name} description={tr("How the PIC score is made")} focusFirstField={false}>
      <div className="space-y-4 text-sm">
        <div className="rounded-xl bg-neutral-50 p-4 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{tr("PIC Score")}</p>
          <p className={cx("text-4xl font-bold tabular-nums", scoreTone(p.score))}>{pct(p.score)}</p>
          <p className="mt-1 text-xs text-neutral-500">{tr("Weighted over the parts with data")}</p>
        </div>
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {parts.map((x) => (
            <li key={x.key} className={cx("px-4 py-3", x.value == null && "opacity-60")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-neutral-900">{x.label} <span className="text-xs font-normal text-neutral-400">· {weights[x.key]}%</span></span>
                <span className={cx("font-semibold tabular-nums", scoreTone(x.value))}>{pct(x.value)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${x.value ?? 0}%` }} /></div>
              <p className="mt-1 text-[11px] text-neutral-500">{x.how}</p>
            </li>
          ))}
        </ul>
      </div>
    </Drawer>
  );
}

function Score({ v, n }: { v: number | null; n: number }) {
  return <span><span className={cx("font-semibold tabular-nums", scoreTone(v))}>{pct(v)}</span><span className="block text-[10px] text-neutral-400">{tr("{0} visits", n)}</span></span>;
}

function Meter({ v }: { v: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden h-1.5 w-20 rounded-full bg-neutral-100 sm:block"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${v}%` }} /></span>
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
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 30 Days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={366} />
      </FilterRow>
      {groups.length > 0 && (
        <FilterRow icon={<Layers size={15} />} label={tr("Branch Group")} value={groups.find((g) => g.id === d.group)?.code ?? null} onClear={() => setD({ ...d, group: "" })}>
          <Segments value={d.group} onChange={(v) => setD({ ...d, group: v })} choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code }))]} />
        </FilterRow>
      )}
    </MonitorFilterSheet>
  );
}

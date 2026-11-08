"use client";

// Monitoring → Monitoring Product / Monitoring Outlet (pages mon.product, mon.outlet): the visits the PICs sent for a
// period. Tabs: Visits (the list, one visit in full in a drawer), Analysis (performance per section, the most frequent
// findings, the stars per platform) and Attendance (one visit per outlet per day: the days each PIC visited and the days
// off — a day without any visit). Monitoring WW-WR (form wwwr, the SWAT audit): Audits, Analysis, Comparison with the
// PIC and Schedule (WwwrMonitor) instead of the attendance.

import { AlertTriangle, BarChart3, CalendarDays, CalendarOff, Camera, CalendarPlus, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, Layers, MapPin, MessageSquareText, PenLine, Scale, Star,
  Store, UserRound, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, FilterToolbar, Period, dmy, wibDay } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import { AuditEvaluation, ComparisonPanel, SchedulePanel } from "./WwwrMonitor";
import { Segmented } from "@/so/ui/Simple";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";
import { type Definition, type Platform, type Rating, type Visit, type VisitFormKey, PLATFORM_LABEL, RATINGS, RATING_STYLE, fmtGrams, fmtStars, ratingLabel, scoreTone, tl, visitPhotoUrl, visitSignatureUrl } from "./visit";
import { SkeletonList } from "@/components/kc/Skeleton";
import { thumb } from "@/lib/assets";

type SectionPerf = { key: string; title: string; titleEn?: string; group: string; under: number; meet: number; exceed: number };
type Finding = { key: string; label: string; labelEn?: string; section: string; sectionEn?: string; count: number; branches: string[] };
type Attendance = { days: string[]; today: string; since: string; pics: { id: string; username: string; name: string; branches: number; active: number; off: number; visits: number; days: Record<string, number> }[] };
type Result = {
  period: { from: string; to: string }; definition: Definition; data: Visit[]; sections: SectionPerf[]; findings: Finding[];
  summary: { visits: number; branches: number; pics: number; under: number; meet: number; exceed: number; score: number | null; outside: number };
  pics: { id: string; name: string; n: number }[]; truncated: boolean; attendance?: Attendance;
  /** per branch group (2026-11-02): visits, outlets, PICs, average score, UNDER */
  groups?: { code: string; visits: number; outlets: number; pics: number; under: number; score: number | null }[];
  /** Monitoring Outlet: average stars per platform of the visits that carry one */
  platforms?: { key: string; platform: Platform; label: string; stars: number | null; visits: number }[];
};
type BranchOpt = { branch_code: string; branch_name: string };
type F = { period: Period; group: string; branch: string; user: string; only: "" | "under" | "outside" };
type GroupOpt = { id: string; code: string; name: string };
type Tab = "visits" | "analysis" | "attendance" | "comparison" | "schedule";

const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, group: "", branch: "", user: "", only: "" });
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Bar({ c, className }: { c: { under: number; meet: number; exceed: number }; className?: string }) {
  const total = c.under + c.meet + c.exceed;
  return (
    <span className={cx("flex h-2 gap-px overflow-hidden rounded-full bg-neutral-100", className)}>
      {total > 0 && (["under", "meet", "exceed"] as const).map((k, i) => c[k] > 0 && (
        <span key={k} className={RATING_STYLE[RATINGS[i]].bar} style={{ width: `${(c[k] / total) * 100}%` }} />
      ))}
    </span>
  );
}

function ScorePill({ score, large }: { score: number | null; large?: boolean }) {
  const tone = score === null ? "bg-neutral-100 text-neutral-500" : score >= 90 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : score >= 75 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200";
  return <span className={cx("inline-flex items-center justify-center rounded-lg font-semibold tabular-nums ring-1 ring-inset", tone, large ? "h-12 min-w-[4.5rem] px-3 text-xl" : "h-7 min-w-[3.5rem] px-2 text-sm")}>{score === null ? "—" : `${score}%`}</span>;
}

export default function VisitMonitor({ form }: { form: VisitFormKey }) {
  const audit = form === "wwwr";
  const [f, setF] = useState<F>(NO_F);
  const [tab, setTab] = useState<Tab>("visits");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const q = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.group ? { group: f.group } : {}), ...(f.branch ? { branch: f.branch } : {}), ...(f.user ? { userId: f.user } : {}) });
    try {
      setRes(await call<Result>(`/api/monitoring/${form}?${q}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period, f.group, f.branch, f.user, form]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => { void call<{ groups: GroupOpt[] }>("/api/monitoring/branch-groups").then((r) => setGroups(r.groups)).catch(() => setGroups([])); }, []);

  const title = audit ? "Monitoring WW-WR" : res ? tl(res.definition, "title") : (form === "product" ? "Monitoring Product" : "Monitoring Outlet");
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (res?.data ?? []).filter((v) => (!s || v.branchName.toLowerCase().includes(s) || v.name.toLowerCase().includes(s))
      && (f.only !== "under" || v.counts.under > 0) && (f.only !== "outside" || v.outsideRadius));
  }, [res, search, f.only]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f));
  const s = res?.summary;
  const att = res?.attendance;
  const offDays = att ? att.pics.reduce((a, p) => a + p.off, 0) : 0;
  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.group ? [{ key: "g", label: `${tr("Group")} ${f.group === "none" ? tr("Without a Group") : groups.find((g) => g.id === f.group)?.code ?? ""}`, onRemove: () => setF({ ...f, group: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.user ? [{ key: "u", label: res?.pics.find((p) => p.id === f.user)?.name ?? tr("PIC"), onRemove: () => setF({ ...f, user: "" }) }] : []),
    ...(f.only ? [{ key: "o", label: f.only === "under" ? tr("With UNDER findings") : tr("Outside Radius"), onRemove: () => setF({ ...f, only: "" }) }] : []),
  ];
  const toggle = (only: F["only"]) => { setTab("visits"); setF({ ...f, only: f.only === only ? "" : only }); };

  return (
    <Page title={title} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${audit ? tr("SWAT audits of the outlets") : tr("visits of the PICs to the outlets")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={audit ? tr("Audits") : tr("Visits")} emphasis icon={<ClipboardList size={13} />} value={s ? fmtNumber(s.visits) : <StatSkeleton />}>
            {s && <p>{audit ? tr("{0} outlets · {1} leads", fmtNumber(s.branches), fmtNumber(s.pics)) : tr("{0} outlets · {1} PICs", fmtNumber(s.branches), fmtNumber(s.pics))}</p>}
          </Stat>
          <Stat label={tr("Average Score")} icon={<BarChart3 size={13} />} value={s ? <span className={scoreTone(s.score)}>{s.score === null ? "—" : `${s.score}%`}</span> : <StatSkeleton />}>
            {s && <p>{tr("items rated MEET or EXCEED")}</p>}
          </Stat>
          <Stat label={tr("UNDER Findings")} icon={<AlertTriangle size={13} />} onClick={s ? () => toggle("under") : undefined} active={f.only === "under"}
            value={s ? <span className={s.under ? "text-red-600" : undefined}>{fmtNumber(s.under)}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} MEET · {1} EXCEED", fmtNumber(s.meet), fmtNumber(s.exceed))}</p>}
          </Stat>
          {audit ? (
            <Stat label={tr("Comparison with the PIC")} icon={<Scale size={13} />} onClick={() => setTab("comparison")} active={tab === "comparison"} value={<Scale size={18} className="text-brand-700" />}>
              <p>{tr("SWAT against the PIC's own visits")}</p>
            </Stat>
          ) : (
            <Stat label={tr("Days Off")} icon={<CalendarOff size={13} />} onClick={att ? () => setTab("attendance") : undefined} active={tab === "attendance"}
              value={att ? fmtNumber(offDays) : <StatSkeleton />}>
              {att && <p>{tr("days without a visit · {0} PICs", fmtNumber(att.pics.length))}</p>}
            </Stat>
          )}
        </StatStrip>
      }>
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-neutral-200 px-1" role="tablist" aria-label={tr("Sections")}>
        {((audit ? [["visits", tr("Audits"), <ClipboardList key="v" size={15} />, res?.data.length], ["analysis", tr("Analysis"), <BarChart3 key="a" size={15} />, null],
          ["comparison", tr("Comparison"), <Scale key="c" size={15} />, null], ["schedule", tr("Schedule"), <CalendarPlus key="s" size={15} />, null]]
          : [["visits", tr("Visits"), <ClipboardList key="v" size={15} />, res?.data.length], ["analysis", tr("Analysis"), <BarChart3 key="a" size={15} />, null],
          ["attendance", tr("PIC Attendance"), <CalendarDays key="t" size={15} />, att?.pics.length]]) as [Tab, string, React.ReactNode, number | null | undefined][]).map(([k, label, icon, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx("-mb-px inline-flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === k ? "border-brand-700 text-brand-700" : "border-transparent text-neutral-500 hover:text-neutral-800")}>
            {icon}{label}{n != null && <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] tabular-nums text-neutral-600">{fmtNumber(n)}</span>}
          </button>
        ))}
      </div>

      {tab === "analysis" && (!res ? <SkeletonList rows={5} /> : res.data.length === 0 ? (
        <Panel><Empty icon={<BarChart3 size={28} />} title={tr("No visit in this period")}>{tr("The analysis appears as soon as the PICs send their visits.")}</Empty></Panel>
      ) : (
        <div className="space-y-4">
          <Analysis res={res} onOutlet={(code) => { setF({ ...f, branch: code }); setTab("visits"); }} />
          {!!res.platforms?.length && (
            <Panel title={tr("Outlet Rating per Platform")} description={tr("Average stars of the visits of the period: Google Maps automatic, delivery apps typed by the PIC")}>
              <ul className="grid grid-cols-2 gap-px bg-neutral-100 lg:grid-cols-4">
                {res.platforms.map((p) => (
                  <li key={p.key} className="bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{PLATFORM_LABEL[p.platform]}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums text-neutral-900">
                      <Star size={17} className={p.stars === null ? "text-neutral-300" : "fill-amber-400 text-amber-400"} /> {p.stars === null ? "—" : fmtStars(p.stars)}
                    </p>
                    <p className="text-[11px] text-neutral-500">{tr("{0} visits", fmtNumber(p.visits))}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      ))}

      {tab === "comparison" && <ComparisonPanel period={f.period} branch={f.branch} group={f.group} />}
      {tab === "schedule" && <SchedulePanel branches={branches} onOpenVisit={setOpen} />}
      {tab === "attendance" && <AttendancePanel form={form} group={f.group} branch={f.branch} onPic={(id) => { setF({ ...f, user: id }); setTab("visits"); }} />}

      {tab === "visits" && (
        <Panel title={tr("Visits")} description={tr("Newest first; tap a visit to see every item, note and photo")}
          toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search outlet or PIC")} filters={chips}
            onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
          footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""} · {tr("Times in WIB (server time)")}</span><PageNav paged={paged} /></> : undefined}>
          {error ? <ErrorState message={error} onRetry={() => void load()} /> : res && rows.length === 0 ? (
            <Empty icon={<ClipboardList size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No visit in this period")}>
              {!res.data.length && tr("Visits appear here as soon as the PICs send them from the Form menu.")}
            </Empty>
          ) : (
            <>
              <ul className="divide-y divide-neutral-100 md:hidden">
                {paged.rows.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setOpen(v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                      <ScorePill score={v.score} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{v.branchName}</span>
                        <span className="block truncate text-xs text-neutral-500">{v.branchGroup ? `${v.branchGroup} · ` : ""}{v.name} · {wibDateTime(v.submittedAt)}</span>
                        <Bar c={v.counts} className="mt-1.5" />
                      </span>
                      <ChevronRight size={16} className="text-neutral-300" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="m-cards w-full min-w-[920px] text-sm">
                  <thead className={theadClass}>
                    <tr>
                      <th className="py-2.5 pl-5 pr-3">{tr("Outlet")}</th><th className="px-3 py-2.5">{audit ? tr("Lead") : tr("PIC")}</th><th className="px-3 py-2.5">{tr("Sent")}</th>
                      <th className="px-3 py-2.5">{tr("Result")}</th><th className="px-3 py-2.5 text-center">{tr("Score")}</th>
                      <th className="px-3 py-2.5 text-right">{tr("Photos")}</th><th className="px-3 py-2.5">{tr("Location")}</th><th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {!res ? <SkeletonRows cols={8} /> : paged.rows.map((v) => (
                      <tr key={v.id} onClick={() => setOpen(v.id)} className="group cursor-pointer hover:bg-brand-50/40">
                        <td className="max-w-[16rem] py-3 pl-5 pr-3"><span className="block truncate font-semibold text-neutral-900">{v.branchName}</span><span className="text-[11px] text-neutral-400">{v.branchCode}</span>
                          {v.branchGroup && <span className="ml-1.5 rounded bg-brand-50 px-1 text-[10px] font-semibold text-brand-700">{v.branchGroup}</span>}</td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-600">{initials(v.name)}</span>
                            <span className="min-w-0"><span className="block truncate text-neutral-800">{v.name}</span><span className="block max-w-[14rem] truncate text-[11px] text-neutral-400">{v.audit ? tr("Team: {0}", v.audit.members.map((m) => m.name).join(", ")) : `@${v.username}`}</span></span></span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-neutral-600">{wibDateTime(v.submittedAt)}</td>
                        <td className="w-56 px-3 py-3">
                          <Bar c={v.counts} />
                          <span className="mt-1 block text-[11px] text-neutral-500"><span className={v.counts.under ? "font-semibold text-red-600" : ""}>{v.counts.under} UNDER</span> · {v.counts.meet} MEET · {v.counts.exceed} EXCEED</span>
                        </td>
                        <td className="px-3 py-3 text-center"><ScorePill score={v.score} /></td>
                        <td className="px-3 py-3 text-right tabular-nums text-neutral-600"><span className="inline-flex items-center gap-1"><Camera size={12} className="text-neutral-400" />{v.photoCount ?? 0}</span></td>
                        <td className="px-3 py-3">
                          {v.distanceM === null ? <Badge>{tr("No position")}</Badge> : v.outsideRadius ? <Badge tone="red" icon={<MapPin size={11} />}>{v.distanceM} m</Badge> : <Badge tone="green">{v.distanceM} m</Badge>}
                        </td>
                        <td className="pr-3 text-neutral-300 group-hover:text-brand-600"><ChevronRight size={16} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      )}

      {sheet && <VisitFilters value={f} groups={groups} branches={branches} pics={res?.pics ?? []} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <VisitDrawer form={form} id={open} onClose={() => setOpen(null)} />}
    </Page>
  );
}

type MonthAttendance = Attendance & { month: string; first: string; last: string };
const monthOf = (iso: string) => iso.slice(0, 7);
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Attendance per calendar month (28–31 days): per PIC the days with a visit and the days off — one column per date. */
function AttendancePanel({ form, group, branch, onPic }: { form: VisitFormKey; group: string; branch: string; onPic: (id: string) => void }) {
  const current = monthOf(wibDay(0));
  const [month, setMonth] = useState(current);
  const [att, setAtt] = useState<MonthAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ month, ...(group ? { group } : {}), ...(branch ? { branch } : {}) });
    call<MonthAttendance>(`/api/monitoring/${form}/attendance?${q}`).then((r) => { if (live) { setAtt(r); setError(null); } })
      .catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [form, month, group, branch]);
  const dates = useMemo(() => {
    if (!att) return [];
    const n = Number(att.last.slice(8, 10));
    return Array.from({ length: n }, (_, i) => `${att.month}-${String(i + 1).padStart(2, "0")}`);
  }, [att]);
  const counted = new Set(att?.days ?? []);
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(locale(), { month: "long", year: "numeric" });
  const sunday = (d: string) => new Date(`${d}T00:00:00`).getDay() === 0;
  const past = (att?.days ?? []).filter((d) => d < (att?.today ?? "")).length;
  return (
    <Panel title={tr("PIC Attendance")} description={att ? tr("{0}: {1} days in the month · counted from {2} · one visit per outlet per day; a past day without any visit is a day off", label, dates.length, dmy(att.since), ) : tr("Loading…")}
      actions={<div className="flex flex-wrap items-center gap-3">
        <span className="hidden items-center gap-3 text-[11px] text-neutral-500 lg:flex">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{tr("Visit")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />{tr("Day off")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-inset ring-neutral-300" />{tr("Today")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neutral-100" />{tr("Not counted")}</span>
        </span>
        <span className="inline-flex items-center rounded-lg border border-neutral-200 bg-white">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-l-lg p-2 text-neutral-500 hover:bg-neutral-50" aria-label={tr("Previous Month")}><ChevronLeft size={15} /></button>
          <span className="min-w-[8.5rem] px-2 text-center text-sm font-semibold capitalize text-neutral-900">{label}</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= current} className="rounded-r-lg p-2 text-neutral-500 hover:bg-neutral-50 disabled:opacity-30" aria-label={tr("Next Month")}><ChevronRight size={15} /></button>
        </span>
      </div>}>
      {error ? <ErrorState message={error} /> : !att ? <SkeletonList rows={5} /> : att.pics.length === 0 ? (
        <Empty icon={<UsersRound size={28} />} title={tr("No PIC with this form")}>{tr("PICs appear here when their account has the form page and an outlet in scope.")}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="sticky left-0 z-10 min-w-[14rem] bg-neutral-50 py-2.5 pl-5 pr-3">{tr("PIC")}</th>
                <th className="px-2 py-2.5 text-right">{tr("Visited")}</th><th className="px-2 py-2.5 text-right">{tr("Days Off")}</th><th className="px-2 py-2.5 text-right">{tr("Visits")}</th>
                {dates.map((d) => (
                  <th key={d} className={cx("w-6 px-0 py-2.5 text-center text-[10px] tabular-nums", d === att.today ? "text-brand-700" : sunday(d) ? "text-red-500" : "")}>{Number(d.slice(8))}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {att.pics.map((p) => (
                <tr key={p.id} onClick={() => onPic(p.id)} className="group cursor-pointer hover:bg-brand-50/40" title={tr("Show the visits of {0}", p.name)}>
                  <td className="sticky left-0 z-10 bg-white py-2 pl-5 pr-3 group-hover:bg-brand-50/40">
                    <span className="flex items-center gap-2"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-600">{initials(p.name)}</span>
                      <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{p.name}</span><span className="text-[11px] text-neutral-400">@{p.username} · {tr("{0} outlets", p.branches)}</span></span></span>
                  </td>
                  <td className="px-2 py-2 text-right"><span className="font-semibold tabular-nums text-neutral-900">{p.active}</span><span className="block text-[10px] text-neutral-400">/{counted.size}</span></td>
                  <td className={cx("px-2 py-2 text-right font-semibold tabular-nums", p.off ? "text-amber-700" : "text-neutral-400")}>{p.off}<span className="block text-[10px] font-normal text-neutral-400">/{past}</span></td>
                  <td className="px-2 py-2 text-right tabular-nums text-neutral-700">{p.visits}</td>
                  {dates.map((d) => {
                    const n = p.days[d];
                    const state = n ? "visit" : !counted.has(d) ? "none" : d === att.today ? "today" : "off";
                    return (
                      <td key={d} className="px-px py-2 text-center">
                        <span title={`${dmy(d)} · ${n ? tr("{0} visits", n) : state === "today" ? tr("Today, not yet") : state === "off" ? tr("Day off") : tr("Not counted")}`}
                          className={cx("mx-auto flex h-6 w-5 items-center justify-center rounded text-[10px] font-semibold tabular-nums",
                            state === "visit" ? "bg-emerald-500 text-white" : state === "off" ? "bg-amber-200 text-amber-800" : state === "today" ? "bg-white ring-1 ring-inset ring-neutral-300" : "bg-neutral-100")}>
                          {n && n > 1 ? n : ""}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

const TARGET = 90;
const pctOf = (c: { under: number; meet: number; exceed: number }) => {
  const t = c.under + c.meet + c.exceed;
  return t ? Math.round(((c.meet + c.exceed) / t) * 1000) / 10 : null;
};

/** The Analysis tab for the management: four headline facts, the score per section against the target (worst first),
 * the findings rated UNDER most often and the outlets with the lowest average score (tap one: its visits). */
function Analysis({ res, onOutlet }: { res: Result; onOutlet: (code: string) => void }) {
  const sections = useMemo(() => res.sections.map((s) => ({ ...s, pct: pctOf(s), n: s.under + s.meet + s.exceed }))
    .filter((s) => s.n > 0).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)), [res.sections]);
  const outlets = useMemo(() => {
    const per = new Map<string, { code: string; name: string; visits: number; sum: number; scored: number; under: number; last: string }>();
    for (const v of res.data) {
      const o = per.get(v.branchCode) ?? { code: v.branchCode, name: v.branchName, visits: 0, sum: 0, scored: 0, under: 0, last: "" };
      o.visits += 1;
      o.under += v.counts.under;
      if (v.score !== null) { o.sum += v.score; o.scored += 1; }
      if ((v.submittedAt ?? "") > o.last) o.last = v.submittedAt ?? "";
      per.set(v.branchCode, o);
    }
    return [...per.values()].map((o) => ({ ...o, avg: o.scored ? Math.round((o.sum / o.scored) * 10) / 10 : null }))
      .sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101) || b.under - a.under);
  }, [res.data]);
  const s = res.summary;
  const weakest = sections[0];
  const top = res.findings[0];
  const below = outlets.filter((o) => o.avg !== null && o.avg < 75).length;
  const maxFinding = Math.max(1, ...res.findings.map((x) => x.count));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Insight label={tr("Average Score")} value={<span className={scoreTone(s.score)}>{s.score === null ? "—" : `${s.score}%`}</span>}
          note={tr("{0} visits · target {1}%", fmtNumber(s.visits), TARGET)} />
        <Insight label={tr("Weakest Section")} value={weakest ? <span className={scoreTone(weakest.pct)}>{weakest.pct}%</span> : "—"} note={weakest ? tl(weakest, "title") : tr("No rating yet")} />
        <Insight label={tr("Top Finding")} value={top ? <span className="text-red-600">{top.count}×</span> : "0"} note={top ? tl(top) : tr("No UNDER in this period")} />
        <Insight label={tr("Outlets Below 75%")} value={<span className={below ? "text-red-600" : "text-emerald-600"}>{below}</span>} note={tr("of {0} outlets visited", fmtNumber(outlets.length))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={tr("Performance per Section")} description={tr("Share of items rated MEET or EXCEED, weakest first; the line is the target {0}%", TARGET)}>
          <ul className="space-y-3 px-4 py-4 sm:px-5">
            {sections.map((sec) => (
              <li key={sec.key} title={`${sec.under} UNDER · ${sec.meet} MEET · ${sec.exceed} EXCEED`}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-neutral-700">{tl(sec, "title")}</span>
                  <span className={cx("flex-shrink-0 text-sm font-semibold tabular-nums", scoreTone(sec.pct))}>{sec.pct}%</span>
                </div>
                <div className="relative h-2 rounded-full bg-neutral-100">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-brand-600" style={{ width: `${sec.pct ?? 0}%` }} />
                  <span className="absolute -inset-y-1 w-0.5 rounded bg-neutral-400" style={{ left: `${TARGET}%` }} aria-hidden />
                </div>
                {sec.under > 0 && <p className="mt-1 text-[11px] text-neutral-500">{tr("{0} UNDER of {1} ratings", sec.under, sec.n)}</p>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title={tr("Most Frequent Findings")} description={tr("Items rated UNDER most often in the period")}>
          {res.findings.length === 0 ? <p className="px-4 py-10 text-center text-sm text-neutral-400">{tr("No UNDER in this period")}</p> : (
            <ol className="space-y-3 px-4 py-4 sm:px-5">
              {res.findings.slice(0, 8).map((x, i) => (
                <li key={x.key} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold tabular-nums text-neutral-600">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium text-neutral-800">{tl(x)}</span>
                      <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{x.count}×</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-red-500" style={{ width: `${(x.count / maxFinding) * 100}%` }} /></div>
                    <p className="mt-1 truncate text-[11px] text-neutral-500" title={x.branches.join(", ")}>{tl(x, "section")} · {tr("{0} outlets", x.branches.length)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {(res.groups?.length ?? 0) > 0 && (
        <Panel title={tr("Per Branch Group")} description={tr("The items asked follow the branch group of the outlet (CCI, CTG, CTGP)")}>
          <ul className="grid gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
            {res.groups!.map((g) => (
              <li key={g.code} className="bg-white px-4 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{g.code === "—" ? tr("Without a Group") : g.code}</span>
                  <span className={cx("text-xl font-semibold tabular-nums", scoreTone(g.score))}>{g.score === null ? "—" : `${g.score}%`}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-neutral-500">{tr("{0} visits · {1} outlets · {2} PICs", fmtNumber(g.visits), fmtNumber(g.outlets), fmtNumber(g.pics))}</p>
                <p className={cx("text-[11px]", g.under ? "text-red-600" : "text-neutral-400")}>{tr("{0} UNDER", fmtNumber(g.under))}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={tr("Outlets Needing Attention")} description={tr("Lowest average score first; tap an outlet to see its visits")}>
        <div className="overflow-x-auto">
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}>
              <tr><th className="py-2.5 pl-5 pr-3">{tr("Outlet")}</th><th className="px-3 py-2.5 text-right">{tr("Visits")}</th>
                <th className="px-3 py-2.5 text-right">{tr("UNDER")}</th><th className="px-3 py-2.5">{tr("Last Visit")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Average Score")}</th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {outlets.slice(0, 10).map((o) => (
                <tr key={o.code} onClick={() => onOutlet(o.code)} className="cursor-pointer hover:bg-brand-50/40">
                  <td className="py-2.5 pl-5 pr-3" data-label={tr("Outlet")}><span className="block font-medium text-neutral-900">{o.name}</span><span className="text-[11px] text-neutral-400">{o.code}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700" data-label={tr("Visits")}>{o.visits}</td>
                  <td className={cx("px-3 py-2.5 text-right tabular-nums", o.under ? "font-semibold text-red-600" : "text-neutral-400")} data-label={tr("UNDER")}>{o.under}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-neutral-500" data-label={tr("Last Visit")}>{o.last ? wibDateTime(o.last) : "—"}</td>
                  <td className="px-3 py-2.5 pr-5 text-right" data-label={tr("Average Score")}><ScorePill score={o.avg} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Insight({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{note}</p>
    </div>
  );
}

function VisitFilters({ value, groups, branches, pics, onApply, onClose }: {
  value: F; groups: GroupOpt[]; branches: BranchOpt[]; pics: { id: string; name: string }[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const def = NO_F();
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  const period = periodLabel(d.period, def.period);
  const groupName = d.group === "none" ? tr("Without a Group") : groups.find((g) => g.id === d.group)?.code ?? null;
  const only = { "": null, under: tr("With UNDER findings"), outside: tr("Outside Radius") }[d.only];
  const active = [period, d.group, d.branch, d.user, d.only].filter(Boolean).length;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)} applyDisabled={days > 366}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 30 Days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={366} />
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Outlet")} value={branches.find((b) => b.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} allLabel={tr("All Outlets")} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code }))} />
      </FilterRow>
      <FilterRow icon={<UserRound size={15} />} label={tr("PIC")} value={pics.find((p) => p.id === d.user)?.name ?? null} onClear={() => setD({ ...d, user: "" })}>
        <ComboFilter value={d.user} onChange={(v) => setD({ ...d, user: v })} allLabel={tr("All PICs")} placeholder={tr("Search PIC")}
          options={pics.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterRow>
      {groups.length > 0 && (
        <FilterRow icon={<Layers size={15} />} label={tr("Branch Group")} value={groupName} onClear={() => setD({ ...d, group: "" })}>
          <Segments value={d.group} onChange={(v) => setD({ ...d, group: v })}
            choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("No group") }]} />
        </FilterRow>
      )}
      <FilterRow icon={<AlertTriangle size={15} />} label={tr("Show Only")} value={only} onClear={() => setD({ ...d, only: "" })}>
        <Segments value={d.only} onChange={(v) => setD({ ...d, only: v as F["only"] })}
          choices={[{ value: "", label: tr("All Visits") }, { value: "under", label: tr("With UNDER") }, { value: "outside", label: tr("Outside Radius") }]} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

/** One visit in full: the head (score, counts, PIC, time, position), then every item with its rating, note and photos. */
function VisitDrawer({ form, id, onClose }: { form: VisitFormKey; id: string; onClose: () => void }) {
  const [v, setV] = useState<(Visit & { definition: Definition }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "under" | "notes">("all");
  useEffect(() => {
    call<Visit & { definition: Definition }>(`/api/monitoring/${form}/visits/${id}`).then(setV).catch((e) => setError((e as Error).message));
  }, [form, id]);
  const photosOf = (key: string) => (v?.photos ?? []).filter((p) => p.item === key);
  const notes = v ? Object.values(v.answers ?? {}).filter((a) => a.note).length : 0;

  return (
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardList size={18} />} title={v ? v.branchName : tr("Visit")}
      description={v ? `${tl(v.definition, "title")} · ${wibDateTime(v.submittedAt)}` : undefined} focusFirstField={false}>
      {error ? <ErrorState message={error} /> : !v ? <SkeletonList rows={5} /> : (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:px-5">
              <div className="flex items-center gap-3">
                <ScorePill score={v.score} large />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{tr("Score of the visit")}</p>
                  <p className="text-xs text-neutral-500">{tr("{0} items rated", v.counts.under + v.counts.meet + v.counts.exceed)}</p>
                </div>
              </div>
              <div className="min-w-0">
                <div className="grid grid-cols-3 gap-2">
                  {RATINGS.map((r) => (
                    <div key={r} className={cx("rounded-xl px-3 py-2 text-center ring-1 ring-inset", RATING_STYLE[r].on)}>
                      <p className="text-lg font-bold tabular-nums leading-none">{v.counts[r.toLowerCase() as "under" | "meet" | "exceed"]}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">{ratingLabel(r)}</p>
                    </div>
                  ))}
                </div>
                <Bar c={v.counts} className="mt-2 h-2" />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-neutral-100 bg-neutral-100 sm:grid-cols-4">
              {v.audit ? <Fact icon={<UsersRound size={12} />} k={tr("SWAT team")} v={<>{v.audit.lead.name} <span className="text-[11px] font-normal text-neutral-400">({tr("lead")})</span>
                <span className="block text-[11px] font-normal text-neutral-400">{v.audit.members.filter((m) => m.id !== v.audit!.lead.id).map((m) => m.name).join(", ") || "—"}</span></>} />
                : <Fact icon={<UsersRound size={12} />} k="PIC" v={<>{v.name}<span className="block text-[11px] font-normal text-neutral-400">@{v.username}</span></>} />}
              <Fact icon={<CalendarDays size={12} />} k={tr("Started → sent")} v={<>{wibDateTime(v.submittedAt)}<span className="block text-[11px] font-normal text-neutral-400">{tr("started {0}", wibDateTime(v.startedAt))}</span></>} />
              <Fact icon={<MapPin size={12} />} k={tr("Location when sent")} v={v.latitude !== null && v.longitude !== null ? (
                <a href={mapsUrl(v.latitude, v.longitude)} target="_blank" rel="noreferrer" className={cx("hover:underline", v.outsideRadius ? "text-red-700" : "text-brand-700")}>
                  {v.distanceM !== null ? tr("{0} m from the outlet", v.distanceM) : `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`} <ExternalLink size={10} className="inline" />
                  {v.outsideRadius && <span className="block text-[11px] font-semibold">{tr("Outside Radius")}</span>}
                </a>) : tr("No position")} />
              <Fact icon={<Camera size={12} />} k={tr("Evidence")} v={<>{tr("{0} photos", v.photos?.length ?? 0)}<span className="block text-[11px] font-normal text-neutral-400">{tr("{0} notes", notes)}</span></>} />
            </dl>
          </section>

          {v.audit && <AuditEvaluation audit={v.audit} />}

          <Segmented label={tr("Show")} value={show} onChange={setShow}
            options={[{ value: "all", label: tr("All Items") }, { value: "under", label: tr("UNDER ({0})", v.counts.under) }, { value: "notes", label: tr("With notes or photos") }]} />

          {v.definition.groups.map((g) => {
            const sections = g.sections.map((sec) => ({ ...sec, items: sec.items.filter((it) => {
              const a = v.answers?.[it.key] ?? {};
              if (sec.retired && !a.rating && !a.note && !photosOf(it.key).length) return false; // an old list: only what this visit rated
              return show === "all" || (show === "under" ? a.rating === "UNDER" : !!a.note || photosOf(it.key).length > 0);
            }) })).filter((sec) => sec.items.length);
            if (!sections.length) return null;
            return (
              <section key={g.key} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">{tl(g, "title")} <span className="font-normal normal-case text-neutral-400">· {tl(g, "subtitle")}</span></p>
                {sections.map((sec) => (
                  <div key={sec.key} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
                      <p className="min-w-0 flex-1 text-sm font-semibold text-neutral-900">{tl(sec, "title")} <span className="font-normal text-neutral-400">· {tr("{0} items", sec.items.length)}</span></p>
                      {(() => {
                        const c = { under: 0, meet: 0, exceed: 0 };
                        for (const it of sec.items) { const r = v.answers?.[it.key]?.rating; if (r) c[r.toLowerCase() as "under" | "meet" | "exceed"] += 1; }
                        return <span className="flex items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                          {RATINGS.map((r) => c[r.toLowerCase() as "under" | "meet" | "exceed"] > 0 && <span key={r} className={cx("inline-flex items-center gap-1", RATING_STYLE[r].text)}><span className={cx("h-1.5 w-1.5 rounded-full", RATING_STYLE[r].dot)} />{c[r.toLowerCase() as "under" | "meet" | "exceed"]}</span>)}
                        </span>;
                      })()}
                    </div>
                    <ul className="divide-y divide-neutral-100">
                      {sec.items.map((it) => {
                        const a = v.answers?.[it.key] ?? {};
                        const ph = photosOf(it.key);
                        return (
                          <li key={it.key} className={cx("px-4 py-3", a.rating === "UNDER" && "bg-red-50/40")}>
                            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-2.5">
                              <span className="mt-0.5 text-right text-xs font-semibold tabular-nums text-neutral-400">{it.no}</span>
                              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-800">{tl(it)}
                                {a.stars != null && (
                                  <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold tabular-nums text-amber-800"
                                    title={a.source === "google" ? tr("Google Maps, automatic") : tr("Typed by the PIC")}>
                                    <Star size={11} className="fill-amber-400 text-amber-400" /> {fmtStars(a.stars)}
                                    {a.reviews != null && <span className="font-normal text-amber-700">· {tr("{0} reviews", fmtNumber(a.reviews))}</span>}
                                    <span className="font-normal text-amber-700">· {a.source === "google" ? "Google" : tr("manual")}</span>
                                  </span>
                                )}
                                {a.qty != null && (
                                  <span className="ml-2 inline-flex items-center whitespace-nowrap rounded-md bg-neutral-100 px-1.5 py-0.5 align-middle text-[11px] font-semibold tabular-nums text-neutral-700"
                                    title={tr("Stock quantity")}>{a.unit && a.unit !== "gram" ? `${a.qty.toLocaleString("id-ID")} ${a.unit}` : fmtGrams(a.qty)}</span>
                                )}
                              </span>
                              {a.rating ? <span className={cx("min-w-[4.5rem] rounded-md px-2 py-0.5 text-center text-[11px] font-bold", RATING_STYLE[a.rating as Rating].on)}>{ratingLabel(a.rating as Rating)}</span>
                                : it.kind === "text" ? <span /> : <span className="min-w-[4.5rem] text-center text-xs text-neutral-400">—</span>}
                            </div>
                            {(a.note || ph.length > 0) && (
                              <div className="ml-8 mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                {a.note ? <p className="flex items-start gap-1.5 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700"><MessageSquareText size={13} className="mt-0.5 flex-shrink-0 text-neutral-400" /><span className="whitespace-pre-line">{a.note}</span></p> : <span />}
                                {ph.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {ph.map((p) => (
                                      <a key={p.id} href={visitPhotoUrl(p.id)} target="_blank" rel="noreferrer" className="group block w-28" title={p.takenAt ? wibDateTime(p.takenAt) : undefined}>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                                        <img src={thumb(visitPhotoUrl(p.id), 320)} decoding="async" alt={tl(it)} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-1 ring-neutral-200 group-hover:ring-2 group-hover:ring-brand-400" />
                                        <span className={cx("mt-0.5 block truncate text-[10px]", p.outsideRadius ? "font-semibold text-red-600" : "text-neutral-400")}>
                                          {p.distanceM !== null ? tr("{0} m from the outlet", p.distanceM) : wibDateTime(p.takenAt ?? p.uploadedAt)}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
          {show === "under" && v.counts.under === 0 && <p className="py-6 text-center text-sm text-neutral-400">{tr("No UNDER in this visit")}</p>}
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{tr("Signature of the PIC")}</p>
          {v.signature ? (
            <section className="flex flex-col gap-3 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
              {/* eslint-disable-next-line @next/next/no-img-element -- private signature image through the API */}
              <img src={visitSignatureUrl(v.id)} alt={tr("Signature")} className="h-24 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-neutral-200" />
              <div className="text-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500"><PenLine size={13} /> {tr("Signature")}</p>
                <p className="font-semibold text-neutral-900">{v.signature.name ?? v.name}</p>
                {v.signature.signedAt && <p className="text-xs text-neutral-500">{wibDateTime(v.signature.signedAt)}</p>}
              </div>
            </section>
          ) : <p className="text-xs text-neutral-400">{tr("Sent without a signature.")}</p>}
        </div>
      )}
    </Drawer>
  );
}

function Fact({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="bg-neutral-50/80 px-4 py-2.5">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{icon}{k}</dt>
      <dd className="mt-0.5 text-sm font-medium text-neutral-900">{v}</dd>
    </div>
  );
}

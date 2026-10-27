"use client";

// Monitoring → Monitoring Product / Monitoring Outlet (pages mon.product, mon.outlet): the visits the PICs sent for a
// period. Tabs: Visits (the list, one visit in full in a drawer), Analysis (performance per section, the most frequent
// findings, the stars per platform) and Attendance (one visit per outlet per day: the days each PIC visited and the days
// off — a day without any visit).

import { AlertTriangle, BarChart3, CalendarDays, CalendarOff, Camera, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, MapPin, MessageSquareText, PenLine, Star,
  UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay } from "@/so/ui/Filters";
import { Segmented } from "@/so/ui/Simple";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { call } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";
import { type Definition, type Platform, type Rating, type Visit, type VisitFormKey, PLATFORM_LABEL, RATINGS, RATING_STYLE, fmtStars, ratingLabel, scoreTone, tl, visitPhotoUrl, visitSignatureUrl } from "./visit";

type SectionPerf = { key: string; title: string; titleEn?: string; group: string; under: number; meet: number; exceed: number };
type Finding = { key: string; label: string; labelEn?: string; section: string; sectionEn?: string; count: number; branches: string[] };
type Attendance = { days: string[]; today: string; since: string; pics: { id: string; username: string; name: string; branches: number; active: number; off: number; visits: number; days: Record<string, number> }[] };
type Result = {
  period: { from: string; to: string }; definition: Definition; data: Visit[]; sections: SectionPerf[]; findings: Finding[];
  summary: { visits: number; branches: number; pics: number; under: number; meet: number; exceed: number; score: number | null; outside: number };
  pics: { id: string; name: string; n: number }[]; truncated: boolean; attendance?: Attendance;
  /** Monitoring Outlet: average stars per platform of the visits that carry one */
  platforms?: { key: string; platform: Platform; label: string; stars: number | null; visits: number }[];
};
type BranchOpt = { branch_code: string; branch_name: string };
type F = { period: Period; group: string; branch: string; user: string; only: "" | "under" | "outside" };
type GroupOpt = { id: string; code: string; name: string };
type Tab = "visits" | "analysis" | "attendance";

const NO_F = (): F => ({ period: { from: wibDay(-29), to: wibDay(0) }, group: "", branch: "", user: "", only: "" });
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Bar({ c, className }: { c: { under: number; meet: number; exceed: number }; className?: string }) {
  const total = c.under + c.meet + c.exceed;
  return (
    <span className={cx("flex h-2 gap-px overflow-hidden rounded-full bg-slate-100", className)}>
      {total > 0 && (["under", "meet", "exceed"] as const).map((k, i) => c[k] > 0 && (
        <span key={k} className={RATING_STYLE[RATINGS[i]].bar} style={{ width: `${(c[k] / total) * 100}%` }} />
      ))}
    </span>
  );
}

function ScorePill({ score, large }: { score: number | null; large?: boolean }) {
  const tone = score === null ? "bg-slate-100 text-slate-500" : score >= 90 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : score >= 75 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-red-50 text-red-700 ring-red-200";
  return <span className={cx("inline-flex items-center justify-center rounded-lg font-semibold tabular-nums ring-1 ring-inset", tone, large ? "h-12 min-w-[4.5rem] px-3 text-xl" : "h-7 min-w-[3.5rem] px-2 text-sm")}>{score === null ? "—" : `${score}%`}</span>;
}

export default function VisitMonitor({ form }: { form: VisitFormKey }) {
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

  const title = res ? tl(res.definition, "title") : (form === "product" ? "Monitoring Product" : "Monitoring Outlet");
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
    ...(f.group ? [{ key: "g", label: `${tr("Group")} ${f.group === "none" ? tr("Without a group") : groups.find((g) => g.id === f.group)?.code ?? ""}`, onRemove: () => setF({ ...f, group: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.user ? [{ key: "u", label: res?.pics.find((p) => p.id === f.user)?.name ?? tr("PIC"), onRemove: () => setF({ ...f, user: "" }) }] : []),
    ...(f.only ? [{ key: "o", label: f.only === "under" ? tr("With UNDER findings") : tr("Outside radius"), onRemove: () => setF({ ...f, only: "" }) }] : []),
  ];
  const toggle = (only: F["only"]) => { setTab("visits"); setF({ ...f, only: f.only === only ? "" : only }); };

  return (
    <Page title={title} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("visits of the PICs to the outlets")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Visits")} emphasis icon={<ClipboardList size={13} />} value={s ? fmtNumber(s.visits) : <StatSkeleton />}>
            {s && <p>{tr("{0} outlets · {1} PICs", fmtNumber(s.branches), fmtNumber(s.pics))}</p>}
          </Stat>
          <Stat label={tr("Average score")} icon={<BarChart3 size={13} />} value={s ? <span className={scoreTone(s.score)}>{s.score === null ? "—" : `${s.score}%`}</span> : <StatSkeleton />}>
            {s && <p>{tr("items rated MEET or EXCEED")}</p>}
          </Stat>
          <Stat label={tr("UNDER findings")} icon={<AlertTriangle size={13} />} onClick={s ? () => toggle("under") : undefined} active={f.only === "under"}
            value={s ? <span className={s.under ? "text-red-600" : undefined}>{fmtNumber(s.under)}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} MEET · {1} EXCEED", fmtNumber(s.meet), fmtNumber(s.exceed))}</p>}
          </Stat>
          <Stat label={tr("Days off")} icon={<CalendarOff size={13} />} onClick={att ? () => setTab("attendance") : undefined} active={tab === "attendance"}
            value={att ? fmtNumber(offDays) : <StatSkeleton />}>
            {att && <p>{tr("days without a visit · {0} PICs", fmtNumber(att.pics.length))}</p>}
          </Stat>
        </StatStrip>
      }>
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1" role="tablist" aria-label={tr("Sections")}>
        {([["visits", tr("Visits"), <ClipboardList key="v" size={15} />, res?.data.length], ["analysis", tr("Analysis"), <BarChart3 key="a" size={15} />, null],
          ["attendance", tr("PIC attendance"), <CalendarDays key="t" size={15} />, att?.pics.length]] as [Tab, string, React.ReactNode, number | null | undefined][]).map(([k, label, icon, n]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx("-mb-px inline-flex flex-shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              tab === k ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {icon}{label}{n != null && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600">{fmtNumber(n)}</span>}
          </button>
        ))}
      </div>

      {tab === "analysis" && (!res ? <div className="skeleton h-64 rounded-xl" /> : res.data.length === 0 ? (
        <Panel><Empty icon={<BarChart3 size={28} />} title={tr("No visit in this period")}>{tr("The analysis appears as soon as the PICs send their visits.")}</Empty></Panel>
      ) : (
        <div className="space-y-4">
          {!!res.platforms?.length && (
            <Panel title={tr("Outlet rating per platform")} description={tr("Average stars of the visits of the period: Google Maps automatic, delivery apps typed by the PIC")}>
              <ul className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
                {res.platforms.map((p) => (
                  <li key={p.key} className="bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{PLATFORM_LABEL[p.platform]}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-xl font-semibold tabular-nums text-slate-900">
                      <Star size={17} className={p.stars === null ? "text-slate-300" : "fill-amber-400 text-amber-400"} /> {p.stars === null ? "—" : fmtStars(p.stars)}
                    </p>
                    <p className="text-[11px] text-slate-500">{tr("{0} visits", fmtNumber(p.visits))}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={tr("Performance per section")} description={tr("Ratings of every visit of the period")}
              actions={<span className="flex items-center gap-2.5 text-[11px] text-slate-500">{RATINGS.map((r) => <span key={r} className="inline-flex items-center gap-1"><span className={cx("h-2 w-2 rounded-full", RATING_STYLE[r].dot)} />{ratingLabel(r)}</span>)}</span>}>
              <ul className="divide-y divide-slate-100">
                {res.sections.map((sec) => {
                  const total = sec.under + sec.meet + sec.exceed;
                  const pct = total ? Math.round(((sec.meet + sec.exceed) / total) * 1000) / 10 : null;
                  return (
                    <li key={sec.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{tl(sec, "title")}</span>
                      <span className={cx("row-span-2 text-sm font-semibold tabular-nums", scoreTone(pct))}>{pct === null ? "—" : `${pct}%`}</span>
                      <span className="flex items-center gap-2"><Bar c={sec} className="flex-1" /><span className="w-24 text-right text-[11px] tabular-nums text-slate-500">{sec.under}/{sec.meet}/{sec.exceed}</span></span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            <Panel title={tr("Most frequent findings")} description={tr("Items rated UNDER most often")}>
              {res.findings.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{tr("No UNDER in this period")}</p> : (
                <ul className="divide-y divide-slate-100">
                  {res.findings.map((x, i) => (
                    <li key={x.key} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="mt-0.5 w-4 text-right text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{tl(x)}</span>
                        <span className="block truncate text-[11px] text-slate-500" title={x.branches.join(", ")}>{tl(x, "section")} · {tr("{0} outlets", x.branches.length)}</span>
                      </span>
                      <Badge tone="red">{x.count}×</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      ))}

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
              <ul className="divide-y divide-slate-100 md:hidden">
                {paged.rows.map((v) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setOpen(v.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                      <ScorePill score={v.score} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{v.branchName}</span>
                        <span className="block truncate text-xs text-slate-500">{v.name} · {wibDateTime(v.submittedAt)}</span>
                        <Bar c={v.counts} className="mt-1.5" />
                      </span>
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className={theadClass}>
                    <tr>
                      <th className="py-2.5 pl-5 pr-3">{tr("Outlet")}</th><th className="px-3 py-2.5">{tr("PIC")}</th><th className="px-3 py-2.5">{tr("Sent")}</th>
                      <th className="px-3 py-2.5">{tr("Result")}</th><th className="px-3 py-2.5 text-center">{tr("Score")}</th>
                      <th className="px-3 py-2.5 text-right">{tr("Photos")}</th><th className="px-3 py-2.5">{tr("Location")}</th><th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!res ? <SkeletonRows cols={8} /> : paged.rows.map((v) => (
                      <tr key={v.id} onClick={() => setOpen(v.id)} className="group cursor-pointer hover:bg-blue-50/40">
                        <td className="max-w-[16rem] py-3 pl-5 pr-3"><span className="block truncate font-semibold text-slate-900">{v.branchName}</span><span className="text-[11px] text-slate-400">{v.branchCode}</span></td>
                        <td className="px-3 py-3">
                          <span className="flex items-center gap-2"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initials(v.name)}</span>
                            <span className="min-w-0"><span className="block truncate text-slate-800">{v.name}</span><span className="text-[11px] text-slate-400">@{v.username}</span></span></span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-slate-600">{wibDateTime(v.submittedAt)}</td>
                        <td className="w-56 px-3 py-3">
                          <Bar c={v.counts} />
                          <span className="mt-1 block text-[11px] text-slate-500"><span className={v.counts.under ? "font-semibold text-red-600" : ""}>{v.counts.under} UNDER</span> · {v.counts.meet} MEET · {v.counts.exceed} EXCEED</span>
                        </td>
                        <td className="px-3 py-3 text-center"><ScorePill score={v.score} /></td>
                        <td className="px-3 py-3 text-right tabular-nums text-slate-600"><span className="inline-flex items-center gap-1"><Camera size={12} className="text-slate-400" />{v.photoCount ?? 0}</span></td>
                        <td className="px-3 py-3">
                          {v.distanceM === null ? <Badge>{tr("No position")}</Badge> : v.outsideRadius ? <Badge tone="red" icon={<MapPin size={11} />}>{v.distanceM} m</Badge> : <Badge tone="green">{v.distanceM} m</Badge>}
                        </td>
                        <td className="pr-3 text-slate-300 group-hover:text-blue-600"><ChevronRight size={16} /></td>
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
    <Panel title={tr("PIC attendance")} description={att ? tr("{0}: {1} days in the month · counted from {2} · one visit per outlet per day; a past day without any visit is a day off", label, dates.length, dmy(att.since), ) : tr("Loading…")}
      actions={<div className="flex flex-wrap items-center gap-3">
        <span className="hidden items-center gap-3 text-[11px] text-slate-500 lg:flex">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />{tr("Visit")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />{tr("Day off")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-inset ring-slate-300" />{tr("Today")}</span>
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />{tr("Not counted")}</span>
        </span>
        <span className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="rounded-l-lg p-2 text-slate-500 hover:bg-slate-50" aria-label={tr("Previous month")}><ChevronLeft size={15} /></button>
          <span className="min-w-[8.5rem] px-2 text-center text-sm font-semibold capitalize text-slate-900">{label}</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= current} className="rounded-r-lg p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-30" aria-label={tr("Next month")}><ChevronRight size={15} /></button>
        </span>
      </div>}>
      {error ? <ErrorState message={error} /> : !att ? <div className="skeleton m-4 h-48 rounded-lg" /> : att.pics.length === 0 ? (
        <Empty icon={<UsersRound size={28} />} title={tr("No PIC with this form")}>{tr("PICs appear here when their account has the form page and an outlet in scope.")}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="sticky left-0 z-10 min-w-[14rem] bg-slate-50 py-2.5 pl-5 pr-3">{tr("PIC")}</th>
                <th className="px-2 py-2.5 text-right">{tr("Visited")}</th><th className="px-2 py-2.5 text-right">{tr("Days off")}</th><th className="px-2 py-2.5 text-right">{tr("Visits")}</th>
                {dates.map((d) => (
                  <th key={d} className={cx("w-6 px-0 py-2.5 text-center text-[10px] tabular-nums", d === att.today ? "text-blue-700" : sunday(d) ? "text-red-500" : "")}>{Number(d.slice(8))}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {att.pics.map((p) => (
                <tr key={p.id} onClick={() => onPic(p.id)} className="group cursor-pointer hover:bg-blue-50/40" title={tr("Show the visits of {0}", p.name)}>
                  <td className="sticky left-0 z-10 bg-white py-2 pl-5 pr-3 group-hover:bg-blue-50/40">
                    <span className="flex items-center gap-2"><span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{initials(p.name)}</span>
                      <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{p.name}</span><span className="text-[11px] text-slate-400">@{p.username} · {tr("{0} outlets", p.branches)}</span></span></span>
                  </td>
                  <td className="px-2 py-2 text-right"><span className="font-semibold tabular-nums text-slate-900">{p.active}</span><span className="block text-[10px] text-slate-400">/{counted.size}</span></td>
                  <td className={cx("px-2 py-2 text-right font-semibold tabular-nums", p.off ? "text-amber-700" : "text-slate-400")}>{p.off}<span className="block text-[10px] font-normal text-slate-400">/{past}</span></td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">{p.visits}</td>
                  {dates.map((d) => {
                    const n = p.days[d];
                    const state = n ? "visit" : !counted.has(d) ? "none" : d === att.today ? "today" : "off";
                    return (
                      <td key={d} className="px-px py-2 text-center">
                        <span title={`${dmy(d)} · ${n ? tr("{0} visits", n) : state === "today" ? tr("Today, not yet") : state === "off" ? tr("Day off") : tr("Not counted")}`}
                          className={cx("mx-auto flex h-6 w-5 items-center justify-center rounded text-[10px] font-semibold tabular-nums",
                            state === "visit" ? "bg-emerald-500 text-white" : state === "off" ? "bg-amber-200 text-amber-800" : state === "today" ? "bg-white ring-1 ring-inset ring-slate-300" : "bg-slate-100")}>
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

function VisitFilters({ value, groups, branches, pics, onApply, onClose }: {
  value: F; groups: GroupOpt[]; branches: BranchOpt[]; pics: { id: string; name: string }[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F())} applyDisabled={days > 366}>
      <FilterSection title={tr("Visit day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={366} /></FilterSection>
      {groups.length > 0 && (
        <FilterSection title={tr("Branch group")}>
          <ChoiceGroup label="" value={d.group} onChange={(v) => setD({ ...d, group: v })}
            choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a group") }]} />
        </FilterSection>
      )}
      <FilterSection title={tr("Outlet")}>
        <SearchChoice label="" anyLabel={tr("All outlets")} value={d.branch} onChange={(v) => setD({ ...d, branch: v })} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name }))} />
      </FilterSection>
      <FilterSection title={tr("PIC")}>
        <SearchChoice label="" anyLabel={tr("All PICs")} value={d.user} onChange={(v) => setD({ ...d, user: v })} placeholder={tr("Search PIC")}
          options={pics.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterSection>
      <FilterSection title={tr("Show only")}>
        <ChoiceGroup label="" value={d.only} onChange={(v) => setD({ ...d, only: v as F["only"] })}
          choices={[{ value: "", label: tr("All visits") }, { value: "under", label: tr("With UNDER findings") }, { value: "outside", label: tr("Outside radius") }]} />
      </FilterSection>
    </FilterSheet>
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
      {error ? <ErrorState message={error} /> : !v ? <div className="skeleton h-64 rounded-xl" /> : (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-5">
              <ScorePill score={v.score} large />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Score of the visit")}</p>
                <Bar c={v.counts} className="mt-1.5 h-2.5" />
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs">
                  {RATINGS.map((r) => <span key={r} className={cx("inline-flex items-center gap-1 font-semibold", RATING_STYLE[r].text)}><span className={cx("h-2 w-2 rounded-full", RATING_STYLE[r].dot)} />{v.counts[r.toLowerCase() as "under" | "meet" | "exceed"]} {r}</span>)}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/60 sm:grid-cols-4">
              <Fact icon={<UsersRound size={12} />} k="PIC" v={<>{v.name}<span className="block text-[11px] font-normal text-slate-400">@{v.username}</span></>} />
              <Fact icon={<CalendarDays size={12} />} k={tr("Started → sent")} v={<>{wibDateTime(v.submittedAt)}<span className="block text-[11px] font-normal text-slate-400">{tr("started {0}", wibDateTime(v.startedAt))}</span></>} />
              <Fact icon={<MapPin size={12} />} k={tr("Location when sent")} v={v.latitude !== null && v.longitude !== null ? (
                <a href={mapsUrl(v.latitude, v.longitude)} target="_blank" rel="noreferrer" className={cx("hover:underline", v.outsideRadius ? "text-red-700" : "text-blue-700")}>
                  {v.distanceM !== null ? tr("{0} m from the outlet", v.distanceM) : `${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`} <ExternalLink size={10} className="inline" />
                  {v.outsideRadius && <span className="block text-[11px] font-semibold">{tr("Outside radius")}</span>}
                </a>) : tr("No position")} />
              <Fact icon={<Camera size={12} />} k={tr("Evidence")} v={<>{tr("{0} photos", v.photos?.length ?? 0)}<span className="block text-[11px] font-normal text-slate-400">{tr("{0} notes", notes)}</span></>} />
            </dl>
          </section>

          <Segmented label={tr("Show")} value={show} onChange={setShow}
            options={[{ value: "all", label: tr("All items") }, { value: "under", label: tr("UNDER ({0})", v.counts.under) }, { value: "notes", label: tr("With notes or photos") }]} />

          {v.definition.groups.map((g) => {
            const sections = g.sections.map((sec) => ({ ...sec, items: sec.items.filter((it) => {
              const a = v.answers?.[it.key] ?? {};
              return show === "all" || (show === "under" ? a.rating === "UNDER" : !!a.note || photosOf(it.key).length > 0);
            }) })).filter((sec) => sec.items.length);
            if (!sections.length) return null;
            return (
              <section key={g.key} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{tl(g, "title")} <span className="font-normal normal-case text-slate-400">· {tl(g, "subtitle")}</span></p>
                {sections.map((sec) => (
                  <div key={sec.key} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">{tl(sec, "title")}</p>
                    <ul className="divide-y divide-slate-100">
                      {sec.items.map((it) => {
                        const a = v.answers?.[it.key] ?? {};
                        const ph = photosOf(it.key);
                        return (
                          <li key={it.key} className={cx("px-4 py-3", a.rating === "UNDER" && "bg-red-50/40")}>
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{it.no}</span>
                              <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{tl(it)}
                                {a.stars != null && (
                                  <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold tabular-nums text-amber-800"
                                    title={a.source === "google" ? tr("Google Maps, automatic") : tr("Typed by the PIC")}>
                                    <Star size={11} className="fill-amber-400 text-amber-400" /> {fmtStars(a.stars)}
                                    {a.reviews != null && <span className="font-normal text-amber-700">· {tr("{0} reviews", fmtNumber(a.reviews))}</span>}
                                    <span className="font-normal text-amber-700">· {a.source === "google" ? "Google" : tr("manual")}</span>
                                  </span>
                                )}
                              </span>
                              {a.rating ? <span className={cx("rounded-md px-2 py-0.5 text-[11px] font-bold", RATING_STYLE[a.rating as Rating].on)}>{ratingLabel(a.rating as Rating)}</span>
                                : it.kind === "text" ? null : <span className="text-xs text-slate-400">—</span>}
                            </div>
                            {(a.note || ph.length > 0) && (
                              <div className="ml-7 mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                {a.note ? <p className="flex items-start gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><MessageSquareText size={13} className="mt-0.5 flex-shrink-0 text-slate-400" /><span className="whitespace-pre-line">{a.note}</span></p> : <span />}
                                {ph.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {ph.map((p) => (
                                      <a key={p.id} href={visitPhotoUrl(p.id)} target="_blank" rel="noreferrer" className="group block w-24" title={p.takenAt ? wibDateTime(p.takenAt) : undefined}>
                                        {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                                        <img src={visitPhotoUrl(p.id)} alt={tl(it)} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200 group-hover:ring-2 group-hover:ring-blue-400" />
                                        <span className={cx("mt-0.5 block truncate text-[10px]", p.outsideRadius ? "font-semibold text-red-600" : "text-slate-400")}>
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
          {show === "under" && v.counts.under === 0 && <p className="py-6 text-center text-sm text-slate-400">{tr("No UNDER in this visit")}</p>}
          {v.signature ? (
            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
              {/* eslint-disable-next-line @next/next/no-img-element -- private signature image through the API */}
              <img src={visitSignatureUrl(v.id)} alt={tr("Signature")} className="h-24 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
              <div className="text-sm">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><PenLine size={13} /> {tr("Signature")}</p>
                <p className="font-semibold text-slate-900">{v.signature.name ?? v.name}</p>
                {v.signature.signedAt && <p className="text-xs text-slate-500">{wibDateTime(v.signature.signedAt)}</p>}
              </div>
            </section>
          ) : <p className="text-xs text-slate-400">{tr("Sent without a signature.")}</p>}
        </div>
      )}
    </Drawer>
  );
}

function Fact({ icon, k, v }: { icon: React.ReactNode; k: string; v: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 px-4 py-2.5 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 [&:nth-child(2)]:border-t-0">
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{icon}{k}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{v}</dd>
    </div>
  );
}

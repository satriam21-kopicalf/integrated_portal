"use client";

// Monitoring → PIC Check In (page mon.pic-check-in): every check-in of a period — who, which outlet, when, the face
// photo and where the PIC was compared with the outlet. Figures of the period, visits per PIC, one Filters drawer,
// a detail drawer with the photo and map links.
// Alerts: check-ins outside the radius and those with signs of a faked position (fake GPS, app/pic_checkin.py assess)
// stand out (banner, badges, a figure of their own); a manager reviews them (valid / not valid). Refreshes every minute
// while the period includes today.

import { AlertTriangle, CalendarDays, CheckCircle2, ExternalLink, Layers, MapPin, MapPinOff, ScanFace, ShieldAlert, SignalLow, Store, UserRound, UsersRound, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, cx, fmtNumber, inputClass, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, FilterToolbar, Period, SegmentBar, dmy, wibDay } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet, OptionList, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import { wibDay as dayOf } from "@/so/lib/wib";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { type CheckIn, call, photoUrl, suspect } from "@/so/features/checkin/checkin";
import { type Kind, kindSlug, setKind, swapKind } from "@/so/features/checkin/checkin";
import { tr as baseTr } from "@/lib/i18n";
import { thumb } from "@/lib/assets";
const tr = (key: string, ...args: (string | number | null | undefined)[]) => baseTr(swapKind(key), ...args);

type Summary = { total: number; pics: number; branches: number; outside: number; low: number; unlocated: number; inside: number;
  suspect: number; suspect_high: number; unreviewed: number };
type Result = { period: { from: string; to: string }; data: CheckIn[]; summary: Summary; pics: { id: string; name: string; n: number }[]; truncated: boolean };
type BranchOpt = { branch_code: string; branch_name: string };
type Detail = "checkins" | "pics" | "outlets" | "outside";
type F = { period: Period; group: string; branch: string; user: string; location: string };
type GroupOpt = { id: string; code: string; name: string };

const NO_F = (): F => ({ period: { from: wibDay(-6), to: wibDay(0) }, group: "", branch: "", user: "", location: "" });
const LOC: Record<string, () => string> = {
  unreviewed: () => tr("Needs review"), alert: () => tr("Outside radius or suspicious location"),
  suspect: () => tr("Suspicious Location"), outside: () => tr("Outside Radius"), low: () => tr("Low GPS accuracy"),
  unlocated: () => tr("Outlet Has No Coordinates"),
};
const REFRESH_MS = 60_000;

function RiskTags({ c }: { c: CheckIn }) {
  return (
    <>
      {suspect(c) && <Badge tone={c.riskLevel === "high" ? "red" : "amber"} icon={<ShieldAlert size={11} />}
        title={(c.riskSignals ?? []).map((x) => x.text).join("\n")}>{tr("Suspicious Location")}</Badge>}
      {c.review && (c.review.status === "valid"
        ? <Badge tone="green" icon={<CheckCircle2 size={11} />}>{tr("Reviewed: valid")}</Badge>
        : <Badge tone="red" icon={<XCircle size={11} />}>{tr("Reviewed: not valid")}</Badge>)}
    </>
  );
}

function LocationTags({ c, distance = true }: { c: CheckIn; distance?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {!c.outletLocated ? <Badge tone="slate" icon={<MapPinOff size={11} />}>{tr("Outlet Has No Coordinates")}</Badge>
        : c.outsideRadius ? <Badge tone="red" icon={<MapPin size={11} />}>{tr("Outside Radius")}</Badge>
        : <Badge tone="green">{tr("At the Outlet")}</Badge>}
      {c.lowAccuracy && <Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low GPS accuracy")}</Badge>}
      <RiskTags c={c} />
      {distance && c.distanceM !== null && <span className="text-[11px] tabular-nums text-neutral-500">{c.distanceM} m{c.accuracyM !== null ? ` ±${Math.round(c.accuracyM)}` : ""}</span>}
    </span>
  );
}

export default function CheckInMonitor({ kind = "pic" }: { kind?: Kind }) {
  setKind(kind);
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [groups, setGroups] = useState<GroupOpt[]>([]);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<CheckIn | null>(null);
  // a summary figure opened: its details in a drawer
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async (quiet = false) => {
    setError(null);
    if (!quiet) setRes(null);
    const q = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.group ? { group: f.group } : {}), ...(f.branch ? { branch: f.branch } : {}),
      ...(f.user ? { userId: f.user } : {}), ...(f.location ? { location: f.location } : {}) });
    try {
      setRes(await call<Result>(`/api/monitoring/${kindSlug()}?${q}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f]);
  useEffect(() => { void load(); }, [load]);
  // while the period includes today: new check-ins (and their alerts) appear without reloading
  useEffect(() => {
    if (f.period.to < wibDay(0)) return;
    const t = setInterval(() => { if (!document.hidden) void load(true); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load, f.period.to]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => { void call<{ groups: GroupOpt[] }>("/api/monitoring/branch-groups").then((r) => setGroups(r.groups)).catch(() => setGroups([])); }, []);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (res?.data ?? []).filter((c) => !s || c.name.toLowerCase().includes(s) || c.username.toLowerCase().includes(s) || c.branchName.toLowerCase().includes(s));
  }, [res, search]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f));
  const s = res?.summary;
  const pics = res?.pics ?? [];
  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.group ? [{ key: "g", label: `${tr("Group")} ${groups.find((g) => g.id === f.group)?.code ?? ""}`, onRemove: () => setF({ ...f, group: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.user ? [{ key: "u", label: pics.find((p) => p.id === f.user)?.name ?? tr("PIC"), onRemove: () => setF({ ...f, user: "" }) }] : []),
    ...(f.location ? [{ key: "l", label: LOC[f.location](), onRemove: () => setF({ ...f, location: "" }) }] : []),
  ];

  return (
    <Page title={tr("PIC Check In")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("visits of the PICs to the outlets")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Check-ins")} emphasis icon={<CalendarDays size={13} />} onClick={s ? () => setDetail("checkins") : undefined} active={detail === "checkins"} value={s ? fmtNumber(s.total) : <StatSkeleton />}>
            {s && <p>{tr("{0} days", Math.round((Date.parse(f.period.to) - Date.parse(f.period.from)) / 864e5) + 1)}</p>}
          </Stat>
          <Stat label={tr("PICs")} icon={<UsersRound size={13} />} onClick={s ? () => setDetail("pics") : undefined} active={detail === "pics"} value={s ? fmtNumber(s.pics) : <StatSkeleton />}>
            {s && <p>{tr("who checked in")}</p>}
          </Stat>
          <Stat label={tr("Outlets Visited")} icon={<Store size={13} />} onClick={s ? () => setDetail("outlets") : undefined} active={detail === "outlets"} value={s ? fmtNumber(s.branches) : <StatSkeleton />}>
            {s && <p>{tr("different outlets")}</p>}
          </Stat>
          <Stat label={tr("Outside Radius")} icon={<MapPin size={13} />} onClick={s ? () => setDetail("outside") : undefined} active={detail === "outside"} value={s ? fmtNumber(s.outside) : <StatSkeleton />}>
            {s && <p>{tr("{0} low GPS accuracy · {1} outlet without coordinates", fmtNumber(s.low), fmtNumber(s.unlocated))}</p>}
          </Stat>
          <Stat label={tr("Suspicious Location")} icon={<ShieldAlert size={13} />} active={f.location === "suspect"}
            onClick={s ? () => setF({ ...f, location: f.location === "suspect" ? "" : "suspect" }) : undefined}
            value={s ? <span className={s.suspect ? "text-red-600" : undefined}>{fmtNumber(s.suspect)}</span> : <StatSkeleton />}>
            {s && <p>{tr("{0} high risk · signs of fake GPS", fmtNumber(s.suspect_high))}</p>}
          </Stat>
        </StatStrip>
      }>

      {s && s.unreviewed > 0 && f.location !== "unreviewed" && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:flex-row sm:items-center">
          <AlertTriangle size={18} className="hidden flex-shrink-0 text-red-600 sm:block" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{tr("{0} check-ins need review", fmtNumber(s.unreviewed))}</p>
            <p className="text-xs">{tr("{0} outside the radius · {1} with signs of a faked location (fake GPS)", fmtNumber(s.outside), fmtNumber(s.suspect))}</p>
          </div>
          <Button size="sm" variant="danger" onClick={() => setF({ ...f, location: "unreviewed" })}>{tr("Show them")}</Button>
        </div>
      )}

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search PIC or outlet")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""} · {tr("Times in WIB (server time)")}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : res && rows.length === 0 ? (
          <Empty icon={<ScanFace size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No check in in this period")}>
            {!res.data.length && tr("Check-ins appear here as soon as the PICs send them from Form → PIC Check In.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {paged.rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpen(c)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                    <img src={thumb(photoUrl(c.id), 96)} decoding="async" alt="" loading="lazy" className="h-12 w-12 flex-shrink-0 rounded-lg bg-neutral-100 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900">{c.name}</span>
                      <span className="block truncate text-xs text-neutral-500">{c.branchName} · {wibDateTime(c.visitedAt)}</span>
                      <span className="mt-1 block"><LocationTags c={c} /></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className={theadClass}>
                  <tr>
                    <th className="w-16 px-4 py-2.5">{tr("Photo")}</th>
                    <th className="px-4 py-2.5">{tr("PIC")}</th>
                    <th className="px-4 py-2.5">{tr("Outlet")}</th>
                    <th className="px-4 py-2.5">{tr("Visit Time")}</th>
                    <th className="px-4 py-2.5">{tr("Location")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {!res ? <SkeletonRows cols={5} /> : paged.rows.map((c) => (
                    <tr key={c.id} onClick={() => setOpen(c)} className={cx("cursor-pointer", (c.outsideRadius || suspect(c)) && !c.review ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-neutral-50/70")}>
                      <td className="px-4 py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                        <img src={thumb(photoUrl(c.id), 96)} decoding="async" alt={tr("Face Photo")} loading="lazy" className="h-11 w-11 rounded-lg bg-neutral-100 object-cover" />
                      </td>
                      <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{c.name}</span><span className="text-xs text-neutral-400">@{c.username}</span></td>
                      <td className="max-w-[16rem] px-4 py-2.5"><span className="block truncate text-neutral-800">{c.branchName}</span><span className="text-xs text-neutral-400">{c.branchCode}</span></td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-neutral-700">{wibDateTime(c.visitedAt)}</td>
                      <td className="px-4 py-2.5"><LocationTags c={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <CheckInFilters value={f} groups={groups} branches={branches} pics={pics} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <CheckInDrawer c={res?.data.find((x) => x.id === open.id) ?? open} onClose={() => setOpen(null)} onReviewed={() => void load(true)} />}
      {detail && res && <DetailDrawer kind={detail} data={res.data} summary={res.summary} truncated={res.truncated} onClose={() => setDetail(null)}
        onPic={(id) => { setF({ ...f, user: id }); setDetail(null); }} onOutlet={(code) => { setF({ ...f, branch: code }); setDetail(null); }}
        onOpen={(c) => setOpen(c)} />}
    </Page>
  );
}

function CheckInFilters({ value, groups, branches, pics, onApply, onClose }: {
  value: F; groups: GroupOpt[]; branches: BranchOpt[]; pics: { id: string; name: string }[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const def = NO_F();
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  const period = periodLabel(d.period, def.period);
  const groupName = groups.find((g) => g.id === d.group)?.code ?? null;
  const active = [period, d.group, d.branch, d.user, d.location].filter(Boolean).length;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)} applyDisabled={days > 93}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Period")} value={period ?? tr("Last 7 Days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={93} />
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Outlet")} value={branches.find((b) => b.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} allLabel={tr("All Outlets")} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code }))} />
      </FilterRow>
      <FilterRow icon={<UserRound size={15} />} label={tr("PIC")} value={pics.find((p) => p.id === d.user)?.name ?? null} onClear={() => setD({ ...d, user: "" })}>
        <ComboFilter value={d.user} onChange={(v) => setD({ ...d, user: v })} allLabel={tr("All PICs")} placeholder={tr("Search PIC")}
          options={pics.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterRow>
      <FilterRow icon={<MapPin size={15} />} label={tr("Location")} value={d.location ? LOC[d.location]() : null} onClear={() => setD({ ...d, location: "" })}>
        <OptionList value={d.location} onChange={(v) => setD({ ...d, location: v })}
          choices={[{ value: "", label: tr("All Check-ins") }, ...Object.keys(LOC).map((k) => ({ value: k, label: LOC[k]() }))]} />
      </FilterRow>
      {groups.length > 0 && (
        <FilterRow icon={<Layers size={15} />} label={tr("Branch Group")} value={groupName} onClear={() => setD({ ...d, group: "" })}>
          <Segments value={d.group} onChange={(v) => setD({ ...d, group: v })}
            choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g.id, label: g.code }))]} />
        </FilterRow>
      )}
    </MonitorFilterSheet>
  );
}

function CheckInDrawer({ c, onClose, onReviewed }: { c: CheckIn; onClose: () => void; onReviewed: () => void }) {
  const skew = c.deviceTime ? Math.round((Date.parse(c.deviceTime) - Date.parse(c.visitedAt)) / 60_000) : null;
  const risky = suspect(c);
  // the verdict at a glance: where the PIC was, the location check, the review
  const verdict = !c.outletLocated ? { tone: "slate", icon: <MapPinOff size={20} />, title: tr("Outlet Has No Coordinates"), text: tr("Set the outlet's location in Cost Control → Outlet Locations") }
    : c.outsideRadius ? { tone: "red", icon: <MapPin size={20} />, title: tr("Outside Radius"), text: tr("{0} m from the outlet (radius {1} m)", c.distanceM ?? "?", c.radiusM ?? 100) }
    : { tone: "green", icon: <CheckCircle2 size={20} />, title: tr("At the Outlet"), text: tr("{0} m from the outlet (radius {1} m)", c.distanceM ?? 0, c.radiusM ?? 100) };
  const toneBox: Record<string, string> = { green: "border-emerald-200 bg-emerald-50 text-emerald-900", red: "border-red-200 bg-red-50 text-red-900", slate: "border-neutral-200 bg-neutral-50 text-neutral-800" };
  const toneIcon: Record<string, string> = { green: "bg-emerald-600", red: "bg-red-600", slate: "bg-neutral-500" };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<ScanFace size={18} />} title={c.name} description={`${c.branchName} · ${wibDateTime(c.visitedAt)}`}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <a href={photoUrl(c.id)} target="_blank" rel="noreferrer" className="group relative block overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
            <img src={thumb(photoUrl(c.id), 640)} decoding="async" loading="lazy" alt={tr("Face Photo")} className="aspect-[3/4] w-full object-cover transition group-hover:scale-[1.02]" />
            <span className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
              <ScanFace size={12} />{tr("{0} face(s) detected", c.faces)}
            </span>
          </a>
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <p className="text-base font-semibold text-neutral-900">{c.name}</p>
              <p className="text-xs text-neutral-500">@{c.username}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Fact icon={<Store size={14} />} label={tr("Outlet")} value={c.branchName} sub={c.branchCode} />
              <Fact icon={<CalendarDays size={14} />} label={tr("Visit Time")} value={wibDateTime(c.visitedAt)} />
            </div>
            <div className={cx("flex items-start gap-3 rounded-xl border px-3 py-2.5", toneBox[verdict.tone])}>
              <span className={cx("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white", toneIcon[verdict.tone])}>{verdict.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{verdict.title}</span>
                <span className="block text-xs opacity-90">{verdict.text}</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {c.lowAccuracy && <Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low GPS accuracy")}</Badge>}
              <RiskTags c={c} />
            </div>
          </div>
        </div>

        <DrawerBlock title={tr("Location")}>
          <div className="grid grid-cols-3 divide-x divide-neutral-100 rounded-xl border border-neutral-200">
            <Figure label={tr("Distance")} value={c.distanceM !== null ? `${c.distanceM} m` : "—"} tone={c.outsideRadius ? "text-red-700" : undefined} />
            <Figure label={tr("Radius")} value={c.radiusM !== null ? `${c.radiusM} m` : "—"} />
            <Figure label={tr("GPS Accuracy")} value={c.accuracyM !== null ? `±${Math.round(c.accuracyM)} m` : "—"} tone={c.lowAccuracy ? "text-amber-700" : undefined} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <MapLink href={mapsUrl(c.latitude, c.longitude)} label={tr("PIC Position")} value={`${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`} />
            {c.outletLatitude !== null && c.outletLongitude !== null
              ? <MapLink href={mapsUrl(c.outletLatitude, c.outletLongitude)} label={tr("Outlet Location")} value={`${c.outletLatitude.toFixed(5)}, ${c.outletLongitude.toFixed(5)}`} />
              : <div className="rounded-xl border border-dashed border-neutral-200 px-3 py-2 text-xs text-neutral-500">{tr("Outlet Location")}: {tr("No coordinates yet")}</div>}
          </div>
        </DrawerBlock>

        <DrawerBlock title={tr("Time")}>
          <dl className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
            <DrawerRow k={tr("Visit Time")} v={`${wibDateTime(c.visitedAt)} · ${tr("server time")}`} />
            <DrawerRow k={tr("Phone clock")} v={c.deviceTime ? <>{wibDateTime(c.deviceTime)}{skew !== null && Math.abs(skew) >= 5 && <Badge tone="amber">{tr("differs {0} min", skew)}</Badge>}</> : "—"} />
          </dl>
        </DrawerBlock>

        {c.note && (
          <DrawerBlock title={tr("Note")}>
            <p className="rounded-xl bg-neutral-50 px-3 py-2.5 text-sm leading-relaxed text-neutral-700">{c.note}</p>
          </DrawerBlock>
        )}

        {(c.riskSignals ?? []).length > 0 && (
          <DrawerBlock title={`${tr("Location check")} · ${RISK_LABEL[c.riskLevel ?? "none"]()}`}>
            <ul className={cx("space-y-1.5 rounded-xl border p-3 text-xs", risky ? "border-red-200 bg-red-50" : "border-neutral-200 bg-neutral-50")}>
              {(c.riskSignals ?? []).map((x) => (
                <li key={x.code} className="flex gap-2">
                  <span className={cx("mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full", x.level === "high" ? "bg-red-500" : x.level === "medium" ? "bg-amber-500" : "bg-neutral-400")} />
                  <span className="text-neutral-700">{x.text}</span>
                </li>
              ))}
            </ul>
          </DrawerBlock>
        )}

        {(c.outsideRadius || risky || c.review) && <ReviewBox c={c} onReviewed={onReviewed} />}
      </div>
    </Drawer>
  );
}

/** A titled block of a detail drawer. */
export function DrawerBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      {children}
    </section>
  );
}

export function DrawerRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 px-3 py-2">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-1.5 break-words text-neutral-900">{v}</dd>
    </div>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{icon}{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900" title={value}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-neutral-400">{sub}</p>}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-3 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={cx("mt-0.5 text-base font-semibold tabular-nums text-neutral-900", tone)}>{value}</p>
    </div>
  );
}

function MapLink({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40">
      <MapPin size={15} className="flex-shrink-0 text-brand-700" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-neutral-700">{label}</span>
        <span className="block truncate font-mono text-[11px] text-neutral-500">{value}</span>
      </span>
      <ExternalLink size={13} className="flex-shrink-0 text-neutral-400" />
    </a>
  );
}

/** Details of a summary figure, from the check-ins of the period (the latest 1,000). */
function DetailDrawer({ kind, data, summary, truncated, onClose, onPic, onOutlet, onOpen }: {
  kind: Detail; data: CheckIn[]; summary: Summary; truncated: boolean; onClose: () => void;
  onPic: (id: string) => void; onOutlet: (code: string) => void; onOpen: (c: CheckIn) => void;
}) {
  const title = { checkins: tr("Check-ins"), pics: tr("PICs"), outlets: tr("Outlets Visited"), outside: tr("Outside Radius") }[kind];
  const groups = useMemo(() => {
    const key = (c: CheckIn) => kind === "checkins" ? dayOf(c.visitedAt) : kind === "pics" ? c.userId : c.branchCode;
    const m = new Map<string, { key: string; label: string; sub: string; n: number; outside: number; people: Set<string>; places: Set<string>; last: string }>();
    for (const c of data) {
      const k = key(c);
      const g = m.get(k) ?? { key: k, label: kind === "checkins" ? dayOf(c.visitedAt) : kind === "pics" ? c.name : c.branchName,
        sub: kind === "pics" ? `@${c.username}` : kind === "outlets" ? c.branchCode : "", n: 0, outside: 0, people: new Set(), places: new Set(), last: c.visitedAt };
      g.n += 1;
      if (c.outsideRadius) g.outside += 1;
      g.people.add(c.userId);
      g.places.add(c.branchCode);
      if (c.visitedAt > g.last) g.last = c.visitedAt;
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => kind === "checkins" ? b.last.localeCompare(a.last) : b.n - a.n || a.label.localeCompare(b.label));
  }, [data, kind]);
  const outside = useMemo(() => data.filter((c) => c.outsideRadius), [data]);

  return (
    <Drawer open onClose={onClose} size="md" title={title}
      description={kind === "checkins" ? tr("Check-ins per day") : kind === "pics" ? tr("Visits per PIC · click to filter the list")
        : kind === "outlets" ? tr("Visits per outlet · click to filter the list") : tr("Where the PICs were when checking in")}>
      <div className="space-y-4">
        {kind === "outside" && (
          <>
            <SegmentBar parts={[
              { label: tr("At the Outlet"), value: summary.inside, color: "bg-emerald-500" },
              { label: tr("Outside Radius"), value: summary.outside, color: "bg-amber-500" },
              { label: tr("Outlet Has No Coordinates"), value: summary.unlocated, color: "bg-neutral-300" },
            ]} />
            {summary.low > 0 && <p className="text-xs text-neutral-500">{tr("{0} with low GPS accuracy", fmtNumber(summary.low))}</p>}
          </>
        )}
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          {kind === "outside" ? (
            outside.length === 0 ? <p className="px-4 py-8 text-center text-sm text-neutral-400">{tr("No check in outside the radius")}</p> : (
              <ul className="divide-y divide-neutral-100">
                {outside.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpen(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                      <img src={thumb(photoUrl(c.id), 96)} decoding="async" alt="" loading="lazy" className="h-9 w-9 flex-shrink-0 rounded-full bg-neutral-100 object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">{c.name} · {c.branchName}</span>
                        <span className="block text-xs text-neutral-500">{wibDateTime(c.visitedAt)}</span>
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-amber-700">{c.distanceM} m</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <table className="w-full text-sm">
              <thead className={theadClass}>
                <tr>
                  <th className="px-3 py-2">{kind === "checkins" ? tr("Day") : kind === "pics" ? tr("PIC") : tr("Outlet")}</th>
                  <th className="px-3 py-2 text-right">{tr("Check-ins")}</th>
                  <th className="px-3 py-2 text-right">{kind === "pics" ? tr("Outlets") : tr("PICs")}</th>
                  <th className="px-3 py-2 text-right">{tr("Outside")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {groups.map((g) => {
                  const click = kind === "pics" ? () => onPic(g.key) : kind === "outlets" ? () => onOutlet(g.key) : undefined;
                  return (
                    <tr key={g.key} onClick={click} className={click ? "cursor-pointer hover:bg-neutral-50" : ""}>
                      <td className="px-3 py-2"><span className="block font-medium text-neutral-900">{g.label}</span>{g.sub && <span className="text-xs text-neutral-400">{g.sub}</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-900">{fmtNumber(g.n)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{fmtNumber(kind === "pics" ? g.places.size : g.people.size)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${g.outside ? "font-semibold text-amber-700" : "text-neutral-400"}`}>{fmtNumber(g.outside)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {truncated && <p className="text-xs text-neutral-400">{tr("From the latest 1,000 check-ins of the period")}</p>}
      </div>
    </Drawer>
  );
}

const RISK_LABEL: Record<string, () => string> = {
  none: () => tr("no sign"), low: () => tr("low risk"), medium: () => tr("medium risk"), high: () => tr("high risk"),
};

/** A manager's verdict on a check-in outside the radius or with a suspicious location. */
function ReviewBox({ c, onReviewed }: { c: CheckIn; onReviewed: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(c.review?.note ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const save = async (status: "valid" | "invalid") => {
    setBusy(status);
    try {
      await call(`/api/monitoring/${kindSlug()}/${c.id}/review`, { method: "POST", json: { status, note: note.trim() || null } });
      toast(status === "valid" ? tr("Marked as valid") : tr("Marked as not valid"));
      onReviewed();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <p className="text-sm font-semibold text-neutral-900">{tr("Management review")}</p>
      {c.review ? (
        <p className="mt-1 text-xs text-neutral-600">
          {c.review.status === "valid" ? tr("Valid") : tr("Not valid")} · {c.review.by ?? "—"}{c.review.at ? ` · ${wibDateTime(c.review.at)}` : ""}
        </p>
      ) : <p className="mt-1 text-xs text-neutral-500">{tr("Check the photo, the note and the location, then decide.")}</p>}
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={tr("Review note (optional)")}
        className={cx(inputClass, "mt-2 h-auto py-2")} />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" loading={busy === "valid"} disabled={!!busy} onClick={() => void save("valid")}>
          <CheckCircle2 size={14} className="text-emerald-600" /> {tr("Valid")}
        </Button>
        <Button size="sm" variant="secondary" loading={busy === "invalid"} disabled={!!busy} onClick={() => void save("invalid")}>
          <XCircle size={14} className="text-red-600" /> {tr("Not valid")}
        </Button>
      </div>
    </section>
  );
}

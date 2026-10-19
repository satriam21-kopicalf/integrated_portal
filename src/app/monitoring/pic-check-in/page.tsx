"use client";

// Monitoring → PIC Check In (page mon.pic-check-in): every check-in of a period — who, which outlet, when, the face
// photo and where the PIC was compared with the outlet. Figures of the period, visits per PIC, one Filters drawer,
// a detail drawer with the photo and map links.

import { CalendarDays, ExternalLink, MapPin, MapPinOff, RefreshCw, ScanFace, SignalLow, Store, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, PageNav, Panel, SkeletonRows, fmtNumber, theadClass, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, SegmentBar, dmy, wibDay } from "@/so/ui/Filters";
import { wibDay as dayOf } from "@/so/lib/wib";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { type CheckIn, call, photoUrl } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Summary = { total: number; pics: number; branches: number; outside: number; low: number; unlocated: number; inside: number };
type Result = { period: { from: string; to: string }; data: CheckIn[]; summary: Summary; pics: { id: string; name: string; n: number }[]; truncated: boolean };
type BranchOpt = { branch_code: string; branch_name: string };
type Detail = "checkins" | "pics" | "outlets" | "outside";
type F = { period: Period; branch: string; user: string; location: string };

const NO_F = (): F => ({ period: { from: wibDay(-6), to: wibDay(0) }, branch: "", user: "", location: "" });
const LOC: Record<string, () => string> = {
  outside: () => tr("Outside radius"), low: () => tr("Low GPS accuracy"), unlocated: () => tr("Outlet has no coordinates"),
};

function LocationTags({ c, distance = true }: { c: CheckIn; distance?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {!c.outletLocated ? <Badge tone="slate" icon={<MapPinOff size={11} />}>{tr("Outlet has no coordinates")}</Badge>
        : c.outsideRadius ? <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>
        : <Badge tone="green">{tr("At the outlet")}</Badge>}
      {c.lowAccuracy && <Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low GPS accuracy")}</Badge>}
      {distance && c.distanceM !== null && <span className="text-[11px] tabular-nums text-slate-500">{c.distanceM} m{c.accuracyM !== null ? ` ±${Math.round(c.accuracyM)}` : ""}</span>}
    </span>
  );
}

export default function PicCheckInMonitorPage() {
  const [f, setF] = useState<F>(NO_F);
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<CheckIn | null>(null);
  // a summary figure opened: its details in a drawer
  const [detail, setDetail] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const q = new URLSearchParams({ dateFrom: f.period.from, dateTo: f.period.to, ...(f.branch ? { branch: f.branch } : {}),
      ...(f.user ? { userId: f.user } : {}), ...(f.location ? { location: f.location } : {}) });
    try {
      setRes(await call<Result>(`/api/monitoring/pic-check-in?${q}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<BranchOpt[]>("/api/branches").then(setBranches).catch(() => setBranches([])); }, []);

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
    ...(f.branch ? [{ key: "b", label: branches.find((b) => b.branch_code === f.branch)?.branch_name ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.user ? [{ key: "u", label: pics.find((p) => p.id === f.user)?.name ?? tr("PIC"), onRemove: () => setF({ ...f, user: "" }) }] : []),
    ...(f.location ? [{ key: "l", label: LOC[f.location](), onRemove: () => setF({ ...f, location: "" }) }] : []),
  ];

  return (
    <Page title={tr("PIC Check In")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("visits of the PICs to the outlets")}`}
      actions={<button type="button" onClick={() => void load()} disabled={!res && !error} title={tr("Refresh")} aria-label={tr("Refresh")}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait">
        <RefreshCw size={18} className={!res && !error ? "animate-spin" : ""} />
      </button>}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Check-ins")} emphasis icon={<CalendarDays size={13} />} onClick={s ? () => setDetail("checkins") : undefined} active={detail === "checkins"} value={s ? fmtNumber(s.total) : <StatSkeleton />}>
            {s && <p>{tr("{0} days", Math.round((Date.parse(f.period.to) - Date.parse(f.period.from)) / 864e5) + 1)}</p>}
          </Stat>
          <Stat label={tr("PICs")} icon={<UsersRound size={13} />} onClick={s ? () => setDetail("pics") : undefined} active={detail === "pics"} value={s ? fmtNumber(s.pics) : <StatSkeleton />}>
            {s && <p>{tr("who checked in")}</p>}
          </Stat>
          <Stat label={tr("Outlets visited")} icon={<Store size={13} />} onClick={s ? () => setDetail("outlets") : undefined} active={detail === "outlets"} value={s ? fmtNumber(s.branches) : <StatSkeleton />}>
            {s && <p>{tr("different outlets")}</p>}
          </Stat>
          <Stat label={tr("Outside radius")} icon={<MapPin size={13} />} onClick={s ? () => setDetail("outside") : undefined} active={detail === "outside"} value={s ? fmtNumber(s.outside) : <StatSkeleton />}>
            {s && <p>{tr("{0} low GPS accuracy · {1} outlet without coordinates", fmtNumber(s.low), fmtNumber(s.unlocated))}</p>}
          </Stat>
        </StatStrip>
      }>

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search PIC or outlet")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""} · {tr("Times in WIB (server time)")}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : res && rows.length === 0 ? (
          <Empty icon={<ScanFace size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No check in in this period")}>
            {!res.data.length && tr("Check-ins appear here as soon as the PICs send them from Form → PIC Check In.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {paged.rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => setOpen(c)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                    <img src={photoUrl(c.id)} alt="" loading="lazy" className="h-12 w-12 flex-shrink-0 rounded-lg bg-slate-100 object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                      <span className="block truncate text-xs text-slate-500">{c.branchName} · {wibDateTime(c.visitedAt)}</span>
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
                    <th className="px-4 py-2.5">{tr("Visit time")}</th>
                    <th className="px-4 py-2.5">{tr("Location")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!res ? <SkeletonRows cols={5} /> : paged.rows.map((c) => (
                    <tr key={c.id} onClick={() => setOpen(c)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                        <img src={photoUrl(c.id)} alt={tr("Face photo")} loading="lazy" className="h-11 w-11 rounded-lg bg-slate-100 object-cover" />
                      </td>
                      <td className="px-4 py-2.5"><span className="block font-medium text-slate-900">{c.name}</span><span className="text-xs text-slate-400">@{c.username}</span></td>
                      <td className="max-w-[16rem] px-4 py-2.5"><span className="block truncate text-slate-800">{c.branchName}</span><span className="text-xs text-slate-400">{c.branchCode}</span></td>
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-700">{wibDateTime(c.visitedAt)}</td>
                      <td className="px-4 py-2.5"><LocationTags c={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      {sheet && <CheckInFilters value={f} branches={branches} pics={pics} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && <CheckInDrawer c={open} onClose={() => setOpen(null)} />}
      {detail && res && <DetailDrawer kind={detail} data={res.data} summary={res.summary} truncated={res.truncated} onClose={() => setDetail(null)}
        onPic={(id) => { setF({ ...f, user: id }); setDetail(null); }} onOutlet={(code) => { setF({ ...f, branch: code }); setDetail(null); }}
        onOpen={(c) => setOpen(c)} />}
    </Page>
  );
}

function CheckInFilters({ value, branches, pics, onApply, onClose }: {
  value: F; branches: BranchOpt[]; pics: { id: string; name: string }[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F())} applyDisabled={days > 93}>
      <FilterSection title={tr("Visit day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={93} /></FilterSection>
      <FilterSection title={tr("Outlet")}>
        <SearchChoice label="" anyLabel={tr("All outlets")} value={d.branch} onChange={(v) => setD({ ...d, branch: v })} placeholder={tr("Search outlet")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name }))} />
      </FilterSection>
      <FilterSection title={tr("PIC")}>
        <SearchChoice label="" anyLabel={tr("All PICs")} value={d.user} onChange={(v) => setD({ ...d, user: v })} placeholder={tr("Search PIC")}
          options={pics.map((p) => ({ value: p.id, label: p.name }))} />
      </FilterSection>
      <FilterSection title={tr("Location")}>
        <ChoiceGroup label="" value={d.location} onChange={(v) => setD({ ...d, location: v })}
          choices={[{ value: "", label: tr("All") }, ...Object.keys(LOC).map((k) => ({ value: k, label: LOC[k]() }))]} />
      </FilterSection>
    </FilterSheet>
  );
}

function CheckInDrawer({ c, onClose }: { c: CheckIn; onClose: () => void }) {
  const skew = c.deviceTime ? Math.round((Date.parse(c.deviceTime) - Date.parse(c.visitedAt)) / 60_000) : null;
  const rows: [string, React.ReactNode][] = [
    [tr("PIC"), `${c.name} · @${c.username}`],
    [tr("Outlet"), `${c.branchName} (${c.branchCode})`],
    [tr("Visit time"), wibDateTime(c.visitedAt)],
    [tr("Phone clock"), c.deviceTime ? `${wibDateTime(c.deviceTime)}${skew && Math.abs(skew) >= 5 ? ` · ${tr("differs {0} min", skew)}` : ""}` : "—"],
    [tr("PIC position"), <a key="p" href={mapsUrl(c.latitude, c.longitude)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
      {c.latitude.toFixed(5)}, {c.longitude.toFixed(5)}{c.accuracyM !== null ? ` ±${Math.round(c.accuracyM)} m` : ""} <ExternalLink size={11} className="inline" /></a>],
    [tr("Outlet location"), c.outletLatitude !== null && c.outletLongitude !== null
      ? <a key="o" href={mapsUrl(c.outletLatitude, c.outletLongitude)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
        {c.outletLatitude.toFixed(5)}, {c.outletLongitude.toFixed(5)} · {tr("radius {0} m", c.radiusM ?? "")} <ExternalLink size={11} className="inline" /></a>
      : tr("No coordinates yet")],
    [tr("Distance"), c.distanceM !== null ? tr("{0} m from the outlet", c.distanceM) : "—"],
    [tr("Face"), tr("{0} face(s) detected", c.faces)],
    ...(c.note ? [[tr("Note"), c.note] as [string, React.ReactNode]] : []),
  ];
  return (
    <Drawer open onClose={onClose} size="md" icon={<ScanFace size={18} />} title={c.name} description={`${c.branchName} · ${wibDateTime(c.visitedAt)}`}>
      <div className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
        <img src={photoUrl(c.id)} alt={tr("Face photo")} className="w-full rounded-xl bg-slate-100 object-contain" />
        <LocationTags c={c} />
        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-3 px-3 py-2">
              <dt className="text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Drawer>
  );
}

/** Details of a summary figure, from the check-ins of the period (the latest 1,000). */
function DetailDrawer({ kind, data, summary, truncated, onClose, onPic, onOutlet, onOpen }: {
  kind: Detail; data: CheckIn[]; summary: Summary; truncated: boolean; onClose: () => void;
  onPic: (id: string) => void; onOutlet: (code: string) => void; onOpen: (c: CheckIn) => void;
}) {
  const title = { checkins: tr("Check-ins"), pics: tr("PICs"), outlets: tr("Outlets visited"), outside: tr("Outside radius") }[kind];
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
              { label: tr("At the outlet"), value: summary.inside, color: "bg-emerald-500" },
              { label: tr("Outside radius"), value: summary.outside, color: "bg-amber-500" },
              { label: tr("Outlet has no coordinates"), value: summary.unlocated, color: "bg-slate-300" },
            ]} />
            {summary.low > 0 && <p className="text-xs text-slate-500">{tr("{0} with low GPS accuracy", fmtNumber(summary.low))}</p>}
          </>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {kind === "outside" ? (
            outside.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-400">{tr("No check in outside the radius")}</p> : (
              <ul className="divide-y divide-slate-100">
                {outside.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onOpen(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                      <img src={photoUrl(c.id)} alt="" loading="lazy" className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-100 object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{c.name} · {c.branchName}</span>
                        <span className="block text-xs text-slate-500">{wibDateTime(c.visitedAt)}</span>
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
              <tbody className="divide-y divide-slate-100">
                {groups.map((g) => {
                  const click = kind === "pics" ? () => onPic(g.key) : kind === "outlets" ? () => onOutlet(g.key) : undefined;
                  return (
                    <tr key={g.key} onClick={click} className={click ? "cursor-pointer hover:bg-slate-50" : ""}>
                      <td className="px-3 py-2"><span className="block font-medium text-slate-900">{g.label}</span>{g.sub && <span className="text-xs text-slate-400">{g.sub}</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-900">{fmtNumber(g.n)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtNumber(kind === "pics" ? g.places.size : g.people.size)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${g.outside ? "font-semibold text-amber-700" : "text-slate-400"}`}>{fmtNumber(g.outside)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {truncated && <p className="text-xs text-slate-400">{tr("From the latest 1,000 check-ins of the period")}</p>}
      </div>
    </Drawer>
  );
}

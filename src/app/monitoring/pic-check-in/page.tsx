"use client";

// Monitoring → PIC Check In (page mon.pic-check-in): every check-in of a period — who, which outlet, when, the face
// photo and where the PIC was compared with the outlet. Figures of the period, visits per PIC, one Filters drawer,
// a detail drawer with the photo and map links.

import { CalendarDays, ExternalLink, MapPin, MapPinOff, RefreshCw, ScanFace, SignalLow, Store, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Empty, ErrorState, Page, Panel, SkeletonRows, fmtNumber, theadClass } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, SegmentBar, dmy, wibDay } from "@/so/ui/Filters";
import { mapsUrl } from "@/so/lib/counts";
import { wibDateTime } from "@/so/lib/wib";
import { type CheckIn, call, photoUrl } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Summary = { total: number; pics: number; branches: number; outside: number; low: number; unlocated: number; inside: number };
type Result = { period: { from: string; to: string }; data: CheckIn[]; summary: Summary; pics: { id: string; name: string; n: number }[]; truncated: boolean };
type BranchOpt = { branch_code: string; branch_name: string };
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
  const s = res?.summary;
  const pics = res?.pics ?? [];
  const maxPic = Math.max(1, ...pics.map((p) => p.n));
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
          <Stat label={tr("Check-ins")} emphasis icon={<CalendarDays size={13} />} value={s ? fmtNumber(s.total) : <StatSkeleton />}>
            {s && <p>{tr("{0} days", Math.round((Date.parse(f.period.to) - Date.parse(f.period.from)) / 864e5) + 1)}</p>}
          </Stat>
          <Stat label={tr("PICs")} icon={<UsersRound size={13} />} value={s ? fmtNumber(s.pics) : <StatSkeleton />}>
            {s && <p>{tr("who checked in")}</p>}
          </Stat>
          <Stat label={tr("Outlets visited")} icon={<Store size={13} />} value={s ? fmtNumber(s.branches) : <StatSkeleton />}>
            {s && <p>{tr("different outlets")}</p>}
          </Stat>
          <Stat label={tr("Outside radius")} icon={<MapPin size={13} />} value={s ? fmtNumber(s.outside) : <StatSkeleton />}>
            {s && <p>{tr("{0} low GPS accuracy · {1} outlet without coordinates", fmtNumber(s.low), fmtNumber(s.unlocated))}</p>}
          </Stat>
        </StatStrip>
      }>
      {s && s.total > 0 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Panel title={tr("Location of the check-ins")}>
            <div className="p-4 sm:p-5">
              <SegmentBar parts={[
                { label: tr("At the outlet"), value: s.inside, color: "bg-emerald-500" },
                { label: tr("Outside radius"), value: s.outside, color: "bg-amber-500" },
                { label: tr("Outlet has no coordinates"), value: s.unlocated, color: "bg-slate-300" },
              ]} />
            </div>
          </Panel>
          <Panel title={tr("Visits per PIC")}>
            <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
              {pics.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => setF({ ...f, user: f.user === p.id ? "" : p.id })} className="block w-full px-4 py-2 text-left hover:bg-slate-50 sm:px-5">
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-slate-800">{p.name}</span>
                      <span className="tabular-nums font-semibold text-slate-900">{p.n}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${(p.n / maxPic) * 100}%` }} /></span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search PIC or outlet")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />}
        footer={res ? <span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(res.data.length))}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""} · {tr("Times in WIB (server time)")}</span> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : res && rows.length === 0 ? (
          <Empty icon={<ScanFace size={28} />} title={res.data.length ? tr("Nothing matches the search or filters") : tr("No check in in this period")}>
            {!res.data.length && tr("Check-ins appear here as soon as the PICs send them from Form → PIC Check In.")}
          </Empty>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((c) => (
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
                  {!res ? <SkeletonRows cols={5} /> : rows.map((c) => (
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

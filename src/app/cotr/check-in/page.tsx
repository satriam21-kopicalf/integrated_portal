"use client";

// Monitoring COTR → Monitoring Armada - Driver (page cotr.check-in, renamed 2026-11-08): the day of every COTR driver from the driver app — the shift
// (start / end check in with photo and location, the stock on the fleet, the cash to hand over, the stock difference at
// the end), the reloads to approve or reject for the pool, the cost requests to approve or reject, and where the
// drivers are (the GPS of their phone while the shift is open, on a map).

import { Building2, CalendarDays, Camera, Check, LogIn, LogOut, MapPin, MapPinCheck, PackagePlus, TriangleAlert, Wallet, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Drawer from "@/so/ui/Drawer";
import { Badge, Button, Empty, ErrorState, Input, cx, useToast } from "@/so/ui";
import { SearchInput, Tabs } from "@/components/kc";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { DayField, ScopeBar, dmyOf } from "@/components/kc/ScopeBar";
import { ComboFilter, FilterRow, MonitorFilterSheet, OptionList } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { Monitor, Reload, Request, Shift, Stock } from "@/cotr/types";
import { rupiah, useMaster } from "@/cotr/ui";
import type { RequestKind } from "@/cotr/RequestKinds";
import { locale, tr } from "@/lib/i18n";
import { thumb } from "@/lib/assets";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const cups = (s: Stock) => Object.values(s ?? {}).reduce((a, v) => a + v, 0);
const photoUrl = (kind: "check-in" | "signature" | "request", id: string) => `/api/cotr/photos/${kind}/${id}`;
const KINDS: Record<string, () => string> = { fuel: () => tr("Fuel"), ice: () => tr("Ice"), stall: () => tr("Stall rent"), repair: () => tr("Fleet repair"), parking: () => tr("Parking / levy"), other: () => tr("Other") };
// the map reads window (Leaflet): loaded in the browser only
const DriverMap = dynamic(() => import("@/cotr/DriverMap"), { ssr: false, loading: () => <div className="skeleton h-[480px] rounded-xl" /> });
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
type ShiftFilter = "" | "open" | "closed" | "difference" | "short";
const SHIFT_FILTER: Record<Exclude<ShiftFilter, "">, () => string> = {
  open: () => tr("On the road"), closed: () => tr("Shift ended"), difference: () => tr("Stock difference"), short: () => tr("Cash Short"),
};
const matchShift = (s: Shift, f: ShiftFilter) => !f || (f === "open" ? s.status === "open" : f === "closed" ? s.status === "closed"
  : f === "difference" ? !!(s.recap.difference && Object.keys(s.recap.difference).length) : (s.recap.balance ?? 0) < 0);

export default function CotrCheckInPage() {
  const [day, setDay] = useState(todayWib());
  const [tab, setTab] = useState<"shifts" | "location" | "reloads" | "requests">("shifts");
  const [data, setData] = useState<Monitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<Monitor>(`/api/cotr/monitor?day=${day}`)); } catch (e) { setError((e as Error).message); }
  }, [day]);
  useEffect(() => { void load(); }, [load]);
  // no refresh button (2026-11-09): read again every 60 s while the page is shown
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000); return () => clearInterval(t); }, [load]);
  // the filters (pool, state of the shift, a driver) narrow every tab
  const [pool, setPool] = useState("");
  const [state, setState] = useState<ShiftFilter>("");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ day, pool, state });
  const pools = useMemo(() => {
    const m = new Map<string, string>();
    data?.shifts.forEach((s) => s.pool && m.set(s.pool, s.poolName ?? s.pool));
    data?.notStarted.forEach((d) => d.pool && !m.has(d.pool) && m.set(d.pool, d.pool));
    return [...m.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const view = useMemo((): Monitor | null => {
    if (!data) return null;
    const words = q.trim().toLowerCase();
    const who = (code: string, name?: string | null) => !words || `${code} ${name ?? ""}`.toLowerCase().includes(words);
    const shifts = data.shifts.filter((s) => (!pool || s.pool === pool) && matchShift(s, state) && who(s.driver, s.driverName));
    const notStarted = state ? [] : data.notStarted.filter((d) => (!pool || d.pool === pool) && who(d.code, d.name));
    const inScope = new Set([...data.shifts.filter((s) => !pool || s.pool === pool).map((s) => s.driver), ...data.notStarted.filter((d) => !pool || d.pool === pool).map((d) => d.code)]);
    return { ...data, shifts, notStarted,
      reloads: data.reloads.filter((r) => (!r.driver || inScope.has(r.driver)) && who(r.driver ?? "")),
      requests: data.requests.filter((r) => inScope.has(r.driverCode) && who(r.driverCode, r.driverName)) };
  }, [data, pool, state, q]);
  const pendingReloads = view?.reloads.filter((r) => r.status === "requested").length ?? 0;
  const pendingRequests = view?.requests.filter((r) => r.status === "sent").length ?? 0;

  return (
    <Page eyebrow="Monitoring COTR" media={<MapPinCheck size={19} />} title={tr("Monitoring Armada - Driver")} subtitle={tr("Shifts, sales, deductions, cash, stock, reloads and requests of every driver")}
      stats={<>
        <ScopeBar onOpen={() => { setDraft({ day, pool, state }); setSheet(true); }}
          right={<SearchInput value={q} onChange={setQ} placeholder={tr("Search driver")} />}
          scopes={[
            { key: "day", icon: <CalendarDays />, label: tr("Day"), value: day === todayWib() ? tr("Today") : dmyOf(day) },
            { key: "pool", icon: <Building2 />, label: tr("Pool / HUB"), value: pools.find((p) => p.code === pool)?.name ?? tr("All pools"), active: !!pool },
            { key: "state", icon: <LogIn />, label: tr("Shift"), value: state ? SHIFT_FILTER[state]() : tr("All"), active: !!state },
          ]} />
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Drivers Checked in")} icon={<LogIn size={16} />} value={view ? `${view.shifts.length} / ${view.shifts.length + view.notStarted.length}` : <StatSkeleton />} />
          <Stat label={tr("Cups Sold")} icon={<Check size={16} />} value={view ? view.shifts.reduce((a, s) => a + s.recap.cups, 0) : <StatSkeleton />} />
          <Stat label={tr("Cash to Hand Over")} icon={<Wallet size={16} />} value={view ? rupiah(view.shifts.reduce((a, s) => a + s.recap.cashExpected, 0)) : <StatSkeleton />} />
          <Stat label={tr("To Decide")} icon={<PackagePlus size={16} />} value={view ? pendingReloads + pendingRequests : <StatSkeleton />} emphasis={pendingReloads + pendingRequests > 0} />
          <Stat label={tr("Cash Short")} icon={<TriangleAlert size={16} />} value={view ? rupiah(view.shifts.reduce((a, s) => a + Math.min(0, s.recap.balance ?? 0), 0)) : <StatSkeleton />} />
        </StatStrip>
      </>}>
      <Tabs label={tr("Section")} value={tab} onChange={(k) => setTab(k as typeof tab)} tabs={[
        { key: "shifts", label: <span className="inline-flex items-center gap-1.5"><LogIn size={15} />{tr("Shifts")}</span>, count: view?.shifts.length },
        { key: "location", label: <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{tr("Location")}</span> },
        { key: "reloads", label: <span className="inline-flex items-center gap-1.5"><PackagePlus size={15} />{tr("Reloads")}</span>, count: pendingReloads || undefined },
        { key: "requests", label: <span className="inline-flex items-center gap-1.5"><Wallet size={15} />{tr("Requests")}</span>, count: pendingRequests || undefined },
      ]} />
      {sheet && (
        <MonitorFilterSheet active={[draft.pool, draft.state].filter(Boolean).length} onClose={() => setSheet(false)}
          onReset={() => setDraft({ day: todayWib(), pool: "", state: "" })}
          onApply={() => { setDay(draft.day); setPool(draft.pool); setState(draft.state); setSheet(false); }}>
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Day")} value={dmyOf(draft.day)}>
            <DayField value={draft.day} onChange={(v) => setDraft({ ...draft, day: v })} max={todayWib()} />
          </FilterRow>
          <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={pools.find((p) => p.code === draft.pool)?.name ?? null} onClear={() => setDraft({ ...draft, pool: "" })}>
            <ComboFilter value={draft.pool} onChange={(v) => setDraft({ ...draft, pool: v })} allLabel={tr("All pools")} placeholder={tr("Search pool")}
              options={pools.map((p) => ({ value: p.code, label: p.name }))} />
          </FilterRow>
          <FilterRow icon={<LogIn size={15} />} label={tr("Shift")} value={draft.state ? SHIFT_FILTER[draft.state]() : null} onClear={() => setDraft({ ...draft, state: "" })}>
            <OptionList value={draft.state} onChange={(v) => setDraft({ ...draft, state: v as ShiftFilter })}
              choices={[{ value: "", label: tr("Every Shift") }, ...(Object.keys(SHIFT_FILTER) as Exclude<ShiftFilter, "">[]).map((k) => ({ value: k, label: SHIFT_FILTER[k]() }))]} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel> : !view ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : tab === "shifts" ? <Shifts data={view} /> : tab === "location" ? <DriverMap day={day} live={day === todayWib()} /> : tab === "reloads" ? <Reloads data={view} /> : <Requests data={view} onDone={load} />}
    </Page>
  );
}

type Card = "all" | "open" | "closed" | "attention";

function Shifts({ data }: { data: Monitor }) {
  const [open, setOpen] = useState<Shift | null>(null);
  const [show, setShow] = useState<Card>("all");
  const attention = (s: Shift) => !!(s.recap.difference && Object.keys(s.recap.difference).length) || (s.recap.balance ?? 0) < 0 || s.recap.voided > 0;
  const list = data.shifts.filter((s) => show === "all" || (show === "open" ? s.status === "open" : show === "closed" ? s.status === "closed" : attention(s)))
    .sort((x, y) => Number(attention(y)) - Number(attention(x)) || Number(y.status === "open") - Number(x.status === "open") || (x.driverName ?? "").localeCompare(y.driverName ?? ""));
  const count = (c: Card) => data.shifts.filter((s) => c === "all" || (c === "open" ? s.status === "open" : c === "closed" ? s.status === "closed" : attention(s))).length;
  return (
    <>
      <div role="radiogroup" aria-label={tr("Show")} className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-neutral-100 p-1 [scrollbar-width:none]">
        {([["all", tr("All")], ["open", tr("On the road")], ["closed", tr("Shift ended")], ["attention", tr("Needs attention")]] as [Card, string][]).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={show === k} onClick={() => setShow(k)}
            className={cx("flex h-9 flex-1 flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold sm:text-sm",
              show === k ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800")}>
            {label}<span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", show === k ? "bg-brand-50 text-brand-700" : "bg-white/70 text-neutral-500")}>{count(k)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? <Panel><Empty title={data.shifts.length ? tr("No shift matches") : tr("No driver has checked in on this day")} /></Panel> : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((s) => {
            const diff = s.recap.difference && Object.keys(s.recap.difference).length;
            const short = (s.recap.balance ?? 0) < 0;
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setOpen(s)}
                  className={cx("group flex h-full w-full flex-col rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                    attention(s) ? "border-red-200" : "border-neutral-200 hover:border-brand-200")}>
                  <span className="flex items-start gap-3">
                    <span className={cx("flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold", s.status === "open" ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200" : "bg-neutral-100 text-neutral-600")}>
                      {(s.driverName ?? s.driver).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-neutral-900">{s.driverName ?? s.driver}</span>
                      <span className="block truncate text-[11px] text-neutral-500">{[s.poolName ?? s.pool, s.fleet].filter(Boolean).join(" · ")}</span>
                    </span>
                    {s.status === "open" ? <Badge tone="green" dot>{tr("On the road")}</Badge> : <Badge tone="slate">{tr("Ended")} {time(s.endedAt)}</Badge>}
                  </span>
                  {s.slots.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">{s.slots.map((x, i) => <span key={i} className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-800">{x.start}–{x.end} · {x.area ?? "—"}</span>)}</span>
                  )}
                  <span className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <Kpi label={tr("Sold")} value={String(s.recap.cups)} />
                    <Kpi label={tr("On the Fleet")} value={s.status === "open" ? String(cups(s.stock)) : "—"} />
                    <Kpi label={tr("Cupping / Waste")} value={`${s.recap.cupping}/${s.recap.waste}`} tone={s.deductions.cups ? "amber" : undefined} />
                    <Kpi label={tr("Sales")} value={rupiah(s.recap.total).replace("Rp ", "")} />
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-neutral-100 pt-2.5 text-[11px] text-neutral-500">
                    <LogIn size={12} />{time(s.startedAt)}
                    {diff ? <Badge tone="red" icon={<TriangleAlert size={11} />}>{tr("Stock difference")}</Badge> : null}
                    {short ? <Badge tone="red">{tr("Cash short {0}", rupiah(Math.abs(s.recap.balance ?? 0)))}</Badge> : null}
                    {s.recap.voided ? <Badge tone="amber">{tr("{0} voided", s.recap.voided)}</Badge> : null}
                    {s.deductions.value > 0 && <Badge tone="amber">{tr("Deductions {0}", rupiah(s.deductions.value))}</Badge>}
                    <span className="ml-auto text-brand-700 opacity-0 transition group-hover:opacity-100">{tr("Details")} →</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {data.notStarted.length > 0 && <NotStarted people={data.notStarted} />}
      {open && <ShiftDrawer s={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** The active employees without a shift on the day: per pool, searchable, a part shown until asked (2026-11-09). */
function NotStarted({ people }: { people: { code: string; name: string; pool: string | null }[] }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const words = q.trim().toLowerCase();
  const shown = people.filter((p) => !words || `${p.name} ${p.code} ${p.pool ?? ""}`.toLowerCase().includes(words));
  const pools = [...new Set(shown.map((p) => p.pool ?? "—"))].sort();
  const LIMIT = 8;
  return (
    <Panel title={tr("Not checked in ({0})", people.length)} description={tr("Active employees without a shift on this day, per pool")}
      toolbar={<SearchInput value={q} onChange={setQ} placeholder={tr("Search name, code or pool")} />}>
      {shown.length === 0 ? <Empty title={tr("No one matches")} /> : (
        <div className="divide-y divide-neutral-100">
          {pools.map((pool) => {
            const list = shown.filter((p) => (p.pool ?? "—") === pool);
            const cut = all || words ? list : list.slice(0, LIMIT);
            return (
              <section key={pool} className="px-4 py-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700"><Building2 size={13} className="text-neutral-400" />{pool}
                  <span className="rounded-full bg-amber-50 px-1.5 text-[11px] font-semibold tabular-nums text-amber-700">{list.length}</span></p>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {cut.map((d) => (
                    <li key={d.code} className="flex min-w-0 items-center gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-neutral-500 ring-1 ring-neutral-200">
                        {d.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <span className="min-w-0"><span className="block truncate font-medium text-neutral-800">{d.name}</span><span className="block truncate text-[10px] text-neutral-400">{d.code}</span></span>
                    </li>
                  ))}
                </ul>
                {cut.length < list.length && <p className="mt-1.5 text-[11px] text-neutral-400">{tr("+{0} more", list.length - cut.length)}</p>}
              </section>
            );
          })}
        </div>
      )}
      {!words && people.length > LIMIT && (
        <div className="border-t border-neutral-100 px-4 py-2.5 text-center">
          <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>{all ? tr("Show less") : tr("Show all ({0})", people.length)}</Button>
        </div>
      )}
    </Panel>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <span className={cx("rounded-lg px-1.5 py-1.5", tone === "amber" ? "bg-amber-50" : "bg-neutral-50")}>
      <span className="block truncate text-[15px] font-semibold tabular-nums text-neutral-900">{value}</span>
      <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
    </span>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return <li className={cx("flex justify-between gap-3 py-1", strong && "font-semibold text-neutral-900", tone)}><span>{label}</span><span className="tabular-nums">{value}</span></li>;
}

/** Everything of one shift: the check ins with photo, location and signature, the sales, the deductions (cupping and
 * waste at the menu price), the cash, the stock difference, the accessories and the areas of the day. */
function ShiftDrawer({ s, onClose }: { s: Shift; onClose: () => void }) {
  const diff = s.recap.difference && Object.keys(s.recap.difference).length ? s.recap.difference : null;
  return (
    <Drawer open onClose={onClose} size="xl" icon={<MapPinCheck size={18} />} title={s.driverName ?? s.driver}
      description={`${[s.poolName ?? s.pool, s.fleet, s.phone].filter(Boolean).join(" · ")} · ${time(s.startedAt)}–${s.status === "open" ? tr("on the road") : time(s.endedAt)}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label={tr("Sold")} value={`${s.recap.cups} ${tr("cups")}`} />
          <Kpi label={tr("Sales")} value={rupiah(s.recap.total)} />
          <Kpi label={tr("Deductions")} value={rupiah(s.deductions.value)} tone={s.deductions.value ? "amber" : undefined} />
          <Kpi label={tr("Balance")} value={s.recap.balance === null ? "—" : rupiah(s.recap.balance)} />
        </div>
        {s.slots.length > 0 && (
          <Block title={tr("Areas of the day")}>
            <ul className="flex flex-wrap gap-1.5">{s.slots.map((x, i) => <li key={i} className="rounded-lg bg-brand-50 px-2 py-1 text-xs text-brand-800"><b className="tabular-nums">{x.start}–{x.end}</b> · {x.area ?? "—"}</li>)}</ul>
          </Block>
        )}
        <Block title={tr("Check In & Check Out")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.checkIns.map((c) => (
              <section key={c.id} className="rounded-xl border border-neutral-200 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  {c.kind === "start" ? <LogIn size={14} /> : <LogOut size={14} />}{c.kind === "start" ? tr("Start of shift") : tr("End of shift")}
                  <span className="ml-auto font-normal tabular-nums text-neutral-500">{time(c.at)}</span></p>
                {c.hasPhoto ? (
                  <a href={photoUrl("check-in", c.id)} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(photoUrl("check-in", c.id), 480)} decoding="async" alt={tr("Photo")} className="h-40 w-full bg-neutral-100 object-cover" loading="lazy" />
                  </a>
                ) : <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><Camera size={12} />{tr("Missing")}</p>}
                {c.lat !== null && c.lng !== null && (
                  <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-700"><MapPin size={12} />{tr("Open the map")}</a>
                )}
                <p className="mt-1 text-xs text-neutral-600">{tr("Stock")}: {Object.entries(c.stock).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</p>
                {c.note && <p className="mt-1 text-xs text-neutral-500">“{c.note}”</p>}
                {c.hasSignature && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl("signature", c.id)} alt={tr("Signature")} className="mt-2 h-14 rounded-md border border-neutral-100 bg-white object-contain" loading="lazy" />
                )}
              </section>
            ))}
            {s.checkIns.length === 1 && <p className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 p-3 text-xs text-neutral-400">{tr("Not checked out yet")}</p>}
          </div>
        </Block>
        <div className="grid gap-4 lg:grid-cols-2">
          <Block title={tr("Sales per menu")}>
            {s.recap.perMenu.length === 0 ? <p className="text-xs text-neutral-400">{tr("No sale yet")}</p> : (
              <ul className="divide-y divide-neutral-100 text-xs text-neutral-700">
                {s.recap.perMenu.map((m) => <Row key={m.code} label={`${m.name} × ${m.qty}`} value={rupiah(m.total)} />)}
                <Row strong label={tr("Total")} value={rupiah(s.recap.total)} />
                <Row label={tr("Cash")} value={rupiah(s.recap.cash)} /><Row label="QRIS" value={rupiah(s.recap.qris)} />
                {s.recap.voided > 0 && <Row label={tr("Voided bills")} value={s.recap.voided} tone="text-amber-700" />}
              </ul>
            )}
          </Block>
          <Block title={tr("Deductions (cupping & waste)")}>
            {s.deductions.lines.length === 0 ? <p className="text-xs text-neutral-400">{tr("No cupping or waste")}</p> : (
              <>
                <table className="w-full text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-neutral-400"><tr><th className="py-1">{tr("Menu")}</th><th>{tr("Type")}</th><th className="text-right">{tr("Assigned")}</th><th className="text-right">{tr("Used")}</th><th className="text-right">{tr("Value")}</th></tr></thead>
                  <tbody className="divide-y divide-neutral-100 text-neutral-700">
                    {s.deductions.lines.map((d) => (
                      <tr key={`${d.kind}:${d.code}`}><td className="py-1.5">{d.name}</td><td><Badge tone={d.kind === "cupping" ? "violet" : "amber"}>{d.kind === "cupping" ? tr("Cupping") : tr("Waste")}</Badge></td>
                        <td className="text-right tabular-nums">{d.assigned ?? "—"}</td><td className="text-right tabular-nums">{d.qty}</td><td className="text-right tabular-nums">{rupiah(d.value)}</td></tr>))}
                  </tbody>
                </table>
                <ul className="mt-2 border-t border-neutral-100 pt-1 text-xs text-neutral-700">
                  <Row label={tr("Cupping")} value={rupiah(s.deductions.cupping)} /><Row label={tr("Waste")} value={rupiah(s.deductions.waste)} />
                  <Row strong label={tr("Deducted from the sales")} value={rupiah(s.deductions.value)} />
                </ul>
                <p className="mt-1 text-[11px] text-neutral-400">{tr("Valued at the menu price; not counted as a sale, deducted as cupping / waste")}</p>
              </>
            )}
          </Block>
          <Block title={tr("Cash")}>
            {s.recap.cashActual === null ? <p className="text-xs text-neutral-400">{tr("Counted at the end of the shift")}</p> : (
              <ul className="divide-y divide-neutral-100 text-xs text-neutral-700">
                <Row label={tr("Cash sales")} value={rupiah(s.recap.cash)} /><Row label={tr("Spent from the cash")} value={`− ${rupiah(s.recap.cashSpent)}`} />
                <Row label={tr("Cash to Hand Over")} value={rupiah(s.recap.cashExpected)} /><Row label={tr("Cash counted")} value={rupiah(s.recap.cashActual)} />
                <Row strong label={tr("Balance")} value={rupiah(s.recap.balance ?? 0)} tone={(s.recap.balance ?? 0) < 0 ? "text-red-600" : undefined} />
              </ul>
            )}
          </Block>
          <Block title={tr("Stock & accessories")}>
            <ul className="divide-y divide-neutral-100 text-xs text-neutral-700">
              <Row label={tr("Start stock")} value={`${cups(s.startStock)} ${tr("cups")}`} />
              <Row label={tr("Reloads received")} value={`${s.recap.reloaded} ${tr("cups")}`} />
              {s.status === "open" && <Row label={tr("On the Fleet")} value={`${cups(s.stock)} ${tr("cups")}`} />}
              <Row label={tr("Requests")} value={rupiah(s.recap.requested)} />
            </ul>
            {diff && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{tr("Stock difference")}: {Object.entries(diff).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}{s.endNote ? ` · ${s.endNote}` : ""}</p>}
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{tr("Accessories carried")}</p>
            <p className="text-xs text-neutral-700">{s.accessories.length ? s.accessories.map((x) => `${x.name} × ${x.qty}`).join(" · ") : "—"}</p>
          </Block>
        </div>
      </div>
    </Drawer>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      {children}
    </section>
  );
}

const RELOAD: Record<Reload["status"], { label: () => string; tone: "amber" | "violet" | "red" | "green" }> = {
  requested: { label: () => tr("Waiting"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "violet" },
  rejected: { label: () => tr("Rejected"), tone: "red" }, received: { label: () => tr("Received"), tone: "green" },
  disputed: { label: () => tr("Difference Reported"), tone: "red" },
};

function Decide({ url, onDone, needNote }: { url: string; onDone: () => Promise<void>; needNote?: boolean }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    if (!approve && needNote && !note.trim()) { toast(tr("Write the reason for the rejection"), "error"); return; }
    setBusy(true);
    try { await call(url, { method: "POST", json: { approve, note: note.trim() || null } }); toast(approve ? tr("Approved") : tr("Rejected")); await onDone(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (optional)")} className="h-9 w-44" />
      <Button size="sm" loading={busy} onClick={() => void decide(true)}><Check size={14} /> {tr("Approve")}</Button>
      <Button size="sm" variant="secondary" disabled={busy} className="text-red-600" onClick={() => void decide(false)}><X size={14} /> {tr("Reject")}</Button>
    </div>
  );
}

function Reloads({ data }: { data: Monitor }) {
  const name = (code: string | null) => data.shifts.find((s) => s.driver === code)?.driverName ?? code ?? "—";
  return (
    <Panel title={tr("Reloads")} description={tr("Decided and settled by the storage team in Storage & Assignment")}>
      {data.reloads.length === 0 ? <Empty title={tr("No reload on this day")} /> : (
        <ul className="divide-y divide-neutral-100">
          {[...data.reloads].sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested") || b.at.localeCompare(a.at)).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-neutral-900">{name(r.driver)} · {cups(r.lines)} {tr("cups")} <span className="font-normal text-neutral-400">{time(r.at)}</span></span>
                <span className="text-xs text-neutral-500">{Object.entries(r.lines).map(([k, v]) => `${k} ${v}`).join(" · ")}{r.note ? ` · ${r.note}` : ""}</span>
                {r.decisionNote && <span className="block text-xs text-neutral-400">{r.decisionNote}</span>}
              </span>
              <Badge tone={RELOAD[r.status].tone}>{RELOAD[r.status].label()}{r.receivedAt ? ` ${time(r.receivedAt)}` : ""}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const REQUEST: Record<Request["status"], { label: () => string; tone: "amber" | "green" | "red" }> = {
  sent: { label: () => tr("Waiting"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "green" }, rejected: { label: () => tr("Rejected"), tone: "red" },
};

function Requests({ data, onDone }: { data: Monitor; onDone: () => Promise<void> }) {
  // the names come from Master → Pengajuan (migration 083); the built-in labels stay for the older codes
  const kinds = useMaster<RequestKind>("request-kinds");
  const kindName = (code: string) => kinds.rows?.find((k) => k.code === code)?.name ?? (KINDS[code] ?? (() => code))();
  return (
    <Panel title={tr("Requests")} description={tr("Costs on the road with the receipt; the ones still waiting are listed whatever their day")}>
      {data.requests.length === 0 ? <Empty title={tr("No request")} /> : (
        <ul className="divide-y divide-neutral-100">
          {data.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <a href={photoUrl("request", r.id)} target="_blank" rel="noreferrer" className="flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(photoUrl("request", r.id), 160)} decoding="async" alt={tr("Receipt")} className="h-14 w-14 object-cover" loading="lazy" />
                </a>
                <span className="min-w-0">
                  <span className="block font-medium text-neutral-900">{r.driverName ?? r.driverCode} · {kindName(r.kind)} · {rupiah(r.amount)}</span>
                  <span className="text-xs text-neutral-500">{new Date(r.at).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} {time(r.at)} · {r.note}</span>
                  {r.decisionNote && <span className="block text-xs text-neutral-400">{r.decisionNote}</span>}
                </span>
              </span>
              {r.status === "sent" ? <Decide url={`/api/cotr/requests/${r.id}/decide`} onDone={onDone} needNote />
                : <Badge tone={REQUEST[r.status].tone}>{REQUEST[r.status].label()}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

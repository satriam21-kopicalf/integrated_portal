"use client";

// Monitoring COTR → Monitoring Armada - Driver (page cotr.check-in, renamed 2026-11-08): the day of every COTR driver from the driver app — the shift
// (start / end check in with photo and location, the stock on the fleet, the cash to hand over, the stock difference at
// the end), the reloads to approve or reject for the pool, the cost requests to approve or reject, and where the
// drivers are (the GPS of their phone while the shift is open, on a map).

import { Building2, CalendarDays, Camera, Check, Fingerprint, LogIn, LogOut, MapPin, MapPinCheck, PackagePlus, TriangleAlert, Wallet } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import Drawer from "@/so/ui/Drawer";
import { Badge, Button, Empty, ErrorState, cx, usePaged } from "@/so/ui";
import { SearchInput } from "@/components/kc";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { DayField, dmyOf } from "@/components/kc/ScopeBar";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar } from "@/so/ui/Filters";
import { CardBody, QuickChips, Toolbar, WorkCard } from "@/so/ui/Jira";
import { CotrAttendance } from "@/cotr/Attendance";
import { call } from "@/so/features/checkin/checkin";
import { Monitor, Reload, Shift, Stock } from "@/cotr/types";
import { COTR_PAGE, CotrPager, rupiah, useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";
import { thumb } from "@/lib/assets";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const cups = (s: Stock) => Object.values(s ?? {}).reduce((a, v) => a + v, 0);
const photoUrl = (kind: "check-in" | "signature" | "request", id: string) => `/api/cotr/photos/${kind}/${id}`;
// the map reads window (Leaflet): loaded in the browser only
const DriverMap = dynamic(() => import("@/cotr/DriverMap"), { ssr: false, loading: () => <div className="skeleton h-[480px] rounded-[3px]" /> });
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
type Card = "all" | "open" | "closed" | "attention";
const attention = (s: Shift) => !!(s.recap.difference && Object.keys(s.recap.difference).length) || (s.recap.balance ?? 0) < 0 || s.recap.voided > 0;
const inCard = (s: Shift, c: Card) => c === "all" || (c === "open" ? s.status === "open" : c === "closed" ? s.status === "closed" : attention(s));

export default function CotrCheckInPage() {
  const [day, setDay] = useState(todayWib());
  const [tab, setTab] = useState<"shifts" | "attendance" | "location" | "reloads">("shifts");
  const [data, setData] = useState<Monitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<Monitor>(`/api/cotr/monitor?day=${day}`)); } catch (e) { setError((e as Error).message); }
  }, [day]);
  useEffect(() => { void load(); }, [load]);
  // no refresh button (2026-11-09): read again every 60 s while the page is shown
  useEffect(() => { const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000); return () => clearInterval(t); }, [load]);
  // the filters (day, pool in the drawer; the state of the shift as quick chips; a driver by search) narrow every tab
  const [pool, setPool] = useState("");
  const [show, setShow] = useState<Card>("all");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ day, pool });
  const master = useMaster<{ code: string; name: string }>("pools");
  const pools = useMemo(() => {
    const m = new Map<string, string>();
    const named = (code: string) => master.rows?.find((p) => p.code === code)?.name ?? code;
    data?.shifts.forEach((s) => s.pool && m.set(s.pool, s.poolName ?? named(s.pool)));
    data?.notStarted.forEach((d) => d.pool && !m.has(d.pool) && m.set(d.pool, named(d.pool)));
    return [...m.entries()].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, master.rows]);
  const view = useMemo((): Monitor | null => {
    if (!data) return null;
    const words = q.trim().toLowerCase();
    const who = (code: string, name?: string | null) => !words || `${code} ${name ?? ""}`.toLowerCase().includes(words);
    const shifts = data.shifts.filter((s) => (!pool || s.pool === pool) && who(s.driver, s.driverName));
    const notStarted = data.notStarted.filter((d) => (!pool || d.pool === pool) && who(d.code, d.name));
    const inScope = new Set([...data.shifts.filter((s) => !pool || s.pool === pool).map((s) => s.driver), ...data.notStarted.filter((d) => !pool || d.pool === pool).map((d) => d.code)]);
    return { ...data, shifts, notStarted, reloads: data.reloads.filter((r) => (!r.driver || inScope.has(r.driver)) && who(r.driver ?? "")) };
  }, [data, pool, q]);
  const pendingReloads = view?.reloads.filter((r) => r.status === "requested").length ?? 0;
  const filters: ActiveFilter[] = [
    ...(day !== todayWib() ? [{ key: "day", label: `${tr("Day")}: ${dmyOf(day)}`, onRemove: () => setDay(todayWib()) }] : []),
    ...(pool ? [{ key: "pool", label: `${tr("Pool / HUB")}: ${pools.find((p) => p.code === pool)?.name ?? pool}`, onRemove: () => setPool("") }] : []),
  ];
  const cardCount = (c: Card) => (view ? view.shifts.filter((s) => inCard(s, c)).length : null);

  return (
    <Page eyebrow="Calf On The Road" media={<MapPinCheck size={19} />} title={tr("Monitoring Armada - Driver")}
      subtitle={`${day === todayWib() ? tr("Today") : dmyOf(day)} · ${pool ? pools.find((p) => p.code === pool)?.name ?? pool : tr("All pools")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={5} gridClassName="grid-cols-2 xl:grid-cols-5">
          <Stat label={tr("Drivers Checked in")} icon={<LogIn size={13} />} value={view ? `${view.shifts.length} / ${view.shifts.length + view.notStarted.length}` : <StatSkeleton />}
            onClick={view ? () => { setTab("shifts"); setShow("all"); } : undefined} />
          <Stat label={tr("Cups Sold")} icon={<Check size={13} />} value={view ? view.shifts.reduce((a, s) => a + s.recap.cups, 0) : <StatSkeleton />} />
          <Stat label={tr("Cash to Hand Over")} icon={<Wallet size={13} />} value={view ? rupiah(view.shifts.reduce((a, s) => a + s.recap.cashExpected, 0)) : <StatSkeleton />} />
          <Stat label={tr("Reloads to Decide")} icon={<PackagePlus size={13} />} value={view ? pendingReloads : <StatSkeleton />} emphasis={pendingReloads > 0}
            onClick={view ? () => setTab("reloads") : undefined} active={tab === "reloads"} />
          <Stat label={tr("Cash Short")} icon={<TriangleAlert size={13} />} value={view ? rupiah(view.shifts.reduce((a, s) => a + Math.min(0, s.recap.balance ?? 0), 0)) : <StatSkeleton />}
            onClick={view ? () => { setTab("shifts"); setShow("attention"); } : undefined} />
        </StatStrip>
      }>
      {sheet && (
        <MonitorFilterSheet active={[draft.pool, draft.day !== todayWib()].filter(Boolean).length} onClose={() => setSheet(false)}
          onReset={() => setDraft({ day: todayWib(), pool: "" })}
          onApply={() => { setDay(draft.day); setPool(draft.pool); setSheet(false); }}>
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Day")} value={dmyOf(draft.day)}>
            <DayField value={draft.day} onChange={(v) => setDraft({ ...draft, day: v })} max={todayWib()} />
          </FilterRow>
          <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={pools.find((p) => p.code === draft.pool)?.name ?? null} onClear={() => setDraft({ ...draft, pool: "" })}>
            <ComboFilter value={draft.pool} onChange={(v) => setDraft({ ...draft, pool: v })} allLabel={tr("All pools")} placeholder={tr("Search pool")}
              options={pools.map((p) => ({ value: p.code, label: p.name }))} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {/* Jira-like (2026-11-23): one card, the shifts / location / reloads as tabs; the driver requests have their own menu */}
      <WorkCard label={tr("Section")} active={tab} onTab={setTab} tabs={[
        { key: "shifts", label: tr("Shifts"), icon: <LogIn size={15} />, count: view?.shifts.length ?? null },
        { key: "attendance", label: tr("HRMS Attendance"), icon: <Fingerprint size={15} /> },
        { key: "location", label: tr("Location"), icon: <MapPin size={15} /> },
        { key: "reloads", label: tr("Reloads"), icon: <PackagePlus size={15} />, count: pendingReloads || null },
      ]}>
        <Toolbar>
          {tab !== "reloads" && tab !== "attendance" && <QuickChips label={tr("Show")} value={show} onChange={setShow} items={[
            { key: "all" as Card, label: tr("All"), count: cardCount("all") }, { key: "open" as Card, label: tr("On the road"), dot: "bg-emerald-500", count: cardCount("open") },
            { key: "closed" as Card, label: tr("Shift ended"), dot: "bg-neutral-400", count: cardCount("closed") },
            { key: "attention" as Card, label: tr("Needs attention"), dot: "bg-red-500", count: cardCount("attention") }]} />}
          <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search driver")} filters={filters}
            onOpen={() => { setDraft({ day, pool }); setSheet(true); }} onClear={() => { setDay(todayWib()); setPool(""); }} />
        </Toolbar>
        {error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load()} /></div> : !view ? (
          <div className="p-4"><div className="skeleton h-64 rounded-[3px]" /></div>
        ) : tab === "attendance" ? <CotrAttendance day={day} pool={pool} q={q} />
          : tab === "shifts" ? <CardBody><Shifts data={view} show={show} /></CardBody>
          : tab === "location" ? <CardBody><DriverMap day={day} live={day === todayWib()} drivers={pool || q.trim() || show !== "all" ? new Set(view.shifts.filter((s) => inCard(s, show)).map((s) => s.driver)) : undefined} /></CardBody>
          : <Reloads data={view} />}
      </WorkCard>
    </Page>
  );
}


function Shifts({ data, show }: { data: Monitor; show: Card }) {
  const [open, setOpen] = useState<Shift | null>(null);
  const list = data.shifts.filter((s) => inCard(s, show))
    .sort((x, y) => Number(attention(y)) - Number(attention(x)) || Number(y.status === "open") - Number(x.status === "open") || (x.driverName ?? "").localeCompare(y.driverName ?? ""));
  const paged = usePaged(list, show + list.length, COTR_PAGE);
  return (
    <>
      {list.length === 0 ? <Panel><Empty title={data.shifts.length ? tr("No shift matches") : tr("No driver has checked in on this day")} /></Panel> : (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {paged.rows.map((s) => {
            const diff = s.recap.difference && Object.keys(s.recap.difference).length;
            const short = (s.recap.balance ?? 0) < 0;
            return (
              <li key={s.id}>
                <button type="button" onClick={() => setOpen(s)}
                  className={cx("group flex h-full w-full flex-col rounded-[3px] border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                    attention(s) ? "border-red-200" : "border-[color:var(--j-DCDFE4)] hover:border-[color:var(--j-85B8FF)]")}>
                  <span className="flex items-start gap-3">
                    <span className={cx("flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold", s.status === "open" ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)]")}>
                      {(s.driverName ?? s.driver).split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{s.driverName ?? s.driver}</span>
                      <span className="block truncate text-[11px] text-[color:var(--j-626F86)]">{[s.poolName ?? s.pool, s.fleet].filter(Boolean).join(" · ")}</span>
                    </span>
                    {s.status === "open" ? <Badge tone="green" dot>{tr("On the road")}</Badge> : <Badge tone="slate">{tr("Ended")} {time(s.endedAt)}</Badge>}
                  </span>
                  {s.slots.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1">{s.slots.map((x, i) => <span key={i} className="rounded-[3px] bg-[color:var(--j-E9F2FF)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--j-0055CC)]">{x.start}–{x.end} · {x.area ?? "—"}</span>)}</span>
                  )}
                  <span className="mt-3 grid grid-cols-4 gap-2 text-center">
                    <Kpi label={tr("Sold")} value={String(s.recap.cups)} />
                    <Kpi label={tr("On the Fleet")} value={s.status === "open" ? String(cups(s.stock)) : "—"} />
                    <Kpi label={tr("Cupping / Waste")} value={`${s.recap.cupping}/${s.recap.waste}`} tone={s.deductions.cups ? "amber" : undefined} />
                    <Kpi label={tr("Sales")} value={rupiah(s.recap.total).replace("Rp ", "")} />
                  </span>
                  <span className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[color:var(--j-F1F2F4)] pt-2.5 text-[11px] text-[color:var(--j-626F86)]">
                    <LogIn size={12} />{time(s.startedAt)}
                    {diff ? <Badge tone="red" icon={<TriangleAlert size={11} />}>{tr("Stock difference")}</Badge> : null}
                    {short ? <Badge tone="red">{tr("Cash short {0}", rupiah(Math.abs(s.recap.balance ?? 0)))}</Badge> : null}
                    {s.recap.voided ? <Badge tone="amber">{tr("{0} voided", s.recap.voided)}</Badge> : null}
                    {s.recap.recapCups ? <Badge tone="blue">{tr("Recap at the pool {0} cups", s.recap.recapCups)}</Badge> : null}
                    {s.deductions.value > 0 && <Badge tone="amber">{tr("Deductions {0}", rupiah(s.deductions.value))}</Badge>}
                    <span className="ml-auto text-[color:var(--j-0C66E4)] opacity-0 transition group-hover:opacity-100">{tr("Details")} →</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <CotrPager paged={paged} />
      {show === "all" && data.notStarted.length > 0 && <NotStarted people={data.notStarted} />}
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
        <div className="divide-y divide-[color:var(--j-F1F2F4)]">
          {pools.map((pool) => {
            const list = shown.filter((p) => (p.pool ?? "—") === pool);
            const cut = all || words ? list : list.slice(0, LIMIT);
            return (
              <section key={pool} className="px-4 py-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[color:var(--j-44546F)]"><Building2 size={13} className="text-[color:var(--j-626F86)]" />{pool}
                  <span className="rounded-full bg-amber-50 px-1.5 text-[11px] font-semibold tabular-nums text-amber-700">{list.length}</span></p>
                <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {cut.map((d) => (
                    <li key={d.code} className="flex min-w-0 items-center gap-2 rounded-[3px] bg-[color:var(--j-F7F8F9)] px-2.5 py-1.5 text-xs">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[color:var(--j-626F86)] ring-1 ring-[color:var(--j-DCDFE4)]">
                        {d.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <span className="min-w-0"><span className="block truncate font-medium text-[color:var(--j-172B4D)]">{d.name}</span><span className="block truncate text-[10px] text-[color:var(--j-626F86)]">{d.code}</span></span>
                    </li>
                  ))}
                </ul>
                {cut.length < list.length && <p className="mt-1.5 text-[11px] text-[color:var(--j-626F86)]">{tr("+{0} more", list.length - cut.length)}</p>}
              </section>
            );
          })}
        </div>
      )}
      {!words && people.length > LIMIT && (
        <div className="border-t border-[color:var(--j-F1F2F4)] px-4 py-2.5 text-center">
          <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>{all ? tr("Show less") : tr("Show all ({0})", people.length)}</Button>
        </div>
      )}
    </Panel>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "amber" }) {
  return (
    <span className={cx("rounded-[3px] px-1.5 py-1.5", tone === "amber" ? "bg-amber-50" : "bg-[color:var(--j-F7F8F9)]")}>
      <span className="block truncate text-[15px] font-semibold tabular-nums text-[color:var(--j-172B4D)]">{value}</span>
      <span className="block truncate text-[10px] font-medium uppercase tracking-wide text-[color:var(--j-626F86)]">{label}</span>
    </span>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return <li className={cx("flex justify-between gap-3 py-1", strong && "font-semibold text-[color:var(--j-172B4D)]", tone)}><span>{label}</span><span className="tabular-nums">{value}</span></li>;
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
            <ul className="flex flex-wrap gap-1.5">{s.slots.map((x, i) => <li key={i} className="rounded-[3px] bg-[color:var(--j-E9F2FF)] px-2 py-1 text-xs text-[color:var(--j-0055CC)]"><b className="tabular-nums">{x.start}–{x.end}</b> · {x.area ?? "—"}</li>)}</ul>
          </Block>
        )}
        <Block title={tr("Check In & Check Out")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.checkIns.map((c) => (
              <section key={c.id} className="rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-[color:var(--j-172B4D)]">
                  {c.kind === "start" ? <LogIn size={14} /> : <LogOut size={14} />}{c.kind === "start" ? tr("Start of shift") : tr("End of shift")}
                  <span className="ml-auto font-normal tabular-nums text-[color:var(--j-626F86)]">{time(c.at)}</span></p>
                {c.hasPhoto ? (
                  <a href={photoUrl("check-in", c.id)} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-[3px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumb(photoUrl("check-in", c.id), 480)} decoding="async" alt={tr("Photo")} className="h-40 w-full bg-[color:var(--j-091E420F)] object-cover" loading="lazy" />
                  </a>
                ) : <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><Camera size={12} />{tr("Missing")}</p>}
                {c.lat !== null && c.lng !== null && (
                  <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--j-0C66E4)]"><MapPin size={12} />{tr("Open the map")}</a>
                )}
                <p className="mt-1 text-xs text-[color:var(--j-44546F)]">{tr("Stock")}: {Object.entries(c.stock).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</p>
                {c.note && <p className="mt-1 text-xs text-[color:var(--j-626F86)]">“{c.note}”</p>}
                {c.hasSignature && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl("signature", c.id)} alt={tr("Signature")} className="mt-2 h-14 rounded-[3px] border border-[color:var(--j-F1F2F4)] bg-white object-contain" loading="lazy" />
                )}
              </section>
            ))}
            {s.checkIns.length === 1 && <p className="flex items-center justify-center rounded-[3px] border border-dashed border-[color:var(--j-DCDFE4)] p-3 text-xs text-[color:var(--j-626F86)]">{tr("Not checked out yet")}</p>}
          </div>
        </Block>
        <div className="grid gap-4 lg:grid-cols-2">
          <Block title={tr("Sales per menu")}>
            {s.recap.perMenu.length === 0 ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("No sale yet")}</p> : (
              <ul className="divide-y divide-[color:var(--j-F1F2F4)] text-xs text-[color:var(--j-44546F)]">
                {s.recap.perMenu.map((m) => <Row key={m.code} label={`${m.name} × ${m.qty}`} value={rupiah(m.total)} />)}
                <Row strong label={tr("Total")} value={rupiah(s.recap.total)} />
                <Row label={tr("Cash")} value={rupiah(s.recap.cash)} /><Row label="QRIS" value={rupiah(s.recap.qris)} />
                {s.recap.voided > 0 && <Row label={tr("Voided bills")} value={s.recap.voided} tone="text-amber-700" />}
                {!!s.recap.recapCups && <Row label={tr("Recap at the pool (from the leftover)")} value={tr("{0} cups", s.recap.recapCups) + " · " + rupiah(s.recap.recapTotal ?? 0)} tone="text-[color:var(--j-0C66E4)]" />}
              </ul>
            )}
          </Block>
          <Block title={tr("Deductions (cupping & waste)")}>
            {s.deductions.lines.length === 0 ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("No cupping or waste")}</p> : (
              <>
                <table className="w-full text-xs">
                  <thead className="text-left text-xs capitalize text-[color:var(--j-626F86)]"><tr><th className="py-1">{tr("Menu")}</th><th>{tr("Type")}</th><th className="text-right">{tr("Assigned")}</th><th className="text-right">{tr("Used")}</th><th className="text-right">{tr("Value")}</th></tr></thead>
                  <tbody className="divide-y divide-[color:var(--j-F1F2F4)] text-[color:var(--j-44546F)]">
                    {s.deductions.lines.map((d) => (
                      <tr key={`${d.kind}:${d.code}`}><td className="py-1.5">{d.name}</td><td><Badge tone={d.kind === "cupping" ? "violet" : "amber"}>{d.kind === "cupping" ? tr("Cupping") : tr("Waste")}</Badge></td>
                        <td className="text-right tabular-nums">{d.assigned ?? "—"}</td><td className="text-right tabular-nums">{d.qty}</td><td className="text-right tabular-nums">{rupiah(d.value)}</td></tr>))}
                  </tbody>
                </table>
                <ul className="mt-2 border-t border-[color:var(--j-F1F2F4)] pt-1 text-xs text-[color:var(--j-44546F)]">
                  <Row label={tr("Cupping")} value={rupiah(s.deductions.cupping)} /><Row label={tr("Waste")} value={rupiah(s.deductions.waste)} />
                  <Row strong label={tr("Deducted from the sales")} value={rupiah(s.deductions.value)} />
                </ul>
                <p className="mt-1 text-[11px] text-[color:var(--j-626F86)]">{tr("Valued at the menu price; not counted as a sale, deducted as cupping / waste")}</p>
              </>
            )}
          </Block>
          <Block title={tr("Cash")}>
            {s.recap.cashActual === null ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("Counted at the end of the shift")}</p> : (
              <ul className="divide-y divide-[color:var(--j-F1F2F4)] text-xs text-[color:var(--j-44546F)]">
                <Row label={tr("Cash sales")} value={rupiah(s.recap.cash)} /><Row label={tr("Spent from the cash")} value={`− ${rupiah(s.recap.cashSpent)}`} />
                <Row label={tr("Cash to Hand Over")} value={rupiah(s.recap.cashExpected)} /><Row label={tr("Cash counted")} value={rupiah(s.recap.cashActual)} />
                <Row strong label={tr("Balance")} value={rupiah(s.recap.balance ?? 0)} tone={(s.recap.balance ?? 0) < 0 ? "text-red-600" : undefined} />
              </ul>
            )}
          </Block>
          <Block title={tr("Stock & accessories")}>
            <ul className="divide-y divide-[color:var(--j-F1F2F4)] text-xs text-[color:var(--j-44546F)]">
              <Row label={tr("Start stock")} value={`${cups(s.startStock)} ${tr("cups")}`} />
              <Row label={tr("Reloads received")} value={`${s.recap.reloaded} ${tr("cups")}`} />
              {s.status === "open" && <Row label={tr("On the Fleet")} value={`${cups(s.stock)} ${tr("cups")}`} />}
              <Row label={tr("Requests")} value={rupiah(s.recap.requested)} />
            </ul>
            {diff && <p className="mt-2 rounded-[3px] bg-red-50 px-2 py-1.5 text-xs text-red-700">{tr("Stock difference")}: {Object.entries(diff).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}{s.endNote ? ` · ${s.endNote}` : ""}</p>}
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{tr("Accessories carried")}</p>
            <p className="text-xs text-[color:var(--j-44546F)]">{s.accessories.length ? s.accessories.map((x) => `${x.name} × ${x.qty}`).join(" · ") : "—"}</p>
          </Block>
        </div>
      </div>
    </Drawer>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{title}</p>
      {children}
    </section>
  );
}

const RELOAD: Record<Reload["status"], { label: () => string; tone: "amber" | "violet" | "red" | "green" }> = {
  requested: { label: () => tr("Waiting"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "violet" },
  rejected: { label: () => tr("Rejected"), tone: "red" }, received: { label: () => tr("Received"), tone: "green" },
  disputed: { label: () => tr("Difference Reported"), tone: "red" },
};

function Reloads({ data }: { data: Monitor }) {
  const name = (code: string | null) => data.shifts.find((s) => s.driver === code)?.driverName ?? code ?? "—";
  const sorted = [...data.reloads].sort((a, b) => Number(b.status === "requested") - Number(a.status === "requested") || b.at.localeCompare(a.at));
  const paged = usePaged(sorted, sorted.length, COTR_PAGE);
  return (
    <div>
      {data.reloads.length === 0 ? <Empty title={tr("No reload on this day")} /> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {paged.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-[color:var(--j-172B4D)]">{name(r.driver)} · {cups(r.lines)} {tr("cups")} <span className="font-normal text-[color:var(--j-626F86)]">{time(r.at)}</span></span>
                <span className="text-xs text-[color:var(--j-626F86)]">{Object.entries(r.lines).map(([k, v]) => `${k} ${v}`).join(" · ")}{r.note ? ` · ${r.note}` : ""}</span>
                {r.decisionNote && <span className="block text-xs text-[color:var(--j-626F86)]">{r.decisionNote}</span>}
              </span>
              <Badge tone={RELOAD[r.status].tone}>{RELOAD[r.status].label()}{r.receivedAt ? ` ${time(r.receivedAt)}` : ""}</Badge>
            </li>
          ))}
        </ul>
      )}
      <CotrPager paged={paged} className="px-4 pb-3" />
      <p className="border-t border-[color:var(--j-F1F2F4)] px-4 py-2.5 text-[11px] text-[color:var(--j-626F86)] sm:px-5">{tr("Decided and settled by the storage team in Storage & Assignment")}</p>
    </div>
  );
}

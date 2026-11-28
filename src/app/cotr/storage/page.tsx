"use client";

// Monitoring COTR → Storage & Assignment (page cotr.storage, backend migration 049): the storage team of a pool assigns
// the cups per menu every driver takes for the day (changeable until the driver has checked and accepted them),
// settles the differences a driver reports (the final cups = the start stock of the shift), and decides the reloads:
// approve with the cups sent (fewer when short) or reject, then settle a difference found on arrival.

import { ChevronDown, AlertTriangle, Boxes, Building2, CalendarDays, Check, ClipboardCopy, Coffee, Moon, PackagePlus, Save, Send, Sparkles, UserRound, Warehouse, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Empty, ErrorState, Input, cx, usePaged, useToast } from "@/so/ui";
import { Page, Panel, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { DayField, dmyOf } from "@/components/kc/ScopeBar";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar } from "@/so/ui/Filters";
import { CardBody, CardFooter, Lozenge, type LozengeTone, Person, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool, Stock } from "@/cotr/types";
import { useAuth } from "@/lib/auth";
import { COTR_PAGE, CotrPager, useMaster } from "@/cotr/ui";
import { PoolBatches } from "@/cotr/Batches";
import { PoolWaste } from "@/cotr/PoolWaste";
import { ClosingBar } from "@/cotr/Closing";
import { FifoPanel } from "@/cotr/Fifo";
import { PoolAvailable } from "@/cotr/PoolAvailable";
import { locale, tr } from "@/lib/i18n";
import { SkeletonList } from "@/components/kc/Skeleton";

type Dispatch = { id: string; lines: Stock; note: string | null; status: "assigned" | "disputed" | "accepted"; driverCounts: Stock | null; driverNote: string | null; finalLines: Stock | null; resolutionNote: string | null;
  /** migration 061: the part of the lines for tasting */ cupping?: Stock };
/** what a driver should carry from his last 14 days (or the pool average): to sell and for cupping */
type Advice = { days: number; sell: Stock; cupping: Stock; avgSold: Record<string, number>; wasteRate: number | null; source: "driver" | "pool" };
type Row = { /** asked by the driver before the shift (2026-11-26) */ request?: { lines: Record<string, number>; note: string | null; at: string } | null; code: string; name: string; nickname?: string | null; pool: string; fleet: string | null; dispatch: Dispatch | null; previous: Stock | null; shift: "open" | "closed" | null; advice?: Advice | null };
/** the assignment being edited: to sell and for cupping (the driver carries both) */
type Plan = { sell: Stock; cupping: Stock };
type Reload = { id: string; at: string; lines: Stock; note: string | null; status: string; approvedLines: Stock | null; driverCounts: Stock | null; driverNote: string | null; driver: string };
type Day = { day: string; drivers: Row[]; reloads: Reload[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const cups = (s: Stock | null | undefined) => Object.values(s ?? {}).reduce((a, v) => a + v, 0);
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const clean = (s: Stock) => Object.fromEntries(Object.entries(s).filter(([, v]) => v > 0));
const add = (a: Stock, b: Stock) => { const o: Stock = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = (o[k] ?? 0) + v; return o; };
const planOf = (d: Dispatch | null): Plan => {
  const taste = d?.cupping ?? {};
  const sell: Stock = {};
  for (const [k, v] of Object.entries(d?.lines ?? {})) sell[k] = Math.max(0, v - (taste[k] ?? 0));
  return { sell, cupping: { ...taste } };
};

/** the drivers listed: by where their assignment is */
type DriverFilter = "" | "none" | "assigned" | "disputed" | "accepted" | "road";
const FILTER_STATUS: Record<Exclude<DriverFilter, "">, () => string> = {
  none: () => tr("Not assigned"), assigned: () => tr("Waiting for the driver's check"), disputed: () => tr("Difference Reported"),
  accepted: () => tr("Accepted"), road: () => tr("On the road or shift ended"),
};
const matchStatus = (r: Row, f: DriverFilter) => !f || (f === "road" ? !!r.shift : f === "none" ? !r.dispatch && !r.shift : !r.shift && r.dispatch?.status === f);

const DOT: Record<Exclude<DriverFilter, "">, string> = { none: "bg-[color:var(--j-8590A2)]", assigned: "bg-[color:var(--j-0C66E4)]", disputed: "bg-[color:var(--j-C9372C)]", accepted: "bg-[color:var(--j-22A06B)]", road: "bg-[color:var(--j-2898BD)]" };
const STATUS: Record<Dispatch["status"], { label: () => string; tone: LozengeTone }> = {
  assigned: { label: () => tr("Waiting for the driver's check"), tone: "blue" },
  disputed: { label: () => tr("Difference Reported"), tone: "red" },
  accepted: { label: () => tr("Accepted"), tone: "green" },
};

export default function CotrStoragePage() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const menusMaster = useMaster<Menu>("menus");
  const menus = useMemo(() => (menusMaster.rows ?? []).filter((m) => m.is_active), [menusMaster.rows]);
  const usable = (pools.rows ?? []).filter((p) => p.kind !== "storage");
  const [pool, setPool] = useState("");
  const [day, setDay] = useState(todayWib());
  const [data, setData] = useState<Day | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Plan>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // #16: a storage / pool leader account works on its own pool only (the backend enforces it too)
  const { user } = useAuth();
  const hub = user?.hubPool ?? null;
  const poolCode = hub ?? pool;  // "" = every pool (the default)
  const [status, setStatus] = useState<DriverFilter>("");
  const [tab, setTab] = useState<"assign" | "settle" | "stock" | "waste" | "closing">("assign");
  const [q, setQ] = useState("");
  // #17: on phones a driver card folds; the ones still to assign open by themselves
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const [draftF, setDraftF] = useState({ pool: "", day: todayWib(), status: "" as DriverFilter });
  useEffect(() => { if (sheet) setDraftF({ pool: poolCode, day, status }); }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps -- the values when the drawer opens

  // a new pool / day, or `load()` after a change: read the day again
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    call<Day>(`/api/cotr/storage?day=${day}${poolCode ? `&pool=${encodeURIComponent(poolCode)}` : ""}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setDraft(Object.fromEntries(d.drivers.map((r) => [r.code, planOf(r.dispatch)])));
      })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [day, poolCode, tick]);
  const load = async () => { setTick((t) => t + 1); };

  const editable = (r: Row) => !r.shift && r.dispatch?.status !== "accepted";
  const carried = (p: Plan | undefined) => clean(add(p?.sell ?? {}, p?.cupping ?? {}));
  const changed = (r: Row) => { const a = planOf(r.dispatch), b = draft[r.code];
    return JSON.stringify([clean(a.sell), clean(a.cupping)]) !== JSON.stringify([clean(b?.sell ?? {}), clean(b?.cupping ?? {})]); };
  const setQty = (code: string, part: keyof Plan, menu: string, v: number) =>
    setDraft((d) => ({ ...d, [code]: { ...(d[code] ?? { sell: {}, cupping: {} }), [part]: { ...(d[code]?.[part] ?? {}), [menu]: v } } }));
  const applyAdvice = (r: Row) => r.advice && setDraft((d) => ({ ...d, [r.code]: { sell: { ...r.advice!.sell }, cupping: { ...r.advice!.cupping } } }));
  const save = async (rows: Row[]) => {
    setBusy("save");
    let ok = 0;
    for (const r of rows) {
      try { await call("/api/cotr/dispatch", { method: "PUT", json: { day, driver: r.code, lines: carried(draft[r.code]), cupping: clean(draft[r.code]?.cupping ?? {}) } }); ok++; }
      catch (e) { toast(`${r.name}: ${(e as Error).message}`, "error"); }
    }
    setBusy(null);
    if (ok) toast(tr("{0} assignments saved", ok));
    await load();
  };
  const fromYesterday = () => setDraft((d) => {
    const next = { ...d };
    data?.drivers.forEach((r) => { if (editable(r) && r.previous && !cups(carried(next[r.code]))) next[r.code] = { sell: { ...r.previous }, cupping: {} }; });
    return next;
  });
  // every driver not filled yet takes the advice of his last days (or of the pool)
  const fromAdvice = () => setDraft((d) => {
    const next = { ...d };
    data?.drivers.forEach((r) => { if (editable(r) && r.advice && !cups(carried(next[r.code]))) next[r.code] = { sell: { ...r.advice.sell }, cupping: { ...r.advice.cupping } }; });
    return next;
  });

  const rows = data?.drivers ?? [];
  const toSave = rows.filter((r) => editable(r) && changed(r) && cups(carried(draft[r.code])) > 0);
  // what the storage prepares for the pool today: to sell and for cupping, per menu
  const need = menus.map((m) => ({ menu: m, sell: rows.reduce((a, r) => a + (draft[r.code]?.sell?.[m.code] ?? 0), 0), cupping: rows.reduce((a, r) => a + (draft[r.code]?.cupping?.[m.code] ?? 0), 0) }));
  const disputes = rows.filter((r) => r.dispatch?.status === "disputed");
  const reloads = useMemo(() => (data?.reloads.filter((r) => r.status === "requested" || r.status === "disputed") ?? [])
    .sort((a, b) => a.at.localeCompare(b.at)), [data]);  // the oldest request first: it has waited the longest
  const reloadPage = usePaged(reloads, `${poolCode}|${day}`, COTR_PAGE);
  const name = (code: string) => rows.find((r) => r.code === code)?.name ?? code;
  const listed = rows.filter((r) => matchStatus(r, status) && (!q.trim() || `${r.name} ${r.nickname ?? ""} ${r.code} ${r.fleet ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));

  const poolLabel = usable.find((p) => p.code === poolCode)?.name ?? poolCode;
  const filters: ActiveFilter[] = [
    ...(poolCode && !hub ? [{ key: "pool", label: `${tr("Pool / HUB")}: ${poolLabel}`, onRemove: () => setPool("") }] : []),
    ...(day !== todayWib() ? [{ key: "day", label: `${tr("Day")}: ${dmyOf(day)}`, onRemove: () => setDay(todayWib()) }] : []),
  ];
  const count = (f: DriverFilter) => rows.filter((r) => matchStatus(r, f)).length;
  const settleCount = disputes.length + reloads.length;
  const needPool = <Empty icon={<Building2 size={28} />} title={tr("Choose a pool first")}>{tr("Open Filters and choose the pool / HUB: this part works on one pool at a time.")}</Empty>;

  return (
    <Page eyebrow="Calf On The Road" media={<Warehouse size={19} />} title={tr("Storage & Assignment")}
      subtitle={`${hub ? poolLabel : poolCode ? poolLabel : tr("All pools")} · ${day === todayWib() ? tr("Today") : dmyOf(day)}`}
      stats={
        <StatStrip label={tr("Summary")} columns={5} gridClassName="grid-cols-2 xl:grid-cols-5">
          <Stat label={tr("Drivers")} icon={<UserRound size={13} />} value={data ? rows.length : <StatSkeleton />} onClick={data ? () => { setTab("assign"); setStatus(""); } : undefined} />
          <Stat label={tr("Not assigned")} icon={<Send size={13} />} value={data ? count("none") : <StatSkeleton />} active={tab === "assign" && status === "none"}
            onClick={data ? () => { setTab("assign"); setStatus("none"); } : undefined} />
          <Stat label={tr("Accepted")} icon={<Check size={13} />} value={data ? count("accepted") : <StatSkeleton />} active={tab === "assign" && status === "accepted"}
            onClick={data ? () => { setTab("assign"); setStatus("accepted"); } : undefined} />
          <Stat label={tr("Differences to Settle")} icon={<AlertTriangle size={13} />} value={data ? disputes.length : <StatSkeleton />} emphasis={disputes.length > 0}
            onClick={data ? () => setTab("settle") : undefined} />
          <Stat label={tr("Reloads to Decide")} icon={<PackagePlus size={13} />} value={data ? reloads.length : <StatSkeleton />} emphasis={reloads.length > 0}
            onClick={data ? () => setTab("settle") : undefined} />
        </StatStrip>
      }>
      {sheet && (
        <MonitorFilterSheet active={[draftF.pool && !hub, draftF.day !== todayWib()].filter(Boolean).length} onClose={() => setSheet(false)} onReset={() => setDraftF({ pool: "", day: todayWib(), status })}
          onApply={() => { setPool(draftF.pool); setDay(draftF.day); setSheet(false); }}>
          {!hub && <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={usable.find((p) => p.code === draftF.pool)?.name ?? null} onClear={() => setDraftF({ ...draftF, pool: "" })}>
            <ComboFilter value={draftF.pool} onChange={(v) => setDraftF({ ...draftF, pool: v })} allLabel={tr("All pools")} placeholder={tr("Search pool")}
              options={usable.map((p) => ({ value: p.code, label: p.name, hint: p.city }))} />
          </FilterRow>}
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Day")} value={dmyOf(draftF.day)}>
            <DayField value={draftF.day} onChange={(v) => setDraftF({ ...draftF, day: v })} future />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      {/* Jira-like (2026-11-23, the COTR team: one page of many blocks was confusing): one card, one job per tab */}
      <WorkCard label={tr("Section")} active={tab} onTab={setTab} tabs={[
        { key: "assign", label: tr("Assignment"), icon: <Send size={15} />, count: data ? rows.length : null },
        { key: "settle", label: tr("Differences & Reloads"), icon: <AlertTriangle size={15} />, count: data ? settleCount : null },
        { key: "stock", label: tr("Stock Ready"), icon: <Boxes size={15} /> },
        { key: "waste", label: tr("Waste & Cupping"), icon: <Coffee size={15} /> },
        { key: "closing", label: tr("Night Closing"), icon: <Moon size={15} /> },
      ]}>
        <Toolbar>
          {tab === "assign" && <QuickChips label={tr("Drivers")} value={status} onChange={setStatus} items={[
            { key: "" as DriverFilter, label: tr("All"), count: data ? rows.length : null },
            ...(Object.keys(FILTER_STATUS) as Exclude<DriverFilter, "">[]).map((k) => ({ key: k, label: FILTER_STATUS[k](), dot: DOT[k], count: data ? count(k) : null }))]} />}
          <FilterToolbar search={tab === "assign" ? q : undefined} onSearch={tab === "assign" ? setQ : undefined} placeholder={tr("Search driver or fleet")}
            filters={filters} onOpen={() => setSheet(true)} onClear={() => { setPool(""); setDay(todayWib()); }}
            extra={tab === "assign" && rows.length > 0 ? <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto [&>button]:h-auto [&>button]:min-h-9 [&>button]:min-w-0 [&>button]:py-1.5 [&>button]:text-left [&>button]:leading-tight">
              <Button size="sm" variant="secondary" onClick={fromAdvice}><Sparkles size={14} /> {tr("Use the advice for all")}</Button>
              <Button size="sm" variant="secondary" onClick={fromYesterday}><ClipboardCopy size={14} /> {tr("Fill from the last day")}</Button>
            </div> : undefined} />
        </Toolbar>
        {error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load()} /></div> : !data ? <div className="p-4"><SkeletonList rows={5} /></div> : tab === "assign" ? (
          <>
            {need.some((n) => n.sell + n.cupping > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[color:var(--j-F1F2F4)] bg-[color:var(--j-F7F8F9)] px-4 py-2 text-xs text-[color:var(--j-44546F)] sm:px-5">
                <span className="font-semibold text-[color:var(--j-44546F)]">{tr("The pool prepares")}</span>
                {need.filter((n) => n.sell + n.cupping > 0).map((n) => (
                  <span key={n.menu.code} className="tabular-nums"><b className="text-[color:var(--j-172B4D)]">{n.sell + n.cupping}</b> {n.menu.name}{n.cupping ? ` (${tr("{0} cupping", n.cupping)})` : ""}</span>
                ))}
              </div>
            )}
            {rows.length === 0 ? <Empty title={tr("No driver in this pool")}>{tr("Add the drivers in Master Driver.")}</Empty> : listed.length === 0 ? <Empty title={tr("No driver matches the search or filters")} /> : (
              <ul className="grid gap-3 bg-[color:var(--j-F7F8F9)] p-3 sm:p-4 xl:grid-cols-2">
                {listed.map((r) => driverCard(r))}
              </ul>
            )}
            <CardFooter><span>{tr("{0} of {1}", listed.length, rows.length)}</span>
              {toSave.length > 0 && <span className="flex items-center gap-3"><span className="text-[color:var(--j-7F5F01)]">{tr("{0} assignments not saved yet", toSave.length)}</span>
                <Button size="sm" loading={busy === "save"} onClick={() => void save(toSave)}><Save size={14} /> {tr("Save {0}", toSave.length)}</Button></span>}
            </CardFooter>
          </>
        ) : tab === "settle" ? (
          <CardBody>
            {settleCount === 0 ? <Empty icon={<Check size={28} />} title={tr("Nothing to settle")}>{tr("Differences reported by the drivers and reloads asked appear here.")}</Empty> : null}
            {disputes.length > 0 && (
              <Panel title={tr("Differences reported by the drivers")} description={tr("Set the final cups: they become the start stock of the shift")}>
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {disputes.map((r) => <Settle key={r.code} title={`${r.name} · ${r.fleet ?? ""}`} menus={menus} expected={r.dispatch!.lines}
                    found={r.dispatch!.driverCounts ?? {}} note={r.dispatch!.driverNote} url={`/api/cotr/dispatch/${r.dispatch!.id}/resolve`} onDone={load} />)}
                </div>
              </Panel>
            )}
            {reloads.length > 0 && (
              <Panel title={tr("Reloads")} description={tr("Approve with the cups sent (fewer when short) or reject; settle a difference found on arrival")}>
                <div className="grid gap-3 p-4 lg:grid-cols-2">
                  {reloadPage.rows.map((r) => r.status === "requested"
                    ? <ReloadDecide key={r.id} r={r} title={`${name(r.driver)} · ${time(r.at)}`} menus={menus} onDone={load} />
                    : <Settle key={r.id} title={`${tr("Reload")} · ${name(r.driver)} · ${time(r.at)}`} menus={menus} expected={r.approvedLines ?? r.lines}
                        found={r.driverCounts ?? {}} note={r.driverNote} url={`/api/cotr/reloads/${r.id}/resolve`} onDone={load} />)}
                </div>
                <CotrPager paged={reloadPage} className="px-4 pb-3" />
              </Panel>
            )}
          </CardBody>
        ) : tab === "stock" ? (
          <CardBody>
            {/* migration 090: what the pool can still assign today (ESB COTR transfers in) */}
            <PoolAvailable pool={poolCode} day={day} version={tick} />
            {/* #13: the batch codes to give, first expiring first (one pool chosen) */}
            {poolCode && <FifoPanel pool={poolCode} day={day} version={tick} />}
            <PoolBatches pool={poolCode} />
          </CardBody>
        ) : tab === "waste" ? (
          <CardBody>{poolCode ? <PoolWaste pool={poolCode} day={day} /> : needPool}</CardBody>
        ) : (
          <CardBody>{poolCode ? <ClosingBar key={`${poolCode}:${day}`} pool={poolCode} poolName={poolLabel} day={day} /> : needPool}</CardBody>
        )}
      </WorkCard>
    </Page>
  );

  function driverCard(r: Row) {
    const can = editable(r);
    const plan = draft[r.code] ?? { sell: {}, cupping: {} };
    const shown = can ? plan : planOf(r.dispatch);
    const st = r.dispatch ? STATUS[r.dispatch.status] : null;
    const a = r.advice;
    const open = opened[r.code] ?? (can && (!r.dispatch || changed(r)));
    const total = cups(shown.sell) + cups(shown.cupping);
    const lozenge = r.shift ? <Lozenge tone="green">{r.shift === "open" ? tr("On the road") : tr("Shift ended")}</Lozenge>
      : st ? <Lozenge tone={st.tone}>{st.label()}</Lozenge> : <Lozenge tone="grey">{tr("Not assigned")}</Lozenge>;
    return (
      <li key={r.code} className={cx("min-w-0 overflow-hidden rounded-[3px] border bg-white", changed(r) && can ? "border-[color:var(--j-F5CD47)] ring-2 ring-[color:var(--j-F8E6A0)]" : "border-[color:var(--j-DCDFE4)]")}>
        <div role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpened((o) => ({ ...o, [r.code]: !open }))}
          onKeyDown={(e) => { if (e.key === "Enter") setOpened((o) => ({ ...o, [r.code]: !open })); }}
          className={cx("flex cursor-pointer items-center gap-3 px-4 py-3 sm:cursor-default", open ? "border-b border-[color:var(--j-F1F2F4)]" : "border-b border-[color:var(--j-F1F2F4)] max-sm:border-b-0")}>
          <div className="min-w-0 flex-1"><Person name={r.name} sub={[r.nickname, r.fleet ?? r.code].filter(Boolean).join(" · ")} size={28} /></div>
          {total > 0 && <span className="flex-shrink-0 text-xs font-semibold tabular-nums text-[color:var(--j-44546F)]">{tr("{0} cups", total)}</span>}
          {lozenge}
          <ChevronDown size={16} className={cx("flex-shrink-0 text-[color:var(--j-626F86)] transition-transform sm:hidden", open && "rotate-180")} />
        </div>
        <div className={cx(!open && "max-sm:hidden")}>
          {r.request && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--j-CCE0FF)] bg-[color:var(--j-E9F2FF)]/70 px-4 py-2 text-[11px] text-[color:var(--j-0055CC)]">
              <span className="inline-flex items-center gap-1 font-semibold"><PackagePlus size={12} />{tr("Driver request: {0} cups", cups(r.request.lines))}</span>
              <span className="min-w-0 truncate">{menus.filter((m) => r.request!.lines[m.code]).map((m) => `${r.request!.lines[m.code]}× ${m.name}`).join(", ")}{r.request.note ? ` · “${r.request.note}”` : ""}</span>
              {can && <button type="button" onClick={() => setDraft((d) => ({ ...d, [r.code]: { sell: { ...r.request!.lines }, cupping: { ...(d[r.code]?.cupping ?? {}) } } }))} className="ml-auto rounded-[3px] bg-[color:var(--j-0055CC)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[color:var(--j-0055CC)]">{tr("Use request")}</button>}
            </div>
          )}
          {a && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[color:var(--j-F7F8F9)] px-4 py-2 text-[11px] text-[color:var(--j-44546F)]">
              <span className="inline-flex items-center gap-1 font-medium text-[color:var(--j-44546F)]"><Sparkles size={12} className="text-[color:var(--j-6E5DC6)]" />
                {a.source === "pool" ? tr("Advice from the pool average") : tr("Advice from {0} days worked", a.days)}</span>
              {a.wasteRate !== null && <span className={cx(a.wasteRate > 0.15 ? "font-semibold text-[color:var(--j-AE2E24)]" : "")}>{tr("waste {0}%", Math.round(a.wasteRate * 100))}</span>}
              {can && <button type="button" onClick={() => applyAdvice(r)} className="ml-auto rounded-[3px] bg-[color:var(--j-6E5DC6)] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[color:var(--j-5E4DB2)]">{tr("Use advice")}</button>}
            </div>
          )}
          <table className={cx(jTable, "table-fixed")}>
            <thead><tr className={jHeadRow}><th className={jTh}>{tr("Product")}</th><th className={cx(jTh, "w-20 text-center")}>{tr("Sell")}</th>
              <th className={cx(jTh, "w-20 text-center")}>{tr("Cupping")}</th><th className={cx(jTh, "w-16 text-right")}>{tr("Carried")}</th></tr></thead>
            <tbody>
              {menus.map((m) => {
                const sell = shown.sell[m.code] ?? 0, taste = shown.cupping[m.code] ?? 0;
                const hint = a ? `${tr("avg {0}/day", a.avgSold[m.code] ?? 0)} · ${tr("advice {0}", a.sell[m.code] ?? 0)}` : undefined;
                return (
                  <tr key={m.code} className="border-b border-[color:var(--j-F7F8F9)]">
                    <td className={jTd}><span className="block truncate text-[color:var(--j-172B4D)]">{m.name}</span>{hint && <span className="block text-[10px] text-[color:var(--j-626F86)]">{hint}</span>}</td>
                    {(["sell", "cupping"] as const).map((part) => (
                      <td key={part} className="px-1 py-1 text-center">
                        {can ? (
                          <input inputMode="numeric" value={(part === "sell" ? sell : taste) || ""} placeholder="0" aria-label={`${r.name} · ${m.name} · ${part === "sell" ? tr("Sell") : tr("Cupping")}`}
                            onChange={(e) => setQty(r.code, part, m.code, Number(e.target.value.replace(/\D/g, "")) || 0)}
                            className={cx("h-10 w-full rounded-[3px] border text-center text-base tabular-nums focus:border-[color:var(--j-0C66E4)] focus:outline-none focus:ring-2 focus:ring-[color:var(--j-388BFF)] sm:h-9 sm:text-sm", part === "cupping" ? "border-[color:var(--j-F8E6A0)] bg-[color:var(--j-FFF7D6)]/40" : "border-[color:var(--j-DCDFE4)]")} />
                        ) : <span className="tabular-nums text-[color:var(--j-44546F)]">{(part === "sell" ? sell : taste) || "—"}</span>}
                      </td>
                    ))}
                    <td className={cx(jTd, "text-right font-semibold tabular-nums text-[color:var(--j-172B4D)]")}>{sell + taste || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-[color:var(--j-DCDFE4)] text-xs">
                <td className={cx(jTd, "font-semibold text-[color:var(--j-44546F)]")}>{tr("Total")}</td>
                <td className="px-1 py-2 text-center font-semibold tabular-nums">{cups(shown.sell)}</td>
                <td className="px-1 py-2 text-center font-semibold tabular-nums text-[color:var(--j-7F5F01)]">{cups(shown.cupping)}</td>
                <td className={cx(jTd, "text-right font-bold tabular-nums")}>{total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </li>
    );
  }
}

/** A difference to settle: expected vs found per menu, the final cups (the driver's counts by default). */
function Settle({ title, menus, expected, found, note, url, onDone }: {
  title: string; menus: Menu[]; expected: Stock; found: Stock; note: string | null; url: string; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const codes = Array.from(new Set([...Object.keys(expected), ...Object.keys(found)]));
  const [final, setFinal] = useState<Stock>(() => Object.fromEntries(codes.map((c) => [c, found[c] ?? 0])));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const name = (c: string) => menus.find((m) => m.code === c)?.name ?? c;
  const send = async () => {
    setBusy(true);
    try { await call(url, { method: "POST", json: { lines: clean(final), note: reply.trim() || null } }); toast(tr("Confirmed")); await onDone(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-[3px] border border-[color:var(--j-FFD5D2)] bg-white p-3">
      <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{title}</p>
      {note && <p className="mt-1 rounded-[3px] bg-[color:var(--j-FFECEB)] px-2 py-1.5 text-xs text-[color:var(--j-AE2E24)]">{note}</p>}
      <table className="mt-2 w-full text-xs">
        <thead className="text-[color:var(--j-626F86)]"><tr><th className="py-1 text-left">{tr("Menu")}</th><th className="text-right">{tr("Sent")}</th><th className="text-right">{tr("Found")}</th><th className="text-right">{tr("Final")}</th></tr></thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c} className={cx((found[c] ?? 0) !== (expected[c] ?? 0) && "text-[color:var(--j-AE2E24)]")}>
              <td className="py-1">{name(c)}</td><td className="text-right tabular-nums">{expected[c] ?? 0}</td><td className="text-right tabular-nums">{found[c] ?? 0}</td>
              <td className="py-1 text-right">
                <input inputMode="numeric" value={final[c] ?? 0} onChange={(e) => setFinal({ ...final, [c]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  className="h-8 w-16 rounded-[3px] border border-[color:var(--j-DCDFE4)] text-center tabular-nums text-[color:var(--j-172B4D)]" aria-label={`${tr("Final")} ${name(c)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2">
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={tr("Note for the driver (optional)")} className="h-9" />
        <Button size="sm" loading={busy} onClick={() => void send()}><Check size={14} /> {tr("Confirm")}</Button>
      </div>
    </section>
  );
}

/** A reload asked: the cups sent (the ones asked by default), approve or reject with a reason. */
function ReloadDecide({ r, title, menus, onDone }: { r: Reload; title: string; menus: Menu[]; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [sent, setSent] = useState<Stock>({ ...r.lines });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const name = (c: string) => menus.find((m) => m.code === c)?.name ?? c;
  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) { toast(tr("Write the reason for the rejection"), "error"); return; }
    setBusy(true);
    try {
      await call(`/api/cotr/reloads/${r.id}/decide`, { method: "POST", json: { approve, note: note.trim() || null, lines: approve ? clean(sent) : null } });
      toast(approve ? tr("Approved") : tr("Rejected"));
      await onDone();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-[3px] border border-[color:var(--j-F8E6A0)] bg-white p-3">
      <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{title}</p>
      {r.note && <p className="mt-1 text-xs text-[color:var(--j-626F86)]">{r.note}</p>}
      <table className="mt-2 w-full text-xs">
        <thead className="text-[color:var(--j-626F86)]"><tr><th className="py-1 text-left">{tr("Menu")}</th><th className="text-right">{tr("Asked")}</th><th className="text-right">{tr("Sent")}</th></tr></thead>
        <tbody>
          {Object.keys(r.lines).map((c) => (
            <tr key={c}>
              <td className="py-1">{name(c)}</td><td className="text-right tabular-nums">{r.lines[c]}</td>
              <td className="py-1 text-right">
                <input inputMode="numeric" value={sent[c] ?? 0} onChange={(e) => setSent({ ...sent, [c]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  className="h-8 w-16 rounded-[3px] border border-[color:var(--j-DCDFE4)] text-center tabular-nums" aria-label={`${tr("Sent")} ${name(c)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (a rejection needs it)")} className="h-9 flex-1" />
        <Button size="sm" loading={busy} disabled={!cups(clean(sent))} onClick={() => void decide(true)}><Check size={14} /> {tr("Approve")}</Button>
        <Button size="sm" variant="secondary" disabled={busy} className="text-[color:var(--j-C9372C)]" onClick={() => void decide(false)}><X size={14} /> {tr("Reject")}</Button>
      </div>
    </section>
  );
}

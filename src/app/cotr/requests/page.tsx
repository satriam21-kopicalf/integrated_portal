"use client";

// Calf On The Road → Requests & Maintenance (2026-11-23, the user: "pengajuan maintenance dibuatkan menu terpisah"):
// the driver cost requests (formerly a tab of Monitoring Armada - Driver) and the fleet maintenance issues the drivers
// report (formerly Master Fleet → Issues) in one place. Page key cotr.check-in (src/lib/pages.ts); handling an issue still
// needs page cotr.fleet (the backend checks it).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, ClipboardList, Wallet, Wrench } from "lucide-react";
import { ErrorState } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { type ActiveFilter, FilterToolbar } from "@/so/ui/Filters";
import { CardBody, QuickChips, Toolbar, WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { Monitor, Request } from "@/cotr/types";
import { DriverRequests } from "@/cotr/DriverRequests";
import { FleetIssues } from "@/cotr/FleetIssues";
import { rupiah } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
type Show = "" | Request["status"];

export default function CotrRequestsPage() {
  const [tab, setTab] = useState<"costs" | "maintenance">("costs");
  const [data, setData] = useState<Monitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<number | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<Monitor>(`/api/cotr/monitor?day=${todayWib()}`)); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    call<{ status: string }[]>("/api/cotr/issues").then((r) => setIssues(r.filter((x) => x.status === "open" || x.status === "in_progress").length)).catch(() => setIssues(0));
  }, []);
  const [show, setShow] = useState<Show>("sent");
  const [q, setQ] = useState("");
  const [pool, setPool] = useState("");
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const poolOf = useMemo(() => {
    const m = new Map<string, string>();
    data?.shifts.forEach((s) => s.pool && m.set(s.driver, s.pool));
    data?.notStarted.forEach((d) => d.pool && m.set(d.code, d.pool));
    return m;
  }, [data]);
  const pools = useMemo(() => [...new Set([...poolOf.values()].filter(Boolean))].sort(), [poolOf]);
  const all = useMemo(() => (data?.requests ?? []).filter((r) => (!pool || poolOf.get(r.driverCode) === pool)
    && (!q.trim() || `${r.driverCode} ${r.driverName ?? ""} ${r.note ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [data, pool, poolOf, q]);
  const rows = all.filter((r) => !show || r.status === show);
  const waiting = (data?.requests ?? []).filter((r) => r.status === "sent");
  const filters: ActiveFilter[] = pool ? [{ key: "pool", label: `${tr("Pool / HUB")}: ${pool}`, onRemove: () => setPool("") }] : [];
  const onCount = useCallback((n: number) => setIssues(n), []);

  return (
    <Page eyebrow="Calf On The Road" media={<ClipboardList size={19} />} title={tr("Requests & Maintenance")} subtitle={tr("Driver cost requests and fleet maintenance")}
      stats={
        <StatStrip label={tr("Summary")} columns={3} gridClassName="grid-cols-2 xl:grid-cols-3">
          <Stat label={tr("Cost requests waiting")} icon={<Wallet size={13} />} emphasis={waiting.length > 0} value={data ? waiting.length : <StatSkeleton />}
            onClick={data ? () => { setTab("costs"); setShow("sent"); } : undefined} active={tab === "costs" && show === "sent"}>
            {data && <p className="tabular-nums">{rupiah(waiting.reduce((a, r) => a + r.amount, 0))}</p>}
          </Stat>
          <Stat label={tr("Fleet issues open")} icon={<Wrench size={13} />} emphasis={!!issues} value={issues ?? <StatSkeleton />}
            onClick={() => setTab("maintenance")} active={tab === "maintenance"} />
          <Stat label={tr("Cost requests decided")} icon={<ClipboardList size={13} />} value={data ? (data.requests.length - waiting.length) : <StatSkeleton />} />
        </StatStrip>
      }>
      {sheet && (
        <MonitorFilterSheet active={draft ? 1 : 0} onClose={() => setSheet(false)} onReset={() => setDraft("")} onApply={() => { setPool(draft); setSheet(false); }}>
          <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={draft || null} onClear={() => setDraft("")}>
            <ComboFilter value={draft} onChange={setDraft} allLabel={tr("All pools")} placeholder={tr("Search pool")} options={pools.map((p) => ({ value: p, label: p }))} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <WorkCard label={tr("Section")} active={tab} onTab={setTab} tabs={[
        { key: "costs", label: tr("Driver Costs"), icon: <Wallet size={15} />, count: data ? waiting.length : null },
        { key: "maintenance", label: tr("Fleet Maintenance"), icon: <Wrench size={15} />, count: issues },
      ]}>
        {tab === "costs" ? (
          <>
            <Toolbar>
              <QuickChips label={tr("Status")} value={show} onChange={setShow} items={[
                { key: "sent" as Show, label: tr("Waiting"), dot: "bg-amber-500", count: data ? all.filter((r) => r.status === "sent").length : null },
                { key: "approved" as Show, label: tr("Approved"), dot: "bg-emerald-500", count: data ? all.filter((r) => r.status === "approved").length : null },
                { key: "rejected" as Show, label: tr("Rejected"), dot: "bg-red-500", count: data ? all.filter((r) => r.status === "rejected").length : null },
                { key: "" as Show, label: tr("All"), count: data ? all.length : null }]} />
              <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search driver or note")} filters={filters}
                onOpen={() => { setDraft(pool); setSheet(true); }} onClear={() => setPool("")} />
            </Toolbar>
            {error ? <div className="p-4"><ErrorState message={error} onRetry={() => void load()} /></div>
              : !data ? <div className="p-4"><div className="skeleton h-48 rounded-xl" /></div>
              : <CardBody><DriverRequests rows={rows} onDone={load} /></CardBody>}
          </>
        ) : <CardBody><FleetIssues onCount={onCount} /></CardBody>}
      </WorkCard>
    </Page>
  );
}

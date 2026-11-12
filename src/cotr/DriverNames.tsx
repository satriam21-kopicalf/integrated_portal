"use client";

// Monitoring COTR → Storage & Production → Driver Names (recommendation #11, migration 093): the names of Report Armada in
// the pool workbooks ("BRI 55 BAKRI") that no employee of Master Driver was found for. Tied once to the driver (a
// suggestion, or any driver searched), the rows already imported take the driver — their cups count in the incentives —
// and the next imports use it; a name that is not a driver ("PESENAN / CUSTOMER POOL") is marked so and stops asking.

import { Ban, Check, Link2, Search, Trash2, UserRoundSearch, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Driver, Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Suggestion = { code: string; name: string; nickname: string | null; pool: string | null; fleet: string | null; score: number };
type Unmatched = { pool: string; poolName: string; label: string; key: string; rows: number; first: string; last: string; suggestions: Suggestion[] };
type Tied = { pool: string; poolName: string; label: string; driver: string | null; driverName: string | null; ignored: boolean; at: string };
type Data = { unmatched: Unmatched[]; tied: Tied[] };

export function DriverNames() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [pool, setPool] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    call<Data>(`/api/cotr/driver-labels${pool ? `?pool=${encodeURIComponent(pool)}` : ""}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, tick]);
  const tie = async (u: { pool: string; label: string }, driver: string | null, name?: string) => {
    setBusy(`${u.pool}:${u.label}`);
    try {
      const r = await call<{ rows: number }>("/api/cotr/driver-labels", { method: "PUT", json: { pool: u.pool, label: u.label, driver } });
      toast(driver ? tr("{0} tied to {1}: {2} rows of Report Armada updated", u.label, name ?? driver, r.rows) : tr("{0} marked as not a driver", u.label));
      setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const untie = async (t: Tied) => {
    try { await call(`/api/cotr/driver-labels?pool=${encodeURIComponent(t.pool)}&label=${encodeURIComponent(t.label)}`, { method: "DELETE" }); setTick((x) => x + 1); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const rows = data?.unmatched.reduce((a, u) => a + u.rows, 0) ?? 0;
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPool(e.target.value)}><option value="">{tr("All pools")}</option>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
      </div>
      <StatGrid label={tr("Summary")} cols={3}>
        <StatCard label={tr("Names without a driver")} icon={<UserRoundSearch />} tone={data?.unmatched.length ? "warn" : "brand"} value={data ? data.unmatched.length : "…"}
          sub={data && tr("{0} rows of Report Armada", rows)} />
        <StatCard label={tr("Names tied")} icon={<Link2 />} value={data ? data.tied.filter((t) => !t.ignored).length : "…"} />
        <StatCard label={tr("Not a driver")} icon={<Ban />} value={data ? data.tied.filter((t) => t.ignored).length : "…"} />
      </StatGrid>
      <Panel title={tr("Names in the workbooks without a driver")} description={tr("Tie each name once: the rows already imported take the driver (their cups count in the incentives) and the next imports use it.")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <SkeletonTable cols={4} /> : data.unmatched.length === 0 ? (
          <EmptyState icon={<Check />} title={tr("Every name in the workbooks has its driver")} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.unmatched.map((u) => (
              <LabelRow key={`${u.pool}:${u.label}`} u={u} drivers={drivers.rows ?? []} busy={busy === `${u.pool}:${u.label}`} onTie={(d, n) => void tie(u, d, n)} />
            ))}
          </ul>
        )}
      </Panel>
      {data && data.tied.length > 0 && (
        <Panel title={tr("Names tied by hand")} description={tr("Removing a tie lets the next import match the name by itself again; the rows already imported keep their driver.")}>
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Name in the workbook")}</th><th className="px-3 py-2.5">{tr("Pool / HUB")}</th><th className="px-3 py-2.5">{tr("Driver")}</th><th className="w-12 px-3 py-2.5" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.tied.map((t) => (
                <tr key={`${t.pool}:${t.label}`}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-neutral-900">{t.label}</td>
                  <td className="px-3 py-2.5">{t.poolName}</td>
                  <td className="px-3 py-2.5">{t.ignored ? <Badge tone="neutral">{tr("Not a driver")}</Badge> : <span className="font-medium">{t.driverName ?? t.driver}</span>}</td>
                  <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => void untie(t)} aria-label={tr("Remove")} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

/** One name: the suggested drivers to tap, a search of every driver, or "not a driver". */
function LabelRow({ u, drivers, busy, onTie }: { u: Unmatched; drivers: Driver[]; busy: boolean; onTie: (driver: string | null, name?: string) => void }) {
  const [q, setQ] = useState("");
  const found = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 2) return [];
    return drivers.filter((d) => `${d.name} ${d.code} ${d.fleet_code ?? ""}`.toLowerCase().includes(k)).slice(0, 6);
  }, [q, drivers]);
  return (
    <li className="space-y-2.5 px-1 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p><span className="font-mono text-sm font-semibold text-neutral-900">{u.label}</span> <span className="text-xs text-neutral-500">· {u.poolName}</span></p>
        <p className="text-xs text-neutral-500">{tr("{0} rows", u.rows)} · {u.first === u.last ? dmyOf(u.first) : `${dmyOf(u.first)} – ${dmyOf(u.last)}`}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{tr("Suggested")}</span>
        {u.suggestions.map((s) => (
          <button key={s.code} type="button" disabled={busy} onClick={() => onTie(s.code, s.name)} title={[s.pool, s.fleet].filter(Boolean).join(" · ")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors disabled:opacity-50 ${s.score >= 0.9 ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100" : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50"}`}>
            <Users size={12} />{s.name}{s.fleet && <span className="text-neutral-400">{s.fleet}</span>}<span className="tabular-nums text-neutral-400">{Math.round(s.score * 100)}%</span>
          </button>
        ))}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onTie(null)}><Ban size={13} /> {tr("Not a driver")}</Button>
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search another driver (name, code, armada)")} className="h-9 pl-8 text-sm" />
      </div>
      {found.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {found.map((d) => (
            <button key={d.code} type="button" disabled={busy} onClick={() => { onTie(d.code, d.name); setQ(""); }}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100 hover:bg-brand-100 disabled:opacity-50">
              {d.name}<span className="text-brand-500">{d.fleet_code ?? d.code}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

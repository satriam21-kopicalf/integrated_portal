"use client";

// Monitoring COTR → Stock of the products of a pool / HUB (migration 089): the opening stock is entered once per pool (cups
// per menu with the expiry); from then on every day runs by itself: start (the left of the day before) + received at the
// pool − given to the drivers + brought back at check out − waste − cupping − expired (first expired, first out) = left,
// the start of the next day. An assignment never gives more than the pool has once it has an opening.
// On Storage & Production (any pool) and on Storage & Assignment (the pool and day chosen there).

import { AlertTriangle, Boxes, CalendarClock, PackageCheck, PackageOpen, Save, Warehouse } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, kcTable } from "@/components/kc";
import Drawer from "@/components/kc/Drawer";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Lot = { expiresOn: string | null; qty: number; daysLeft: number | null; batchNo: string | null };
type Row = { menu: string; name: string; start: number; in: number; out: number; back: number; waste: number; cupping: number; expired: number; left: number; lots: Lot[] };
type Totals = Omit<Row, "menu" | "name" | "lots"> & { day: string };
type Ledger = { pool: string; day: string; opening: { day: string; by: string | null; at: string | null; lines: { menu: string; qty: number; expiresOn: string | null }[] } | null; rows: Row[]; days: Totals[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const COLS: [keyof Totals, () => string, string][] = [
  ["start", () => tr("Opening"), ""], ["in", () => tr("Received"), "+"], ["out", () => tr("To drivers"), "−"], ["back", () => tr("Back from drivers"), "+"],
  ["waste", () => tr("Waste"), "−"], ["cupping", () => tr("Cupping"), "−"], ["expired", () => tr("Expired"), "−"],
];

export function PoolLedger({ pool: fixed, day: fixedDay }: { pool?: string; day?: string }) {
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [poolSel, setPoolSel] = useState("");
  const [daySel, setDaySel] = useState(todayWib());
  const pool = fixed ?? (poolSel || usable[0]?.code || "");
  const day = fixedDay ?? daySel;
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    if (!pool) return;
    let alive = true;
    setData(null); setError(null);
    call<Ledger>(`/api/cotr/pool-ledger?pool=${encodeURIComponent(pool)}&day=${day}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, day, tick]);
  const sum = (k: keyof Totals) => (data ? data.rows.reduce((a, r) => a + (r[k as keyof Row] as number), 0) : 0);
  const expiring = data ? data.rows.reduce((a, r) => a + r.lots.filter((l) => l.daysLeft !== null && l.daysLeft <= 1 && l.qty > 0).reduce((b, l) => b + l.qty, 0), 0) : 0;
  const short = data ? data.rows.filter((r) => r.left < 0) : [];
  return (
    <>
      {!fixed && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPoolSel(e.target.value)}>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
          <Field label={tr("Day")}><Input type="date" value={daySel} max={todayWib()} onChange={(e) => setDaySel(e.target.value)} /></Field>
        </div>
      )}
      <Panel title={tr("Product stock of the pool")}
        description={data?.opening ? tr("Running from the opening stock of {0}; the left of a day is the opening of the next", dmyOf(data.opening.day)) : tr("Cups per menu at the pool / HUB")}
        actions={<Button variant={data?.opening ? "secondary" : "primary"} onClick={() => setEditing(true)} disabled={!pool}><PackageOpen size={15} /> {data?.opening ? tr("New opening stock") : tr("Set opening stock")}</Button>}>
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <SkeletonTable cols={8} /> : !data.opening ? (
          <EmptyState icon={<Boxes />} title={tr("No opening stock yet")}>
            <p className="mt-1 text-sm text-neutral-500">{tr("Enter it once; from then on the stock of the pool runs by itself every day.")}</p>
            <div className="mt-3"><Button onClick={() => setEditing(true)}><PackageOpen size={15} /> {tr("Set opening stock")}</Button></div>
          </EmptyState>
        ) : (
          <div className="space-y-4 p-4">
            <StatGrid label={tr("Summary")} cols={4}>
              <StatCard label={tr("Opening")} icon={<Warehouse />} value={sum("start")} sub={tr("cups at the start of the day")} />
              <StatCard label={tr("To drivers (net)")} icon={<PackageCheck />} value={sum("out") - sum("back")} sub={tr("{0} given · {1} back", sum("out"), sum("back"))} />
              <StatCard label={tr("Left")} tone="brand" icon={<Boxes />} value={sum("left")} sub={tr("opening of the next day")} />
              <StatCard label={tr("Expiring")} tone={expiring ? "warn" : "default"} icon={<CalendarClock />} value={expiring} sub={tr("cups expiring by tomorrow")} />
            </StatGrid>
            {short.length > 0 && <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertTriangle size={14} className="mt-0.5" />{tr("More went out than the stock had: {0}. Count the pool and enter a new opening stock.", short.map((r) => r.name).join(", "))}</p>}
            <div className="overflow-x-auto">
              <table className="m-cards w-full text-sm">
                <thead className={kcTable.thead}><tr><th className="px-3 py-2.5">{tr("Menu")}</th>{COLS.map(([k, l]) => <th key={k} className="px-3 py-2.5 text-right">{l()}</th>)}<th className="px-3 py-2.5 text-right">{tr("Left")}</th><th className="px-3 py-2.5">{tr("Batch & expiry of the left")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.rows.map((r) => (
                    <tr key={r.menu}>
                      <td className="px-3 py-2.5 font-medium text-neutral-900">{r.name}</td>
                      {COLS.map(([k, , sign]) => { const v = r[k as keyof Row] as number; return <td key={k} className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{v ? `${sign}${v}` : "—"}</td>; })}
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${r.left < 0 ? "text-red-600" : "text-neutral-900"}`}>{r.left}</td>
                      <td className="px-3 py-2.5"><span className="flex flex-wrap gap-1">{r.lots.filter((l) => l.qty !== 0).map((l, i) => (
                        <Badge key={i} tone={l.daysLeft === null ? "slate" : l.daysLeft <= 0 ? "red" : l.daysLeft <= 1 ? "amber" : "green"}>{l.batchNo ? `${l.batchNo} · ` : ""}{l.qty} · {l.expiresOn ? dmyOf(l.expiresOn) : tr("no expiry")}</Badge>))}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.days.length > 1 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-neutral-600">{tr("Last days")}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-neutral-500"><tr><th className="py-1.5 text-left">{tr("Day")}</th>{COLS.map(([k, l]) => <th key={k} className="py-1.5 text-right">{l()}</th>)}<th className="py-1.5 text-right">{tr("Left")}</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">{data.days.map((d) => (
                      <tr key={d.day}><td className="py-1.5">{dmyOf(d.day)}</td>{COLS.map(([k]) => <td key={k} className="py-1.5 text-right tabular-nums">{d[k] || "—"}</td>)}<td className="py-1.5 text-right font-semibold tabular-nums">{d.left}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
      {editing && <OpeningDrawer pool={pool} day={day} current={data} onClose={() => setEditing(false)} onSaved={(l) => { setData(l); setEditing(false); }} />}
    </>
  );
}

function OpeningDrawer({ pool, day, current, onClose, onSaved }: { pool: string; day: string; current: Ledger | null; onClose: () => void; onSaved: (l: Ledger) => void }) {
  const toast = useToast();
  const menus = useMaster<Menu>("menus");
  const active = useMemo(() => (menus.rows ?? []).filter((m) => m.is_active), [menus.rows]);
  const [on, setOn] = useState(day);
  const [lines, setLines] = useState<Record<string, { qty: string; exp: string; batch: string }>>(() => {
    const out: Record<string, { qty: string; exp: string; batch: string }> = {};
    for (const r of current?.rows ?? []) { const lot = r.lots.find((l) => l.qty > 0); out[r.menu] = { qty: r.left > 0 ? String(r.left) : "", exp: lot?.expiresOn ?? "", batch: lot?.batchNo ?? "" }; }
    return out;
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const total = Object.values(lines).reduce((a, l) => a + (Number(l.qty) || 0), 0);
  const save = async () => {
    setBusy(true);
    try {
      const out = await call<Ledger>("/api/cotr/pool-opening", { method: "PUT", json: { pool, day: on, note: note.trim() || null,
        lines: Object.entries(lines).filter(([, l]) => Number(l.qty) > 0).map(([menu, l]) => ({ menu, qty: Number(l.qty), expiresOn: l.exp || null, batchNo: l.batch.trim() || null })) } });
      toast(tr("Saved")); onSaved(out);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const set = (code: string, k: "qty" | "exp" | "batch", v: string) => setLines((s) => ({ ...s, [code]: { qty: s[code]?.qty ?? "", exp: s[code]?.exp ?? "", batch: s[code]?.batch ?? "", [k]: v } }));
  return (
    <Drawer open onClose={onClose} icon={<PackageOpen size={18} />} title={tr("Opening stock of the pool")} description={tr("The cups counted at the pool at the start of the day; the stock runs from here")}
      footer={<><span className="mr-auto text-xs text-neutral-500">{tr("{0} cups", total)}</span><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        {current?.opening && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("A new opening starts the stock again from its day; the days before keep the earlier opening.")}</p>}
        <Field label={tr("Day")}><Input type="date" value={on} max={todayWib()} onChange={(e) => setOn(e.target.value)} /></Field>
        <table className="w-full text-sm">
          <thead className="text-xs text-neutral-500"><tr><th className="py-1.5 text-left">{tr("Menu")}</th><th className="w-24 py-1.5 text-right">{tr("Cups")}</th><th className="w-32 py-1.5 pl-2 text-left">{tr("Batch No.")}</th><th className="w-40 py-1.5 pl-2 text-left">{tr("Expires on")}</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {active.map((m) => (
              <tr key={m.code}>
                <td className="py-1.5 pr-2">{m.name}</td>
                <td className="py-1.5"><Input inputMode="numeric" value={lines[m.code]?.qty ?? ""} onChange={(e) => set(m.code, "qty", e.target.value.replace(/\D/g, ""))} className="h-9 text-right tabular-nums" /></td>
                <td className="py-1.5 pl-2"><Input value={lines[m.code]?.batch ?? ""} maxLength={40} placeholder={tr("optional")} onChange={(e) => set(m.code, "batch", e.target.value.toUpperCase())} className="h-9" /></td>
                <td className="py-1.5 pl-2"><Input type="date" value={lines[m.code]?.exp ?? ""} min={on} onChange={(e) => set(m.code, "exp", e.target.value)} className="h-9" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Field label={tr("Note")}><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

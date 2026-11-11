"use client";

// Monitoring COTR → Product stock of a pool / HUB per day (migration 089), as the sheet "Product" of the pool workbooks:
// Opening (the physical leftover of the day before, less the lots past their expiry) + Transfer + Arrived − Sold − Waste
// − Cupping = Calculated; the Physical Leftover is counted per production / batch code and Balance = physical − calculated.
// The first count of a pool is its opening stock. Sold comes from the drivers' transactions, Arrived from the batches
// received (plus what is entered), Waste and Cupping from the drivers' check out and the pool; days imported from the
// workbooks keep the figures of the sheet. On Storage & Production (any pool) and Storage & Assignment (the pool chosen).

import { AlertTriangle, Boxes, FileSpreadsheet, PackageOpen, Plus, Save, Trash2, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, cx, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState } from "@/components/kc";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Lot = { batchNo: string | null; qty: number; expiresOn: string | null };
type Cell = { opening?: number; transfer?: number; arrived?: number; sold?: number; waste?: number; cupping?: number; calculated?: number;
  actual: number | null; balance?: number | null; expired: number; lots: Lot[] };
type Day = { day: string; source: "opening" | "app" | "sheet"; rows: Record<string, Cell> };
type Ledger = { pool: string; from: string; to: string; start: string | null; menus: { code: string; name: string }[]; days: Day[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const FIGURES: { key: keyof Cell; label: () => string; strong?: boolean }[] = [
  { key: "opening", label: () => tr("Opening Stock") }, { key: "transfer", label: () => tr("Product Transfer") },
  { key: "arrived", label: () => tr("Product Arrived") }, { key: "sold", label: () => tr("Product Sold") },
  { key: "waste", label: () => tr("Waste") }, { key: "cupping", label: () => tr("Cupping") },
  { key: "calculated", label: () => tr("Leftover (Calculated)"), strong: true }, { key: "actual", label: () => tr("Leftover (Physical)"), strong: true },
  { key: "balance", label: () => tr("Balance"), strong: true },
];

export function PoolLedger({ pool: fixed, day: fixedDay }: { pool?: string; day?: string }) {
  const pools = useMaster<Pool>("pools");
  const usable = (pools.rows ?? []).filter((p) => p.kind === "parent");
  const [poolSel, setPoolSel] = useState("");
  const [toSel, setToSel] = useState(todayWib());
  const [span, setSpan] = useState(fixed ? 1 : 7);
  const pool = fixed ?? (poolSel || usable[0]?.code || "");
  const to = fixedDay ?? toSel;
  const from = addDays(to, -(span - 1));
  const [data, setData] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [count, setCount] = useState<string | null>(null);
  const [moves, setMoves] = useState<{ day: string; kind: "transfer" | "arrived" } | null>(null);
  const [importing, setImporting] = useState(false);
  const reload = () => setTick((t) => t + 1);
  useEffect(() => {
    if (!pool) return;
    let alive = true;
    setData(null); setError(null);
    call<Ledger>(`/api/cotr/pool-ledger?pool=${encodeURIComponent(pool)}&dateFrom=${from}&dateTo=${to}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pool, from, to, tick]);
  const days = (data?.days ?? []).filter((d) => d.source !== "opening");
  const short = days.flatMap((d) => Object.entries(d.rows).filter(([, c]) => (c.calculated ?? 0) < 0).map(([m]) => m));
  const menuName = (code: string) => data?.menus.find((m) => m.code === code)?.name ?? code;
  return (
    <>
      {!fixed && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => setPoolSel(e.target.value)}>{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
          <Field label={tr("Until")}><Input type="date" value={toSel} max={todayWib()} onChange={(e) => setToSel(e.target.value)} /></Field>
          <Field label={tr("Days")}><Select value={String(span)} onChange={(e) => setSpan(Number(e.target.value))}>{[1, 3, 7, 14, 31].map((n) => <option key={n} value={n}>{tr("{0} days", n)}</option>)}</Select></Field>
          <Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet size={15} /> {tr("Import workbook")}</Button>
        </div>
      )}
      <Panel title={tr("Product stock of the pool")}
        description={data?.start ? tr("Counted from {0}; the physical leftover of a day is the opening stock of the next", dmyOf(data.start)) : tr("Cups per menu at the pool / HUB, as the sheet Product")}
        actions={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!pool} onClick={() => setMoves({ day: to, kind: "arrived" })}><Truck size={15} /> {tr("Arrived / Transfer")}</Button>
          <Button disabled={!pool} onClick={() => setCount(to)}><PackageOpen size={15} /> {data?.start ? tr("Physical leftover") : tr("Set opening stock")}</Button>
        </div>}>
        {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <SkeletonTable cols={6} /> : !data.start ? (
          <EmptyState icon={<Boxes />} title={tr("No opening stock yet")}>
            <p className="mt-1 text-sm text-neutral-500">{tr("Count the pool once (per batch code); from the next day the stock of the pool runs by itself.")}</p>
            <div className="mt-3"><Button onClick={() => setCount(addDays(to, -1))}><PackageOpen size={15} /> {tr("Set opening stock")}</Button></div>
          </EmptyState>
        ) : days.length === 0 ? <EmptyState icon={<Boxes />} title={tr("The stock starts the day after the opening count")} /> : (
          <div className="space-y-5 p-4">
            {short.length > 0 && <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertTriangle size={14} className="mt-0.5" />
              {tr("More went out than there was: {0}. Check the entries or count the pool.", [...new Set(short)].map(menuName).join(", "))}</p>}
            {[...days].reverse().map((d) => (
              <section key={d.day} className="overflow-hidden rounded-xl ring-1 ring-neutral-200">
                <header className="flex flex-wrap items-center gap-2 bg-neutral-50 px-3 py-2">
                  <span className="text-sm font-semibold text-neutral-900">{dmyOf(d.day)}</span>
                  {d.source === "sheet" && <Badge tone="violet">{tr("From the workbook")}</Badge>}
                  {Object.values(d.rows).some((c) => c.actual === null) && <Badge tone="amber">{tr("Not counted yet")}</Badge>}
                  <span className="ml-auto flex gap-1.5">
                    <Button variant="ghost" onClick={() => setMoves({ day: d.day, kind: "arrived" })}>{tr("Arrived / Transfer")}</Button>
                    <Button variant="ghost" onClick={() => setCount(d.day)}>{tr("Physical leftover")}</Button>
                  </span>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-xs text-neutral-500"><tr><th className="px-3 py-2 text-left font-medium">&nbsp;</th>{data.menus.map((m) => <th key={m.code} className="px-3 py-2 text-right font-medium">{m.name}</th>)}</tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                      {FIGURES.map((f) => (
                        <tr key={f.key} className={f.strong ? "bg-neutral-50/60" : undefined}>
                          <td className={cx("whitespace-nowrap px-3 py-1.5", f.strong ? "font-semibold text-neutral-900" : "text-neutral-600")}>{f.label()}</td>
                          {data.menus.map((m) => {
                            const c = d.rows[m.code];
                            const v = c?.[f.key] as number | null | undefined;
                            const tone = f.key === "balance" && v ? (v < 0 ? "text-red-600" : "text-emerald-700") : f.key === "calculated" && (v ?? 0) < 0 ? "text-red-600" : "";
                            return <td key={m.code} className={cx("px-3 py-1.5 text-right tabular-nums", f.strong && "font-semibold", tone)}>{v === null || v === undefined ? "—" : f.key === "balance" && v > 0 ? `+${v}` : v || (f.strong ? 0 : "—")}</td>;
                          })}
                        </tr>
                      ))}
                      <tr>
                        <td className="px-3 py-1.5 text-xs text-neutral-500">{tr("Batch & expiry")}</td>
                        {data.menus.map((m) => (
                          <td key={m.code} className="px-3 py-1.5 text-right">
                            <span className="inline-flex flex-wrap justify-end gap-1">{(d.rows[m.code]?.lots ?? []).map((l, i) => {
                              const gone = !!l.expiresOn && l.expiresOn <= d.day;
                              return <Badge key={i} tone={gone ? "red" : l.expiresOn && l.expiresOn <= addDays(d.day, 1) ? "amber" : "slate"} title={l.expiresOn ? tr("Expires {0}", dmyOf(l.expiresOn)) : undefined}>{l.batchNo ?? "—"} · {l.qty}</Badge>;
                            })}</span>
                            {(d.rows[m.code]?.expired ?? 0) > 0 && <span className="mt-0.5 block text-[11px] text-red-600">{tr("{0} expired: not carried over", d.rows[m.code].expired)}</span>}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
      {count && data && <CountDrawer pool={pool} day={count} ledger={data} onClose={() => setCount(null)} onSaved={() => { setCount(null); reload(); }} />}
      {moves && data && <MovesDrawer pool={pool} {...moves} ledger={data} onClose={() => setMoves(null)} onSaved={() => { setMoves(null); reload(); }} />}
      {importing && <ImportDrawer pools={usable} pool={pool} onClose={() => setImporting(false)} onSaved={() => { setImporting(false); reload(); }} />}
    </>
  );
}

type LotRow = { menu: string; batch: string; qty: string };

/** The physical leftover at the end of a day, per menu and batch code (the first count is the opening stock). */
function CountDrawer({ pool, day: first, ledger, onClose, onSaved }: { pool: string; day: string; ledger: Ledger; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [day, setDay] = useState(first);
  const known = ledger.days.find((d) => d.day === first);
  const [rows, setRows] = useState<LotRow[]>(() => {
    const out: LotRow[] = [];
    for (const m of ledger.menus) for (const l of known?.rows[m.code]?.lots ?? []) out.push({ menu: m.code, batch: l.batchNo ?? "", qty: String(l.qty) });
    return out.length ? out : ledger.menus.map((m) => ({ menu: m.code, batch: "", qty: "" }));
  });
  const [busy, setBusy] = useState(false);
  const total = (code: string) => rows.filter((r) => r.menu === code).reduce((a, r) => a + (Number(r.qty) || 0), 0);
  const set = (i: number, k: keyof LotRow, v: string) => setRows((s) => s.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/cotr/pool-count", { method: "PUT", json: { pool, day, lines: rows.filter((r) => Number(r.qty) > 0).map((r) => ({ menu: r.menu, qty: Number(r.qty), batchNo: r.batch.trim() || null })) } });
      toast(tr("Saved")); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<PackageOpen size={18} />} title={ledger.start ? tr("Physical leftover") : tr("Opening stock of the pool")}
      description={tr("Counted at the pool at the end of the day, per production / batch code; it is the opening stock of the next day")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("End of the day")}><Input type="date" value={day} max={todayWib()} onChange={(e) => setDay(e.target.value)} /></Field>
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{tr("Batch code SSDD: the batch of the day and the day it was made (0210 = batch 2 of the 10th); the expiry follows the shelf life of the menu.")}</p>
        {ledger.menus.map((m) => (
          <DrawerSection key={m.code} title={`${m.name} · ${tr("{0} cups", total(m.code))}`}>
            {rows.map((r, i) => r.menu !== m.code ? null : (
              <div key={i} className="flex items-center gap-2">
                <Input value={r.batch} placeholder={tr("Batch code")} maxLength={20} onChange={(e) => set(i, "batch", e.target.value.toUpperCase())} className="h-9 w-32" />
                <Input inputMode="numeric" value={r.qty} placeholder="0" onChange={(e) => set(i, "qty", e.target.value.replace(/\D/g, ""))} className="h-9 flex-1 text-right tabular-nums" />
                <button type="button" aria-label={tr("Delete")} onClick={() => setRows((s) => s.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setRows((s) => [...s, { menu: m.code, batch: "", qty: "" }])} className="inline-flex items-center gap-1 text-xs font-medium text-brand-700"><Plus size={13} />{tr("Add batch")}</button>
          </DrawerSection>
        ))}
      </div>
    </Drawer>
  );
}

/** The cups arrived from the storage (besides the batches received in the app) or moved in / out (transfer) on a day. */
function MovesDrawer({ pool, day: first, kind: k0, ledger, onClose, onSaved }: { pool: string; day: string; kind: "transfer" | "arrived"; ledger: Ledger; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [day, setDay] = useState(first);
  const [kind, setKind] = useState(k0);
  const [lines, setLines] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/cotr/pool-moves", { method: "PUT", json: { pool, day, kind, note: note.trim() || null,
        lines: Object.fromEntries(Object.entries(lines).map(([m, v]) => [m, Number(v) || 0]).filter(([, v]) => v)) } });
      toast(tr("Saved")); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Truck size={18} />} title={tr("Arrived / Transfer")} description={tr("Entered by hand; replaces what was entered for that day and kind")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Day")}><Input type="date" value={day} max={todayWib()} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label={tr("Kind")}><Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="arrived">{tr("Product Arrived (from the storage)")}</option><option value="transfer">{tr("Product Transfer (minus = out)")}</option></Select></Field>
        </div>
        {ledger.menus.map((m) => (
          <Field key={m.code} label={m.name}><Input inputMode="numeric" value={lines[m.code] ?? ""} placeholder="0"
            onChange={(e) => setLines((s) => ({ ...s, [m.code]: e.target.value.replace(kind === "transfer" ? /[^\d-]/g : /\D/g, "") }))} className="text-right tabular-nums" /></Field>
        ))}
        <Field label={tr("Note")}><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

type ImportSummary = { days: string[]; counts: number; figures: number; reports: number; unmatched: string[]; saved?: boolean };

/** A pool workbook (sheets Product and Report Armada) into the app, from a day: checked first, then saved. */
function ImportDrawer({ pools, pool: p0, onClose, onSaved }: { pools: Pool[]; pool: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [pool, setPool] = useState(p0);
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [check, setCheck] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const body = useMemo(() => ({ pool, dateFrom: from, file: file?.data ?? "" }), [pool, from, file]);
  const pick = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setFile({ name: f.name, data: String(r.result) }); setCheck(null); };
    r.readAsDataURL(f);
  };
  const run = async (apply: boolean) => {
    setBusy(true);
    try {
      const out = await call<ImportSummary>("/api/cotr/pool-ledger/import", { method: "POST", json: { ...body, apply } });
      if (apply) { toast(tr("Saved")); onSaved(); } else setCheck(out);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<FileSpreadsheet size={18} />} title={tr("Import workbook")} description={tr("The sheets Product and Report Armada of a pool workbook")}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        {check ? <Button loading={busy} onClick={() => void run(true)}><Save size={15} /> {tr("Save")}</Button>
          : <Button loading={busy} disabled={!file || !pool} onClick={() => void run(false)}>{tr("Check")}</Button>}</>}>
      <div className="space-y-4">
        <Field label={tr("Pool / HUB")}><Select value={pool} onChange={(e) => { setPool(e.target.value); setCheck(null); }}>{pools.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
        <Field label={tr("From")} hint={tr("The physical leftover of the day before becomes the opening stock")}><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setCheck(null); }} /></Field>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-sm text-neutral-600">
          <FileSpreadsheet size={16} />{file?.name ?? tr("Choose the .xlsx file")}
          <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {check && (
          <DrawerSection title={tr("Found")}>
            <p className="text-sm">{tr("Days: {0}", check.days.map(dmyOf).join(", ") || "—")}</p>
            <p className="text-sm">{tr("{0} batch counts · {1} figures · {2} driver days", check.counts, check.figures, check.reports)}</p>
            {check.unmatched.length > 0 && <p className="text-xs text-amber-700">{tr("Not matched to a driver (kept with the sheet's name): {0}", check.unmatched.join(", "))}</p>}
            <p className="text-xs text-neutral-500">{tr("Saving replaces the earlier import of these days.")}</p>
          </DrawerSection>
        )}
      </div>
    </Drawer>
  );
}

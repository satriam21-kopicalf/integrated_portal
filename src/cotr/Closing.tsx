"use client";

// Storage & Assignment → Night closing of a pool / HUB (recommendation #15, migration 094): before — every driver checked
// out and the reloads decided; 1) the waste and cupping of the pool, 2) the physical leftover per batch code, 3) the
// balance per menu (a note when it is not 0), then the day is closed. A closed day shows who closed it; Storage &
// Production can open it again.

import { CheckCircle2, Circle, ClipboardCheck, Lock, LockOpen, MoonStar, PackageOpen, Scale, Trash2, TriangleAlert, Truck } from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { Badge, Button, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { SkeletonList } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { CountDrawer, type Ledger } from "@/cotr/PoolLedger";
import { PoolWaste } from "@/cotr/PoolWaste";
import { hasPage, useAuth } from "@/lib/auth";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type MenuRow = { menu: string; name: string; opening: number | null; arrived: number | null; transfer: number | null; sold: number | null; waste: number | null;
  cupping: number | null; calculated: number | null; actual: number | null; balance: number | null };
type Closing = { pool: string; day: string; started: boolean; source: string | null; openShifts: { code: string; name: string }[]; reloads: number;
  waste: Record<string, { entries: number; qty: number }>; counted: boolean; menus: MenuRow[]; balance: number;
  closed: { at: string; by: string | null; note: string | null } | null };

/** The closing state of a pool-day as one bar on Storage & Assignment, opening the guided steps. */
export function ClosingBar({ pool, poolName, day }: { pool: string; poolName: string; day: string }) {
  const [c, setC] = useState<Closing | null>(null);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    call<Closing>(`/api/cotr/pool-close?pool=${encodeURIComponent(pool)}&day=${day}`).then((r) => { if (alive) setC(r); }).catch(() => { if (alive) setC(null); });
    return () => { alive = false; };
  }, [pool, day, tick]);
  return (
    <>
      <div className={cx("flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 ring-1", c?.closed ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-neutral-200")}>
        <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", c?.closed ? "bg-emerald-100 text-emerald-700" : "bg-brand-50 text-brand-700")}>
          {c?.closed ? <Lock size={17} /> : <MoonStar size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{tr("Night closing")} · {poolName} · {dmyOf(day)}</p>
          <p className="text-xs text-neutral-500">{!c ? "…" : c.closed ? tr("Closed by {0}, {1}", c.closed.by ?? "—", wibDateTime(c.closed.at))
            : tr("Waste & cupping → physical leftover → balance → close the day")}</p>
        </div>
        <Button size="sm" variant={c?.closed ? "secondary" : "primary"} onClick={() => setOpen(true)} disabled={!c}>
          {c?.closed ? tr("See closing") : tr("Start closing")}</Button>
      </div>
      {open && c && <ClosingDrawer initial={c} poolName={poolName} onClose={() => { setOpen(false); setTick((t) => t + 1); }} />}
    </>
  );
}

function Step({ n, title, done, warn, children }: { n: number; title: string; done: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <section className="relative pl-10">
      <span className={cx("absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
        done ? "bg-emerald-600 text-white" : warn ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600")}>
        {done ? <CheckCircle2 size={16} /> : n}</span>
      <h3 className="pb-2 pt-1 text-sm font-semibold text-neutral-900">{title}</h3>
      {children}
    </section>
  );
}

function ClosingDrawer({ initial, poolName, onClose }: { initial: Closing; poolName: string; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [c, setC] = useState<Closing>(initial);
  const [noWaste, setNoWaste] = useState(false);
  const [note, setNote] = useState(initial.closed?.note ?? "");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [counting, setCounting] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => setC(await call<Closing>(`/api/cotr/pool-close?pool=${encodeURIComponent(c.pool)}&day=${c.day}`)), [c.pool, c.day]);
  const openCount = async () => {
    try { setLedger(await call<Ledger>(`/api/cotr/pool-ledger?pool=${encodeURIComponent(c.pool)}&dateFrom=${c.day}&dateTo=${c.day}`)); setCounting(true); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const ledgerWaste = c.menus.reduce((a, m) => a + (m.waste ?? 0) + (m.cupping ?? 0), 0);
  const entries = Object.values(c.waste).reduce((a, w) => a + w.entries, 0);
  const step0 = c.openShifts.length === 0 && c.reloads === 0;
  const step1 = entries > 0 || ledgerWaste > 0 || noWaste;
  const step2 = c.counted;
  const step3 = step2 && (c.balance === 0 || note.trim().length >= 3);
  const close = async () => {
    setBusy(true);
    try { setC(await call<Closing>("/api/cotr/pool-close", { method: "POST", json: { pool: c.pool, day: c.day, note: note.trim() || null } })); toast(tr("The day is closed")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const reopen = async () => {
    setBusy(true);
    try { setC(await call<Closing>(`/api/cotr/pool-close?pool=${encodeURIComponent(c.pool)}&day=${c.day}`, { method: "DELETE" })); toast(tr("The day is open again")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const locked = !!c.closed;
  return (
    <Drawer open onClose={onClose} icon={<MoonStar size={18} />} title={tr("Night closing")} description={`${poolName} · ${dmyOf(c.day)}`} size="xl"
      footer={locked ? <>
        <Button variant="ghost" onClick={onClose}>{tr("Close")}</Button>
        {user && hasPage(user, "cotr.production") && <Button variant="secondary" loading={busy} onClick={() => void reopen()}><LockOpen size={15} /> {tr("Open the day again")}</Button>}
      </> : <>
        <Button variant="ghost" onClick={onClose}>{tr("Later")}</Button>
        <Button loading={busy} disabled={!(step0 && step1 && step3)} onClick={() => void close()}><Lock size={15} /> {tr("Close the day")}</Button>
      </>}>
      {!c ? <SkeletonList rows={4} /> : (
        <div className="space-y-6">
          {locked && (
            <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200"><Lock size={16} className="mt-0.5 flex-shrink-0" />
              <span>{tr("Closed by {0}, {1}", c.closed!.by ?? "—", wibDateTime(c.closed!.at))}{c.closed!.note && <span className="block text-xs">“{c.closed!.note}”</span>}</span></p>
          )}
          <Step n={0} title={tr("Drivers back at the pool")} done={step0} warn={!step0}>
            {step0 ? <p className="text-xs text-neutral-500">{tr("Every driver checked out and no reload waits.")}</p> : (
              <div className="space-y-1 text-xs text-amber-800">
                {c.openShifts.length > 0 && <p className="flex items-start gap-1.5"><Truck size={13} className="mt-0.5" />{tr("Not checked out yet: {0}", c.openShifts.map((s) => s.name).join(", "))}</p>}
                {c.reloads > 0 && <p className="flex items-start gap-1.5"><TriangleAlert size={13} className="mt-0.5" />{tr("{0} reloads wait for a decision", c.reloads)}</p>}
              </div>
            )}
          </Step>

          <Step n={1} title={tr("Waste & cupping of the pool")} done={step1}>
            <p className="text-xs text-neutral-500">
              {entries > 0 ? tr("{0} entries today ({1} cups waste, {2} cups cupping)", entries, (c.waste.storage?.qty ?? 0) + (c.waste.production?.qty ?? 0), c.waste.cupping?.qty ?? 0)
                : ledgerWaste > 0 ? tr("{0} cups of waste and cupping in the figures of the day ({1})", ledgerWaste, c.source ?? "—") : tr("Nothing entered yet for today.")}</p>
            {!locked && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="secondary" onClick={() => { if (wasteOpen) void reload(); setWasteOpen(!wasteOpen); }}><Trash2 size={14} /> {wasteOpen ? tr("Hide the form") : tr("Enter waste & cupping")}</Button>
                {entries === 0 && ledgerWaste === 0 && (
                  <label className="flex items-center gap-2 text-xs text-neutral-700"><input type="checkbox" checked={noWaste} onChange={(e) => setNoWaste(e.target.checked)} className="h-4 w-4" />
                    {tr("No waste or cupping today")}</label>
                )}
              </div>
            )}
            {wasteOpen && <div className="mt-3 rounded-xl ring-1 ring-neutral-200"><PoolWaste pool={c.pool} day={c.day} /></div>}
          </Step>

          <Step n={2} title={tr("Physical leftover per batch code")} done={step2}>
            <p className="text-xs text-neutral-500">{step2 ? tr("Counted for every menu.") : tr("Count the cups left at the pool, per production / batch code.")}</p>
            {!locked && <Button size="sm" variant={step2 ? "secondary" : "primary"} className="mt-2" onClick={() => void openCount()}><PackageOpen size={14} /> {step2 ? tr("Correct the count") : tr("Count the leftover")}</Button>}
          </Step>

          <Step n={3} title={tr("Check the balance")} done={step3 && step2} warn={step2 && c.balance !== 0}>
            {!step2 ? <p className="text-xs text-neutral-400">{tr("After the count.")}</p> : (
              <>
                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full min-w-[30rem] text-xs">
                    <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500"><tr><th className="px-3 py-2">{tr("Menu")}</th>
                      <th className="px-3 py-2 text-right">{tr("Opening")}</th><th className="px-3 py-2 text-right">{tr("In")}</th><th className="px-3 py-2 text-right">{tr("Out")}</th>
                      <th className="px-3 py-2 text-right">{tr("Calculated")}</th><th className="px-3 py-2 text-right">{tr("Actual")}</th><th className="px-3 py-2 text-right">{tr("Balance")}</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                      {c.menus.map((m) => (
                        <tr key={m.menu} className={m.balance ? "bg-red-50/50" : undefined}>
                          <td className="px-3 py-1.5 font-medium text-neutral-800">{m.name}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.opening ?? 0}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{(m.arrived ?? 0) + Math.max(0, m.transfer ?? 0)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{(m.sold ?? 0) + (m.waste ?? 0) + (m.cupping ?? 0) + Math.max(0, -(m.transfer ?? 0))}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.calculated ?? 0}</td>
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{m.actual ?? "—"}</td>
                          <td className={cx("px-3 py-1.5 text-right font-semibold tabular-nums", m.balance ? "text-red-700" : "text-emerald-700")}>{m.balance ? (m.balance > 0 ? `+${m.balance}` : m.balance) : "0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs">{c.balance === 0
                  ? <><Scale size={13} className="text-emerald-600" /><span className="text-emerald-700">{tr("Every menu balances.")}</span></>
                  : <><TriangleAlert size={13} className="text-amber-600" /><span className="text-amber-800">{tr("{0} cups apart: explain it before closing.", c.balance > 0 ? `+${c.balance}` : c.balance)}</span></>}</p>
                {!locked && c.balance !== 0 && (
                  <textarea value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} placeholder={tr("e.g. 2 cups broken in the cooler, counted again")}
                    className={cx(inputClass, "mt-2 py-2")} />
                )}
              </>
            )}
          </Step>

          <Step n={4} title={tr("Close the day")} done={locked}>
            <p className="text-xs text-neutral-500">{locked ? tr("The figures of this moment are kept with the closing.")
              : step0 && step1 && step3 ? tr("Everything is ready: close the day.") : tr("Finish the steps above first.")}</p>
            {!locked && <ul className="mt-2 space-y-1 text-xs">
              {[[step0, tr("Drivers back at the pool")], [step1, tr("Waste & cupping of the pool")], [step2, tr("Physical leftover per batch code")], [step3, tr("Check the balance")]].map(([ok, label]) => (
                <li key={label as string} className={cx("flex items-center gap-1.5", ok ? "text-emerald-700" : "text-neutral-500")}>{ok ? <CheckCircle2 size={13} /> : <Circle size={13} />}{label as string}</li>
              ))}
            </ul>}
          </Step>
          {c.source && <p className="flex items-center gap-1.5 text-[11px] text-neutral-400"><ClipboardCheck size={12} />{tr("Figures of the day from: {0}", c.source)} <Badge tone="slate">{c.pool}</Badge></p>}
        </div>
      )}
      {counting && ledger && <CountDrawer pool={c.pool} day={c.day} ledger={ledger} onClose={() => setCounting(false)} onSaved={() => { setCounting(false); void reload(); }} />}
    </Drawer>
  );
}

"use client";

// Monitoring COTR → Storage & Assignment (page cotr.storage, backend migration 049): the storage team of a pool assigns
// the cups per menu every driver takes for the day (changeable until the driver has checked and accepted them),
// settles the differences a driver reports (the final cups = the start stock of the shift), and decides the reloads:
// approve with the cups sent (fewer when short) or reject, then settle a difference found on arrival.

import { AlertTriangle, Check, ClipboardCopy, PackagePlus, RefreshCw, Save, Send, Warehouse, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Input, Page, Panel, Select, cx, theadClass, useToast } from "@/so/ui";
import { Stat, StatStrip } from "@/so/ui/StatStrip";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool, Stock } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

type Dispatch = { id: string; lines: Stock; note: string | null; status: "assigned" | "disputed" | "accepted"; driverCounts: Stock | null; driverNote: string | null; finalLines: Stock | null; resolutionNote: string | null };
type Row = { code: string; name: string; pool: string; fleet: string | null; dispatch: Dispatch | null; previous: Stock | null; shift: "open" | "closed" | null };
type Reload = { id: string; at: string; lines: Stock; note: string | null; status: string; approvedLines: Stock | null; driverCounts: Stock | null; driverNote: string | null; driver: string };
type Day = { day: string; drivers: Row[]; reloads: Reload[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const cups = (s: Stock | null | undefined) => Object.values(s ?? {}).reduce((a, v) => a + v, 0);
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
const clean = (s: Stock) => Object.fromEntries(Object.entries(s).filter(([, v]) => v > 0));

const STATUS: Record<Dispatch["status"], { label: () => string; tone: "blue" | "red" | "green" }> = {
  assigned: { label: () => tr("Waiting for the driver's check"), tone: "blue" },
  disputed: { label: () => tr("Difference reported"), tone: "red" },
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
  const [draft, setDraft] = useState<Record<string, Stock>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const poolCode = pool || usable[0]?.code || "";

  // a new pool / day, or `load()` after a change: read the day again
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!poolCode) return;
    let alive = true;
    setError(null);
    call<Day>(`/api/cotr/storage?day=${day}&pool=${encodeURIComponent(poolCode)}`)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setDraft(Object.fromEntries(d.drivers.map((r) => [r.code, { ...(r.dispatch?.lines ?? {}) }])));
      })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [day, poolCode, tick]);
  const load = async () => { setTick((t) => t + 1); };

  const editable = (r: Row) => !r.shift && r.dispatch?.status !== "accepted";
  const changed = (r: Row) => JSON.stringify(clean(draft[r.code] ?? {})) !== JSON.stringify(clean(r.dispatch?.lines ?? {}));
  const save = async (rows: Row[]) => {
    setBusy("save");
    let ok = 0;
    for (const r of rows) {
      try { await call("/api/cotr/dispatch", { method: "PUT", json: { day, driver: r.code, lines: clean(draft[r.code] ?? {}) } }); ok++; }
      catch (e) { toast(`${r.name}: ${(e as Error).message}`, "error"); }
    }
    setBusy(null);
    if (ok) toast(tr("{0} assignments saved", ok));
    await load();
  };
  const fromYesterday = () => setDraft((d) => {
    const next = { ...d };
    data?.drivers.forEach((r) => { if (editable(r) && r.previous && !cups(next[r.code])) next[r.code] = { ...r.previous }; });
    return next;
  });

  const rows = data?.drivers ?? [];
  const toSave = rows.filter((r) => editable(r) && changed(r) && cups(clean(draft[r.code] ?? {})) > 0);
  const disputes = rows.filter((r) => r.dispatch?.status === "disputed");
  const reloads = data?.reloads.filter((r) => r.status === "requested" || r.status === "disputed") ?? [];
  const name = (code: string) => rows.find((r) => r.code === code)?.name ?? code;

  return (
    <Page title={tr("Storage & Assignment")} subtitle={tr("Products every driver takes, differences and reloads of the pool")}
      actions={<>
        <Select value={poolCode} onChange={(e) => setPool(e.target.value)} className="h-10 w-48">{usable.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value || todayWib())} className="h-10 w-40" />
        <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> {tr("Refresh")}</Button>
      </>}
      stats={data && (
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Drivers")} icon={<Warehouse size={16} />} value={rows.length} />
          <Stat label={tr("Assigned")} icon={<Send size={16} />} value={rows.filter((r) => r.dispatch).length} />
          <Stat label={tr("Accepted")} icon={<Check size={16} />} value={rows.filter((r) => r.dispatch?.status === "accepted").length} />
          <Stat label={tr("Differences to settle")} icon={<AlertTriangle size={16} />} value={disputes.length} />
          <Stat label={tr("Reloads to decide")} icon={<PackagePlus size={16} />} value={reloads.length} />
        </StatStrip>
      )}>
      {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel> : !data ? <div className="skeleton h-64 rounded-2xl" /> : (
        <>
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
                {reloads.map((r) => r.status === "requested"
                  ? <ReloadDecide key={r.id} r={r} title={`${name(r.driver)} · ${time(r.at)}`} menus={menus} onDone={load} />
                  : <Settle key={r.id} title={`${tr("Reload")} · ${name(r.driver)} · ${time(r.at)}`} menus={menus} expected={r.approvedLines ?? r.lines}
                      found={r.driverCounts ?? {}} note={r.driverNote} url={`/api/cotr/reloads/${r.id}/resolve`} onDone={load} />)}
              </div>
            </Panel>
          )}

          <Panel title={tr("Assignment of the day")} description={tr("Cups per menu each driver takes; the driver checks them before checking in")}
            actions={<>
              <Button size="sm" variant="secondary" onClick={fromYesterday}><ClipboardCopy size={14} /> {tr("Fill from the last day")}</Button>
              <Button size="sm" loading={busy === "save"} disabled={!toSave.length} onClick={() => void save(toSave)}><Save size={14} /> {tr("Save {0}", toSave.length)}</Button>
            </>}>
            {rows.length === 0 ? <Empty title={tr("No driver in this pool")}>{tr("Add the drivers in Master Driver.")}</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={theadClass}>
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-4 py-2.5">{tr("Driver")}</th>
                      {menus.map((m) => <th key={m.code} className="px-2 py-2.5 text-center">{m.name}</th>)}
                      <th className="px-3 py-2.5 text-right">{tr("Total")}</th><th className="px-4 py-2.5">{tr("Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => {
                      const can = editable(r);
                      const lines = draft[r.code] ?? {};
                      const st = r.dispatch ? STATUS[r.dispatch.status] : null;
                      return (
                        <tr key={r.code} className={cx(changed(r) && can && "bg-amber-50/40")}>
                          <td className="sticky left-0 bg-white px-4 py-2"><span className="block font-medium text-slate-900">{r.name}</span><span className="text-[11px] text-slate-400">{r.fleet ?? r.code}</span></td>
                          {menus.map((m) => (
                            <td key={m.code} className="px-1 py-1.5 text-center">
                              {can ? (
                                <input inputMode="numeric" value={lines[m.code] || ""} placeholder="0" aria-label={`${r.name} · ${m.name}`}
                                  onChange={(e) => setDraft((d) => ({ ...d, [r.code]: { ...d[r.code], [m.code]: Number(e.target.value.replace(/\D/g, "")) || 0 } }))}
                                  className="h-9 w-16 rounded-lg border border-slate-200 text-center tabular-nums focus:border-blue-500 focus:outline-none" />
                              ) : <span className="tabular-nums">{(r.dispatch?.finalLines ?? r.dispatch?.lines)?.[m.code] ?? "—"}</span>}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{cups(can ? lines : r.dispatch?.finalLines ?? r.dispatch?.lines)}</td>
                          <td className="px-4 py-2">
                            {r.shift ? <Badge tone="green" dot>{r.shift === "open" ? tr("On the road") : tr("Shift ended")}</Badge>
                              : st ? <Badge tone={st.tone}>{st.label()}</Badge> : <Badge tone="slate">{tr("Not assigned")}</Badge>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </Page>
  );
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
    <section className="rounded-xl border border-red-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {note && <p className="mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">{note}</p>}
      <table className="mt-2 w-full text-xs">
        <thead className="text-slate-500"><tr><th className="py-1 text-left">{tr("Menu")}</th><th className="text-right">{tr("Sent")}</th><th className="text-right">{tr("Found")}</th><th className="text-right">{tr("Final")}</th></tr></thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c} className={cx((found[c] ?? 0) !== (expected[c] ?? 0) && "text-red-700")}>
              <td className="py-1">{name(c)}</td><td className="text-right tabular-nums">{expected[c] ?? 0}</td><td className="text-right tabular-nums">{found[c] ?? 0}</td>
              <td className="py-1 text-right">
                <input inputMode="numeric" value={final[c] ?? 0} onChange={(e) => setFinal({ ...final, [c]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  className="h-8 w-16 rounded-md border border-slate-200 text-center tabular-nums text-slate-900" aria-label={`${tr("Final")} ${name(c)}`} />
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
    <section className="rounded-xl border border-amber-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {r.note && <p className="mt-1 text-xs text-slate-500">{r.note}</p>}
      <table className="mt-2 w-full text-xs">
        <thead className="text-slate-500"><tr><th className="py-1 text-left">{tr("Menu")}</th><th className="text-right">{tr("Asked")}</th><th className="text-right">{tr("Sent")}</th></tr></thead>
        <tbody>
          {Object.keys(r.lines).map((c) => (
            <tr key={c}>
              <td className="py-1">{name(c)}</td><td className="text-right tabular-nums">{r.lines[c]}</td>
              <td className="py-1 text-right">
                <input inputMode="numeric" value={sent[c] ?? 0} onChange={(e) => setSent({ ...sent, [c]: Number(e.target.value.replace(/\D/g, "")) || 0 })}
                  className="h-8 w-16 rounded-md border border-slate-200 text-center tabular-nums" aria-label={`${tr("Sent")} ${name(c)}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (a rejection needs it)")} className="h-9 flex-1" />
        <Button size="sm" loading={busy} disabled={!cups(clean(sent))} onClick={() => void decide(true)}><Check size={14} /> {tr("Approve")}</Button>
        <Button size="sm" variant="secondary" disabled={busy} className="text-red-600" onClick={() => void decide(false)}><X size={14} /> {tr("Reject")}</Button>
      </div>
    </section>
  );
}

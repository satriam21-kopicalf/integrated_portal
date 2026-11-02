"use client";

// Monitoring COTR → Storage & Assignment (page cotr.storage, backend migration 049): the storage team of a pool assigns
// the cups per menu every driver takes for the day (changeable until the driver has checked and accepted them),
// settles the differences a driver reports (the final cups = the start stock of the shift), and decides the reloads:
// approve with the cups sent (fewer when short) or reject, then settle a difference found on arrival.

import { AlertTriangle, Check, ClipboardCopy, Coffee, PackagePlus, RefreshCw, Save, Send, Sparkles, Warehouse, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Input, Page, Panel, Select, cx, useToast } from "@/so/ui";
import { Stat, StatStrip } from "@/so/ui/StatStrip";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool, Stock } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

type Dispatch = { id: string; lines: Stock; note: string | null; status: "assigned" | "disputed" | "accepted"; driverCounts: Stock | null; driverNote: string | null; finalLines: Stock | null; resolutionNote: string | null;
  /** migration 061: the part of the lines for tasting */ cupping?: Stock };
/** what a driver should carry from his last 14 days (or the pool average): to sell and for cupping */
type Advice = { days: number; sell: Stock; cupping: Stock; avgSold: Record<string, number>; wasteRate: number | null; source: "driver" | "pool" };
type Row = { code: string; name: string; nickname?: string | null; pool: string; fleet: string | null; dispatch: Dispatch | null; previous: Stock | null; shift: "open" | "closed" | null; advice?: Advice | null };
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
  const [draft, setDraft] = useState<Record<string, Plan>>({});
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

          <Panel title={tr("What the pool prepares today")} description={tr("Total per product of the assignments below: to sell and for cupping")}>
            <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-6">
              {need.map((n) => (
                <div key={n.menu.code} className="bg-white px-3 py-2.5">
                  <p className="truncate text-xs font-medium text-slate-600" title={n.menu.name}>{n.menu.name}</p>
                  <p className="text-xl font-bold tabular-nums text-slate-900">{n.sell + n.cupping}</p>
                  <p className="text-[11px] text-slate-500">{tr("{0} to sell · {1} cupping", n.sell, n.cupping)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={tr("Assignment of the day")} description={tr("Products every driver carries, set per driver from his sales: what to sell and what is for cupping")}
            actions={<>
              <Button size="sm" variant="secondary" onClick={fromAdvice}><Sparkles size={14} /> <span className="hidden sm:inline">{tr("Use the advice for all")}</span></Button>
              <Button size="sm" variant="secondary" onClick={fromYesterday}><ClipboardCopy size={14} /> <span className="hidden sm:inline">{tr("Fill from the last day")}</span></Button>
            </>}>
            {rows.length === 0 ? <Empty title={tr("No driver in this pool")}>{tr("Add the drivers in Master Driver.")}</Empty> : (
              <ul className="grid gap-3 p-3 sm:p-4 xl:grid-cols-2">
                {rows.map((r) => {
                  const can = editable(r);
                  const plan = draft[r.code] ?? { sell: {}, cupping: {} };
                  const shown = can ? plan : planOf(r.dispatch);
                  const st = r.dispatch ? STATUS[r.dispatch.status] : null;
                  const a = r.advice;
                  return (
                    <li key={r.code} className={cx("rounded-2xl border bg-white", changed(r) && can ? "border-amber-300 ring-2 ring-amber-100" : "border-slate-200")}>
                      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                          <p className="text-[11px] text-slate-500">{[r.nickname, r.fleet ?? r.code].filter(Boolean).join(" · ")}</p>
                        </div>
                        {r.shift ? <Badge tone="green" dot>{r.shift === "open" ? tr("On the road") : tr("Shift ended")}</Badge>
                          : st ? <Badge tone={st.tone}>{st.label()}</Badge> : <Badge tone="slate">{tr("Not assigned")}</Badge>}
                      </div>
                      {a && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700"><Sparkles size={12} className="text-violet-600" />
                            {a.source === "pool" ? tr("Advice from the pool average") : tr("Advice from {0} days worked", a.days)}</span>
                          {a.wasteRate !== null && <span className={cx(a.wasteRate > 0.15 ? "font-semibold text-red-700" : "")}>{tr("waste {0}%", Math.round(a.wasteRate * 100))}</span>}
                          {can && <button type="button" onClick={() => applyAdvice(r)} className="ml-auto rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700">{tr("Use advice")}</button>}
                        </div>
                      )}
                      <table className="w-full text-sm">
                        <thead className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          <tr><th className="px-4 pb-1 pt-2 text-left">{tr("Product")}</th><th className="w-20 px-1 pb-1 pt-2 text-center">{tr("Sell")}</th>
                            <th className="w-20 px-1 pb-1 pt-2 text-center"><span className="inline-flex items-center gap-0.5"><Coffee size={10} />{tr("Cupping")}</span></th><th className="w-16 px-3 pb-1 pt-2 text-right">{tr("Carried")}</th></tr>
                        </thead>
                        <tbody>
                          {menus.map((m) => {
                            const sell = shown.sell[m.code] ?? 0, taste = shown.cupping[m.code] ?? 0;
                            const hint = a ? `${tr("avg {0}/day", a.avgSold[m.code] ?? 0)} · ${tr("advice {0}", a.sell[m.code] ?? 0)}` : undefined;
                            return (
                              <tr key={m.code} className="border-t border-slate-50">
                                <td className="px-4 py-1"><span className="block truncate text-[13px] text-slate-800">{m.name}</span>{hint && <span className="block text-[10px] text-slate-400">{hint}</span>}</td>
                                {(["sell", "cupping"] as const).map((part) => (
                                  <td key={part} className="px-1 py-1 text-center">
                                    {can ? (
                                      <input inputMode="numeric" value={(part === "sell" ? sell : taste) || ""} placeholder="0" aria-label={`${r.name} · ${m.name} · ${part === "sell" ? tr("Sell") : tr("Cupping")}`}
                                        onChange={(e) => setQty(r.code, part, m.code, Number(e.target.value.replace(/\D/g, "")) || 0)}
                                        className={cx("h-10 w-full rounded-lg border text-center text-base tabular-nums focus:border-blue-500 focus:outline-none sm:h-9 sm:text-sm", part === "cupping" ? "border-amber-200 bg-amber-50/40" : "border-slate-200")} />
                                    ) : <span className="tabular-nums text-slate-700">{(part === "sell" ? sell : taste) || "—"}</span>}
                                  </td>
                                ))}
                                <td className="px-3 py-1 text-right font-semibold tabular-nums text-slate-900">{sell + taste || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 text-xs">
                            <td className="px-4 py-2 font-semibold text-slate-600">{tr("Total")}</td>
                            <td className="px-1 py-2 text-center font-semibold tabular-nums">{cups(shown.sell)}</td>
                            <td className="px-1 py-2 text-center font-semibold tabular-nums text-amber-700">{cups(shown.cupping)}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums">{cups(shown.sell) + cups(shown.cupping)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {toSave.length > 0 && (
            <div className="action-bar sticky bottom-0 z-20 -mx-4 -mb-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
              <p className="min-w-0 flex-1 text-xs text-slate-600">{tr("{0} assignments not saved yet", toSave.length)}</p>
              <Button loading={busy === "save"} onClick={() => void save(toSave)}><Save size={15} /> {tr("Save {0}", toSave.length)}</Button>
            </div>
          )}
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

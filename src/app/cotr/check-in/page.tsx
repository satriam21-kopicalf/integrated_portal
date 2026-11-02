"use client";

// Monitoring COTR → Driver Check In (page cotr.check-in): the day of every COTR driver from the driver app — the shift
// (start / end check in with photo and location, the stock on the fleet, the cash to hand over, the stock difference at
// the end), the reloads to approve or reject for the pool, the cost requests to approve or reject, and where the
// drivers are (the GPS of their phone while the shift is open, on a map).

import { Camera, Check, ChevronDown, LogIn, LogOut, MapPin, MapPinCheck, PackagePlus, RefreshCw, TriangleAlert, Wallet, X } from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Input, cx, useToast } from "@/so/ui";
import { kcTable } from "@/components/kc";
import { Page, Panel, Stat, StatStrip } from "@/components/kc/compat";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { Monitor, Reload, Request, Shift, Stock } from "@/cotr/types";
import { rupiah } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const cups = (s: Stock) => Object.values(s ?? {}).reduce((a, v) => a + v, 0);
const photoUrl = (kind: "check-in" | "signature" | "request", id: string) => `/api/cotr/photos/${kind}/${id}`;
const KINDS: Record<string, () => string> = { fuel: () => tr("Fuel"), ice: () => tr("Ice"), stall: () => tr("Stall rent"), repair: () => tr("Fleet repair"), parking: () => tr("Parking / levy"), other: () => tr("Other") };
// the map reads window (Leaflet): loaded in the browser only
const DriverMap = dynamic(() => import("@/cotr/DriverMap"), { ssr: false, loading: () => <div className="skeleton h-[480px] rounded-xl" /> });
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

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
  const pendingReloads = data?.reloads.filter((r) => r.status === "requested").length ?? 0;
  const pendingRequests = data?.requests.filter((r) => r.status === "sent").length ?? 0;

  return (
    <Page eyebrow="Monitoring COTR" media={<MapPinCheck size={19} />} title={tr("Driver Check In")} subtitle={tr("Shifts, reloads and requests of every COTR driver")}
      actions={<>
        <Input type="date" value={day} max={todayWib()} onChange={(e) => setDay(e.target.value || todayWib())} className="h-10 w-40" />
        <Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} /> {tr("Refresh")}</Button>
      </>}
      stats={data && (
        <StatStrip label={tr("Summary")} columns={5}>
          <Stat label={tr("Drivers checked in")} icon={<LogIn size={16} />} value={`${data.shifts.length} / ${data.shifts.length + data.notStarted.length}`} />
          <Stat label={tr("Cups sold")} icon={<Check size={16} />} value={data.shifts.reduce((a, s) => a + s.recap.cups, 0)} />
          <Stat label={tr("Cash to hand over")} icon={<Wallet size={16} />} value={rupiah(data.shifts.reduce((a, s) => a + s.recap.cashExpected, 0))} />
          <Stat label={tr("To decide")} icon={<PackagePlus size={16} />} value={pendingReloads + pendingRequests} />
          <Stat label={tr("Cash short")} icon={<TriangleAlert size={16} />} value={rupiah(data.shifts.reduce((a, s) => a + Math.min(0, s.recap.balance ?? 0), 0))} />
        </StatStrip>
      )}>
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[
        { value: "shifts", label: tr("Shifts") },
        { value: "location", label: tr("Location") },
        { value: "reloads", label: pendingReloads ? `${tr("Reloads")} (${pendingReloads})` : tr("Reloads") },
        { value: "requests", label: pendingRequests ? `${tr("Requests")} (${pendingRequests})` : tr("Requests") },
      ]} />
      {error ? <Panel><ErrorState message={error} onRetry={() => void load()} /></Panel> : !data ? (
        <div className="skeleton h-64 rounded-xl" />
      ) : tab === "shifts" ? <Shifts data={data} /> : tab === "location" ? <DriverMap day={day} live={day === todayWib()} /> : tab === "reloads" ? <Reloads data={data} /> : <Requests data={data} onDone={load} />}
    </Page>
  );
}

function Shifts({ data }: { data: Monitor }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <Panel title={tr("Shifts")}>
        {data.shifts.length === 0 ? <Empty title={tr("No driver has checked in on this day")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={kcTable.thead}>
                <tr>
                  <th className="px-4 py-2.5">{tr("Driver")}</th><th className="px-4 py-2.5">{tr("Pool / fleet")}</th>
                  <th className="px-4 py-2.5">{tr("Start")}</th><th className="px-4 py-2.5">{tr("End")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Sold")}</th><th className="px-4 py-2.5 text-right">{tr("On the fleet")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Cash")}</th><th className="px-4 py-2.5 text-right">{tr("QRIS")}</th><th className="px-4 py-2.5 text-right">{tr("Balance")}</th>
                  <th className="px-4 py-2.5">{tr("Check")}</th><th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.shifts.map((s) => {
                  const diff = s.recap.difference && Object.keys(s.recap.difference).length;
                  return (
                    <Fragment key={s.id}>
                      <tr className="cursor-pointer hover:bg-neutral-50/70" onClick={() => setOpen(open === s.id ? null : s.id)}>
                        <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{s.driverName ?? s.driver}</span><span className="text-[11px] text-neutral-400">{s.driver}</span></td>
                        <td className="px-4 py-2.5"><span className="block">{s.poolName ?? s.pool}</span><span className="text-[11px] text-neutral-400">{s.fleet ?? "—"}</span></td>
                        <td className="px-4 py-2.5 tabular-nums">{time(s.startedAt)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{s.status === "open" ? <Badge tone="green" dot>{tr("On the road")}</Badge> : time(s.endedAt)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.recap.cups}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{s.status === "open" ? cups(s.stock) : "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(s.recap.cash)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(s.recap.qris)}</td>
                        <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", (s.recap.balance ?? 0) < 0 ? "text-red-600" : (s.recap.balance ?? 0) > 0 ? "text-amber-700" : "text-neutral-500")}>
                          {s.recap.balance === null ? "—" : rupiah(s.recap.balance)}
                        </td>
                        <td className="px-4 py-2.5">
                          {diff ? <Badge tone="red" icon={<TriangleAlert size={11} />}>{tr("Stock difference")}</Badge>
                            : s.recap.voided ? <Badge tone="amber">{tr("{0} voided", s.recap.voided)}</Badge> : <Badge tone="slate">OK</Badge>}
                        </td>
                        <td className="px-2"><ChevronDown size={16} className={cx("text-neutral-400 transition-transform", open === s.id && "rotate-180")} /></td>
                      </tr>
                      {open === s.id && <tr><td colSpan={11} className="bg-neutral-50/60 px-4 py-4"><ShiftDetail s={s} /></td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {data.notStarted.length > 0 && (
        <Panel title={tr("Not checked in ({0})", data.notStarted.length)} description={tr("Active drivers without a shift on this day")}>
          <ul className="flex flex-wrap gap-1.5 p-4">
            {data.notStarted.map((d) => <li key={d.code}><Badge tone="amber">{d.name} · {d.code}</Badge></li>)}
          </ul>
        </Panel>
      )}
    </>
  );
}

function ShiftDetail({ s }: { s: Shift }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {s.checkIns.map((c) => (
        <section key={c.id} className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            {c.kind === "start" ? <LogIn size={14} /> : <LogOut size={14} />}{c.kind === "start" ? tr("Start of shift") : tr("End of shift")}
            <span className="font-normal text-neutral-400">{time(c.at)}</span>
          </p>
          {c.hasPhoto ? (
            <a href={photoUrl("check-in", c.id)} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl("check-in", c.id)} alt={tr("Photo")} className="h-36 w-full object-cover" loading="lazy" />
            </a>
          ) : <p className="mt-2 flex items-center gap-1 text-xs text-red-600"><Camera size={12} />{tr("Missing")}</p>}
          {c.lat !== null && c.lng !== null && (
            <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-brand-700">
              <MapPin size={12} />{c.lat.toFixed(5)}, {c.lng.toFixed(5)}
            </a>
          )}
          <p className="mt-1 text-xs text-neutral-600">{Object.entries(c.stock).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</p>
          {c.note && <p className="mt-1 text-xs text-neutral-500">{c.note}</p>}
          {c.hasSignature && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl("signature", c.id)} alt={tr("Signature")} className="mt-2 h-16 rounded-md border border-neutral-100 bg-white object-contain" loading="lazy" />
          )}
        </section>
      ))}
      <section className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
        <p className="font-semibold text-neutral-900">{tr("Recap")}</p>
        <ul className="mt-2 space-y-1 text-xs text-neutral-600">
          {s.recap.perMenu.map((m) => <li key={m.code} className="flex justify-between"><span>{m.name} × {m.qty}</span><span className="tabular-nums">{rupiah(m.total)}</span></li>)}
          <li className="flex justify-between border-t border-neutral-100 pt-1 font-semibold text-neutral-900"><span>{tr("Total")}</span><span className="tabular-nums">{rupiah(s.recap.total)}</span></li>
          <li className="flex justify-between"><span>{tr("Waste")} · {tr("Cupping")}</span><span className="tabular-nums">{s.recap.waste} · {s.recap.cupping} {tr("cups")}</span></li>
          {s.recap.cashActual !== null && <>
            <li className="flex justify-between"><span>{tr("Spent from the cash")}</span><span className="tabular-nums">{rupiah(s.recap.cashSpent)}</span></li>
            <li className="flex justify-between"><span>{tr("Cash to hand over")}</span><span className="tabular-nums">{rupiah(s.recap.cashExpected)}</span></li>
            <li className="flex justify-between"><span>{tr("Cash counted")}</span><span className="tabular-nums">{rupiah(s.recap.cashActual)}</span></li>
            <li className={cx("flex justify-between font-semibold", (s.recap.balance ?? 0) < 0 ? "text-red-600" : "text-neutral-900")}><span>{tr("Balance")}</span><span className="tabular-nums">{rupiah(s.recap.balance ?? 0)}</span></li>
          </>}
          <li className="flex justify-between"><span>{tr("Reloads received")}</span><span className="tabular-nums">{s.recap.reloaded} {tr("cups")}</span></li>
          <li className="flex justify-between"><span>{tr("Requests")}</span><span className="tabular-nums">{rupiah(s.recap.requested)}</span></li>
        </ul>
        {s.recap.difference && Object.keys(s.recap.difference).length > 0 && (
          <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
            {tr("Stock difference")}: {Object.entries(s.recap.difference).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}
            {s.endNote ? ` · ${s.endNote}` : ""}
          </p>
        )}
      </section>
    </div>
  );
}

const RELOAD: Record<Reload["status"], { label: () => string; tone: "amber" | "violet" | "red" | "green" }> = {
  requested: { label: () => tr("Waiting"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "violet" },
  rejected: { label: () => tr("Rejected"), tone: "red" }, received: { label: () => tr("Received"), tone: "green" },
  disputed: { label: () => tr("Difference reported"), tone: "red" },
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
  return (
    <Panel title={tr("Requests")} description={tr("Costs on the road with the receipt; the ones still waiting are listed whatever their day")}>
      {data.requests.length === 0 ? <Empty title={tr("No request")} /> : (
        <ul className="divide-y divide-neutral-100">
          {data.requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <a href={photoUrl("request", r.id)} target="_blank" rel="noreferrer" className="flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-neutral-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoUrl("request", r.id)} alt={tr("Receipt")} className="h-14 w-14 object-cover" loading="lazy" />
                </a>
                <span className="min-w-0">
                  <span className="block font-medium text-neutral-900">{r.driverName ?? r.driverCode} · {(KINDS[r.kind] ?? (() => r.kind))()} · {rupiah(r.amount)}</span>
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

"use client";

// Form → Transfer Stock (TITO, page form.stock-transfer; integrated_portal_be app/stock_transfer.py, migration 075), the
// same screen in the portal and in Operations. Three tabs:
//   Request    my outlet asks another outlet for materials: the materials the outlet has available (its latest SO less
//              the transfers on their way out), the exact quantities (at most what it has; none of a material ≤ 0),
//              a photo and a signature before submitting;
//   My requests  their steps; once Cost Control approved, "Receive" with a clear photo of the goods (only then the stock
//              of both outlets moves); a request the outlet has not answered can be cancelled;
//   Incoming   the requests to my outlets: accept (the stock does not move yet) or decline, with a note.

import { ArrowDown, ArrowRight, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, Inbox, Info, PackageCheck, PenLine, Search, Send, Store, Trash2, Undo2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import Dialog, { ConfirmDialog } from "@/so/ui/Dialog";
import Drawer from "@/so/ui/Drawer";
import { FormCard, Note, Segmented } from "@/so/ui/Simple";
import LiveClock from "@/so/ui/LiveClock";
import SignaturePad from "@/so/features/count/SignaturePad";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { SkeletonList } from "@/components/kc/Skeleton";
import { thumb } from "@/lib/assets";
import { useFocusMode } from "@/components/layout/BottomNav";
import { tr } from "@/lib/i18n";
import { wibDateTime } from "@/so/lib/wib";
import { type Available, type FormData, type Transfer, STATUS, fileUrl, qtyText, rpText, shortBranch } from "./transfer";

type Tab = "request" | "mine" | "incoming";

export default function TransferForm() {
  const toast = useToast();
  useFocusMode();  // the phone tab bar steps aside for the send bar of the form
  const [data, setData] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("request");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<FormData>("/api/stock-transfer/form")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error || !data) {
    return (
      <Page title={tr("Transfer Stock")} subtitle={tr("Take materials from another outlet")} actions={<LiveClock />}>
        {error ? <ErrorState message={error} onRetry={load} /> : <SkeletonList rows={4} />}
      </Page>
    );
  }
  const tabs: { value: Tab; label: string }[] = [
    { value: "request", label: tr("Request") },
    { value: "mine", label: data.todo.receive ? tr("My Requests ({0} to receive)", data.todo.receive) : tr("My Requests") },
    { value: "incoming", label: data.todo.answer ? tr("Incoming ({0} to check)", data.todo.answer) : tr("Incoming") },
  ];
  return (
    <Page title={tr("Transfer Stock")} subtitle={tr("Take materials from another outlet")} actions={<LiveClock />}>
      <div className="mx-auto max-w-5xl space-y-4">
        {(data.todo.answer > 0 || data.todo.receive > 0) && (
          <div className="flex flex-wrap gap-2">
            {data.todo.answer > 0 && <button type="button" onClick={() => setTab("incoming")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <Inbox size={15} />{tr("{0} requests from other outlets to check", data.todo.answer)}</button>}
            {data.todo.receive > 0 && <button type="button" onClick={() => setTab("mine")} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900">
              <PackageCheck size={15} />{tr("{0} approved transfers to receive", data.todo.receive)}</button>}
          </div>
        )}
        <Segmented label={tr("View")} value={tab} onChange={setTab} options={tabs} />
        {!data.branches.length ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">{tr("No outlet is assigned to your account.")}</div>
        ) : tab === "request" ? (
          <RequestForm data={data} onDone={(t) => { toast(tr("Transfer {0} sent to {1}", t.number, shortBranch(t.fromName))); void load(); setTab("mine"); setOpen(t.id); }} />
        ) : (
          <List rows={tab === "mine" ? data.requests : data.incoming} side={tab} onOpen={setOpen} />
        )}
      </div>
      {open && <TransferDrawer id={open} mine={new Set(data.branches.map((b) => b.code))} onClose={() => setOpen(null)} onChanged={() => void load()} />}
    </Page>
  );
}

function RequestForm({ data, onDone }: { data: FormData; onDone: (t: Transfer) => void }) {
  const toast = useToast();
  const [to, setTo] = useState(data.branches.length === 1 ? data.branches[0].code : "");
  const [from, setFrom] = useState("");
  const [picking, setPicking] = useState(false);
  const [stock, setStock] = useState<Available | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<Shot | null>(null);
  const [camera, setCamera] = useState(false);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setStock(null); setQty({});
    if (!from) return;
    setLoading(true);
    call<Available>(`/api/stock-transfer/available?branch=${encodeURIComponent(from)}`).then(setStock).catch((e: Error) => toast(e.message, "error")).finally(() => setLoading(false));
  }, [from, toast]);
  const num = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() && !Number.isNaN(n) ? n : null; };
  const picked = useMemo(() => (stock?.items ?? []).filter((i) => (num(qty[i.code] ?? "") ?? 0) > 0), [stock, qty]);
  const over = picked.filter((i) => (num(qty[i.code] ?? "") ?? 0) > i.available);
  const shown = (stock?.items ?? []).filter((i) => !q || `${i.name} ${i.code} ${i.category}`.toLowerCase().includes(q.toLowerCase()));
  const ready = !!to && !!from && picked.length > 0 && !over.length && !!photo;
  const fromName = data.sources.find((s) => s.code === from)?.name ?? "";
  const send = async (signature: string) => {
    setBusy(true);
    try {
      const t = await call<Transfer>("/api/stock-transfer", { method: "POST", json: {
        toBranch: to, fromBranch: from, note: note.trim() || null, photo: photo!.image, signature,
        lines: picked.map((i) => ({ code: i.code, qty: num(qty[i.code] ?? "") })) } });
      onDone(t);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); setSigning(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <FormCard n={1} title={tr("Outlets")} hint={tr("Your outlet asks the outlet that has the material")}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:gap-3">
            <label className="block text-xs font-medium text-neutral-600">{tr("My outlet (receives)")}
              {data.branches.length === 1 ? (
                <span className="mt-1 flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-900"><Store size={15} className="text-neutral-400" /><span className="truncate">{data.branches[0].name}</span></span>
              ) : (
                <select className={cx(inputClass, "mt-1 h-11")} value={to} onChange={(e) => { setTo(e.target.value); if (e.target.value === from) setFrom(""); }}>
                  <option value="">{tr("Choose")}</option>{data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              )}</label>
            <span className="flex justify-center text-neutral-300 sm:pb-3" aria-hidden><ArrowDown size={18} className="sm:hidden" /><ArrowRight size={18} className="hidden rotate-180 sm:block" /></span>
            <div className="text-xs font-medium text-neutral-600">{tr("Take from outlet")}
              <button type="button" disabled={!to} onClick={() => setPicking(true)}
                className={cx("mt-1 flex h-11 w-full items-center gap-2 rounded-lg border px-3 text-left text-sm transition disabled:opacity-50",
                  from ? "border-brand-300 bg-brand-50 text-brand-900" : "border-neutral-200 bg-white text-neutral-500 hover:border-brand-300")}>
                <Store size={15} className={from ? "text-brand-600" : "text-neutral-400"} />
                <span className="min-w-0 flex-1 truncate">{from ? fromName : to ? tr("Choose the outlet to take from") : tr("Choose your outlet first")}</span>
                <ChevronRight size={16} className="flex-shrink-0 text-neutral-400" />
              </button>
            </div>
          </div>
        </FormCard>

        <FormCard n={2} title={tr("Materials")} hint={stock?.so ? tr("Stock of {0} from its SO of {1}, less the transfers on their way out", shortBranch(fromName), stock.so.date) : tr("Choose the outlet to take from first")}
          aside={picked.length ? <Badge tone="blue">{tr("{0} chosen", picked.length)}</Badge> : undefined}>
          {!from ? <p className="text-sm text-neutral-500">{tr("Choose the outlet to take from first")}</p>
            : loading ? <SkeletonList rows={3} />
            : !stock?.so ? <Note tone="warn" icon={<Info />}>{tr("This outlet has no stock opname in the portal in the last 60 days: its stock is unknown.")}</Note>
            : !stock.items.length ? <p className="text-sm text-neutral-500">{tr("This outlet has no material in stock.")}</p> : (
              <>
                <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input className={cx(inputClass, "pl-8")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search material")} /></div>
                <ul className="max-h-[28rem] divide-y divide-neutral-100 overflow-auto rounded-lg border border-neutral-200">
                  {shown.map((i) => {
                    const v = num(qty[i.code] ?? "");
                    const bad = v != null && v > i.available;
                    return (
                      <li key={i.code} className={cx("flex items-center gap-3 px-3 py-2.5", v && !bad ? "bg-brand-50/50" : bad ? "bg-red-50" : "")}>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-snug text-neutral-900">{i.name}</span>
                          <span className="block text-[11px] text-neutral-500">{i.code}{i.category ? ` · ${i.category}` : ""} · {tr("available {0} {1}", qtyText(i.available), i.unit)}</span></span>
                        <span className="relative w-28 flex-shrink-0 sm:w-32">
                          <input inputMode="decimal" className={cx(inputClass, "h-11 pr-11 text-right text-base tabular-nums sm:h-10 sm:text-sm", bad && "border-red-300")} value={qty[i.code] ?? ""} placeholder="0"
                            onChange={(e) => setQty({ ...qty, [i.code]: e.target.value })} aria-label={`${tr("Qty")} ${i.name}`} />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] uppercase text-neutral-400">{i.unit}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {over.length > 0 && <p className="text-xs text-red-600">{tr("More than the stock of the outlet: {0}", over.map((i) => i.name).join(", "))}</p>}
              </>
            )}
        </FormCard>

        <FormCard n={3} title={tr("Evidence")} hint={tr("A photo of the need (empty stock, the order …) and a note; you sign when submitting")}>
          {photo ? (
            <div className="flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- the photo just taken */}
              <img src={photo.image} alt={tr("Photo evidence")} className="h-32 w-32 rounded-lg bg-neutral-100 object-cover" />
              <Button variant="secondary" size="sm" onClick={() => setCamera(true)}><Camera size={14} />{tr("Retake")}</Button>
            </div>
          ) : <Button variant="secondary" disabled={!to} onClick={() => setCamera(true)}><Camera size={15} />{tr("Take photo")}</Button>}
          <label className="block text-xs font-medium text-neutral-600">{tr("Note")} <span className="font-normal text-neutral-400">({tr("optional")})</span>
            <textarea className={cx(inputClass, "mt-1 py-2")} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("e.g. the milk ran out before the delivery")} /></label>
        </FormCard>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <section className="hidden rounded-xl border border-neutral-200 bg-white p-4 lg:block">
          <p className="text-sm font-semibold text-neutral-900">{tr("Summary")}</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-neutral-500">{tr("From")}</dt><dd className="truncate text-right">{fromName ? shortBranch(fromName) : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-neutral-500">{tr("To")}</dt><dd className="truncate text-right">{shortBranch(data.branches.find((b) => b.code === to)?.name ?? "—")}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-neutral-500">{tr("Materials")}</dt><dd>{picked.length}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-neutral-500">{tr("Photo")}</dt><dd>{photo ? tr("Attached") : "—"}</dd></div>
          </dl>
          <Button className="mt-3 w-full" disabled={!ready} loading={busy} onClick={() => setSigning(true)}><PenLine size={15} />{tr("Sign & Submit")}</Button>
          {!ready && <p className="mt-2 text-center text-xs text-neutral-400">{tr("Choose the outlets, the materials and take the photo.")}</p>}
        </section>
        <Note icon={<Info />}>{tr("The outlet checks the request, Cost Control approves it, then you receive the goods with a photo: only then the stock of both outlets changes.")}</Note>
      </aside>
      {/* phones & tablets: what is ready and the send button, at the bottom */}
      <div className="action-bar sticky bottom-0 z-10 -mx-4 -mb-5 border-t border-neutral-200/70 bg-white/95 px-4 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <p className="mb-2 truncate text-xs text-neutral-500">
          {ready ? `${shortBranch(fromName)} → ${shortBranch(data.branches.find((b) => b.code === to)?.name ?? "")} · ${tr("{0} materials", picked.length)}` : tr("Choose the outlets, the materials and take the photo.")}
        </p>
        <Button className="h-11 w-full" disabled={!ready} loading={busy} onClick={() => setSigning(true)}><PenLine size={15} />{tr("Sign & Submit")}</Button>
      </div>
      {picking && <OutletPicker outlets={data.sources.filter((x) => x.code !== to)} value={from} onClose={() => setPicking(false)}
        onPick={(code) => { setFrom(code); setPicking(false); }} />}
      <CameraCapture open={camera} title={tr("Transfer Stock")} branch={data.branches.find((b) => b.code === to)?.name ?? ""} countNumber={fromName ? `← ${shortBranch(fromName)}` : ""}
        onClose={() => setCamera(false)} onShot={async (s) => { setPhoto(s); setCamera(false); }} />
      {signing && <SignDialog busy={busy} onClose={() => setSigning(false)} onSign={(sig) => void send(sig)} />}
    </div>
  );
}

/** The outlet to take from: a sheet with a search, full screen on a phone, rows easy to tap. */
function OutletPicker({ outlets, value, onPick, onClose }: { outlets: { code: string; name: string }[]; value: string; onPick: (code: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = outlets.filter((o) => words.every((w) => `${o.name} ${o.code}`.toLowerCase().includes(w)));
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-neutral-900/40 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={tr("Take from outlet")} onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2 border-b border-neutral-100 px-4 pb-3 pt-4">
          <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-neutral-900">{tr("Take from outlet")}</span>
            <span className="block text-xs text-neutral-500">{tr("{0} outlets", outlets.length)}</span></span>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label={tr("Close")}><X size={18} /></button>
        </header>
        <div className="border-b border-neutral-100 p-3">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input autoFocus className={cx(inputClass, "h-11 pl-9 text-base sm:text-sm")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search outlet, e.g. kemang")} /></div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {shown.map((o) => (
            <li key={o.code}>
              <button type="button" onClick={() => onPick(o.code)} className={cx("flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-neutral-100", o.code === value ? "bg-brand-50" : "hover:bg-neutral-50")}>
                <Store size={16} className="flex-shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-neutral-900">{shortBranch(o.name)}</span><span className="block text-[11px] text-neutral-400">{o.code}</span></span>
                {o.code === value && <Check size={16} className="text-brand-600" />}
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-4 py-10 text-center text-sm text-neutral-400">{tr("No outlet matches")}</li>}
        </ul>
      </div>
    </div>
  );
}

function SignDialog({ busy, onSign, onClose }: { busy: boolean; onSign: (sig: string) => void; onClose: () => void }) {
  const [sig, setSig] = useState<string | null>(null);
  return (
    <Dialog open title={tr("Signature")} description={tr("Sign to submit the request")} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!sig} onClick={() => sig && onSign(sig)}><Send size={15} />{tr("Submit")}</Button></>}>
      <SignaturePad onChange={setSig} />
    </Dialog>
  );
}

function List({ rows, side, onOpen }: { rows: Transfer[]; side: "mine" | "incoming"; onOpen: (id: string) => void }) {
  if (!rows.length) return <div className="rounded-xl border border-neutral-200 bg-white"><Empty icon={<ClipboardList size={26} />} title={side === "mine" ? tr("No request yet") : tr("No request from other outlets")} /></div>;
  return (
    <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      {rows.map((t) => {
        const todo = side === "mine" ? t.status === "approved" : t.status === "submitted";
        return (
          <li key={t.id}>
            <button type="button" onClick={() => onOpen(t.id)} className={cx("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50", todo && "bg-amber-50/40")}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-semibold text-neutral-900">{t.number}</span><Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label()}</Badge></span>
                <span className="mt-0.5 block truncate text-sm text-neutral-800">{shortBranch(t.fromName)} <ArrowRight size={12} className="inline text-neutral-400" /> {shortBranch(t.toName)}</span>
                <span className="block text-xs text-neutral-500">{tr("{0} materials", t.lines)} · {wibDateTime(t.requested.at)} · {t.requested.by}</span>
              </span>
              {todo && <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{side === "mine" ? tr("Receive") : tr("Check")}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One transfer with its steps, photos and the actions the account may take on it. */
export function TransferDrawer({ id, mine, monitor = false, onClose, onChanged }: {
  id: string; mine: Set<string>; monitor?: boolean; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [t, setT] = useState<Transfer | null>(null);
  const [act, setAct] = useState<null | "accept" | "decline" | "cancel" | "approve" | "reject">(null);
  const [receiving, setReceiving] = useState(false);
  const [busy, setBusy] = useState(false);
  // Cost Control adjusts the quantities before approving (migration 076)
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const load = useCallback(() => { call<Transfer>(`/api/stock-transfer/${id}`).then(setT).catch((e: Error) => toast(e.message, "error")); }, [id, toast]);
  useEffect(() => { load(); }, [load]);
  const run = async (path: string, json: unknown) => {
    setBusy(true);
    try { setT(await call<Transfer>(path, { method: "POST", json })); onChanged(); setAct(null); setReceiving(false); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  if (!t) return <Drawer open onClose={onClose} size="lg" title={tr("Transfer Stock")}><SkeletonList rows={4} /></Drawer>;
  const isTo = mine.has(t.toBranch), isFrom = mine.has(t.fromBranch);
  const deciding = monitor && !!t.canDecide && t.status === "accepted";
  const numOf = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() && !Number.isNaN(n) ? n : null; };
  const adjusted: Record<string, number> = {};
  for (const i of t.items ?? []) {
    const n = adjust[i.code] === undefined ? null : numOf(adjust[i.code]);
    if (n !== null && Math.abs(n - i.qty) > 1e-9) adjusted[i.code] = n;
  }
  const nAdjusted = Object.keys(adjusted).length;
  const badAdjust = (t.items ?? []).some((i) => adjust[i.code] !== undefined && (numOf(adjust[i.code]) ?? 0) <= 0);
  const steps: { label: string; s: { note: string | null; by: string | null; at: string | null } | null; tone?: string }[] = [
    { label: tr("Requested by {0}", shortBranch(t.toName)), s: { note: t.note, by: t.requested.by, at: t.requested.at } },
    { label: t.status === "declined" ? tr("Declined by {0}", shortBranch(t.fromName)) : tr("Checked by {0}", shortBranch(t.fromName)), s: t.source },
    { label: t.status === "rejected" ? tr("Rejected by Cost Control") : tr("Approved by Cost Control"), s: t.costControl },
    { label: tr("Received"), s: t.received },
  ];
  const footer = (
    <div className="flex w-full flex-wrap justify-end gap-2">
      {!monitor && isFrom && t.status === "submitted" && <><Button variant="secondary" onClick={() => setAct("decline")}><XCircle size={14} />{tr("Decline")}</Button><Button onClick={() => setAct("accept")}><CheckCircle2 size={14} />{tr("Accept")}</Button></>}
      {!monitor && isTo && t.status === "submitted" && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setAct("cancel")}><Trash2 size={14} />{tr("Cancel the request")}</Button>}
      {!monitor && isTo && t.status === "approved" && <Button onClick={() => setReceiving(true)}><PackageCheck size={15} />{tr("Receive the Goods")}</Button>}
      {deciding && <><Button variant="secondary" onClick={() => setAct("reject")}><XCircle size={14} />{tr("Reject")}</Button>
        <Button disabled={badAdjust} onClick={() => setAct("approve")}><CheckCircle2 size={14} />{nAdjusted ? tr("Approve with {0} adjusted", nAdjusted) : tr("Approve")}</Button></>}
    </div>
  );
  return (
    <Drawer open onClose={onClose} size="lg" icon={<ClipboardList size={18} />} title={t.number} description={`${t.fromName} → ${t.toName}`} footer={footer}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label()}</Badge>
          {t.esbLabel && <Badge tone="slate">{tr("ESB label")}: {t.esbLabel.value === "esb" ? tr("To ESB") : tr("Portal only")}</Badge>}
          <span className="ml-auto font-semibold tabular-nums text-neutral-900">{t.value != null ? rpText(t.value) : t.estimate != null ? `± ${rpText(t.estimate)}` : ""}</span></div>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500"><tr><th className="px-3 py-2">{tr("Material")}</th><th className="px-3 py-2 text-right">{deciding ? tr("Approved Qty") : tr("Qty")}</th><th className="px-3 py-2 text-right">{tr("Value")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">{(t.items ?? []).map((i) => (
              <tr key={i.code}><td className="px-3 py-2"><p className="font-medium text-neutral-900">{i.name}</p><p className="text-[11px] text-neutral-400">{i.code}{i.available != null ? ` · ${tr("stock when asked {0}", qtyText(i.available))}` : ""}</p></td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {deciding ? (
                    <span className="relative inline-block w-28 sm:w-32">
                      <input inputMode="decimal" className={cx(inputClass, "h-10 pr-10 text-right text-base tabular-nums sm:h-9 sm:text-sm", adjusted[i.code] !== undefined && "border-amber-400 bg-amber-50")}
                        value={adjust[i.code] ?? String(i.qty).replace(".", ",")} onChange={(e) => setAdjust({ ...adjust, [i.code]: e.target.value })} aria-label={`${tr("Approved Qty")} ${i.name}`} />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-neutral-400">{i.unit}</span>
                    </span>
                  ) : <>{qtyText(i.qty)} <span className="text-neutral-400">{i.unit}</span></>}
                  {Math.abs(i.requested - i.qty) > 1e-9 && <span className="block text-[11px] text-amber-700">{tr("asked {0}, adjusted by Cost Control", qtyText(i.requested))}</span>}
                  {deciding && adjusted[i.code] !== undefined && <span className="block text-[11px] text-amber-700">{tr("asked {0}", qtyText(i.requested))}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-neutral-700">{rpText(i.value)}</td></tr>))}</tbody>
          </table>
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className={cx("flex gap-3 rounded-xl border px-3 py-2", s.s ? "border-neutral-200 bg-white" : "border-dashed border-neutral-200 bg-neutral-50/60")}>
              <span className={cx("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold", s.s ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-500")}>{i + 1}</span>
              <span className="min-w-0 flex-1"><span className="block font-medium text-neutral-900">{s.label}</span>
                {s.s ? <span className="block text-xs text-neutral-500">{[s.s.by, s.s.at ? wibDateTime(s.s.at) : null].filter(Boolean).join(" · ")}</span> : <span className="block text-xs text-neutral-400">{tr("Not yet")}</span>}
                {s.s?.note && <span className="mt-0.5 block text-xs text-neutral-700">“{s.s.note}”</span>}</span>
            </li>
          ))}
        </ol>
        {t.gr && <GrStatus gr={t.gr} />}
        <div className="grid grid-cols-3 gap-2">
          {([["photo", tr("Request photo")], ["signature", tr("Signature")], ["receive", tr("Goods received")]] as const).filter(([k]) => k !== "receive" || t.received).map(([k, label]) => (
            <a key={k} href={fileUrl(t.id, k)} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
              <img src={thumb(fileUrl(t.id, k), 320)} alt={label} loading="lazy" className={cx("aspect-square w-full rounded-lg bg-neutral-100 ring-1 ring-neutral-200", k === "signature" ? "object-contain p-2" : "object-cover")} />
              <span className="mt-1 block text-center text-[11px] text-neutral-500">{label}</span>
            </a>
          ))}
        </div>
      </div>
      <ConfirmDialog open={!!act} busy={busy} danger={act === "decline" || act === "reject" || act === "cancel"}
        title={{ accept: tr("Accept the request?"), decline: tr("Decline the request?"), cancel: tr("Cancel the request?"), approve: tr("Approve the transfer?"), reject: tr("Reject the transfer?") }[act ?? "accept"]}
        description={act === "accept" ? tr("Your stock does not change yet: it moves when the outlet receives the goods after Cost Control approves.")
          : act === "approve" && nAdjusted ? tr("{0} quantities adjusted: the stock and the COGS follow the approved quantities.", nAdjusted) : undefined}
        confirmLabel={{ accept: tr("Accept"), decline: tr("Decline"), cancel: tr("Cancel the request"), approve: tr("Approve"), reject: tr("Reject") }[act ?? "accept"]}
        reasonLabel={act === "cancel" ? undefined : act === "approve" ? (nAdjusted ? tr("Reason of the adjustment (required)") : tr("Note (optional)")) : tr("Reason / note (required)")}
        onClose={() => setAct(null)}
        onConfirm={(note) => {
          if ((act === "accept" || act === "decline" || act === "reject" || (act === "approve" && nAdjusted > 0)) && !note.trim()) { toast(tr("Write the reason / note"), "error"); return; }
          if (act === "accept" || act === "decline") void run(`/api/stock-transfer/${t.id}/answer`, { accept: act === "accept", note });
          else if (act === "cancel") void run(`/api/stock-transfer/${t.id}/cancel`, {});
          else if (act) void run(`/api/monitoring/stock/transfers/${t.id}/decide`, { approve: act === "approve", note, ...(act === "approve" && nAdjusted ? { qty: adjusted } : {}) });
        }} />
      {receiving && <ReceiveDialog t={t} busy={busy} onClose={() => setReceiving(false)} onReceive={(photo, note, grNumber) => void run(`/api/stock-transfer/${t.id}/receive`, { photo, note, grNumber })} />}
    </Drawer>
  );
}

function ReceiveDialog({ t, busy, onReceive, onClose }: { t: Transfer; busy: boolean; onReceive: (photo: string, note: string, grNumber: string) => void; onClose: () => void }) {
  const [photo, setPhoto] = useState<Shot | null>(null);
  const [gr, setGr] = useState("");
  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Dialog open title={tr("Receive the Goods")} description={tr("Enter the ESB Good Receipt number and take a clear photo of the goods; your stock changes when you confirm.")} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!photo || !gr.trim()} onClick={() => photo && onReceive(photo.image, note, gr.trim())}><PackageCheck size={15} />{tr("Confirm Received")}</Button></>}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-neutral-600">{tr("ESB Good Receipt number")}
          <input className={cx(inputClass, "mt-1 h-11 text-base uppercase sm:h-10 sm:text-sm")} value={gr} maxLength={60} onChange={(e) => setGr(e.target.value)}
            placeholder={tr("e.g. GR-CTG18-2611-0001")} autoCapitalize="characters" /></label>
        <Note icon={<Info />}>{tr("Make the Good Receipt of these goods in ESB first. The portal matches the materials and quantities with it once ESB syncs (every 30 minutes).")}</Note>
        {photo ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo just taken */}
            <img src={photo.image} alt={tr("Goods received")} className="h-36 w-36 rounded-lg bg-neutral-100 object-cover" />
            <Button variant="secondary" size="sm" onClick={() => setCamera(true)}><Undo2 size={14} />{tr("Retake")}</Button>
          </div>
        ) : <Button onClick={() => setCamera(true)}><Camera size={15} />{tr("Take photo of the goods")}</Button>}
        <textarea className={cx(inputClass, "py-2")} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (optional)")} />
      </div>
      <CameraCapture open={camera} title={tr("Goods received")} branch={t.toName} countNumber={t.number} onClose={() => setCamera(false)} onShot={async (s) => { setPhoto(s); setCamera(false); }} />
    </Dialog>
  );
}

/** The ESB GR of a received transfer against what ESB synced (app/stock_transfer.py gr_check). */
function GrStatus({ gr }: { gr: NonNullable<Transfer["gr"]> }) {
  const title = tr("Good Receipt {0}", gr.number);
  if (gr.status === "waiting") return <Note tone="info" icon={<Info />} title={title}>{tr("Waiting for the ESB GR: not synced to the portal yet (every 30 minutes).")}</Note>;
  if (gr.status === "otherBranch") return <Note tone="warn" icon={<Info />} title={title}>{tr("This GR belongs to another outlet ({0}). Check the number with Cost Control.", gr.branch ?? "—")}</Note>;
  if (gr.status === "matched") return <Note tone="ok" icon={<CheckCircle2 />} title={title}>{tr("Matches the transfer: every material and quantity.")}</Note>;
  return (
    <Note tone="warn" icon={<Info />} title={title}>
      <p>{tr("Differs from the transfer:")}</p>
      <ul className="mt-1 space-y-0.5">{(gr.diffs ?? []).map((d) => (
        <li key={d.code} className="flex justify-between gap-3"><span className="truncate">{d.name}</span>
          <span className="flex-shrink-0 tabular-nums">{tr("transfer {0} · GR {1}", d.transfer == null ? "—" : qtyText(d.transfer), d.gr == null ? "—" : qtyText(d.gr))}</span></li>))}</ul>
    </Note>
  );
}

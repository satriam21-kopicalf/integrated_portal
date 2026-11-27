"use client";

// Aggregator Insight → a ticket (a complaint, or a low review made a ticket), 2026-11-27 (backend migration 167): the
// complaint and the review it came from (with the reply seen in the merchant app), the details of the handling, the
// evidence (screenshots of the chat, refund / voucher proof, the reply, photos; images or PDF) and its history. A ticket is
// done with its resolution, its action, its root cause, whether the customer was contacted and at least one evidence.

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, MessageSquareText, Paperclip, Save, Star, Trash2, Upload } from "lucide-react";
import { useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import Drawer, { Button, Facts, Group, IconButton, JSelect, Lozenge, Row, SectionMessage, ctl, cx, type LozengeTone } from "@/jira";
import { Platform } from "@/aggregator/kit";
import { fmtDay, fmtSpan, fmtStamp, rp } from "@/aggregator/time";

type Status = "open" | "progress" | "done";
export type Ticket = {
  id: number; reviewId: string | null; branchCode: string | null; outlet: string; platform: string; orderNo: string | null; day: string; source: string; category: string; detail: string;
  status: Status; resolution: string | null; compensation: number | null; createdAt: string; createdBy: string | null; firstResponseAt: string | null; resolvedAt: string | null;
  responseMin: number | null; resolveMin: number | null; handledBy: string | null; member: string | null;
  action: string | null; rootCause: string | null; contacted: boolean | null; contactVia: string | null; replyText: string | null; compBearer: string | null; esbBill: string | null; evidence: number;
  files?: { id: string; kind: string; mime: string; bytes: number; fileName: string | null; note: string | null; by: string | null; at: string }[];
  events?: { kind: string; from: string | null; to: string | null; note: string | null; by: string | null; at: string }[];
  review?: { rating: number; comment: string | null; at: string; orderId: string | null; item: string | null; customer: string | null; appReply: string | null; appReplyAt: string | null };
};

export const STATUS_LABEL: Record<Status, () => string> = { open: () => tr("Open"), progress: () => tr("In Progress"), done: () => tr("Done") };
export const STATUS_TONE: Record<Status, LozengeTone> = { open: "red", progress: "blue", done: "green" };
const ACTION: Record<string, () => string> = { REFUND: () => tr("Refund"), REPLACE: () => tr("Replacement product"), VOUCHER: () => tr("Voucher"), APOLOGY: () => tr("Apology only"), REPLY: () => tr("Reply to the review"), OTHER: () => tr("Other") };
const CAUSE: Record<string, () => string> = { OUTLET: () => tr("Outlet"), DRIVER: () => tr("Driver"), PLATFORM: () => tr("Platform / app"), CUSTOMER: () => tr("Customer"), UNKNOWN: () => tr("Not known") };
const VIA: Record<string, () => string> = { CHAT: () => tr("Chat in the app"), PHONE: () => tr("Phone"), WHATSAPP: () => "WhatsApp", REVIEW_REPLY: () => tr("Reply to the review") };
const BEARER: Record<string, () => string> = { OUTLET: () => tr("Outlet"), COMPANY: () => tr("Company"), PLATFORM: () => tr("Platform") };
export const EVIDENCE: Record<string, () => string> = { CHAT: () => tr("Chat screenshot"), REFUND: () => tr("Refund proof"), VOUCHER: () => tr("Voucher proof"), REPLY: () => tr("Review reply"), PHOTO: () => tr("Product photo"), OTHER: () => tr("Other") };
const opts = (m: Record<string, () => string>) => Object.entries(m).map(([value, l]) => ({ value, label: l() }));
const SOURCE: Record<string, () => string> = { review: () => tr("Customer review"), chat: () => tr("Chat"), app: () => tr("Delivery app"), other: () => tr("Other") };

/** what the ticket still needs to be done (the same rule as the backend's done_missing) */
export function missing(f: { resolution: string; action: string; rootCause: string; contacted: string; replyText: string }, files: number): string[] {
  const out: string[] = [];
  if (!f.resolution.trim()) out.push(tr("write the resolution"));
  if (!f.action) out.push(tr("choose the action"));
  if (!f.rootCause) out.push(tr("choose the root cause"));
  if (!f.contacted) out.push(tr("say whether the customer was contacted"));
  if (f.action === "REPLY" && !f.replyText.trim()) out.push(tr("write the reply to the review"));
  if (files < 1) out.push(tr("attach at least one evidence"));
  return out;
}

export default function TicketDrawer({ id, topics, onClose, onSaved }: { id: number; topics: string[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [t, setT] = useState<Ticket | null>(null);
  const [f, setF] = useState({ status: "progress" as Status, category: "", resolution: "", comp: "", action: "", rootCause: "", contacted: "", contactVia: "", replyText: "", compBearer: "", esbBill: "" });
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("CHAT");
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const fill = useCallback((x: Ticket) => {
    setT(x);
    setF({ status: x.status === "open" ? "progress" : x.status, category: x.category, resolution: x.resolution ?? "", comp: x.compensation != null ? String(x.compensation) : "",
      action: x.action ?? "", rootCause: x.rootCause ?? "", contacted: x.contacted == null ? "" : x.contacted ? "yes" : "no", contactVia: x.contactVia ?? "",
      replyText: x.replyText ?? "", compBearer: x.compBearer ?? "", esbBill: x.esbBill ?? "" });
  }, []);
  useEffect(() => { call<Ticket>(`/api/aggregator/complaints/${id}`).then(fill).catch((e: Error) => toast(e.message, "error")); }, [id, fill, toast]);
  const files = t?.files ?? [];
  const todo = missing(f, files.length);
  const save = async () => {
    setBusy(true);
    try {
      await call(`/api/aggregator/complaints/${id}`, { method: "PATCH", json: { status: f.status, category: f.category, resolution: f.resolution.trim() || null,
        compensation: f.comp ? Number(f.comp) : null, action: f.action || null, rootCause: f.rootCause || null, contacted: f.contacted ? f.contacted === "yes" : null,
        contactVia: f.contactVia || null, replyText: f.replyText.trim() || null, compBearer: f.compBearer || null, esbBill: f.esbBill.trim() || null } });
      toast(tr("Saved")); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const one of [...list]) {
        const q = new URLSearchParams({ kind, name: one.name, ...(note.trim() ? { note: note.trim() } : {}) });
        const res = await fetch(`/api/aggregator/complaints/${id}/evidence?${q}`, { method: "POST", body: one, credentials: "include", headers: { "Content-Type": one.type || "application/octet-stream" } });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { detail?: string }).detail ?? tr("Upload failed"));
        fill((await res.json()) as Ticket);
      }
      setNote(""); toast(tr("Evidence attached"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  };
  const remove = async (eid: string) => {
    setBusy(true);
    try { fill(await call<Ticket>(`/api/aggregator/complaints/${id}/evidence/${eid}`, { method: "DELETE" })); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  return (
    <Drawer open onClose={onClose} size="lg" icon={<MessageSquareText size={18} />} title={tr("Complaint #{0}", id)}
      description={t ? <span className="flex flex-wrap items-center gap-2"><Lozenge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]()}</Lozenge>{t.outlet} · <Platform p={t.platform} /></span> : "…"}
      footer={<div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[color:var(--j-626F86)]">{f.status === "done" && todo.length ? tr("{0} left before done", todo.length) : t?.handledBy ? tr("Last handled by {0}", t.handledBy) : ""}</span>
        <span className="flex gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button loading={busy} disabled={!t || (f.status === "done" && todo.length > 0)} onClick={() => void save()}><Save size={14} />{tr("Save")}</Button></span></div>}>
      {!t ? <p className="text-sm text-[color:var(--j-626F86)]">…</p> : <>
        <Group title={tr("The complaint")}>
          <p className="whitespace-pre-line rounded-[3px] bg-[color:var(--j-F7F8F9)] px-3 py-2.5 text-sm text-[color:var(--j-172B4D)]">{t.detail}</p>
          <Facts rows={[[tr("Outlet"), t.outlet], [tr("Platform"), <Platform key="p" p={t.platform} />], [tr("Date"), fmtDay(t.day)], [tr("Order no."), t.orderNo ?? "—"],
            [tr("Source"), SOURCE[t.source]?.() ?? t.source], ...(t.member ? [[tr("On duty"), t.member] as [string, string]] : [])]} />
        </Group>
        {t.review && <Group title={tr("The review")}>
          <p className="flex items-center gap-1 text-sm font-semibold text-[color:var(--j-172B4D)]">{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={14} className={n <= t.review!.rating ? "fill-[#E2B203] text-[#E2B203]" : "text-[color:var(--j-DCDFE4)]"} />)}<span className="ml-1">{t.review.rating}/5</span></p>
          <Facts rows={[[tr("Customer"), t.review.customer ?? "—"], [tr("Item"), t.review.item ?? "—"], [tr("Order"), t.review.orderId ?? "—"], [tr("Time"), fmtStamp(t.review.at)],
            [tr("Reply in the merchant app"), t.review.appReply ? <span key="r"><span className="block whitespace-pre-line">{t.review.appReply}</span><span className="text-xs text-[color:var(--j-626F86)]">{fmtStamp(t.review.appReplyAt)}</span></span> : <span key="n" className="text-[color:var(--j-AE2E24)]">{tr("not replied yet")}</span>]]} />
          {t.review.appReply && f.replyText.trim() && t.review.appReply.trim() !== f.replyText.trim() && <SectionMessage tone="warning">{tr("The reply written here is not the one in the merchant app: check that the reply was sent as written.")}</SectionMessage>}
        </Group>}
        <Group title={tr("Handling")} note={tr("These details make the reports of the team and of the outlets comparable")}>
          <Row label={tr("Status")}><div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={tr("Status")}>{(["open", "progress", "done"] as Status[]).map((x) => (
            <button key={x} type="button" role="radio" aria-checked={f.status === x} onClick={() => set("status")(x)}
              className={cx("h-11 rounded-[3px] border text-sm font-medium sm:h-8", f.status === x ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]" : "border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]")}>{STATUS_LABEL[x]()}</button>))}</div></Row>
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label={tr("Action taken")} required={f.status === "done"}><JSelect label={tr("Action taken")} placeholder={tr("Choose")} value={f.action} onChange={set("action")} options={opts(ACTION)} /></Row>
            <Row label={tr("Root cause")} required={f.status === "done"}><JSelect label={tr("Root cause")} placeholder={tr("Choose")} value={f.rootCause} onChange={set("rootCause")} options={opts(CAUSE)} /></Row>
            <Row label={tr("Customer contacted")} required={f.status === "done"}><JSelect label={tr("Customer contacted")} placeholder={tr("Choose")} value={f.contacted} onChange={set("contacted")} options={[{ value: "yes", label: tr("Yes") }, { value: "no", label: tr("No") }]} /></Row>
            <Row label={tr("Contacted via")}><JSelect label={tr("Contacted via")} placeholder={tr("Choose")} value={f.contactVia} onChange={set("contactVia")} options={opts(VIA)} /></Row>
            <Row label={tr("Category")}><JSelect label={tr("Category")} placeholder={tr("Category")} value={f.category} onChange={set("category")} options={[...new Set([...topics, f.category])].map((c) => ({ value: c, label: c }))} /></Row>
            <Row label={tr("ESB bill")} hint={tr("The bill of the order, to match the data")}><input value={f.esbBill} onChange={(e) => set("esbBill")(e.target.value)} maxLength={60} className={ctl} /></Row>
          </div>
          {(f.action === "REPLY" || t.review) && <Row label={tr("Reply to the review")} required={f.action === "REPLY" && f.status === "done"}><textarea value={f.replyText} onChange={(e) => set("replyText")(e.target.value)} rows={3} maxLength={2000} className={cx(ctl, "!h-auto py-2")} placeholder={tr("As sent in the merchant app")} /></Row>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Row label={tr("Compensation (Rp)")} hint={f.comp ? rp(Number(f.comp)) : tr("Leave empty when there is none")}><input inputMode="numeric" value={f.comp} onChange={(e) => set("comp")(e.target.value.replace(/\D/g, ""))} className={cx(ctl, "tabular-nums")} /></Row>
            <Row label={tr("Compensation borne by")}><JSelect label={tr("Compensation borne by")} placeholder={tr("Choose")} value={f.compBearer} onChange={set("compBearer")} options={opts(BEARER)} /></Row>
          </div>
          <Row label={tr("Resolution")} required={f.status === "done"} hint={tr("What was done and agreed with the customer")}><textarea value={f.resolution} onChange={(e) => set("resolution")(e.target.value)} rows={4} maxLength={2000} className={cx(ctl, "!h-auto py-2")} /></Row>
        </Group>
        <Group title={tr("Evidence ({0})", files.length)} note={tr("Screenshots of the chat, proof of the refund or voucher, the reply, photos: images or PDF, 10 MB each, up to 10")}>
          <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
            <Row label={tr("Kind")}><JSelect label={tr("Kind")} placeholder="" value={kind} onChange={setKind} options={opts(EVIDENCE)} /></Row>
            <Row label={tr("Note")}><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={ctl} placeholder={tr("optional")} /></Row>
            <Button variant="secondary" disabled={busy || files.length >= 10} onClick={() => file.current?.click()}><Upload size={14} />{tr("Attach the file")}</Button>
            <input ref={file} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
          </div>
          {files.length === 0 ? <p className="flex items-center gap-1.5 text-sm text-[color:var(--j-626F86)]"><Paperclip size={14} />{tr("No evidence yet")}</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">{files.map((x) => (
              <li key={x.id} className="flex gap-3 rounded-[3px] border border-[color:var(--j-DCDFE4)] p-2">
                <a href={`/api/aggregator/evidence/${x.id}`} target="_blank" rel="noreferrer" className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[color:var(--j-F7F8F9)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {x.mime.startsWith("image/") ? <img src={`/api/aggregator/evidence/${x.id}`} alt={EVIDENCE[x.kind]?.() ?? x.kind} loading="lazy" className="h-full w-full object-cover" /> : <FileText size={22} className="text-[color:var(--j-626F86)]" />}
                </a>
                <span className="min-w-0 flex-1 text-xs"><span className="block font-semibold text-[color:var(--j-172B4D)]">{EVIDENCE[x.kind]?.() ?? x.kind}</span>
                  {x.note && <span className="block text-[color:var(--j-44546F)]">{x.note}</span>}<span className="block text-[color:var(--j-626F86)]">{x.by} · {fmtStamp(x.at)}</span></span>
                <IconButton label={tr("Remove")} onClick={() => void remove(x.id)} disabled={busy}><Trash2 size={14} /></IconButton>
              </li>))}</ul>)}
        </Group>
        {f.status === "done" && todo.length > 0 && <SectionMessage tone="warning" title={tr("Before it is done")}><ul className="list-disc pl-5">{todo.map((x) => <li key={x}>{x}</li>)}</ul></SectionMessage>}
        <Group title={tr("History")} note={tr("All times in WIB")}>
          <ol className="space-y-3">
            {(t.events ?? []).map((e, i) => (
              <li key={i} className="flex gap-3"><span className={cx("mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full", e.to === "done" ? "bg-[#22A06B]" : "bg-[color:var(--j-0C66E4)]")} aria-hidden />
                <span className="min-w-0 flex-1 text-sm"><span className="block font-medium text-[color:var(--j-172B4D)]">{
                  e.kind === "CREATE" ? tr("Ticket made") : e.kind === "STATUS" ? tr("{0} → {1}", STATUS_LABEL[(e.from ?? "open") as Status](), STATUS_LABEL[(e.to ?? "open") as Status]()) :
                  e.kind === "EVIDENCE" ? tr("Evidence attached") : e.kind === "EVIDENCE_REMOVED" ? tr("Evidence removed") : tr("Handling updated")}</span>
                  <span className="block text-xs text-[color:var(--j-626F86)]">{e.by} · {fmtStamp(e.at)}{e.note ? ` · ${e.note}` : ""}</span></span></li>))}
            {!(t.events ?? []).length && <li className="text-sm text-[color:var(--j-626F86)]">{tr("Ticket made")} · {t.createdBy} · {fmtStamp(t.createdAt)}</li>}
          </ol>
          <Facts rows={[[tr("First response"), t.responseMin != null ? tr("after {0}", fmtSpan(t.responseMin)) : tr("not yet")], [tr("Resolved in"), t.resolveMin != null ? fmtSpan(t.resolveMin) : "—"]]} />
          {t.status === "done" && <p className="flex items-center gap-1.5 text-xs text-[color:var(--j-216E4E)]"><CheckCircle2 size={13} />{tr("Done {0}", fmtStamp(t.resolvedAt))}</p>}
        </Group>
      </>}
    </Drawer>
  );
}

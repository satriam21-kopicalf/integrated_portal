"use client";

// Form → Damaged Equipment (page form.damaged-equipment): the PIC asks for a repair (building & tools) or a procurement
// (decoration & tools) for one of their branches. The draft is saved as it is filled; the open requests of the branch
// are shown (and an item already asked is flagged) so nothing is asked twice; photos come from the camera (stamped),
// one video ≤ 10 MB; a preview with the PIC's signature sends it; the PDF and a share link follow, and "My requests"
// shows the progress and every note of the team. While the work runs the PIC can add photos; when the team asks for the
// handover (link ?request=<id>) the PIC confirms at the outlet: 1-5 photos, their signature and, for a vendor, the
// vendor's signature. Once Done the final document (work report / vendor's handover record) is downloadable.

import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, ClipboardList, CloudUpload, Copy, Download, FileCheck2, FileText,
  Hammer, Handshake, Loader2, MessageCircle, PackagePlus, Plus, Send, Trash2, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { FormCard, Segmented } from "@/so/ui/Simple";
import LiveClock from "@/so/ui/LiveClock";
import SignaturePad from "@/so/features/count/SignaturePad";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { useFocusMode } from "@/components/layout/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import { call } from "@/so/features/checkin/checkin";
import { locate } from "@/so/lib/counts";
import { TZ, wibDateTime } from "@/so/lib/wib";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import RequestView, { AddPhotoTile, EvidenceGrid, StatusBadge, UrgencyBadge } from "./RequestView";
import { type Category, type FormState, type Item, type Kind, type Request, CAUSES, KIND_LABEL, OPEN, PORTAL_URLS, STEPS, URGENCIES, URGENCY_LABEL,
  alreadyAsked, download, fmtHours, fmtMb } from "./de";

export default function DeForm() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState<Kind>("REPAIR");
  const [draft, setDraft] = useState<Request | null>(null);
  const [sent, setSent] = useState<Request | null>(null);
  const [opening, setOpening] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [show, setShow] = useState<"all" | "open" | "done" | "rejected">("all");
  const [now, setNow] = useState<Date | null>(null);
  // the header like the other forms: the date as subtitle, the live clock on the right
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await call<FormState>("/api/de/form");
      setData(d);
      setBranch((b) => b || (d.branches.length === 1 ? d.branches[0].code : ""));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // a link from the team (WhatsApp): /forms/damaged-equipment?request=<id> opens that request
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("request");
    if (id) setView(id); // read once from the address
  }, []);

  const open = async (id?: string) => {
    setOpening(true);
    try {
      setDraft(id ? await call<Request>(`/api/de/requests/${id}`) : await call<Request>("/api/de/requests", { method: "POST", json: { kind, branchCode: branch } }));
      setSent(null);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOpening(false);
    }
  };

  if (draft && data) {
    return <Editor data={data} initial={draft} onClose={() => { setDraft(null); void load(); }}
      onSent={(r) => { setDraft(null); setSent(r); void load(); window.scrollTo({ top: 0 }); }} />;
  }

  const drafts = (data?.requests ?? []).filter((r) => r.status === "DRAFT");
  const mine = (data?.requests ?? []).filter((r) => r.status !== "DRAFT");
  const live = mine.filter((r) => OPEN.includes(r.status));
  const done = mine.filter((r) => r.status === "DONE");
  const shown = mine.filter((r) => show === "all" || (show === "open" ? OPEN.includes(r.status) : show === "done" ? r.status === "DONE" : r.status === "REJECTED"));
  return (
    <Page title="Damaged Equipment" actions={<LiveClock />}
      subtitle={now ? now.toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""}>
      {error ? <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-48 rounded-xl" /><div className="skeleton h-64 rounded-xl" /></div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {sent && <SentCard r={sent} onClose={() => setSent(null)} onOpen={() => setView(sent.id)} />}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <UserAvatar name={data.user.name} src={me?.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{data.user.name}</p>
                <p className="truncate text-xs text-slate-500">{me?.username ? `@${me.username} · ` : ""}{tr("PIC of the request")}</p>
              </div>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">{tr("Type of request")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["REPAIR", "PROCUREMENT"] as Kind[]).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                      className={cx("flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        kind === k ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600" : "border-slate-200 hover:border-slate-300")}>
                      <span className={cx("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg", kind === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
                        {k === "REPAIR" ? <Hammer size={18} /> : <PackagePlus size={18} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{KIND_LABEL[k]()}</span>
                        <span className="block text-xs text-slate-500">{k === "REPAIR" ? tr("Damage to the building, furniture, tools or heavy tools") : tr("Decoration, tools or heavy tools to add to the outlet")}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">{tr("Branch")}</p>
                {data.branches.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">{tr("No branch is assigned to your account. Ask your administrator to assign your outlets.")}</p>
                ) : data.branches.length === 1 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900">{data.branches[0].name}</p>
                ) : (
                  <select value={branch} onChange={(e) => setBranch(e.target.value)} className={cx(inputClass, "h-11")} aria-label={tr("Branch")}>
                    <option value="">{tr("Choose the branch")}</option>
                    {data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                  </select>
                )}
              </div>
              <p className="text-xs text-slate-500">{tr("Date and time = server time when sent; PIC and branch come from your account.")}</p>
              <Button className="w-full sm:w-auto" disabled={!branch} loading={opening} onClick={() => void open()}><Plus size={15} /> {tr("Create request")}</Button>
            </div>
          </section>

          {drafts.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-white shadow-sm">
              <p className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-amber-900 sm:px-5">{tr("Drafts saved ({0})", drafts.length)}</p>
              <ul className="divide-y divide-slate-100">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => void open(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                      <ClipboardList size={18} className="flex-shrink-0 text-amber-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{d.kind === "REPAIR" ? "Maintenance" : tr("Procurement")} · {d.branchName}</span>
                        <span className="block text-xs text-slate-500">{tr("saved {0}", wibDateTime(d.updatedAt))}</span>
                      </span>
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <p className="text-sm font-semibold text-slate-900">{tr("My requests")}</p>
                <p className="text-xs text-slate-500">{tr("Tap a request to see every step and note of the team")}</p>
              </div>
              <Segmented label={tr("Show")} value={show} onChange={setShow} options={[
                { value: "all", label: `${tr("All")} ${mine.length}` }, { value: "open", label: `${tr("In progress")} ${live.length}` },
                { value: "done", label: `Done ${done.length}` }, { value: "rejected", label: `Reject ${mine.length - live.length - done.length}` }]} />
            </div>
            {shown.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{mine.length ? tr("No request in this view") : tr("No request sent yet")}</p> : (
              <ul className="divide-y divide-slate-100">
                {shown.map((r) => <MineRow key={r.id} r={r} onOpen={() => setView(r.id)} />)}
              </ul>
            )}
          </section>
        </div>
      )}
      {view && <MyRequest id={view} onClose={() => setView(null)} />}
    </Page>
  );
}

/** One of the PIC's requests: number, status and urgency, items, the steps reached and the latest note of the team. */
function MineRow({ r, onOpen }: { r: Request; onOpen: () => void }) {
  const at = r.status === "ON_HOLD" ? r.holdFrom : r.status;
  const idx = r.status === "DONE" ? STEPS.length - 1 : at ? STEPS.indexOf(at) : 0;
  return (
    <li>
      <button type="button" onClick={onOpen} className="w-full px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-slate-500">{r.number}</span>
          <StatusBadge r={r} /><UrgencyBadge u={r.urgency} />
          {r.status === "HANDOVER" && !r.handover?.at && <Badge tone="red" icon={<Handshake size={11} />}>{tr("Your handover needed")}</Badge>}
          {r.tracker?.targetAdjusted && OPEN.includes(r.status) && <Badge tone="violet">{tr("Estimate adjusted")}</Badge>}
          <span className="ml-auto text-[11px] tabular-nums text-slate-400">{wibDateTime(r.submittedAt)}</span>
        </span>
        <span className="mt-1 block truncate text-sm font-medium text-slate-900">{r.kind === "REPAIR" ? "Maintenance" : tr("Procurement")} · {r.branchName}</span>
        <span className="mt-2 flex items-center gap-1" aria-label={tr("Progress")}>
          {STEPS.map((st, i) => (
            <span key={st} title={st} className={cx("h-1.5 flex-1 rounded-full", r.status === "REJECTED" ? "bg-red-200" : i <= idx ? (r.status === "ON_HOLD" && i === idx ? "bg-amber-500" : r.status === "DONE" ? "bg-emerald-500" : "bg-blue-600") : "bg-slate-100")} />
          ))}
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="truncate">{r.lastNote?.note ? `“${r.lastNote.note}” — ${r.lastNote.actor}` : tr("No note from the team yet")}</span>
          <span className="flex-shrink-0 tabular-nums">{fmtHours(r.tracker?.workHours)}</span>
        </span>
      </button>
    </li>
  );
}

/** Sent: number, PDF, link to share with the teams. */
function SentCard({ r, onClose, onOpen }: { r: Request; onClose: () => void; onOpen: () => void }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{tr("Request {0} sent", r.number ?? "")}</p>
          <p className="text-xs">{r.kindLabel} · {r.branchName} · {wibDateTime(r.submittedAt)} · {tr("status Pending: the team checks it first")}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 opacity-70 hover:bg-white/60" aria-label={tr("Close")}><X size={16} /></button>
      </div>
      <div className="mt-3"><DocActions r={r} /></div>
      <button type="button" onClick={onOpen} className="mt-2 text-xs font-semibold text-emerald-800 underline-offset-2 hover:underline">{tr("See the progress")}</button>
    </div>
  );
}

/** PDF download, copy link, WhatsApp: the document goes to the teams as a file or a link. */
export function DocActions({ r, shareUrl }: { r: Request; shareUrl?: string | null }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const url = shareUrl ?? r.shareUrl ?? null;
  const pdf = async () => {
    setBusy(true);
    try {
      await download(PORTAL_URLS.pdf(r.id), `${r.number}.pdf`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast(tr("Link copied"));
    } catch {
      window.prompt(tr("Copy the link"), url);
    }
  };
  const text = `${tr("Damaged Equipment request")} ${r.number} · ${r.kindLabel} · ${r.branchName}\n${url ?? ""}`;
  const final = async () => {
    setBusy(true);
    try {
      await download(PORTAL_URLS.final!(r.id), `${r.number}-${r.mode === "VENDOR" ? "berita-acara-vendor" : "laporan-pekerjaan"}.pdf`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {r.status === "DONE" && (
        <Button size="sm" loading={busy} onClick={() => void final()}><FileCheck2 size={14} /> {r.mode === "VENDOR" ? tr("Vendor handover record") : tr("Final work report")}</Button>
      )}
      <Button size="sm" variant="secondary" loading={busy} onClick={() => void pdf()}><Download size={14} /> PDF</Button>
      {url && <Button size="sm" variant="secondary" onClick={() => void copy()}><Copy size={14} /> {tr("Copy link")}</Button>}
      {url && <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
        <MessageCircle size={14} className="text-emerald-600" /> WhatsApp</a>}
    </div>
  );
}

function MyRequest({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"MONITOR" | "HANDOVER" | null>(null);
  useEffect(() => { call<Request>(`/api/de/requests/${id}`).then(setR).catch((e) => setError((e as Error).message)); }, [id]);
  const addPhoto = async (shot: Shot) => {
    try {
      setR(await call<Request>(`/api/de/requests/${id}/${camera === "HANDOVER" ? "handover" : "monitor"}-photos`,
        { method: "POST", json: { photo: shot.image, latitude: shot.lat, longitude: shot.lng, takenAt: shot.taken_at } }));
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };
  const removePhoto = async (mid: string) => {
    try {
      setR(await call<Request>(`/api/de/requests/${id}/pic-media/${mid}`, { method: "DELETE" }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const handoverDue = r?.status === "HANDOVER" && !r.handover?.at;
  const working = r && ["IN_PROGRESS", "HANDOVER"].includes(r.status) && !r.handover?.at;
  return (
    <Drawer open onClose={onClose} size="lg" icon={<FileText size={18} />} title={r ? `${r.number} · ${r.branchName}` : tr("Request")}
      description={r ? r.kindLabel : undefined} focusFirstField={false} footer={r ? <DocActions r={r} /> : undefined}>
      {error ? <ErrorState message={error} /> : !r ? <div className="skeleton h-64 rounded-xl" /> : (
        <RequestView r={r} urls={PORTAL_URLS}>
          {handoverDue && <HandoverCard r={r} onCamera={() => setCamera("HANDOVER")} onRemove={(mid) => void removePhoto(mid)} onSent={(out) => { setR(out); toast(tr("Handover sent to the maintenance team")); }} />}
          {working && (
            <FormCard title={tr("Photos while the work runs")} hint={tr("Optional: let the team follow the technician's work at your outlet")}
              aside={<Badge>{(r.media ?? []).filter((m) => m.kind === "MONITOR").length}/10</Badge>}>
              <PicPhotos r={r} kind="MONITOR" onRemove={(mid) => void removePhoto(mid)}
                add={(r.media ?? []).filter((m) => m.kind === "MONITOR").length < 10 ? <AddPhotoTile onClick={() => setCamera("MONITOR")} label={tr("Take photo")} /> : undefined} />
            </FormCard>
          )}
        </RequestView>
      )}
      <CameraCapture open={camera !== null} title={camera === "HANDOVER" ? tr("Handover") : tr("Work in progress")} branch={r?.branchName ?? ""}
        countNumber={r?.number ?? ""} onClose={() => setCamera(null)} onShot={addPhoto} />
    </Drawer>
  );
}

function PicPhotos({ r, kind, onRemove, add }: { r: Request; kind: "MONITOR" | "HANDOVER"; onRemove: (id: string) => void; add?: React.ReactNode }) {
  return <EvidenceGrid list={(r.media ?? []).filter((m) => m.kind === kind)} urls={PORTAL_URLS} onRemove={onRemove} add={add} empty={tr("No photo yet")} />;
}

/** The handover at the outlet: photos of the result (1-5), the vendor's signature (vendor work) and the PIC's. */
function HandoverCard({ r, onCamera, onRemove, onSent }: { r: Request; onCamera: () => void; onRemove: (id: string) => void; onSent: (r: Request) => void }) {
  const toast = useToast();
  const vendor = r.mode === "VENDOR";
  const photos = (r.media ?? []).filter((m) => m.kind === "HANDOVER").length;
  const vendorName0 = (r.assignments ?? []).find((a) => a.status === "ACTIVE" && a.kind === "VENDOR")?.company ?? "";
  const [vendorSign, setVendorSign] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [picSign, setPicSign] = useState<string | null>(null);
  const [picName, setPicName] = useState(r.picName);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = photos > 0 && !!picSign && !!picName.trim() && (!vendor || (!!vendorSign && !!vendorName.trim()));
  const send = async () => {
    setBusy(true);
    try {
      const pos = await locate(undefined, 50, 12_000);
      onSent(await call<Request>(`/api/de/requests/${r.id}/handover`, { method: "POST", json: {
        latitude: pos.fix?.lat ?? null, longitude: pos.fix?.lng ?? null, accuracyM: pos.fix?.accuracy ?? null,
        picSignature: picSign, picName, vendorSignature: vendor ? vendorSign : null, vendorName: vendor ? vendorName : null, note: note.trim() || null } }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  let n = 0;
  return (
    <section className="space-y-3 rounded-2xl border-2 border-cyan-200 bg-cyan-50/40 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-600 text-white"><Handshake size={18} /></span>
        <div>
          <p className="font-semibold text-slate-900">{tr("Handover at the outlet")}</p>
          <p className="text-xs text-slate-600">{vendor ? tr("The maintenance team asks you to check the vendor's work: photos of the result, the vendor's signature and yours.")
            : tr("The maintenance team asks you to check the work: photos of the result and your signature.")}</p>
        </div>
      </div>
      <FormCard n={++n} title={tr("Photos of the result")} hint={tr("1–5 photos with the camera at the outlet")} aside={<Badge tone={photos ? "green" : "red"}>{photos ? `${photos}/5` : tr("Required")}</Badge>}>
        <PicPhotos r={r} kind="HANDOVER" onRemove={onRemove} add={photos < 5 ? <AddPhotoTile onClick={onCamera} label={tr("Take photo")} tone={photos ? "slate" : "blue"} /> : undefined} />
      </FormCard>
      {vendor && (
        <FormCard n={++n} title={tr("Vendor's signature")} hint={tr("The vendor's officer signs on this phone")} aside={<Badge tone="red">{tr("Required")}</Badge>}>
          <SignaturePad onChange={setVendorSign} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{tr("Vendor officer's name")}{vendorName0 ? ` · ${vendorName0}` : ""}</span>
            <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} maxLength={120} className={inputClass} placeholder={tr("Full name")} />
          </label>
        </FormCard>
      )}
      <FormCard n={++n} title={tr("Your signature (PIC)")} hint={tr("By signing I confirm the work has been done and received at the outlet.")} aside={<Badge tone="red">{tr("Required")}</Badge>}>
        <SignaturePad onChange={setPicSign} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">{tr("Signer's name")}</span>
          <input value={picName} onChange={(e) => setPicName(e.target.value)} maxLength={120} className={inputClass} />
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder={tr("Note (optional), e.g. anything still to follow up")}
          className={cx(inputClass, "h-auto py-2 text-sm")} aria-label={tr("Note")} />
      </FormCard>
      <Button className="w-full" loading={busy} disabled={!ready} onClick={() => void send()}><Send size={15} /> {tr("Send the handover")}</Button>
      {!ready && <p className="text-center text-[11px] text-slate-500">{vendor ? tr("Photos, the vendor's signature and name, and your signature are needed.") : tr("Photos and your signature are needed.")}</p>}
    </section>
  );
}

// ------------------------------------------------------------------------------------------------- the draft

type ItemDraft = Item & { key: string };
const blank = (c: Category | undefined): ItemDraft => ({ key: `${Date.now()}-${Math.random()}`, categoryId: c?.id ?? 0, name: "", qty: 1, location: "",
  urgency: c?.defaultUrgency ?? "NORMAL", note: "" });

function Editor({ data, initial, onClose, onSent }: { data: FormState; initial: Request; onClose: () => void; onSent: (r: Request) => void }) {
  const toast = useToast();
  useFocusMode();
  const [r, setR] = useState(initial);
  const [items, setItems] = useState<ItemDraft[]>((initial.items ?? []).map((i) => ({ ...i, location: i.location ?? "", note: i.note ?? "", key: String(i.id) })));
  const [analysis, setAnalysis] = useState(initial.analysis ?? "");
  const [cause, setCause] = useState(initial.cause ?? "");
  const [saving, setSaving] = useState(0);
  const [camera, setCamera] = useState(false);
  const [upload, setUpload] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  const base = `/api/de/requests/${r.id}`;
  // the categories offered to the branch's group (a category without groups goes to every branch)
  const cats = useMemo(() => data.categories.filter((c) => !c.branchGroups?.length || c.branchGroups.includes(data.branchGroups?.[r.branchCode] ?? "")),
    [data.categories, data.branchGroups, r.branchCode]);
  const groups = useMemo(() => [...new Set(cats.map((c) => c.group))], [cats]);
  const photos = (r.media ?? []).filter((m) => m.kind === "PHOTO");
  const video = (r.media ?? []).find((m) => m.kind === "VIDEO");

  const flush = useCallback(async () => {
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setSaving((n) => n + 1);
    try {
      const out = await call<Request>(base, { method: "PATCH", json: body });
      setR((cur) => ({ ...out, media: cur.media }));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving((n) => n - 1);
    }
  }, [base, toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void flush(); }, [flush]);
  const save = (patch: Record<string, unknown>, now = false) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), now ? 50 : 800);
  };
  const itemsPayload = (list: ItemDraft[]) => list.filter((i) => i.categoryId && i.name.trim())
    .map(({ categoryId, name, qty, location, urgency, note }) => ({ categoryId, name, qty, location, urgency, note }));
  const setItemsAndSave = (list: ItemDraft[], now = false) => { setItems(list); save({ items: itemsPayload(list) }, now); };

  const addPhoto = async (shot: Shot) => {
    try {
      const out = await call<{ media: Request["media"] }>(`${base}/photos`, { method: "POST", json: { photo: shot.image, latitude: shot.lat, longitude: shot.lng, takenAt: shot.taken_at } });
      setR((cur) => ({ ...cur, media: out.media }));
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };
  const removeMedia = async (id: string) => {
    try {
      const out = await call<{ media: Request["media"] }>(`${base}/media/${id}`, { method: "DELETE" });
      setR((cur) => ({ ...cur, media: out.media }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const addVideo = (file: File | undefined) => {
    if (!file) return;
    if (file.size > data.limits.videoBytes) { toast(tr("The video is {0}; at most {1}. Record a shorter video.", fmtMb(file.size), fmtMb(data.limits.videoBytes)), "error"); return; }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/video?name=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && setUpload(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setUpload(null);
      const body = (() => { try { return JSON.parse(xhr.responseText); } catch { return {}; } })();
      if (xhr.status >= 200 && xhr.status < 300) setR((cur) => ({ ...cur, media: body.media }));
      else toast(body.error ?? body.detail ?? tr("The video could not be uploaded"), "error");
    };
    xhr.onerror = () => { setUpload(null); toast(tr("The video could not be uploaded"), "error"); };
    setUpload(0);
    xhr.send(file);
  };
  const discard = async () => {
    try {
      await call(base, { method: "DELETE" });
      toast(tr("Draft deleted"));
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const filled = itemsPayload(items);
  const todo = [
    ...(filled.length ? [] : [tr("Add at least one item")]),
    ...(analysis.trim() ? [] : [r.kind === "REPAIR" ? tr("Fill in the damage analysis") : tr("Fill in the reason for the procurement")]),
    ...(photos.length ? [] : [tr("Attach at least one photo")]),
  ];

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-start gap-2">
          <button type="button" onClick={() => { void flush(); onClose(); }} className="-ml-1.5 mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{KIND_LABEL[r.kind]()}</h1>
            <p className="truncate text-xs text-slate-500">{r.picName} · {r.branchName}</p>
          </div>
          <span className="flex-shrink-0 pt-1 text-xs text-slate-400" aria-live="polite">
            {saving > 0 ? <span className="inline-flex items-center gap-1"><CloudUpload size={13} /> {tr("Saving…")}</span> : <span className="inline-flex items-center gap-1"><Check size={13} /> {tr("Saved")}</span>}
          </span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-3 py-4 sm:px-6">
        <FormCard n={1} title={tr("Request data")} hint={tr("Filled automatically from your account")}>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-[11px] text-slate-400">{tr("Date & time")}</dt><dd className="font-medium text-slate-900"><LiveClock /></dd></div>
            <div><dt className="text-[11px] text-slate-400">PIC</dt><dd className="font-medium text-slate-900">{r.picName}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Branch")}</dt>
              <dd>{data.branches.length > 1 ? (
                <select value={r.branchCode} onChange={(e) => { setR({ ...r, branchCode: e.target.value }); save({ branchCode: e.target.value }, true); }}
                  className={cx(inputClass, "h-9 text-sm")} aria-label={tr("Branch")}>
                  {data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              ) : <span className="font-medium text-slate-900">{r.branchName}</span>}</dd></div>
          </dl>
        </FormCard>

        {(r.openInBranch ?? []).length > 0 && (
          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900"><AlertTriangle size={16} /> {tr("Still in progress at {0} ({1})", r.branchName, r.openInBranch!.length)}</p>
            <p className="mt-0.5 text-xs text-amber-800">{tr("Check these first so nothing is asked twice; follow them under My requests.")}</p>
            <ul className="mt-2 space-y-1.5">
              {r.openInBranch!.map((o) => (
                <li key={o.id} className="rounded-lg bg-white px-3 py-2 text-xs ring-1 ring-amber-100">
                  <span className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold text-slate-600">{o.number}</span> <StatusBadge r={o} />
                    <span className="text-slate-500">{o.picName} · {wibDateTime(o.submittedAt)}</span></span>
                  <span className="mt-1 block text-slate-700">{(o.items ?? []).map((i) => `${i.name} (${i.category})`).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <FormCard n={2} title={r.kind === "REPAIR" ? tr("What is damaged") : tr("What to add")}
          hint={r.kind === "REPAIR" ? tr("Building & furniture, heavy tools … one line per item") : tr("Decoration, tools & heavy tools … one line per item")}
          aside={<Badge tone={filled.length ? "blue" : "slate"}>{filled.length}</Badge>}>
          {items.length === 0 && <p className="text-sm text-slate-500">{tr("No item yet.")}</p>}
          {items.map((it, idx) => {
            const cat = cats.find((c) => c.id === it.categoryId);
            const dup = alreadyAsked(it, r.openInBranch);
            const upd = (patch: Partial<ItemDraft>, now = false) => setItemsAndSave(items.map((x) => (x.key === it.key ? { ...x, ...patch } : x)), now);
            return (
              <div key={it.key} className={cx("space-y-2 rounded-lg border p-3", dup ? "border-amber-300 bg-amber-50/40" : "border-slate-200")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">{tr("Item {0}", idx + 1)}</span>
                  <button type="button" onClick={() => setItemsAndSave(items.filter((x) => x.key !== it.key), true)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove item")}><Trash2 size={15} /></button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={it.categoryId || ""} aria-label={tr("Category")} className={cx(inputClass, "h-10 text-sm")}
                    onChange={(e) => { const c = cats.find((x) => x.id === Number(e.target.value)); upd({ categoryId: Number(e.target.value), urgency: c?.defaultUrgency ?? it.urgency }, true); }}>
                    <option value="">{tr("Choose the category")}</option>
                    {groups.map((g) => <optgroup key={g} label={g}>{cats.filter((c) => c.group === g).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
                  </select>
                  <input value={it.name} onChange={(e) => upd({ name: e.target.value })} list={`ex-${it.key}`} maxLength={120} placeholder={tr("Item name, e.g. {0}", cat?.examples[0] ?? "Grinder")}
                    className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Item name")} />
                  <datalist id={`ex-${it.key}`}>{(cat?.examples ?? []).map((x) => <option key={x} value={x} />)}</datalist>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[5rem_1fr_10rem]">
                  <input type="number" min={1} max={9999} value={it.qty} onChange={(e) => upd({ qty: Math.max(1, Number(e.target.value) || 1) })}
                    className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Quantity")} />
                  <input value={it.location ?? ""} onChange={(e) => upd({ location: e.target.value })} maxLength={120} placeholder={tr("Location in the outlet, e.g. bar")}
                    className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Location")} />
                  <select value={it.urgency} onChange={(e) => upd({ urgency: e.target.value as Item["urgency"] }, true)} className={cx(inputClass, "col-span-2 h-10 text-sm sm:col-span-1")} aria-label={tr("Urgency")}>
                    {URGENCIES.map((u) => <option key={u} value={u}>{URGENCY_LABEL[u]()}</option>)}
                  </select>
                </div>
                <input value={it.note ?? ""} onChange={(e) => upd({ note: e.target.value })} maxLength={1000} placeholder={tr("Detail (optional), e.g. brand, size, what happens")}
                  className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Detail")} />
                {dup && <p className="flex items-center gap-1 text-xs font-medium text-amber-800"><AlertTriangle size={13} /> {tr("Already asked in {0}, still in progress", dup)}</p>}
              </div>
            );
          })}
          <Button variant="secondary" disabled={items.length >= data.limits.items} onClick={() => setItems([...items, blank(undefined)])}><Plus size={15} /> {tr("Add item")}</Button>
        </FormCard>

        <FormCard n={3} title={r.kind === "REPAIR" ? tr("Damage analysis") : tr("Reason for the procurement")}
          hint={r.kind === "REPAIR" ? tr("What happened, since when, what was tried") : tr("Why it is needed and where it goes")}>
          <textarea value={analysis} onChange={(e) => { setAnalysis(e.target.value); save({ analysis: e.target.value }); }} rows={4} maxLength={4000}
            className={cx(inputClass, "h-auto py-2 text-sm")} aria-label={tr("Analysis")} />
          {r.kind === "REPAIR" && (
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Cause")}>
              {CAUSES.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={cause === c.value} onClick={() => { const v = cause === c.value ? "" : c.value; setCause(v); save({ cause: v || null }, true); }}
                  className={cx("rounded-full border px-3 py-1 text-xs font-medium", cause === c.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{c.label()}</button>
              ))}
            </div>
          )}
        </FormCard>

        <FormCard n={4} title={r.kind === "REPAIR" ? tr("Evidence") : tr("Evidence of the space in the outlet")}
          hint={tr("Photos with the camera (at most {0}) and one video of at most {1}", data.limits.photos, fmtMb(data.limits.videoBytes))}
          aside={<Badge tone={photos.length ? "blue" : "slate"}>{photos.length}/{data.limits.photos}</Badge>}>
          <EvidenceGrid list={photos} urls={PORTAL_URLS} onRemove={(id) => void removeMedia(id)}
            add={photos.length < data.limits.photos ? <AddPhotoTile onClick={() => setCamera(true)} label={photos.length ? tr("Add photo") : tr("Take photo")} tone={photos.length ? "slate" : "blue"} /> : undefined} />
          <div className="rounded-lg border border-slate-200 p-3">
            {video ? (
              <div className="space-y-2">
                <p className="flex items-center justify-between gap-2 text-xs text-slate-600"><span className="inline-flex min-w-0 items-center gap-1 truncate"><Video size={14} /> {video.fileName ?? tr("Video")} · {fmtMb(video.bytes)}</span>
                  <button type="button" onClick={() => void removeMedia(video.id)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove video")}><Trash2 size={14} /></button></p>
                <video src={PORTAL_URLS.media(video.id)} controls preload="metadata" className="max-h-64 w-full rounded-lg bg-black" />
              </div>
            ) : upload !== null ? (
              <div className="space-y-1.5"><p className="flex items-center gap-1.5 text-xs text-slate-600"><Loader2 size={13} className="animate-spin" /> {tr("Uploading the video… {0}%", upload)}</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${upload}%` }} /></div></div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                <Video size={16} className="text-slate-500" /> {tr("Record or choose a video (optional)")}
                <input type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => { addVideo(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </FormCard>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="text-red-600" onClick={() => setDiscarding(true)}><Trash2 size={15} /> {tr("Delete draft")}</Button>
          <span className="text-xs text-slate-500">{tr("Saved automatically; you can continue later.")}</span>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-slate-600">{todo.length ? <span className="text-amber-700">{todo.join(" · ")}</span> : tr("Everything is ready.")}</p>
          <Button disabled={todo.length > 0 || saving > 0} onClick={() => { void flush(); setPreview(true); }}><Send size={15} /> {tr("Preview & send")}</Button>
        </div>
      </div>

      <CameraCapture open={camera} title={tr("Damaged Equipment evidence")} branch={r.branchName} countNumber={r.kind === "REPAIR" ? "Maintenance" : tr("Procurement")}
        onClose={() => setCamera(false)} onShot={addPhoto} />
      {preview && <SendSheet r={{ ...r, items: items.filter((i) => i.categoryId && i.name.trim()).map((i) => ({ ...i, category: cats.find((c) => c.id === i.categoryId)?.name, group: cats.find((c) => c.id === i.categoryId)?.group })), analysis, cause }}
        onClose={() => setPreview(false)} onSent={onSent} />}
      <ConfirmDialog open={discarding} danger onClose={() => setDiscarding(false)} onConfirm={() => void discard()} title={tr("Delete this draft?")}
        confirmLabel={tr("Delete")} description={tr("The items, photos and video of this draft are removed.")} />
    </div>
  );
}

/** Preview of everything entered, the PIC's signature (required) and sending. */
function SendSheet({ r, onClose, onSent }: { r: Request; onClose: () => void; onSent: (r: Request) => void }) {
  const toast = useToast();
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState(r.picName);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const pos = await locate(undefined, 50, 12_000);
      const out = await call<Request>(`/api/de/requests/${r.id}/submit`, { method: "POST",
        json: { latitude: pos.fix?.lat ?? null, longitude: pos.fix?.lng ?? null, accuracyM: pos.fix?.accuracy ?? null, signature, signedName: name } });
      toast(tr("Request {0} sent", out.number ?? ""));
      onSent(out);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<FileText size={18} />} title={tr("Check before sending")} description={`${r.kindLabel} · ${r.branchName}`}
      focusFirstField={false} footer={<>
        <Button variant="secondary" onClick={onClose}>{tr("Back to the request")}</Button>
        <Button loading={busy} disabled={!signature || !name.trim()} onClick={() => void send()}><Send size={15} /> {tr("Send")}</Button>
      </>}>
      <div className="space-y-4">
        <FormCard n={1} title={tr("Request data")} hint={tr("Filled automatically from your account")}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[11px] text-slate-400">PIC</dt><dd className="font-medium text-slate-900">{r.picName}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Branch")}</dt><dd className="font-medium text-slate-900">{r.branchName}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Type of request")}</dt><dd className="text-slate-900">{r.kindLabel}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Date & time")}</dt><dd className="text-slate-900"><LiveClock /></dd></div>
          </dl>
        </FormCard>
        <FormCard n={2} title={tr("Items ({0})", r.items?.length ?? 0)} hint={r.kind === "REPAIR" ? tr("What is damaged") : tr("What to add")}>
          <ul className="divide-y divide-slate-100 text-sm">
            {(r.items ?? []).map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                <span className="min-w-0"><span className="block text-slate-900">{it.name} × {it.qty}</span>
                  <span className="block text-xs text-slate-500">{it.category}{it.location ? ` · ${it.location}` : ""}{it.note ? ` · ${it.note}` : ""}</span></span>
                <UrgencyBadge u={it.urgency} />
              </li>
            ))}
          </ul>
        </FormCard>
        <FormCard n={3} title={r.kind === "REPAIR" ? tr("Damage analysis") : tr("Reason for the procurement")}
          hint={`${tr("{0} photos", (r.media ?? []).filter((m) => m.kind === "PHOTO").length)}${(r.media ?? []).some((m) => m.kind === "VIDEO") ? ` · ${tr("1 video")}` : ""}`}>
          <p className="whitespace-pre-line text-sm text-slate-700">{r.analysis}</p>
          <ul className="grid grid-cols-5 gap-1.5">
            {(r.media ?? []).filter((m) => m.kind === "PHOTO").map((m) => (
              // eslint-disable-next-line @next/next/no-img-element -- private photo through the API
              <li key={m.id}><img src={PORTAL_URLS.media(m.id)} alt={tr("Photo")} className="aspect-square w-full rounded-md object-cover ring-1 ring-slate-200" /></li>
            ))}
          </ul>
        </FormCard>
        <FormCard n={4} title={tr("PIC signature")} hint={tr("By signing I confirm this request is true and needed for the outlet.")} aside={<Badge tone="red">{tr("Required")}</Badge>}>
          <SignaturePad onChange={setSignature} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{tr("Signer's name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} />
          </label>
        </FormCard>
        <p className="text-xs text-slate-500">{tr("After sending: the status is Pending, the team checks it; you get a PDF and a link to share, and follow every step under My requests.")}</p>
      </div>
    </Drawer>
  );
}

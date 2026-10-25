"use client";

// Evidence of a count (2026-10-15): up to 15 photos of the count as a whole, taken with the camera at the end of the
// count (optional), up to 15 documents (PDF, Excel …; 2026-10-21, optional), and once the count is approved the
// evidence as files (ZIP) or one PDF.

import { Camera, Download, FileText, Images, Loader2, Paperclip, PenLine, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button, cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountFile } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { FILE_ACCEPT, FILE_EXTENSIONS, MAX_FILES, MAX_FILE_BYTES, fileExt, fileUrl, fmtBytes, photoUrl } from "@/so/lib/photos";
import { wibDateTime } from "@/so/lib/wib";
import CameraCapture, { type Shot } from "./CameraCapture";

export const MAX_PHOTOS = 15;

async function download(url: string, name: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
  }
  const href = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href, download: name }).click();
  URL.revokeObjectURL(href);
}

/** The crew's signature of a submitted count (06.9 §12.16, D-62), when they signed. */
export function SignatureCard({ count }: { count: Count }) {
  const sig = count.signature;
  if (!sig) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <PenLine size={18} className="text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">{tr("Signature")}</h2>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        {/* eslint-disable-next-line @next/next/no-img-element -- private signature image through the API */}
        <img src={photoUrl(sig.id)} alt={tr("Signature")} className="h-28 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
        <div className="text-sm">
          <p className="font-semibold text-slate-900">{sig.name ?? sig.signed_by_name ?? "—"}</p>
          <p className="text-xs text-slate-500">{wibDateTime(sig.signed_at)}{sig.signed_by_name && sig.signed_by_name !== sig.name ? ` · ${tr("account {0}", sig.signed_by_name)}` : ""}</p>
        </div>
      </div>
    </section>
  );
}

/** ZIP / PDF buttons for an approved count. */
export function EvidenceDownloads({ count }: { count: Count }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"zip" | "pdf" | null>(null);
  if (count.status !== "APPROVED" && count.status !== "EXPORTED") return null;
  const get = async (kind: "zip" | "pdf") => {
    setBusy(kind);
    try {
      await download(`/api/so/count-photos/evidence/${count.id}/${kind}`, `${count.number}-evidence.${kind}`);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" loading={busy === "pdf"} disabled={!!busy} onClick={() => get("pdf")}><FileText size={14} /> {tr("Evidence PDF")}</Button>
      <Button variant="secondary" size="sm" loading={busy === "zip"} disabled={!!busy || (count.photos.length === 0 && !count.files?.length)} onClick={() => get("zip")}>
        <Download size={14} /> {count.files?.length ? tr("Photos & files (ZIP)") : tr("Photos (ZIP)")}
      </Button>
    </div>
  );
}

const FILE_TONE: Record<string, string> = {
  pdf: "bg-red-50 text-red-700", xlsx: "bg-emerald-50 text-emerald-700", xls: "bg-emerald-50 text-emerald-700", csv: "bg-emerald-50 text-emerald-700",
  docx: "bg-blue-50 text-blue-700", doc: "bg-blue-50 text-blue-700", pptx: "bg-orange-50 text-orange-700", ppt: "bg-orange-50 text-orange-700",
};

/** The attached documents: name, size, who and when; a tap downloads the file. Removable by its uploader while open. */
export function CountFileList({ files, onRemove, canRemove }: {
  files: CountFile[]; onRemove?: (id: string) => void; canRemove?: (f: CountFile) => boolean;
}) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
      {files.map((f) => {
        const ext = fileExt(f.file_name);
        return (
          <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className={cx("flex h-9 w-11 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase", FILE_TONE[ext] ?? "bg-slate-100 text-slate-600")}>
              {ext || <FileText size={15} />}
            </span>
            <a href={fileUrl(f.id)} download={f.file_name} className="min-w-0 flex-1 hover:text-blue-700" title={`SHA-256 ${f.sha256}`}>
              <span className="block truncate text-sm font-medium text-slate-900">{f.file_name}</span>
              <span className="block truncate text-[11px] text-slate-500">{fmtBytes(f.bytes)} · {f.uploaded_by_name ?? "—"} · {wibDateTime(f.uploaded_at)}</span>
            </a>
            <a href={fileUrl(f.id)} download={f.file_name} aria-label={tr("Download {0}", f.file_name)} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download size={15} /></a>
            {onRemove && canRemove?.(f) && (
              <button type="button" onClick={() => onRemove(f.id)} aria-label={tr("Remove {0}", f.file_name)} className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={15} /></button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Evidence documents of a count (2026-10-21): optional, up to 15 PDF / Excel / Word … files of 10 MB at most. */
export function EvidenceFiles({ count, open, onChange }: { count: Count; open: boolean; onChange: (c: Count) => void }) {
  const toast = useToast();
  const { me } = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const files = count.files ?? [];
  const full = files.length >= MAX_FILES;

  const pick = async (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (input.current) input.current.value = "";
    const room = MAX_FILES - files.length;
    if (chosen.length > room) toast(tr("Only {0} more files can be attached; the rest was skipped.", room), "error");
    let latest: Count | null = null;
    for (const file of chosen.slice(0, Math.max(0, room))) {
      if (!FILE_EXTENSIONS.includes(fileExt(file.name))) { toast(tr("{0}: this file type is not accepted", file.name), "error"); continue; }
      if (file.size > MAX_FILE_BYTES) { toast(tr("{0}: larger than {1}", file.name, fmtBytes(MAX_FILE_BYTES)), "error"); continue; }
      if (file.size === 0) { toast(tr("{0}: the file is empty", file.name), "error"); continue; }
      setBusy(file.name);
      try {
        latest = await api<Count>(`/api/so/counts/${count.id}/files?name=${encodeURIComponent(file.name)}`, {
          method: "POST", body: file, headers: { "content-type": "application/octet-stream" } });
        onChange(latest);
      } catch (err) {
        toast(`${file.name}: ${errorText(err)}`, "error");
      }
    }
    setBusy(null);
    if (latest) toast(tr("Files attached"));
  };
  const remove = async (id: string) => {
    try {
      onChange(await api<Count>(`/api/so/counts/${count.id}/files/${id}`, { method: "DELETE" }));
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <Paperclip size={18} className="text-slate-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{tr("Evidence files")} <span className="font-normal text-slate-500">({files.length}/{MAX_FILES})</span></h2>
          <p className="text-xs text-slate-500">{open ? tr("Optional: PDF, Excel, Word, PowerPoint, CSV or images, up to 10 MB each.") : tr("Files attached to the count.")}</p>
        </div>
        {open && (
          <>
            <input ref={input} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => void pick(e.target.files)} />
            <Button variant="secondary" size="sm" disabled={full || !!busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {tr("Attach files")}
            </Button>
          </>
        )}
      </div>
      <div className="space-y-2 p-4">
        {busy && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> {tr("Uploading {0}…", busy)}</p>}
        {files.length === 0 ? (
          open ? (
            <button type="button" onClick={() => input.current?.click()} disabled={!!busy}
              className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-700">
              <Paperclip size={18} /> {tr("Attach files (optional)")}
              <span className="text-[11px] text-slate-400">{tr("The count can be submitted without files")}</span>
            </button>
          ) : <p className="text-sm text-slate-500">{tr("No files were attached.")}</p>
        ) : <CountFileList files={files} onRemove={open ? (id) => void remove(id) : undefined} canRemove={(f) => f.uploaded_by === me?.id} />}
        {open && full && <p className="text-xs text-amber-700">{tr("The maximum of 15 files is reached; remove one to attach another.")}</p>}
      </div>
    </section>
  );
}

export default function Evidence({ count, open, onChange }: { count: Count; open: boolean; onChange: (c: Count) => void }) {
  const toast = useToast();
  const { me } = useMe();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const photos = count.photos;
  const full = photos.length >= MAX_PHOTOS;

  const upload = async (shot: Shot) => {
    setBusy(true);
    try {
      onChange(await api<Count>(`/api/so/counts/${count.id}/photos`, {
        method: "POST",
        json: { image: shot.image, subject: "GENERAL", lat: shot.lat, lng: shot.lng, taken_at: shot.taken_at },
      }));
    } catch (err) {
      toast(errorText(err), "error");
      throw err;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    try {
      onChange(await api<Count>(`/api/so/counts/${count.id}/photos/${id}`, { method: "DELETE" }));
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <Images size={18} className="text-slate-500" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900">{tr("Evidence photos")} <span className="font-normal text-slate-500">({photos.length}/{MAX_PHOTOS})</span></h2>
          <p className="text-xs text-slate-500">{open ? tr("Optional: up to 15 photos of the count, taken with the camera.") : tr("Photos taken during the count.")}</p>
        </div>
        <EvidenceDownloads count={count} />
      </div>
      <div className="p-4">
        {photos.length === 0 && !open ? <p className="text-sm text-slate-500">{tr("No evidence photos were taken.")}</p> : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((p) => (
              <li key={p.id} className="relative">
                <a href={photoUrl(p.id)} target="_blank" rel="noreferrer" title={`${p.uploaded_by_name ?? ""} · ${wibDateTime(p.taken_at ?? p.uploaded_at)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API, not a static asset */}
                  <img src={photoUrl(p.id)} alt={tr("Photo")} className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200" loading="lazy" />
                </a>
                {open && p.uploaded_by === me?.id && (
                  <button type="button" onClick={() => remove(p.id)} aria-label={tr("Remove photo")}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-1 text-white shadow"><X size={12} /></button>
                )}
              </li>
            ))}
            {open && !full && (
              <li>
                <button type="button" onClick={() => setCamera(true)} disabled={busy}
                  className={cx("flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs font-medium",
                    "border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-700")}>
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                  {tr("Take photo")}
                </button>
              </li>
            )}
          </ul>
        )}
        {open && full && <p className="mt-2 text-xs text-amber-700">{tr("The maximum of 15 photos is reached; remove one to take another.")}</p>}
      </div>
      <CameraCapture open={camera} title={tr("Stock opname evidence")} branch={count.facility_name} countNumber={count.number}
        onClose={() => setCamera(false)} onShot={upload} />
    </section>
  );
}

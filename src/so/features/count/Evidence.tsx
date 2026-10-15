"use client";

// Evidence of a count (2026-10-15): up to 15 photos of the count as a whole, taken with the camera at the end of the
// count (optional), and once the count is approved the evidence as image files (ZIP) or one PDF.

import { Camera, Download, FileText, Images, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button, cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { type Count } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { photoUrl } from "@/so/lib/photos";
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
      <Button variant="secondary" size="sm" loading={busy === "zip"} disabled={!!busy || count.photos.length === 0} onClick={() => get("zip")}>
        <Download size={14} /> {tr("Photos (ZIP)")}
      </Button>
    </div>
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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

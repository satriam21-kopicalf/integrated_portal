"use client";

// Evidence photos of a count (06.9 §5): taken with the live camera only (no gallery or file, user decision 2026-10-13),
// stamped with branch, count, subject, WIB time and position, uploaded with the position. Shown as thumbnails; the
// person who took a photo can remove it while the count is open.

import { Camera, Loader2, X } from "lucide-react";
import { useState } from "react";
import { cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountPhoto } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { photoUrl } from "@/so/lib/photos";
import CameraCapture, { type Shot } from "./CameraCapture";

export default function PhotoStrip({ count, subject, required, open, onChange, compact = false }: {
  count: Count;
  subject: string;
  required: boolean;
  open: boolean;
  onChange: (c: Count) => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const { me } = useMe();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const photos = count.photos.filter((p) => p.subject === subject);
  const missing = required && photos.length === 0;

  const [kind, ref] = [subject.split(":")[0], subject.slice(subject.indexOf(":") + 1)];
  const title = kind === "AREA" ? tr("Area {0}", ref) : count.lines.find((l) => l.item_id === ref)?.item_name ?? tr("Item");

  const upload = async (shot: Shot) => {
    setBusy(true);
    try {
      onChange(await api<Count>(`/api/so/counts/${count.id}/photos`, {
        method: "POST",
        json: { image: shot.image, subject, lat: shot.lat, lng: shot.lng, taken_at: shot.taken_at },
      }));
    } catch (err) {
      toast(errorText(err), "error");
      throw err;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (p: CountPhoto) => {
    try {
      onChange(await api<Count>(`/api/so/counts/${count.id}/photos/${p.id}`, { method: "DELETE" }));
    } catch (err) {
      toast(errorText(err), "error");
    }
  };

  if (!open && photos.length === 0) return null;
  return (
    <div className={cx("flex flex-wrap items-center gap-2", compact ? "mt-2" : "")}>
      {photos.map((p) => (
        <span key={p.id} className="relative">
          <a href={photoUrl(p.id)} target="_blank" rel="noreferrer" title={`${p.uploaded_by_name ?? ""} · SHA-256 ${p.sha256.slice(0, 12)}…`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API, not a static asset */}
            <img src={photoUrl(p.id)} alt={tr("Photo")} className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" loading="lazy" />
          </a>
          {open && p.uploaded_by === me?.id && (
            <button type="button" onClick={() => remove(p)} aria-label={tr("Remove photo")}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white shadow"><X size={12} /></button>
          )}
        </span>
      ))}
      {open && (
        <button type="button" onClick={() => setCamera(true)} disabled={busy}
          className={cx("inline-flex h-14 items-center gap-1.5 rounded-lg border border-dashed px-3 text-xs font-medium",
            missing ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-500 hover:border-slate-400")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {missing ? tr("Photo needed") : tr("Add photo")}
        </button>
      )}
      <CameraCapture open={camera} title={title} branch={count.facility_name} countNumber={count.number}
        onClose={() => setCamera(false)} onShot={upload} />
    </div>
  );
}

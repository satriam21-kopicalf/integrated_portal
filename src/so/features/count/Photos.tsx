"use client";

// Evidence photos of a count (06.9 §5): taken with the camera, compressed in the browser, uploaded with the position.
// Shown as thumbnails; the person who took a photo can remove it while the count is open.

import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { cx, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { type Count, type CountPhoto, getPosition } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";
import { useMe } from "@/so/lib/me";
import { compressPhoto, photoUrl } from "@/so/lib/photos";

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
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos = count.photos.filter((p) => p.subject === subject);
  const missing = required && photos.length === 0;

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const [image, pos] = await Promise.all([compressPhoto(file), getPosition()]);
      onChange(await api<Count>(`/api/so/counts/${count.id}/photos`, {
        method: "POST",
        json: { image, subject, lat: pos?.lat ?? null, lng: pos?.lng ?? null, taken_at: new Date(file.lastModified || Date.now()).toISOString() },
      }));
    } catch (err) {
      toast(errorText(err), "error");
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
        <button type="button" onClick={() => input.current?.click()} disabled={busy}
          className={cx("inline-flex h-14 items-center gap-1.5 rounded-lg border border-dashed px-3 text-xs font-medium",
            missing ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-300 text-slate-500 hover:border-slate-400")}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {missing ? tr("Photo needed") : tr("Add photo")}
        </button>
      )}
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
    </div>
  );
}

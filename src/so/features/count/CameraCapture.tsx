"use client";

// Live camera for the evidence photos (user decision 2026-10-13): the photo is taken from the camera stream in the
// browser on phones and laptops alike, never picked from the gallery or a file. The branch, the count, what the photo
// is of, the WIB time and the position are burned into the image before it is uploaded.

import { Camera, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/so/ui";
import { TZ, TZ_LABEL } from "@/so/lib/wib";
import { getPosition } from "@/so/lib/counts";
import { locale, tr } from "@/lib/i18n";

const MAX_SIDE = 1600;

export type Shot = { image: string; taken_at: string; lat: number | null; lng: number | null };

function stamp(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  const size = Math.max(14, Math.round(w / 45));
  const pad = Math.round(size * 0.6);
  const boxH = lines.length * (size + 6) + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((t, i) => ctx.fillText(t, pad, h - boxH + pad + i * (size + 6), w - pad * 2));
}

export default function CameraCapture({ open, title, branch, countNumber, onClose, onShot }: {
  open: boolean; title: string; branch: string; countNumber: string; onClose: () => void; onShot: (s: Shot) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(tr("This browser cannot open the camera. Use Chrome or Safari on a phone or a laptop with a camera."));
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError"
        ? tr("Camera access was refused. Allow the camera for this site in the browser settings, then try again.")
        : tr("No camera could be opened on this device."));
    }
  }, [facing, stop]);

  useEffect(() => {
    if (open && !shot) void start();
    return stop;
  }, [open, shot, start, stop]);

  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setBusy(true);
    const pos = await getPosition();
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const now = new Date();
    const when = `${now.toLocaleString(locale(), { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} ${TZ_LABEL}`;
    stamp(ctx, canvas.width, canvas.height, [
      `${branch} · ${countNumber}`,
      title,
      `${when}${pos ? ` · ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : ` · ${tr("no location")}`}`,
    ]);
    setShot({ image: canvas.toDataURL("image/jpeg", 0.78), taken_at: now.toISOString(), lat: pos?.lat ?? null, lng: pos?.lng ?? null });
    stop();
    setBusy(false);
  };

  const use = async () => {
    if (!shot) return;
    setBusy(true);
    try {
      await onShot(shot);
      setShot(null);
      onClose();
    } catch {
      // the upload failed (the message is shown); the photo stays so it can be sent again
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={tr("Take a photo")}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-xs text-white/70">{branch} · {tr("Camera only: photos from the gallery or files are not accepted")}</p>
        </div>
        <button type="button" onClick={() => { setShot(null); onClose(); }} className="rounded-full p-2 hover:bg-white/10" aria-label={tr("Close")}><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- the photo just taken (data URL)
          <img src={shot.image} alt={tr("Photo")} className="max-h-full max-w-full object-contain" />
        ) : error ? (
          <div className="max-w-sm px-6 text-center text-sm text-white">
            <Camera size={32} className="mx-auto mb-3 text-white/60" />
            <p>{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => void start()}><RefreshCw size={16} /> {tr("Try again")}</Button>
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted className="max-h-full max-w-full object-contain" />
            {!ready && <Loader2 className="absolute animate-spin text-white" size={28} />}
          </>
        )}
      </div>
      <div className="flex items-center justify-center gap-6 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {shot ? (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => setShot(null)}><RotateCcw size={16} /> {tr("Retake")}</Button>
            <Button loading={busy} onClick={use}><Camera size={16} /> {tr("Use photo")}</Button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} disabled={!!error}
              className="rounded-full p-3 text-white hover:bg-white/10 disabled:opacity-40" aria-label={tr("Switch camera")}><RefreshCw size={22} /></button>
            <button type="button" onClick={capture} disabled={!ready || busy} aria-label={tr("Take the photo")}
              className="h-16 w-16 rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40" />
            <span className="w-12" />
          </>
        )}
      </div>
    </div>
  );
}

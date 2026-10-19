"use client";

// Selfie for the PIC Check In: the front camera only (never the gallery or a file), an oval to place the face in, the
// PIC, the branch, the WIB date & time and the position burned into the photo before it is sent. The preview is
// not mirrored, like the photo itself (what the PIC sees is what is saved). The server checks there is a face (app/face.py).

import { Camera, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/so/ui";
import { TZ, TZ_LABEL } from "@/so/lib/wib";
import { locale, tr } from "@/lib/i18n";

const MAX_SIDE = 1280;

export type Selfie = { image: string; takenAt: string };

function stamp(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  const size = Math.max(14, Math.round(w / 40));
  const pad = Math.round(size * 0.6);
  const boxH = lines.length * (size + 6) + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((t, i) => ctx.fillText(t, pad, h - boxH + pad + i * (size + 6), w - pad * 2));
}

export default function SelfieCamera({ pic, branch, position, onClose, onShot }: {
  pic: string; branch: string; position: string; onClose: () => void; onShot: (s: Selfie) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<Selfie | null>(null);

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
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
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
  }, [stop]);

  useEffect(() => {
    if (!shot) void start();
    return stop;
  }, [shot, start, stop]);

  const capture = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const now = new Date();
    const when = `${now.toLocaleString(locale(), { timeZone: TZ, weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} ${TZ_LABEL}`;
    stamp(ctx, canvas.width, canvas.height, [`PIC Check In · ${pic}`, branch, `${when} · ${position}`]);
    setShot({ image: canvas.toDataURL("image/jpeg", 0.82), takenAt: now.toISOString() });
    stop();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={tr("Face photo")}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{tr("Face photo")} · {branch}</p>
          <p className="truncate text-xs text-white/70">{tr("Front camera only: place your face in the oval, in good light")}</p>
        </div>
        <button type="button" onClick={() => { stop(); onClose(); }} className="rounded-full p-2 hover:bg-white/10" aria-label={tr("Close")}><X size={20} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element -- the photo just taken (data URL)
          <img src={shot.image} alt={tr("Face photo")} className="max-h-full max-w-full object-contain" />
        ) : error ? (
          <div className="max-w-sm px-6 text-center text-sm text-white">
            <Camera size={32} className="mx-auto mb-3 text-white/60" />
            <p>{error}</p>
            <Button variant="secondary" className="mt-4" onClick={() => void start()}><RefreshCw size={16} /> {tr("Try again")}</Button>
          </div>
        ) : (
          <>
            <video ref={video} playsInline muted className="max-h-full max-w-full object-contain" />
            {/* where the face goes */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] max-h-[26rem] aspect-[3/4] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            {!ready && <Loader2 className="absolute animate-spin text-white" size={28} />}
          </>
        )}
      </div>
      <div className="flex items-center justify-center gap-6 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {shot ? (
          <>
            <Button variant="secondary" onClick={() => setShot(null)}><RotateCcw size={16} /> {tr("Retake")}</Button>
            <Button onClick={() => onShot(shot)}><Camera size={16} /> {tr("Use photo")}</Button>
          </>
        ) : (
          <button type="button" onClick={capture} disabled={!ready} aria-label={tr("Take the photo")}
            className="h-16 w-16 rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40" />
        )}
      </div>
    </div>
  );
}

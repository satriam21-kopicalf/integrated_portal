"use client";

// Signature pad of the stock opname preview (06.9 §12.16, D-62): drawn with a finger, a pen or the mouse; reported as a
// JPEG on white (the evidence PDF embeds JPEG), null while empty or after "Clear".

import { Eraser } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "@/lib/i18n";

const HEIGHT = 190;
const INK = "#0f172a";

export default function SignaturePad({ onChange }: { onChange: (image: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);

  // size the canvas to its box at the device pixel ratio (sharp lines on phones)
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    c.width = Math.round(c.clientWidth * ratio);
    c.height = Math.round(HEIGHT * ratio);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const report = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const out = document.createElement("canvas");
    out.width = c.width;
    out.height = c.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, 0, 0);
    onChange(out.toDataURL("image/jpeg", 0.9));
  }, [onChange]);

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!last.current) return;
    last.current = null;
    setInked(true);
    report();
  };
  const clear = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setInked(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-[3px] border border-[color:var(--j-8590A2)] bg-white">
        <canvas ref={canvas} style={{ height: HEIGHT, touchAction: "none" }} className="block w-full cursor-crosshair"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
          aria-label={tr("Signature area: draw your signature")} role="img" />
        {!inked && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[color:var(--j-8590A2)]">
            {tr("Sign here")}
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-9 border-b border-dashed border-[color:var(--j-8590A2)]" />
      </div>
      <div className="mt-1.5 flex justify-end">
        <button type="button" onClick={clear} disabled={!inked}
          className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)] disabled:opacity-40">
          <Eraser size={13} /> {tr("Clear")}
        </button>
      </div>
    </div>
  );
}

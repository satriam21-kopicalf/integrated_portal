"use client";

// Position of the device before a count starts (06.9 §12.15): a fresh GPS fix is required. The dialog shows the
// accuracy while it improves, explains how to allow location when it is blocked, and warns about a weak fix (worse
// than 100 m) so the counter can move near a window or outside and try again, or go on (the count is then marked
// "low accuracy" for Cost Control).

import { Crosshair, Loader2, MapPinOff, RotateCcw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import { type Fix, type LocateError, locate } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

const WEAK_M = 100;

export default function LocateDialog({ title, onCancel, onDone }: { title: string; onCancel: () => void; onDone: (fix: Fix) => void }) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [state, setState] = useState<"locating" | "weak" | LocateError>("locating");
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const run = useCallback(async () => {
    setFix(null);
    setState("locating");
    const r = await locate((f) => alive.current && setFix(f));
    if (!alive.current) return;
    if (!r.fix) { setState(r.error ?? "unavailable"); return; }
    if (r.fix.accuracy > WEAK_M) { setFix(r.fix); setState("weak"); return; }
    onDone(r.fix);
  }, [onDone]);
  useEffect(() => { void run(); }, [run]);

  const footer = state === "locating" ? (
    <Button variant="secondary" onClick={onCancel}>{tr("Cancel")}</Button>
  ) : state === "weak" ? (
    <>
      <Button variant="secondary" onClick={() => void run()}><RotateCcw size={15} /> {tr("Try again")}</Button>
      <Button onClick={() => fix && onDone(fix)}>{tr("Start anyway")}</Button>
    </>
  ) : (
    <>
      <Button variant="secondary" onClick={onCancel}>{tr("Cancel")}</Button>
      <Button onClick={() => void run()}><RotateCcw size={15} /> {tr("Try again")}</Button>
    </>
  );

  return (
    <Dialog open size="sm" locked={state === "locating"} onClose={onCancel} title={title}
      description={tr("The stock opname records where it starts.")} footer={footer}>
      {state === "locating" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-200/60" />
            <Crosshair size={24} className="relative" />
          </span>
          <p className="text-sm font-medium text-slate-800">{tr("Finding your location…")}</p>
          <p className="text-xs text-slate-500">
            {fix ? tr("Accuracy ±{0} m, improving", Math.round(fix.accuracy)) : tr("Keep this page open; it takes a few seconds")}
          </p>
          <Loader2 size={16} className="animate-spin text-slate-400" />
        </div>
      ) : state === "weak" ? (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert size={20} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">{tr("The location is not precise (±{0} m)", Math.round(fix?.accuracy ?? 0))}</p>
            <p className="mt-1 text-xs leading-relaxed">{tr("Move near a window or outside, turn on Wi-Fi and precise location, then try again. If you start now, the count is marked \"low accuracy\" for Cost Control.")}</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-900">
          <MapPinOff size={20} className="mt-0.5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">{state === "denied" ? tr("Location is blocked for this site") : tr("Location is not available")}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              {state === "denied" ? (
                <>
                  <li>{tr("Chrome / Android: tap the padlock in the address bar → Permissions → Location → Allow.")}</li>
                  <li>{tr("iPhone: Settings → Privacy & Security → Location Services → Safari Websites (or Chrome) → While Using, and turn on Precise Location.")}</li>
                </>
              ) : (
                <>
                  <li>{tr("Turn on Location (GPS) on the phone.")}</li>
                  <li>{tr("Move near a window or outside, then try again.")}</li>
                </>
              )}
              <li>{tr("A stock opname cannot start without the location.")}</li>
            </ul>
          </div>
        </div>
      )}
    </Dialog>
  );
}

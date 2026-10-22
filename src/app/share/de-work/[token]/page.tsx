"use client";

// The photo link of a technician (no sign-in, valid 1 hour): the job (outlet, items, analysis), 1–5 camera photos of the
// work done and an optional note; Send hands them to the maintenance team, who then process Done. Once sent (or expired)
// the link is read-only.

import { Camera, CheckCircle2, Clock, ImagePlus, Loader2, MapPin, Send, Wrench, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, cx, inputClass, ToastProvider, useToast } from "@/so/ui";
import { FormCard } from "@/so/ui/Simple";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import PublicShell, { PublicError, PublicLoading } from "@/so/features/de/PublicShell";
import { UrgencyBadge } from "@/so/features/de/RequestView";
import { type WorkView } from "@/so/features/de/de";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

export default function WorkPage() {
  return <ToastProvider><Work /></ToastProvider>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: init?.body ? { "content-type": "application/json" } : undefined });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? body.detail ?? tr("Something went wrong, try again"));
  return body as T;
}

function useCountdown(until: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!until) return;
    const tick = () => setLeft(Math.max(0, Date.parse(until) - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  return left;
}

function Work() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [w, setW] = useState<WorkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/public/de-work/${encodeURIComponent(token)}`;
  const load = useCallback(() => api<WorkView>(base).then(setW).catch((e) => setError((e as Error).message)), [base]);
  useEffect(() => { void load(); }, [load]);
  const left = useCountdown(w?.expiresAt ?? null);
  const expired = left === 0;
  const sent = !!w?.submittedAt;
  const locked = sent || expired;

  const add = async (shot: Shot) => {
    try {
      setW(await api<WorkView>(`${base}/photos`, { method: "POST", body: JSON.stringify({ photo: shot.image, latitude: shot.lat, longitude: shot.lng, takenAt: shot.taken_at }) }));
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };
  const remove = async (id: string) => {
    try {
      setW(await api<WorkView>(`${base}/photos/${id}`, { method: "DELETE" }));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const send = async () => {
    setBusy(true);
    try {
      setW(await api<WorkView>(`${base}/submit`, { method: "POST", body: JSON.stringify({ note: note.trim() || null }) }));
      toast(tr("Photos sent to the maintenance team"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const mm = left === null ? "--" : String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = left === null ? "--" : String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <PublicShell eyebrow={tr("Photos of the work done")} title={w ? `${w.number} · ${w.branchName}` : tr("Damaged Equipment")}
      subtitle={w ? tr("Technician: {0}", w.technician) : undefined}>
      {error ? <PublicError message={error} /> : !w ? <PublicLoading /> : (
        <div className="space-y-4 pb-24">
          {sent ? (
            <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 size={22} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-900">{tr("Photos sent")}</p>
                <p className="text-sm text-emerald-800">{tr("Sent {0}. The maintenance team checks them and closes the job.", wibDateTime(w.submittedAt))}</p>
              </div>
            </section>
          ) : (
            <section className={cx("grid grid-cols-3 divide-x overflow-hidden rounded-2xl border bg-white shadow-sm", expired ? "border-red-200 divide-red-100" : "border-slate-200 divide-slate-100")}>
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Link valid")}</p>
                <p className={cx("mt-0.5 inline-flex items-center gap-1 font-mono text-lg font-semibold tabular-nums", expired ? "text-red-600" : left !== null && left < 600000 ? "text-amber-600" : "text-slate-900")}>
                  <Clock size={15} />{expired ? tr("Expired") : `${mm}:${ss}`}</p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Photos")}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{w.photos.length}<span className="text-sm font-normal text-slate-400"> / {w.max}</span></p>
              </div>
              <div className="px-3 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Required")}</p>
                <p className={cx("mt-0.5 text-sm font-semibold", w.photos.length ? "text-emerald-600" : "text-slate-900")}>{w.photos.length ? tr("Done ✓") : tr("Min. 1 photo")}</p>
              </div>
            </section>
          )}
          {expired && !sent && <PublicError message={tr("The link has expired. Ask the maintenance team for a new link.")} />}

          <FormCard n={1} title={tr("The job")} hint={`${w.kindLabel} · ${w.branchName} (${w.branchCode})`}>
            <ul className="divide-y divide-slate-100">
              {w.items.map((it, i) => (
                <li key={i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{it.name} <span className="font-normal text-slate-500">× {it.qty}</span></span>
                    <span className="block text-xs text-slate-500">{it.category}{it.location ? <> · <MapPin size={11} className="inline" /> {it.location}</> : null}</span>
                    {it.note && <span className="mt-0.5 block text-xs text-slate-600">{it.note}</span>}
                  </span>
                  <UrgencyBadge u={it.urgency} />
                </li>
              ))}
            </ul>
            {w.analysis && <p className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{w.analysis}</p>}
          </FormCard>

          <FormCard n={2} title={tr("Photos of the work done")} hint={tr("Take 1–{0} photos with the camera: the result, and the parts replaced if any", w.max)}
            aside={<Badge tone={w.photos.length ? "green" : "red"}>{w.photos.length ? `${w.photos.length}/${w.max}` : tr("Required")}</Badge>}>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {w.photos.map((p, i) => (
                <li key={p.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo through the link */}
                  <img src={`${base}/media/${p.id}`} alt={tr("Photo {0}", i + 1)} className="aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-slate-200" />
                  <span className="mt-0.5 block text-[10px] text-slate-400">{wibDateTime(p.takenAt)}</span>
                  {!locked && (
                    <button type="button" onClick={() => void remove(p.id)} aria-label={tr("Remove photo {0}", i + 1)}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600"><X size={14} /></button>
                  )}
                </li>
              ))}
              {!locked && w.photos.length < w.max && (
                <li>
                  <button type="button" onClick={() => setCamera(true)}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 text-sm font-medium text-blue-700 hover:bg-blue-50">
                    {w.photos.length ? <ImagePlus size={22} /> : <Camera size={22} />}{w.photos.length ? tr("Add photo") : tr("Take photo")}
                  </button>
                </li>
              )}
            </ul>
          </FormCard>

          <FormCard n={3} title={tr("Note for the team")} hint={tr("Optional: what was done, parts replaced, anything to follow up")}>
            {sent ? <p className="whitespace-pre-line text-sm text-slate-700">{w.note || "—"}</p> : (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} disabled={locked}
                placeholder={tr("e.g. burr replaced, tested 30 minutes, works normally")} className={cx(inputClass, "h-auto py-2 text-sm")} aria-label={tr("Note for the team")} />
            )}
          </FormCard>

          {!locked && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
              <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
                <p className="min-w-0 flex-1 text-xs text-slate-500">{w.photos.length ? tr("{0} photo(s) ready. After sending, the photos can no longer be changed.", w.photos.length) : tr("Take at least 1 photo to send.")}</p>
                <Button disabled={busy || !w.photos.length} onClick={() => void send()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {tr("Send photos")}</Button>
              </div>
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><Wrench size={12} /> {tr("Link for {0} · valid until {1}", w.technician, wibDateTime(w.expiresAt))}</p>
        </div>
      )}
      {w && <CameraCapture open={camera} title={tr("Work done")} branch={w.branchName} countNumber={w.number} onClose={() => setCamera(false)} onShot={add} />}
    </PublicShell>
  );
}

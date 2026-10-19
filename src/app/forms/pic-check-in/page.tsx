"use client";

// PIC Check In (Form → Visit, page form.pic-check-in): the PIC checks in at the outlet he visits — his account, the
// branch (picked when he has several), the time of the visit (server time when sent), a front-camera face photo
// stamped with the time and the branch (the server refuses a photo without a face) and the GPS position compared with
// the outlet's coordinates (Cost Control → Lokasi Outlet). Management follows them in Monitoring → PIC Check In.

import { Camera, CheckCircle2, Clock, Crosshair, ExternalLink, Loader2, MapPin, MapPinOff, RotateCcw, ScanFace, Send, SignalLow, Store, UserRound, XCircle } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, Panel, useToast } from "@/so/ui";
import { type Fix, locate, mapsUrl } from "@/so/lib/counts";
import { wibClock, wibDateTime } from "@/so/lib/wib";
import SelfieCamera, { type Selfie } from "@/so/features/checkin/SelfieCamera";
import { type CheckIn, type FormData, call, judge, photoUrl } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

const FRESH_MS = 3 * 60_000; // a position older than this is taken again when sending

export default function PicCheckInPage() {
  const toast = useToast();
  const [data, setData] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState<Selfie | null>(null);
  const [faces, setFaces] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<CheckIn | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await call<FormData>("/api/forms/pic-check-in");
      setData(d);
      if (d.branches.length === 1) setBranch(d.branches[0].code);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const findMe = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    const r = await locate((f) => setFix(f));
    setLocating(false);
    if (r.fix) setFix(r.fix);
    else setLocError(r.error === "denied" ? tr("Location is blocked for this site") : tr("Location is not available"));
    return r.fix;
  }, []);
  useEffect(() => { void findMe(); }, [findMe]);

  const b = data?.branches.find((x) => x.code === branch);
  const where = useMemo(() => (fix ? judge(fix.lat, fix.lng, fix.accuracy, b) : null), [fix, b]);
  const position = fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} ±${Math.round(fix.accuracy)} m` : "";

  const takePhoto = async (s: Selfie) => {
    setCamera(false);
    setPhoto(s);
    setFaces(null);
    setChecking(true);
    try {
      setFaces((await call<{ faces: number }>("/api/forms/pic-check-in/face-check", { method: "POST", json: { photo: s.image } })).faces);
    } catch (e) {
      toast((e as Error).message, "error");
      setPhoto(null);
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    if (!b || !photo) return;
    setSending(true);
    try {
      let f = fix;
      if (!f || Date.now() - Date.parse(f.at) > FRESH_MS) f = await findMe();
      if (!f) throw new Error(tr("A check in cannot be sent without the location."));
      const out = await call<{ id: string; visitedAt: string }>("/api/forms/pic-check-in", { method: "POST", json: {
        branchCode: b.code, photo: photo.image, latitude: f.lat, longitude: f.lng, accuracyM: f.accuracy, locatedAt: f.at,
        deviceTime: photo.takenAt, note: note.trim() || null } });
      const d = await call<FormData>("/api/forms/pic-check-in");
      setData(d);
      setDone(d.recent.find((r) => r.id === out.id) ?? null);
      setPhoto(null);
      setFaces(null);
      setNote("");
      toast(tr("Check in sent"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  const ready = !!b && !!fix && !!photo && (faces ?? 0) > 0 && !checking;
  return (
    <Page title={tr("PIC Check In")} subtitle={tr("Check in at the outlet you visit")}
      actions={now ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-700"><Clock size={14} className="text-slate-400" />{wibClock(now)}</span> : undefined}>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : !data ? (
        <div className="skeleton h-96 rounded-xl" />
      ) : data.branches.length === 0 ? (
        <Panel><div className="px-6 py-12 text-center text-sm text-slate-500">{tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}</div></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {done && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tr("Checked in at {0}", done.branchName)}</p>
                  <p className="text-xs">{wibDateTime(done.visitedAt)} · {done.distanceM !== null ? tr("{0} m from the outlet", done.distanceM) : tr("Outlet has no coordinates")}{done.outsideRadius ? ` · ${tr("Outside radius")}` : ""}</p>
                </div>
                <button type="button" onClick={() => setDone(null)} className="text-xs font-medium text-emerald-800 hover:underline">{tr("Close")}</button>
              </div>
            )}
            <Panel>
              <ol className="divide-y divide-slate-100">
                <Step n={1} icon={<UserRound size={16} />} title={tr("PIC")} done>
                  <p className="text-sm font-medium text-slate-900">{data.user.name}</p>
                  <p className="text-xs text-slate-500">@{data.user.username} · {tr("from your account")}</p>
                </Step>

                <Step n={2} icon={<Store size={16} />} title={tr("Outlet visited")} done={!!b}>
                  {data.branches.length === 1 ? (
                    <p className="text-sm font-medium text-slate-900">{data.branches[0].name}</p>
                  ) : (
                    <select value={branch} onChange={(e) => { setBranch(e.target.value); setPhoto(null); setFaces(null); }}
                      className={cx(inputClass, "h-11")} aria-label={tr("Outlet visited")}>
                      <option value="">{tr("Choose the outlet you are visiting")}</option>
                      {data.branches.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                    </select>
                  )}
                </Step>

                <Step n={3} icon={<MapPin size={16} />} title={tr("Location")} done={!!fix}>
                  {locating && !fix ? (
                    <p className="inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" /> {tr("Finding your location…")}</p>
                  ) : fix ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!b ? <span className="text-sm text-slate-600">{tr("Choose the outlet to compare with its location")}</span>
                          : !where?.located ? <Badge tone="slate" icon={<MapPinOff size={11} />}>{tr("Outlet has no coordinates")}</Badge>
                          : where.outside ? <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>
                          : <Badge tone="green" icon={<CheckCircle2 size={11} />}>{tr("At the outlet")}</Badge>}
                        {where?.distance != null && <span className="text-sm tabular-nums text-slate-700">{tr("{0} m from the outlet", where.distance)}</span>}
                        {fix.accuracy > 100 && <Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low GPS accuracy")}</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">
                        <a href={mapsUrl(fix.lat, fix.lng)} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">{position} <ExternalLink size={11} className="inline" /></a>
                        {locating && <> · {tr("improving…")}</>}
                      </p>
                      <Button variant="secondary" size="sm" disabled={locating} onClick={() => void findMe()}><Crosshair size={13} /> {tr("Update location")}</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-red-700">{locError}</p>
                      <p className="text-xs text-slate-500">{tr("Turn on Location (GPS) and allow it for this site (padlock in the address bar), then try again.")}</p>
                      <Button variant="secondary" size="sm" onClick={() => void findMe()}><RotateCcw size={13} /> {tr("Try again")}</Button>
                    </div>
                  )}
                </Step>

                <Step n={4} icon={<ScanFace size={16} />} title={tr("Face photo")} done={(faces ?? 0) > 0}>
                  {photo ? (
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the photo just taken (data URL) */}
                      <img src={photo.image} alt={tr("Face photo")} className="h-24 w-24 flex-shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 space-y-2">
                        {checking ? <p className="inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" /> {tr("Checking the face…")}</p>
                          : (faces ?? 0) > 0 ? <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckCircle2 size={15} /> {tr("Face detected")}</p>
                          : <p className="inline-flex items-start gap-1.5 text-sm font-medium text-red-700"><XCircle size={15} className="mt-0.5 flex-shrink-0" /> {tr("No face detected. Retake the photo with your face clearly visible, facing the camera, in good light.")}</p>}
                        <Button variant="secondary" size="sm" onClick={() => setCamera(true)}><RotateCcw size={13} /> {tr("Retake")}</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">{tr("A selfie with the front camera; the time, the outlet and the location are printed on it.")}</p>
                      <Button disabled={!b || !fix} onClick={() => setCamera(true)}><Camera size={15} /> {tr("Take face photo")}</Button>
                      {(!b || !fix) && <p className="text-xs text-slate-400">{tr("Choose the outlet and wait for the location first.")}</p>}
                    </div>
                  )}
                </Step>

                <Step n={5} icon={<Clock size={16} />} title={tr("Visit time")} done={ready}>
                  <p className="text-sm text-slate-700">{tr("Recorded with the server time when you send the check in")}{now ? ` · ${wibClock(now)}` : ""}</p>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
                    placeholder={tr("Note (optional), e.g. the purpose of the visit")} className={cx(inputClass, "mt-2 py-2")} />
                </Step>
              </ol>
              <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs text-slate-500">{ready ? tr("Everything is ready.") : tr("Complete the outlet, the location and the face photo.")}</p>
                <Button loading={sending} disabled={!ready} onClick={() => void send()} className="w-full sm:w-auto"><Send size={15} /> {tr("Send check in")}</Button>
              </div>
            </Panel>
          </div>

          <Panel title={tr("My latest check-ins")}>
            {data.recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{tr("No check in yet")}</p> : (
              <ul className="divide-y divide-slate-100">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                    <img src={photoUrl(r.id)} alt="" loading="lazy" className="h-11 w-11 flex-shrink-0 rounded-lg bg-slate-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{r.branchName}</p>
                      <p className="text-xs text-slate-500">{wibDateTime(r.visitedAt)}</p>
                    </div>
                    {r.outsideRadius ? <Badge tone="amber">{tr("Outside radius")}</Badge> : r.distanceM !== null ? <span className="text-xs tabular-nums text-slate-500">{r.distanceM} m</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
      {camera && data && b && (
        <SelfieCamera pic={data.user.name} branch={b.name} position={position} onClose={() => setCamera(false)} onShot={(s) => void takePhoto(s)} />
      )}
    </Page>
  );
}

function Step({ n, icon, title, done, children }: { n: number; icon: ReactNode; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3 px-4 py-4 sm:px-5">
      <span className={cx("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold",
        done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")} aria-label={tr("Step {0}", n)}>
        {done ? <CheckCircle2 size={16} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {children}
      </div>
    </li>
  );
}

"use client";

// PIC Check In (Form → Visit, page form.pic-check-in): the PIC checks in at the outlet he visits — his account, the
// branch (picked when he has several), the time of the visit (server time when sent), a front-camera face photo
// stamped with the time and the branch (the server refuses a photo without a face) and the GPS position compared with
// the outlet's coordinates (Cost Control → Lokasi Outlet). Management follows them in Monitoring → PIC Check In.
// Same look as the other portal pages: page header (live WIB clock), a white band with the PIC and the steps, step
// cards, a summary with the send button (right column on desktop, a bar at the bottom on phones).
// Outside the outlet's radius: a red alert and a required reason (the server refuses without one). The GPS readings
// while the form is open and the device signals go with the check-in (fake GPS detection on the server).

import { AlertTriangle, Camera, Check, CheckCircle2, Crosshair, ExternalLink, Loader2, MapPinOff, RotateCcw, Send, X, XCircle } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { type Fix, locate, mapsUrl } from "@/so/lib/counts";
import { TZ, wibDateTime } from "@/so/lib/wib";
import SelfieCamera, { type Selfie } from "@/so/features/checkin/SelfieCamera";
import { type CheckIn, type FormData, call, deviceSignals, judge, photoUrl, useGpsTrail } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";
import LiveClock from "@/so/ui/LiveClock";
import { useFocusMode } from "@/components/layout/BottomNav";

const FRESH_MS = 3 * 60_000; // a position older than this is taken again when sending

type Tone = "ok" | "warn" | "muted";
const TONE: Record<Tone, string> = { ok: "text-emerald-700", warn: "text-amber-700", muted: "text-slate-500" };
const DOT: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", muted: "bg-slate-300" };

export default function PicCheckInPage() {
  const toast = useToast();
  const { user: me } = useAuth();
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
  const trail = useGpsTrail();
  // the phone tab bar steps aside for the send bar of the form
  useFocusMode();

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
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
  const faceOk = (faces ?? 0) > 0 && !checking;
  const outside = !!where?.outside;
  const reasonMissing = outside && !note.trim();
  const ready = !!b && !!fix && !!photo && faceOk && !reasonMissing;
  const pending = reasonMissing && b && fix && photo && faceOk ? tr("Outside the radius: write the reason first.") : tr("Complete the outlet, the location and the face photo.");

  const status: { tone: Tone; text: string } = !fix ? { tone: "muted", text: "—" }
    : !b ? { tone: "muted", text: tr("Choose the outlet") }
    : !where?.located ? { tone: "muted", text: tr("No coordinates") }
    : where.outside ? { tone: "warn", text: tr("Outside radius") }
    : { tone: "ok", text: tr("At the outlet") };

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
      const out = await call<{ id: string }>("/api/forms/pic-check-in", { method: "POST", json: {
        branchCode: b.code, photo: photo.image, latitude: f.lat, longitude: f.lng, accuracyM: f.accuracy, locatedAt: f.at,
        deviceTime: photo.takenAt, note: note.trim() || null, sentAt: new Date().toISOString(),
        samples: trail.current.slice(-30), ...deviceSignals() } });
      const d = await call<FormData>("/api/forms/pic-check-in");
      setData(d);
      setDone(d.recent.find((r) => r.id === out.id) ?? null);
      setPhoto(null);
      setFaces(null);
      setNote("");
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast(tr("Check in sent"));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
    }
  };

  const steps = [
    { label: tr("Outlet"), ok: !!b },
    { label: tr("Location"), ok: !!fix },
    { label: tr("Face photo"), ok: faceOk },
  ];
  const current = steps.findIndex((s) => !s.ok);

  const clock = <LiveClock />;
  const subtitle = now ? now.toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : tr("Check in at the outlet you visit");

  if (error || !data) {
    return (
      <Page title={tr("PIC Check In")} subtitle={subtitle} actions={clock}>
        {error ? <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={load} /></div>
          : <div className="mx-auto max-w-5xl space-y-4"><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-72 rounded-xl" /></div>}
      </Page>
    );
  }

  return (
    <Page title={tr("PIC Check In")} subtitle={subtitle} actions={clock}
      stats={
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar name={data.user.name} src={me?.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{data.user.name}</p>
                <p className="truncate text-xs text-slate-500">@{data.user.username} · {tr("visit time is the server time when sent")}</p>
              </div>
            </div>
            <ol className="flex items-center" aria-label={tr("Steps")}>
              {steps.map((s, i) => (
                <li key={s.label} className="flex items-center">
                  {i > 0 && <span className={cx("mx-2 h-px w-6 sm:w-10", steps[i - 1].ok ? "bg-emerald-400" : "bg-slate-200")} />}
                  <span className="flex items-center gap-1.5">
                    <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                      s.ok ? "bg-emerald-500 text-white" : i === current ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
                      {s.ok ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={cx("text-xs font-medium", s.ok ? "text-slate-700" : i === current ? "text-slate-900" : "text-slate-400")}>{s.label}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      }>
      <div className="mx-auto max-w-5xl space-y-4">
        {done && (
          <div className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            done.outsideRadius ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900")}>
            {done.outsideRadius ? <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" /> : <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tr("Checked in at {0}", done.branchName)}</p>
              <p className="text-xs opacity-90">{wibDateTime(done.visitedAt)} · {done.distanceM !== null ? tr("{0} m from the outlet", done.distanceM) : tr("Outlet has no coordinates")}{done.outsideRadius ? ` · ${tr("Outside radius: reviewed by management")}` : ""}</p>
            </div>
            <button type="button" onClick={() => setDone(null)} className="rounded-md p-1 opacity-70 hover:bg-white/60 hover:opacity-100" aria-label={tr("Close")}><X size={16} /></button>
          </div>
        )}

        {data.branches.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            {tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="space-y-4">
              <Card n={1} ok={!!b} active={current === 0} title={tr("Outlet visited")} hint={tr("The outlet where you are now")}>
                {data.branches.length === 1 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900">{data.branches[0].name}</p>
                ) : (
                  <select value={branch} onChange={(e) => { setBranch(e.target.value); setPhoto(null); setFaces(null); }}
                    className={cx(inputClass, "h-11")} aria-label={tr("Outlet visited")}>
                    <option value="">{tr("Choose the outlet you are visiting")}</option>
                    {data.branches.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                  </select>
                )}
              </Card>

              <Card n={2} ok={!!fix} active={current === 1} title={tr("Location")} hint={tr("Compared with the outlet's coordinates")}
                action={fix && (
                  <button type="button" disabled={locating} onClick={() => void findMe()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                    {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
                    <span className="hidden sm:inline">{tr("Update location")}</span>
                  </button>
                )}>
                {locating && !fix ? (
                  <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600"><Loader2 size={15} className="animate-spin text-blue-600" /> {tr("Finding your location…")}</p>
                ) : fix ? (
                  <>
                    <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100">
                      <Metric label={tr("Status")}>
                        <span className={cx("inline-flex items-center gap-1.5 text-sm font-semibold", TONE[status.tone])}>
                          <span className={cx("h-2 w-2 flex-shrink-0 rounded-full", DOT[status.tone])} />{status.text}
                        </span>
                      </Metric>
                      <Metric label={tr("Distance")}>
                        <span className="text-sm font-semibold tabular-nums text-slate-900">{where?.distance != null ? `${where.distance} m` : "—"}</span>
                        {where?.located && b?.radius_m != null && <span className="block text-[11px] text-slate-400">{tr("radius {0} m", b.radius_m)}</span>}
                      </Metric>
                      <Metric label={tr("Accuracy")}>
                        <span className={cx("text-sm font-semibold tabular-nums", fix.accuracy > 100 ? "text-amber-700" : "text-slate-900")}>±{Math.round(fix.accuracy)} m</span>
                        {fix.accuracy > 100 && <span className="block text-[11px] text-amber-700">{tr("Low")}</span>}
                      </Metric>
                    </dl>
                    <a href={mapsUrl(fix.lat, fix.lng)} target="_blank" rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700">
                      {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} <ExternalLink size={11} />
                    </a>
                    {outside && b && (
                      <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
                        <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="flex-shrink-0" /> {tr("You are outside the outlet's radius")}</p>
                        <p className="mt-1 text-xs leading-relaxed">
                          {tr("{0} m from {1} (radius {2} m). Move closer to the outlet and update the location, or write the reason in the note: the check in is marked outside the radius and reviewed by management.", where?.distance ?? "?", b.name, b.radius_m ?? 100)}
                        </p>
                        <button type="button" disabled={locating} onClick={() => void findMe()}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50">
                          {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />} {tr("Update location")}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-800">
                    <p className="flex items-center gap-2 font-semibold"><MapPinOff size={16} className="flex-shrink-0" /> {locError}</p>
                    <p className="mt-1 text-xs leading-relaxed">{tr("Turn on Location (GPS) and allow it for this site (padlock in the address bar), then try again.")}</p>
                    <Button variant="secondary" size="sm" className="mt-2.5" onClick={() => void findMe()}><RotateCcw size={13} /> {tr("Try again")}</Button>
                  </div>
                )}
              </Card>

              <Card n={3} ok={faceOk} active={current === 2} title={tr("Face photo")} hint={tr("Front camera; the time, the outlet and the location are printed on the photo")}>
                {photo ? (
                  <div className="grid gap-3 sm:grid-cols-[16rem_minmax(0,1fr)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the photo just taken (data URL) */}
                    <img src={photo.image} alt={tr("Face photo")} className="max-h-72 w-full rounded-lg bg-slate-100 object-contain" />
                    <div className="flex flex-col gap-3">
                      {checking ? (
                        <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={15} className="animate-spin" /> {tr("Checking the face…")}</p>
                      ) : faceOk ? (
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                          <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 size={15} /> {tr("Face detected")}</p>
                          <p className="mt-0.5 text-xs">{tr("Taken at {0}", wibDateTime(photo.takenAt))}</p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                          <p className="flex items-center gap-1.5 font-semibold"><XCircle size={15} /> {tr("No face detected")}</p>
                          <p className="mt-0.5 text-xs leading-relaxed">{tr("Retake the photo with your face clearly visible, facing the camera, in good light.")}</p>
                        </div>
                      )}
                      <Button variant="secondary" size="sm" className="self-start" onClick={() => setCamera(true)}><RotateCcw size={13} /> {tr("Retake")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-4 sm:flex-row sm:items-center">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200"><Camera size={18} /></span>
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-600">
                      {b && fix ? tr("Your face must be clearly visible; it is checked automatically") : tr("Choose the outlet and wait for the location first.")}
                    </p>
                    <Button disabled={!b || !fix} onClick={() => setCamera(true)} className="w-full sm:w-auto"><Camera size={15} /> {tr("Take face photo")}</Button>
                  </div>
                )}
              </Card>

              <section className={cx("rounded-xl border bg-white p-4 shadow-sm sm:p-5", outside ? "border-red-200" : "border-slate-200")}>
                <label htmlFor="pic-note" className="text-sm font-semibold text-slate-900">
                  {outside ? <>{tr("Reason for checking in outside the radius")} <span className="font-normal text-red-600">({tr("required")})</span></>
                    : <>{tr("Note")} <span className="font-normal text-slate-400">({tr("optional")})</span></>}
                </label>
                <textarea id="pic-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={outside ? 3 : 2}
                  placeholder={outside ? tr("e.g. delivering stock to the warehouse next to the outlet") : tr("e.g. the purpose of the visit")}
                  aria-invalid={reasonMissing || undefined}
                  className={cx(inputClass, "mt-2 py-2", reasonMissing && "border-red-300 focus:border-red-500 focus:ring-red-500/20")} />
              </section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <section className="hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:block">
                <p className="text-sm font-semibold text-slate-900">{tr("Summary")}</p>
                <dl className="mt-3 divide-y divide-slate-100 text-sm">
                  <Row k={tr("Outlet")} v={b?.name ?? "—"} />
                  <Row k={tr("Location")} v={<span className={TONE[status.tone]}>{status.text}{where?.distance != null ? ` · ${where.distance} m` : ""}</span>} />
                  <Row k={tr("Face photo")} v={faceOk ? tr("Face detected") : "—"} />
                  <Row k={tr("Visit time")} v={tr("Server time when sent")} />
                </dl>
                <Button loading={sending} disabled={!ready} onClick={() => void send()} className="mt-4 w-full"><Send size={15} /> {tr("Send check in")}</Button>
                {!ready && <p className={cx("mt-2 text-center text-xs", reasonMissing ? "text-red-600" : "text-slate-400")}>{pending}</p>}
              </section>

              <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 sm:px-5">{tr("My latest check-ins")}</p>
                {data.recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{tr("No check in yet")}</p> : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                        <img src={photoUrl(r.id)} alt="" loading="lazy" className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-100 object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{r.branchName}</p>
                          <p className="text-xs text-slate-500">{wibDateTime(r.visitedAt)}</p>
                        </div>
                        {r.outsideRadius ? <Badge tone="amber">{tr("Outside radius")}</Badge> : r.distanceM !== null ? <span className="text-xs tabular-nums text-slate-500">{r.distanceM} m</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>

      {/* phones & tablets: what is ready and the send button, at the bottom */}
      {data.branches.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-slate-200 bg-white px-4 pt-3 sm:-mx-6 sm:-mb-6 sm:px-6 lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <p className="mb-2 truncate text-xs text-slate-500">
            {ready ? `${b?.name} · ${status.text}${where?.distance != null ? ` · ${where.distance} m` : ""}` : pending}
          </p>
          <Button loading={sending} disabled={!ready} onClick={() => void send()} className="w-full"><Send size={15} /> {tr("Send check in")}</Button>
        </div>
      )}

      {camera && b && (
        <SelfieCamera pic={data.user.name} branch={b.name} position={position} onClose={() => setCamera(false)} onShot={(s) => void takePhoto(s)} />
      )}
    </Page>
  );
}

function Card({ n, ok, active, title, hint, action, children }: {
  n: number; ok: boolean; active: boolean; title: string; hint: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <span className={cx("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          ok ? "bg-emerald-500 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500")}>
          {ok ? <Check size={13} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs leading-snug text-slate-500">{hint}</p>
        </div>
        {action}
      </header>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-2.5 py-2 sm:px-3">
      <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="flex-shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}

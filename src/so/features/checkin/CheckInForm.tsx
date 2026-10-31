"use client";

// PIC Check In (Form → Visit, page form.pic-check-in): the PIC checks in at the outlet he visits — his account, the
// branch (picked when he has several), the time of the visit (server time when sent), a front-camera face photo
// stamped with the time and the branch (the server refuses a photo without a face) and the GPS position compared with
// the outlet's coordinates (Cost Control → Lokasi Outlet). Management follows them in Monitoring → PIC Check In.
// Same look as the other portal pages: page header (live WIB clock), a white band with the PIC and the steps, step
// cards, a summary with the send button (right column on desktop, a bar at the bottom on phones).
// Outside the outlet's radius: a red alert and a required reason (the server refuses without one). The GPS readings
// while the form is open and the device signals go with the check-in (fake GPS detection on the server).
// One check in per branch per day: a branch already checked in today is locked until tomorrow. After sending, a full
// screen confirmation (phones / PWA), then the form is back to its start. "My latest check-ins" open in a drawer with the
// photo, the position and the management's review (valid / not valid with its note) from Monitoring → PIC Check In.

import { AlertTriangle, Camera, Check, CheckCircle2, ChevronRight, Clock, Crosshair, ExternalLink, Loader2, MapPin, MapPinOff, MessageSquareText, RotateCcw, Send,
  ShieldCheck, ShieldX, XCircle } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { type Fix, locate, mapsUrl } from "@/so/lib/counts";
import { TZ, wibDateTime } from "@/so/lib/wib";
import SelfieCamera, { type Selfie } from "@/so/features/checkin/SelfieCamera";
import { type CheckIn, type FormData, call, deviceSignals, judge, photoUrl, useGpsTrail } from "@/so/features/checkin/checkin";
import { type Kind, kindSlug, setKind, swapKind } from "@/so/features/checkin/checkin";
import { locale, tr as baseTr } from "@/lib/i18n";
import LiveClock from "@/so/ui/LiveClock";
import { useFocusMode } from "@/components/layout/BottomNav";
const tr = (key: string, ...args: (string | number | null | undefined)[]) => baseTr(swapKind(key), ...args);

const FRESH_MS = 3 * 60_000; // a position older than this is taken again when sending

type Tone = "ok" | "warn" | "muted";
const TONE: Record<Tone, string> = { ok: "text-emerald-700", warn: "text-amber-700", muted: "text-slate-500" };
const DOT: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", muted: "bg-slate-300" };

export default function CheckInForm({ kind = "pic" }: { kind?: Kind }) {
  setKind(kind);
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
  const [view, setView] = useState<CheckIn | null>(null);
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
      const d = await call<FormData>(`/api/forms/${kindSlug()}`);
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
  const doneToday = b ? data?.today?.[b.code] : undefined;
  const allDone = !!data && data.branches.length > 0 && data.branches.every((x) => data.today?.[x.code]);
  const where = useMemo(() => (fix ? judge(fix.lat, fix.lng, fix.accuracy, b) : null), [fix, b]);
  const position = fix ? `${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)} ±${Math.round(fix.accuracy)} m` : "";
  const faceOk = (faces ?? 0) > 0 && !checking;
  const outside = !!where?.outside;
  const reasonMissing = outside && !note.trim();
  const ready = !!b && !doneToday && !!fix && !!photo && faceOk && !reasonMissing;
  const pending = doneToday ? tr("Already checked in here today; the next one tomorrow.") : reasonMissing && b && fix && photo && faceOk ? tr("Outside the radius: write the reason first.") : tr("Complete the outlet, the location and the face photo.");

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
      setFaces((await call<{ faces: number }>(`/api/forms/${kindSlug()}/face-check`, { method: "POST", json: { photo: s.image } })).faces);
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
      const out = await call<{ id: string }>(`/api/forms/${kindSlug()}`, { method: "POST", json: {
        branchCode: b.code, photo: photo.image, latitude: f.lat, longitude: f.lng, accuracyM: f.accuracy, locatedAt: f.at,
        deviceTime: photo.takenAt, note: note.trim() || null, sentAt: new Date().toISOString(),
        samples: trail.current.slice(-30), ...deviceSignals() } });
      const d = await call<FormData>(`/api/forms/${kindSlug()}`);
      setData(d);
      setDone(d.recent.find((r) => r.id === out.id) ?? null);
      setPhoto(null);
      setFaces(null);
      setNote("");
      if (d.branches.length > 1) setBranch("");
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
        {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div>
          : <div className="mx-auto max-w-5xl space-y-4"><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-72 rounded-xl" /></div>}
      </Page>
    );
  }

  return (
    <Page title={tr("PIC Check In")} subtitle={subtitle} actions={clock}
      stats={
        <div className="mx-auto max-w-5xl rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
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
        {Object.keys(data.today ?? {}).length > 0 && (
          <section className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", allDone ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700")}>
            <CheckCircle2 size={18} className={cx("mt-0.5 flex-shrink-0", allDone ? "text-emerald-600" : "text-emerald-500")} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{allDone ? tr("You have checked in today") : tr("Checked in today")}</p>
              <p className="text-xs opacity-90">{data.branches.filter((x) => data.today?.[x.code]).map((x) => `${x.name} · ${wibTime(data.today[x.code].visitedAt)}`).join(" · ")}</p>
              {allDone && <p className="mt-0.5 text-xs opacity-90">{tr("One check in per outlet per day: the next one can be done tomorrow.")}</p>}
            </div>
          </section>
        )}

        {data.branches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center text-sm text-slate-500">
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
                    {data.branches.map((x) => <option key={x.code} value={x.code} disabled={!!data.today?.[x.code]}>{x.name}{data.today?.[x.code] ? ` · ${tr("checked in today")}` : ""}</option>)}
                  </select>
                )}
                {doneToday && (
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                    <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                    <span>{tr("Already checked in here today at {0}. The next check in can be done tomorrow.", wibTime(doneToday.visitedAt))}</span>
                  </p>
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
                    <Button disabled={!b || !fix || !!doneToday} onClick={() => setCamera(true)} className="w-full sm:w-auto"><Camera size={15} /> {tr("Take face photo")}</Button>
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
              <section className="hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm lg:block">
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

              <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 sm:px-5">{tr("My latest check-ins")}</p>
                {data.recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{tr("No check in yet")}</p> : (
                  <ul className="divide-y divide-slate-100">
                    {data.recent.map((r) => (
                      <li key={r.id}>
                        <button type="button" onClick={() => setView(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 sm:px-5">
                          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                          <img src={photoUrl(r.id)} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-100 object-cover ring-1 ring-slate-200" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">{r.branchName}</span>
                            <span className="block text-xs text-slate-500">{wibDateTime(r.visitedAt)}</span>
                            <span className="mt-1 flex flex-wrap gap-1"><ReviewBadge c={r} /></span>
                          </span>
                          <ChevronRight size={16} className="flex-shrink-0 text-slate-300" />
                        </button>
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
        <div className="action-bar sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-slate-200/70 bg-white/95 px-4 backdrop-blur pt-3 sm:-mx-6 sm:-mb-6 sm:px-6 lg:hidden"
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
      {done && <SuccessScreen c={done} onClose={() => { setDone(null); window.scrollTo({ top: 0 }); }} onDetail={() => { setView(done); setDone(null); }} />}
      {view && <CheckInDrawer c={view} onClose={() => setView(null)} />}
    </Page>
  );
}

const wibTime = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** Valid / not valid by management, waiting for its review (outside the radius), or at the outlet. */
function ReviewBadge({ c }: { c: CheckIn }) {
  if (c.review?.status === "valid") return <Badge tone="green" icon={<ShieldCheck size={11} />}>{tr("Valid · reviewed")}</Badge>;
  if (c.review?.status === "invalid") return <Badge tone="red" icon={<ShieldX size={11} />}>{tr("Not valid · reviewed")}</Badge>;
  if (c.outsideRadius) return <Badge tone="amber">{tr("Outside radius · waiting for review")}</Badge>;
  return <Badge tone="slate">{c.distanceM !== null ? tr("At the outlet · {0} m", c.distanceM) : tr("Outlet has no coordinates")}</Badge>;
}

/** Full screen after sending (phones / PWA; a centred card on a desktop), then back to the form. */
function SuccessScreen({ c, onClose, onDetail }: { c: CheckIn; onClose: () => void; onDetail: () => void }) {
  // on the body: above the app frame (a transformed ancestor would clip a fixed layer)
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={tr("Check in sent")}>
      <div className="flex w-full flex-col overflow-y-auto bg-white sm:max-h-[92vh] sm:max-w-md sm:rounded-2xl sm:shadow-2xl">
        <div className={cx("flex flex-1 flex-col items-center justify-center px-6 pb-6 pt-10 text-center", c.outsideRadius ? "bg-gradient-to-b from-amber-50 to-white" : "bg-gradient-to-b from-emerald-50 to-white", "sm:rounded-t-2xl")}>
          <span className={cx("flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg", c.outsideRadius ? "bg-amber-500 shadow-amber-200" : "bg-emerald-500 shadow-emerald-200")}>
            {c.outsideRadius ? <AlertTriangle size={38} /> : <Check size={42} strokeWidth={3} />}
          </span>
          <h2 className="mt-5 text-2xl font-semibold text-slate-900">{tr("Check in successful")}</h2>
          <p className="mt-1 text-sm text-slate-600">{c.branchName}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
          <img src={photoUrl(c.id)} alt={tr("Face photo")} className="mt-6 h-36 w-28 rounded-2xl object-cover shadow-md ring-4 ring-white" />
          <dl className="mt-6 grid w-full grid-cols-2 divide-x divide-slate-100 rounded-2xl border border-slate-200/80 bg-white text-left">
            <div className="px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Time")}</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Clock size={13} className="text-slate-400" />{wibTime(c.visitedAt)} WIB</dd></div>
            <div className="px-3 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Location")}</dt>
              <dd className={cx("mt-0.5 flex items-center gap-1.5 text-sm font-semibold", c.outsideRadius ? "text-amber-700" : "text-slate-900")}><MapPin size={13} className="text-slate-400" />
                {c.distanceM !== null ? tr("{0} m from the outlet", c.distanceM) : tr("No coordinates")}</dd></div>
          </dl>
          {c.outsideRadius && <p className="mt-3 text-xs text-amber-800">{tr("Outside the radius: management reviews this check in. You can follow it under My latest check-ins.")}</p>}
          <p className="mt-3 text-xs text-slate-500">{tr("One check in per outlet per day: the next one for this outlet is tomorrow.")}</p>
        </div>
        <div className="space-y-2 border-t border-slate-100 px-6 pt-4 sm:rounded-b-2xl" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <Button className="h-12 w-full text-base" onClick={onClose}>{tr("Done")}</Button>
          <button type="button" onClick={onDetail} className="w-full py-1 text-sm font-medium text-slate-500 hover:text-slate-800">{tr("See the details")}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** One of the PIC's check-ins: the photo, the time, the position and the management's review. */
function CheckInDrawer({ c, onClose }: { c: CheckIn; onClose: () => void }) {
  return (
    <Drawer open onClose={onClose} size="md" icon={<CheckCircle2 size={18} />} title={c.branchName} description={wibDateTime(c.visitedAt)} focusFirstField={false}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <a href={photoUrl(c.id)} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
            <img src={photoUrl(c.id)} alt={tr("Face photo")} className="aspect-[3/4] w-full rounded-xl bg-slate-100 object-cover ring-1 ring-slate-200" />
          </a>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            <Row k={tr("Outlet")} v={c.branchName} />
            <Row k={tr("Visit time")} v={wibDateTime(c.visitedAt)} />
            <Row k={tr("Distance")} v={<span className={c.outsideRadius ? "text-amber-700" : undefined}>{c.distanceM !== null ? `${c.distanceM} m` : "—"}{c.radiusM != null ? ` / ${tr("radius {0} m", c.radiusM)}` : ""}</span>} />
            <Row k={tr("Accuracy")} v={c.accuracyM != null ? `±${Math.round(c.accuracyM)} m` : "—"} />
            <Row k={tr("Position")} v={<a href={mapsUrl(c.latitude, c.longitude)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">{tr("Open map")} <ExternalLink size={11} /></a>} />
          </dl>
        </div>
        {c.note && <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700"><MessageSquareText size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{c.note}</p>}
        <section className={cx("rounded-xl border px-4 py-3",
          c.review?.status === "valid" ? "border-emerald-200 bg-emerald-50" : c.review?.status === "invalid" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tr("Management review")}</p>
          {c.review ? (
            <>
              <p className={cx("mt-1 flex items-center gap-1.5 text-sm font-semibold", c.review.status === "valid" ? "text-emerald-800" : "text-red-800")}>
                {c.review.status === "valid" ? <ShieldCheck size={16} /> : <ShieldX size={16} />}{c.review.status === "valid" ? tr("Valid") : tr("Not valid")}</p>
              {c.review.note && <p className="mt-1 text-sm text-slate-700">{c.review.note}</p>}
              <p className="mt-1 text-xs text-slate-500">{[c.review.by, c.review.at ? wibDateTime(c.review.at) : null].filter(Boolean).join(" · ")}</p>
            </>
          ) : <p className="mt-1 text-sm text-slate-600">{c.outsideRadius ? tr("Waiting for the review of management (outside the radius).") : tr("No review needed: checked in at the outlet.")}</p>}
        </section>
      </div>
    </Drawer>
  );
}

function Card({ n, ok, active, title, hint, action, children }: {
  n: number; ok: boolean; active: boolean; title: string; hint: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
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
    <div className="flex items-start justify-between gap-3 px-3 py-2 first:pt-2.5 last:pb-2.5">
      <dt className="flex-shrink-0 text-slate-500">{k}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}

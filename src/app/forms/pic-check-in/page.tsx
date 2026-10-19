"use client";

// PIC Check In (Form → Visit, page form.pic-check-in): the PIC checks in at the outlet he visits — his account, the
// branch (picked when he has several), the time of the visit (server time when sent), a front-camera face photo
// stamped with the time and the branch (the server refuses a photo without a face) and the GPS position compared with
// the outlet's coordinates (Cost Control → Lokasi Outlet). Management follows them in Monitoring → PIC Check In.
// Layout: identity & live clock on top, the three things to do as cards, a summary with the send button (sticky on
// desktop, a bar at the bottom on phones) and the PIC's latest check-ins.

import { Camera, Check, CheckCircle2, ChevronRight, Crosshair, ExternalLink, Loader2, MapPin, MapPinOff, RotateCcw, ScanFace, Send, SignalLow, Store, X, XCircle } from "lucide-react";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, useToast } from "@/so/ui";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth";
import { type Fix, locate, mapsUrl } from "@/so/lib/counts";
import { TZ, TZ_LABEL, wibDateTime } from "@/so/lib/wib";
import SelfieCamera, { type Selfie } from "@/so/features/checkin/SelfieCamera";
import { type CheckIn, type FormData, call, judge, photoUrl } from "@/so/features/checkin/checkin";
import { locale, tr } from "@/lib/i18n";

const FRESH_MS = 3 * 60_000; // a position older than this is taken again when sending

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
        deviceTime: photo.takenAt, note: note.trim() || null } });
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

  const ready = !!b && !!fix && !!photo && faceOk;
  const todo = [
    { label: tr("Outlet visited"), ok: !!b },
    { label: tr("Location"), ok: !!fix },
    { label: tr("Face photo"), ok: faceOk },
  ];

  if (error) return <Shell><div className="rounded-2xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={load} /></div></Shell>;
  if (!data) return <Shell><div className="space-y-4"><div className="skeleton h-32 rounded-2xl" /><div className="skeleton h-80 rounded-2xl" /></div></Shell>;

  return (
    <Shell>
      {/* identity & live clock */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5 sm:px-6">
          <UserAvatar name={data.user.name} src={me?.avatarUrl} size="lg" className="ring-2 ring-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-200">{tr("PIC Check In")}</p>
            <p className="truncate text-lg font-semibold">{data.user.name}</p>
            <p className="truncate text-xs text-slate-300">@{data.user.username} · {tr("from your account")}</p>
          </div>
          {now && (
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                {now.toLocaleTimeString(locale(), { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                <span className="ml-1.5 align-top text-xs font-medium text-blue-200">{TZ_LABEL}</span>
              </p>
              <p className="text-xs text-slate-300">{now.toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 border-t border-white/10 text-xs">
          {todo.map((t, i) => (
            <div key={t.label} className={cx("flex items-center gap-2 px-4 py-2.5 sm:px-6", i > 0 && "border-l border-white/10")}>
              <span className={cx("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                t.ok ? "bg-emerald-400 text-slate-900" : "bg-white/15 text-white")}>{t.ok ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              <span className={cx("truncate", t.ok ? "text-white" : "text-slate-300")}>{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {done && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check size={18} strokeWidth={3} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{tr("Checked in at {0}", done.branchName)}</p>
            <p className="text-xs text-emerald-800">{wibDateTime(done.visitedAt)} · {done.distanceM !== null ? tr("{0} m from the outlet", done.distanceM) : tr("Outlet has no coordinates")}{done.outsideRadius ? ` · ${tr("Outside radius")}` : ""}</p>
          </div>
          <button type="button" onClick={() => setDone(null)} className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100" aria-label={tr("Close")}><X size={16} /></button>
        </div>
      )}

      {data.branches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          {tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
            {/* 1. outlet */}
            <Card n={1} icon={<Store size={17} />} title={tr("Outlet visited")} hint={tr("The outlet where you are now")} ok={!!b}>
              {data.branches.length === 1 ? (
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <Store size={16} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-900">{data.branches[0].name}</span>
                </div>
              ) : (
                <div className="relative">
                  <select value={branch} onChange={(e) => { setBranch(e.target.value); setPhoto(null); setFaces(null); }}
                    className={cx(inputClass, "h-12 appearance-none pr-10 text-[15px]")} aria-label={tr("Outlet visited")}>
                    <option value="">{tr("Choose the outlet you are visiting")}</option>
                    {data.branches.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                  </select>
                  <ChevronRight size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-slate-400" />
                </div>
              )}
            </Card>

            {/* 2. location */}
            <Card n={2} icon={<MapPin size={17} />} title={tr("Location")} hint={tr("Compared with the outlet's coordinates")} ok={!!fix}
              action={fix && <button type="button" disabled={locating} onClick={() => void findMe()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />} {tr("Update location")}</button>}>
              {locating && !fix ? (
                <div className="flex items-center gap-3 rounded-xl bg-blue-50/60 px-4 py-4 text-sm text-blue-900">
                  <span className="relative flex h-8 w-8 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-blue-200" /><Crosshair size={18} className="relative text-blue-700" /></span>
                  {tr("Finding your location…")}
                </div>
              ) : fix ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <Metric label={tr("Status")}>
                    {!b ? <span className="text-sm text-slate-500">{tr("Choose the outlet")}</span>
                      : !where?.located ? <Badge tone="slate" icon={<MapPinOff size={11} />}>{tr("Outlet has no coordinates")}</Badge>
                      : where.outside ? <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>
                      : <Badge tone="green" icon={<CheckCircle2 size={11} />}>{tr("At the outlet")}</Badge>}
                  </Metric>
                  <Metric label={tr("Distance")}>
                    <span className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">{where?.distance != null ? `${where.distance} m` : "—"}</span>
                    {b?.radius_m != null && where?.located && <span className="ml-1 text-xs text-slate-400">/ {b.radius_m} m</span>}
                  </Metric>
                  <Metric label={tr("GPS accuracy")}>
                    <span className="text-base font-semibold tabular-nums text-slate-900 sm:text-lg">±{Math.round(fix.accuracy)} m</span>
                    {fix.accuracy > 100 && <span className="ml-1 inline-flex align-middle"><Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low")}</Badge></span>}
                  </Metric>
                  <a href={mapsUrl(fix.lat, fix.lng)} target="_blank" rel="noreferrer"
                    className="col-span-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-700">
                    <MapPin size={12} /> {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} <ExternalLink size={11} />
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl bg-red-50 px-4 py-4 text-sm text-red-900 sm:flex-row sm:items-center">
                  <MapPinOff size={20} className="flex-shrink-0 text-red-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{locError}</p>
                    <p className="text-xs">{tr("Turn on Location (GPS) and allow it for this site (padlock in the address bar), then try again.")}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void findMe()}><RotateCcw size={13} /> {tr("Try again")}</Button>
                </div>
              )}
            </Card>

            {/* 3. face photo */}
            <Card n={3} icon={<ScanFace size={17} />} title={tr("Face photo")} hint={tr("Front camera; the time, the outlet and the location are printed on the photo")} ok={faceOk}>
              {photo ? (
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the photo just taken (data URL) */}
                  <img src={photo.image} alt={tr("Face photo")} className="w-full self-start rounded-xl bg-slate-100 object-contain sm:w-72" />
                  <div className="flex flex-1 flex-col justify-between gap-3">
                    {checking ? (
                      <p className="inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={15} className="animate-spin" /> {tr("Checking the face…")}</p>
                    ) : faceOk ? (
                      <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                        <p className="inline-flex items-center gap-1.5 font-semibold"><CheckCircle2 size={15} /> {tr("Face detected")}</p>
                        <p className="mt-0.5 text-xs">{tr("Taken at {0}", wibDateTime(photo.takenAt))}</p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-800">
                        <p className="inline-flex items-start gap-1.5 font-semibold"><XCircle size={15} className="mt-0.5 flex-shrink-0" /> {tr("No face detected")}</p>
                        <p className="mt-0.5 text-xs">{tr("Retake the photo with your face clearly visible, facing the camera, in good light.")}</p>
                      </div>
                    )}
                    <Button variant="secondary" size="sm" className="self-start" onClick={() => setCamera(true)}><RotateCcw size={13} /> {tr("Retake")}</Button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={!b || !fix} onClick={() => setCamera(true)}
                  className="group flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-transparent">
                  <span className={cx("flex h-14 w-14 items-center justify-center rounded-full", b && fix ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}><Camera size={24} /></span>
                  <span className="text-sm font-semibold text-slate-900">{tr("Take face photo")}</span>
                  <span className="text-xs text-slate-500">{b && fix ? tr("Your face must be clearly visible; it is checked automatically") : tr("Choose the outlet and wait for the location first.")}</span>
                </button>
              )}
            </Card>

            {/* note */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="pic-note">{tr("Note (optional)")}</label>
              <textarea id="pic-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
                placeholder={tr("e.g. the purpose of the visit")} className={cx(inputClass, "py-2")} />
            </div>
          </div>

          {/* summary & send */}
          <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 lg:block">
              <p className="text-sm font-semibold text-slate-900">{tr("Summary")}</p>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Row k={tr("Outlet")} v={b?.name ?? "—"} />
                <Row k={tr("Distance")} v={where?.distance != null ? `${where.distance} m` : "—"} />
                <Row k={tr("Face photo")} v={faceOk ? tr("Face detected") : "—"} />
                <Row k={tr("Visit time")} v={tr("Server time when sent")} />
              </dl>
              <Button loading={sending} disabled={!ready} onClick={() => void send()} className="mt-4 w-full"><Send size={15} /> {tr("Send check in")}</Button>
              {!ready && <p className="mt-2 text-center text-xs text-slate-400">{tr("Complete the outlet, the location and the face photo.")}</p>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">{tr("My latest check-ins")}</p>
              {data.recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{tr("No check in yet")}</p> : (
                <ul className="divide-y divide-slate-100">
                  {data.recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- served by the API with the session */}
                      <img src={photoUrl(r.id)} alt="" loading="lazy" className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-100 object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{r.branchName}</p>
                        <p className="text-xs text-slate-500">{wibDateTime(r.visitedAt)}</p>
                      </div>
                      {r.outsideRadius ? <Badge tone="amber">{tr("Outside radius")}</Badge> : r.distanceM !== null ? <span className="text-xs tabular-nums text-slate-500">{r.distanceM} m</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* phones: the send button stays at the bottom */}
      {data.branches.length > 0 && (
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <Button loading={sending} disabled={!ready} onClick={() => void send()} className="w-full"><Send size={15} /> {tr("Send check in")}</Button>
        </div>
      )}

      {camera && b && (
        <SelfieCamera pic={data.user.name} branch={b.name} position={position} onClose={() => setCamera(false)} onShot={(s) => void takePhoto(s)} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-slate-50"><div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">{children}</div></div>;
}

function Card({ n, icon, title, hint, ok, action, children }: {
  n: number; icon: ReactNode; title: string; hint: string; ok: boolean; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className={cx("rounded-2xl border bg-white transition-colors", ok ? "border-emerald-200" : "border-slate-200")}>
      <header className="flex items-center gap-3 px-4 pt-4 sm:px-5">
        <span className={cx("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}
          aria-label={tr("Step {0}", n)}>{ok ? <Check size={17} strokeWidth={3} /> : icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="truncate text-xs text-slate-500">{hint}</p>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-[11px]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}

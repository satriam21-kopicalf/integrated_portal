"use client";

// Form → Monitoring Product / Monitoring Outlet (pages form.product, form.outlet; workbook "Form Visit"). The PIC is the
// signed-in account; one visit per outlet (a PIC with several branches picks one, then the next). The visit is a draft
// saved as it is filled (it can be continued later), then submitted with the position. Each item: UNDER / MEET /
// EXCEED, a note and up to 3 camera photos stamped with the time, the branch and the position. UNDER needs a note and a
// photo (user decision 2026-10-20). Mobile first: one item per row, the progress stays on top, send at the bottom.

import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, ChevronRight, ClipboardList, CloudUpload, MapPin, MessageSquareText, Play, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import UserAvatar from "@/components/UserAvatar";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { locate } from "@/so/lib/counts";
import { TZ, wibDateTime } from "@/so/lib/wib";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import LiveClock from "@/so/ui/LiveClock";
import { type Answer, type FormState, type Item, type Rating, type Visit, type VisitFormKey, type VisitPhoto, RATINGS, RATING_STYLE,
  allItems, missingOf, ratingLabel, scoreTone, visitPhotoUrl } from "./visit";

const MAX_PHOTOS = 3;

export default function VisitForm({ form }: { form: VisitFormKey }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [visit, setVisit] = useState<Visit | null>(null);
  const [opening, setOpening] = useState(false);
  const [done, setDone] = useState<Visit | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const base = `/api/forms/${form}`;

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await call<FormState>(base);
      setData(d);
      setBranch((b) => b || (d.branches.length === 1 ? d.branches[0].code : ""));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base]);
  useEffect(() => { void load(); }, [load]);

  const open = async (code: string) => {
    setOpening(true);
    try {
      setVisit(await call<Visit>(`${base}/visits`, { method: "POST", json: { branchCode: code } }));
      setDone(null);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOpening(false);
    }
  };

  const title = data?.definition.title ?? (form === "product" ? "Monitoring Product" : "Monitoring Outlet");
  const clock = <LiveClock />;
  const subtitle = now ? now.toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

  if (visit && data) {
    return <VisitEditor form={form} data={data} visit={visit}
      onClose={() => { setVisit(null); void load(); }}
      onSubmitted={(v) => { setVisit(null); setDone(v); void load(); window.scrollTo({ top: 0 }); }} />;
  }

  const draftOf = (code: string) => data?.drafts.find((d) => d.branchCode === code);
  return (
    <Page title={title} subtitle={subtitle} actions={clock}>
      {error ? <div className="rounded-xl border border-slate-200 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-40 rounded-xl" /><div className="skeleton h-56 rounded-xl" /></div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {done && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{tr("{0} sent for {1}", title, done.branchName)}</p>
                <p className="text-xs">{wibDateTime(done.submittedAt)} · {done.counts.under} UNDER · {done.counts.meet} MEET · {done.counts.exceed} EXCEED · {tr("score {0}%", done.score ?? "—")}</p>
              </div>
              <button type="button" onClick={() => setDone(null)} className="rounded-md p-1 opacity-70 hover:bg-white/60" aria-label={tr("Close")}><X size={16} /></button>
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <UserAvatar name={data.user.name} src={me?.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{data.user.name}</p>
                <p className="truncate text-xs text-slate-500">@{data.user.username} · {tr("PIC of the visit")}</p>
              </div>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-sm font-semibold text-slate-900">{tr("Outlet visited")}</p>
              {data.branches.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">{tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}</p>
              ) : data.branches.length === 1 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900">{data.branches[0].name}</p>
              ) : (
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className={cx(inputClass, "h-11")} aria-label={tr("Outlet visited")}>
                  <option value="">{tr("Choose the outlet you are visiting")}</option>
                  {data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}{draftOf(b.code) ? ` · ${tr("draft")}` : ""}</option>)}
                </select>
              )}
              <p className="text-xs text-slate-500">{tr("Time of the visit = server time when sent. One visit per outlet; with several outlets, fill them one after the other.")}</p>
              <Button className="w-full sm:w-auto" disabled={!branch} loading={opening} onClick={() => void open(branch)}>
                <Play size={15} /> {branch && draftOf(branch) ? tr("Continue the draft") : tr("Start the visit")}
              </Button>
            </div>
          </section>

          {data.drafts.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-white shadow-sm">
              <p className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 text-sm font-semibold text-amber-900 sm:px-5">{tr("Drafts saved ({0})", data.drafts.length)}</p>
              <ul className="divide-y divide-slate-100">
                {data.drafts.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => void open(d.branchCode)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:px-5">
                      <ClipboardList size={18} className="flex-shrink-0 text-amber-600" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{d.branchName}</span>
                        <span className="block text-xs text-slate-500">{tr("{0} of {1} rated", d.counts.rated, d.counts.total)} · {tr("saved {0}", wibDateTime(d.updatedAt))}</span>
                      </span>
                      <ChevronRight size={16} className="text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 sm:px-5">{tr("My latest visits")}</p>
            {data.recent.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-400">{tr("No visit sent yet")}</p> : (
              <ul className="divide-y divide-slate-100">
                {data.recent.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{v.branchName}</span>
                      <span className="block text-xs text-slate-500">{wibDateTime(v.submittedAt)}</span>
                    </span>
                    <span className="text-right text-xs">
                      <span className={cx("block text-sm font-semibold tabular-nums", scoreTone(v.score))}>{v.score ?? "—"}%</span>
                      <span className="text-slate-400">{v.counts.under} UNDER</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

// ------------------------------------------------------------------------------------------------- the visit

function VisitEditor({ form, data, visit, onClose, onSubmitted }: {
  form: VisitFormKey; data: FormState; visit: Visit; onClose: () => void; onSubmitted: (v: Visit) => void;
}) {
  const toast = useToast();
  const def = data.definition;
  const base = `/api/forms/${form}/visits/${visit.id}`;
  const [answers, setAnswers] = useState<Record<string, Answer>>(visit.answers ?? {});
  const [photos, setPhotos] = useState<VisitPhoto[]>(visit.photos ?? []);
  const [group, setGroup] = useState(def.groups[0].key);
  const [saving, setSaving] = useState(0);
  const [camera, setCamera] = useState<Item | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const pending = useRef<Record<string, Answer>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setSaving((n) => n + 1);
    try {
      await call(base, { method: "PATCH", json: { answers: patch } });
    } catch (e) {
      toast((e as Error).message, "error");
      pending.current = { ...patch, ...pending.current };
    } finally {
      setSaving((n) => n - 1);
    }
  }, [base, toast]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); void flush(); }, [flush]);

  const change = (key: string, value: Answer, now = false) => {
    setAnswers((a) => ({ ...a, [key]: { ...(a[key] ?? {}), ...value } }));
    pending.current[key] = { ...(pending.current[key] ?? {}), ...value };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), now ? 50 : 700);
  };

  const items = useMemo(() => allItems(def), [def]);
  const rated = items.filter((i) => i.kind === "rating");
  const counts = useMemo(() => {
    const c = { UNDER: 0, MEET: 0, EXCEED: 0 } as Record<Rating, number>;
    rated.forEach((i) => { const r = answers[i.key]?.rating; if (r) c[r] += 1; });
    return c;
  }, [answers, rated]);
  const done = counts.UNDER + counts.MEET + counts.EXCEED;
  const missing = useMemo(() => missingOf(def, answers, photos), [def, answers, photos]);
  const pct = rated.length ? Math.round((done / rated.length) * 100) : 0;
  const groupDone = (key: string) => {
    const g = rated.filter((i) => i.group === key);
    return [g.filter((i) => answers[i.key]?.rating).length, g.length];
  };
  const current = def.groups.find((g) => g.key === group)!;
  const gi = def.groups.findIndex((g) => g.key === group);

  const upload = async (item: Item, shot: Shot) => {
    try {
      const r = await call<{ photos: VisitPhoto[] }>(`${base}/photos`, { method: "POST",
        json: { item: item.key, photo: shot.image, latitude: shot.lat, longitude: shot.lng, takenAt: shot.taken_at } });
      setPhotos(r.photos);
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };
  const removePhoto = async (id: string) => {
    try {
      setPhotos((await call<{ photos: VisitPhoto[] }>(`${base}/photos/${id}`, { method: "DELETE" })).photos);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const submit = async () => {
    setSending(true);
    try {
      await flush();
      const pos = await locate(undefined, 50, 12_000);
      const v = await call<Visit>(`${base}/submit`, { method: "POST",
        json: { latitude: pos.fix?.lat ?? null, longitude: pos.fix?.lng ?? null, accuracyM: pos.fix?.accuracy ?? null } });
      toast(tr("Visit sent"));
      onSubmitted(v);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSending(false);
      setConfirm(false);
    }
  };
  const discard = async () => {
    try {
      await call(base, { method: "DELETE" });
      toast(tr("Draft deleted"));
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      {/* the visit: outlet, PIC, progress — stays on top */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start gap-2">
            <button type="button" onClick={() => { void flush(); onClose(); }} className="-ml-1.5 mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr("Back")}><ArrowLeft size={18} /></button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{def.title} · {visit.branchName}</h1>
              <p className="truncate text-xs text-slate-500">{visit.name} · {tr("started {0}", wibDateTime(visit.startedAt))}</p>
            </div>
            <span className="flex-shrink-0 pt-1 text-xs text-slate-400" aria-live="polite">
              {saving > 0 ? <span className="inline-flex items-center gap-1"><CloudUpload size={13} /> {tr("Saving…")}</span> : <span className="inline-flex items-center gap-1"><Check size={13} /> {tr("Saved")}</span>}
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              {RATINGS.map((r) => <span key={r} className={RATING_STYLE[r].bar} style={{ width: `${rated.length ? (counts[r] / rated.length) * 100 : 0}%` }} />)}
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-600">{done}/{rated.length}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium">
            {RATINGS.map((r) => <span key={r} className={cx("inline-flex items-center gap-1", RATING_STYLE[r].text)}><span className={cx("h-2 w-2 rounded-full", RATING_STYLE[r].dot)} />{ratingLabel(r)} {counts[r]}</span>)}
          </div>
          <div className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5 sm:-mx-6 sm:px-6">
            {def.groups.map((g) => {
              const [a, b] = groupDone(g.key);
              return (
                <button key={g.key} type="button" onClick={() => { setGroup(g.key); window.scrollTo({ top: 0 }); }} aria-pressed={group === g.key}
                  className={cx("inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
                    group === g.key ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")}>
                  {g.title}
                  <span className={cx("tabular-nums", a === b ? "text-emerald-600" : "text-slate-400")}>{a === b ? "✓" : `${a}/${b}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-3 py-4 sm:px-6">
        <div className="px-1">
          <p className="text-lg font-semibold text-slate-900">{current.title}</p>
          <p className="text-xs text-slate-500">{current.subtitle} · {tr("rate every item; UNDER needs a note and a photo")}</p>
        </div>
        {current.sections.map((s) => (
          <section key={s.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.title}</p>
            <ul className="divide-y divide-slate-100">
              {s.items.map((it) => (
                <ItemRow key={it.key} item={it} answer={answers[it.key] ?? {}} photos={photos.filter((p) => p.item === it.key)}
                  onAnswer={(v, now) => change(it.key, v, now)} onCamera={() => setCamera(it)} onRemovePhoto={(id) => void removePhoto(id)} />
              ))}
            </ul>
          </section>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <button type="button" onClick={() => setDiscarding(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600">
            <Trash2 size={13} /> {tr("Delete this draft")}
          </button>
          {gi < def.groups.length - 1 && (
            <Button variant="secondary" onClick={() => { setGroup(def.groups[gi + 1].key); window.scrollTo({ top: 0 }); }}>
              {def.groups[gi + 1].title} <ChevronRight size={15} />
            </Button>
          )}
        </div>
      </div>

      {/* send */}
      <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setShowMissing((v) => !v)} disabled={!missing.length}>
            <p className="text-sm font-semibold text-slate-900">{tr("{0} of {1} rated", done, rated.length)}</p>
            <p className={cx("truncate text-xs", missing.length ? "text-amber-700" : "text-emerald-700")}>
              {missing.length ? tr("{0} items to complete · see which", missing.length) : tr("Everything is complete")}
            </p>
          </button>
          <Button disabled={missing.length > 0 || saving > 0} onClick={() => setConfirm(true)}><Send size={15} /> {tr("Send")}</Button>
        </div>
        {showMissing && missing.length > 0 && (
          <ul className="mx-auto mt-2 max-h-48 max-w-4xl overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 text-xs">
            {missing.slice(0, 50).map((m) => (
              <li key={m.item.key}>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-amber-100"
                  onClick={() => { setGroup(m.item.group); setShowMissing(false); setTimeout(() => document.getElementById(`item-${m.item.key}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50); }}>
                  <AlertTriangle size={12} className="flex-shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1 truncate text-slate-800">{m.item.label}</span>
                  <span className="flex-shrink-0 text-amber-800">{m.need === "rating" ? tr("not rated") : tr("UNDER: note + photo")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {camera && (
        <CameraCapture open title={`${camera.no}. ${camera.label}`} branch={visit.branchName} countNumber={def.title}
          onClose={() => setCamera(null)} onShot={(s) => upload(camera, s)} />
      )}
      <ConfirmDialog open={confirm} busy={sending} onClose={() => setConfirm(false)} onConfirm={() => void submit()}
        title={tr("Send the visit?")} confirmLabel={tr("Send")}
        description={tr("{0} · {1} UNDER, {2} MEET, {3} EXCEED. After sending it cannot be changed; your location is recorded.", visit.branchName, counts.UNDER, counts.MEET, counts.EXCEED)} />
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} onConfirm={() => void discard()} danger
        title={tr("Delete this draft?")} confirmLabel={tr("Delete")} description={tr("Every rating, note and photo of this draft is removed.")} />
    </div>
  );
}

function ItemRow({ item, answer, photos, onAnswer, onCamera, onRemovePhoto }: {
  item: Item; answer: Answer; photos: VisitPhoto[]; onAnswer: (v: Answer, now?: boolean) => void; onCamera: () => void; onRemovePhoto: (id: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(!!answer.note);
  const under = answer.rating === "UNDER";
  const showNote = item.kind === "text" || noteOpen || under || !!answer.note;
  const needNote = under && !answer.note;
  const needPhoto = under && photos.length === 0;
  return (
    <li id={`item-${item.key}`} className={cx("px-4 py-3", under && "bg-red-50/40")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{item.no}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-slate-900">{item.label}</p>
          {item.kind === "rating" && (
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={item.label}>
              {RATINGS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={answer.rating === r} onClick={() => onAnswer({ rating: r }, true)}
                  className={cx("h-10 rounded-lg border text-xs font-bold tracking-wide transition-colors",
                    answer.rating === r ? RATING_STYLE[r].on : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>{r}</button>
              ))}
            </div>
          )}
          {showNote && (
            <textarea value={answer.note ?? ""} onChange={(e) => onAnswer({ note: e.target.value })} rows={2} maxLength={1000}
              placeholder={item.kind === "text" ? tr("Names, separated by commas") : under ? tr("What was found (required for UNDER)") : tr("Note")}
              aria-invalid={needNote || undefined}
              className={cx(inputClass, "mt-2 h-auto py-2 text-sm", needNote && "border-red-300")} />
          )}
          {(photos.length > 0 || item.kind === "rating") && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {photos.map((p) => (
                <span key={p.id} className="relative">
                  <a href={visitPhotoUrl(p.id)} target="_blank" rel="noreferrer" title={p.takenAt ? wibDateTime(p.takenAt) : undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
                    <img src={visitPhotoUrl(p.id)} alt={tr("Photo")} loading="lazy" className="h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200" />
                  </a>
                  {p.outsideRadius && <span className="absolute bottom-0.5 left-0.5 rounded bg-amber-500 p-0.5 text-white" title={tr("Taken outside the outlet radius")}><MapPin size={9} /></span>}
                  <button type="button" onClick={() => onRemovePhoto(p.id)} aria-label={tr("Remove photo")}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white shadow"><X size={11} /></button>
                </span>
              ))}
              {item.kind === "rating" && photos.length < MAX_PHOTOS && (
                <button type="button" onClick={onCamera}
                  className={cx("inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
                    needPhoto ? "border-red-300 bg-white text-red-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
                  <Camera size={14} /> {photos.length ? tr("Photo ({0}/{1})", photos.length, MAX_PHOTOS) : tr("Photo")}
                </button>
              )}
              {item.kind === "rating" && !showNote && (
                <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:border-slate-300">
                  <MessageSquareText size={14} /> {tr("Note")}
                </button>
              )}
              {(needNote || needPhoto) && <Badge tone="red">{needNote && needPhoto ? tr("Note & photo required") : needNote ? tr("Note required") : tr("Photo required")}</Badge>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}


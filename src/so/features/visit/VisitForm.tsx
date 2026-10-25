"use client";

// Form → Monitoring Product / Monitoring Outlet (pages form.product, form.outlet; workbook "Form Visit"). The PIC is the
// signed-in account; one visit per outlet (a PIC with several branches picks one, then the next). The visit is a draft
// saved as it is filled (it can be continued later), then submitted with the position. Each item: UNDER / MEET /
// EXCEED, a note and up to 3 camera photos stamped with the time, the branch and the position. Every rated item needs a
// note and a photo (material for the analysis, 2026-10-23); one visit per branch per day, the next one tomorrow. Was: UNDER needs a note and a
// photo (user decision 2026-10-20). Mobile first: one item per row, the progress stays on top, send at the bottom.

import { AlertTriangle, ArrowLeft, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, CloudUpload, ExternalLink, MapPin, MessageSquareText, PenLine, Send, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import Drawer from "@/so/ui/Drawer";
import SectionPicker from "@/so/ui/SectionPicker";
import SignaturePad from "@/so/features/count/SignaturePad";
import { useFocusMode } from "@/components/layout/BottomNav";
import UserAvatar from "@/components/UserAvatar";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { locate } from "@/so/lib/counts";
import { TZ, wibDateTime } from "@/so/lib/wib";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import LiveClock from "@/so/ui/LiveClock";
import { type Answer, type AutoStars, type FormState, type Item, type Rating, type Visit, type VisitFormKey, type VisitPhoto, PLATFORM_LABEL, RATINGS, RATING_STYLE,
  allItems, fmtStars, missingOf, ratingLabel, scoreTone, visitPhotoUrl } from "./visit";

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
      {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
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

          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
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
                  {data.branches.map((b) => <option key={b.code} value={b.code}>{b.name}{data.today?.[b.code] ? ` · ${tr("sent today")}` : draftOf(b.code) ? ` · ${tr("draft")}` : ""}</option>)}
                </select>
              )}
              <p className="text-xs text-slate-500">{tr("One visit per outlet per day (server time when sent); a day without a visit counts as a day off. With several outlets, fill them one after the other.")}</p>
              {branch && data.today?.[branch] && (
                <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                  <span>{tr("Already sent today for this outlet ({0}). The next one can be filled in tomorrow.", wibDateTime(data.today[branch].submittedAt))}</span>
                </p>
              )}
              <Button className="w-full sm:w-auto" disabled={!branch || !!data.today?.[branch]} loading={opening} onClick={() => void open(branch)}>
                {branch && draftOf(branch) ? tr("Continue the draft") : tr("Start")}
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

          <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
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
  // one category (section of the workbook) at a time: short screens on phones
  const parts = useMemo(() => def.groups.flatMap((g) => g.sections.map((s) => ({ ...s, group: g }))), [def]);
  const [section, setSection] = useState(parts[0].key);
  useFocusMode();
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
  const todo = useMemo(() => missingOf(def, answers, photos), [def, answers, photos]);
  // blocking: UNDER without a note or a photo; unrated items may stay (2026-10-21)
  const missing = todo.filter((m) => m.need === "evidence");
  const unrated = todo.length - missing.length;
  const pct = rated.length ? Math.round((done / rated.length) * 100) : 0;
  const sectionDone = (key: string) => {
    const s = rated.filter((i) => i.sectionKey === key);
    return [s.filter((i) => answers[i.key]?.rating).length, s.length];
  };
  const si = Math.max(0, parts.findIndex((p) => p.key === section));
  const current = parts[si];
  const go = (key: string) => { setSection(key); window.scrollTo({ top: 0 }); document.querySelector("main")?.scrollTo({ top: 0 }); };

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

  const submit = async (signature: string | null, signedName: string) => {
    setSending(true);
    try {
      await flush();
      const pos = await locate(undefined, 50, 12_000);
      const v = await call<Visit>(`${base}/submit`, { method: "POST",
        json: { latitude: pos.fix?.lat ?? null, longitude: pos.fix?.lng ?? null, accuracyM: pos.fix?.accuracy ?? null,
          signature, signedName: signature ? signedName : null } });
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
          <div className="mt-2.5">
            <SectionPicker title={tr("Category")} value={section} onChange={go}
              options={parts.map((p) => { const [a, b] = sectionDone(p.key); return { key: p.key, label: p.title, done: a, total: b, hint: p.group.title }; })} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-3 py-4 sm:px-6">
        <div className="px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">{current.group.title} · {current.group.subtitle}</p>
          <div className="mt-0.5 flex items-end justify-between gap-3">
            <p className="text-lg font-semibold leading-tight text-slate-900">{current.title}</p>
            <p className="flex-shrink-0 text-xs tabular-nums text-slate-500">{tr("{0} of {1} rated", sectionDone(current.key)[0], sectionDone(current.key)[1])}</p>
          </div>
        </div>
        <p className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-relaxed text-blue-900">
          <ClipboardCheck size={15} className="mt-px flex-shrink-0 text-blue-700" />
          <span><b>{tr("Photo and note are required for every item you rate")}</b> — {tr("they are the material for the analysis. Write what you see and take a clear photo of it.")}</span>
        </p>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {current.items.map((it) => (
              <ItemRow key={it.key} item={it} answer={answers[it.key] ?? {}} auto={visit.auto?.[it.key] ?? null} photos={photos.filter((p) => p.item === it.key)}
                onAnswer={(v, now) => change(it.key, v, now)} onCamera={() => setCamera(it)} onRemovePhoto={(id) => void removePhoto(id)} />
            ))}
          </ul>
        </section>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={si === 0} onClick={() => go(parts[si - 1].key)} className="justify-start">
            <ChevronLeft size={15} /> <span className="truncate">{si > 0 ? parts[si - 1].title : tr("Previous")}</span>
          </Button>
          <Button variant={si < parts.length - 1 ? "primary" : "secondary"} disabled={si >= parts.length - 1} onClick={() => go(parts[si + 1].key)} className="justify-end">
            <span className="truncate">{si < parts.length - 1 ? parts[si + 1].title : tr("Last category")}</span> <ChevronRight size={15} />
          </Button>
        </div>
        <div className="flex justify-center pt-1">
          <button type="button" onClick={() => setDiscarding(true)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600">
            <Trash2 size={13} /> {tr("Delete this draft")}
          </button>
        </div>
      </div>

      {/* send */}
      <div className="action-bar sticky bottom-0 z-30 border-t border-slate-200/70 bg-white/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setShowMissing((v) => !v)} disabled={!todo.length}>
            <p className="text-sm font-semibold text-slate-900">{tr("{0} of {1} rated", done, rated.length)}</p>
            <p className={cx("truncate text-xs", missing.length ? "text-red-600" : unrated ? "text-amber-700" : "text-emerald-700")}>
              {missing.length ? tr("{0} rated items need a note and a photo · see which", missing.length)
                : unrated ? tr("{0} not rated yet (can still be sent) · see which", unrated) : tr("Everything is complete")}
            </p>
          </button>
          <Button disabled={missing.length > 0 || done === 0 || saving > 0} onClick={() => setConfirm(true)}><ClipboardCheck size={15} /> {tr("Review & send")}</Button>
        </div>
        {showMissing && todo.length > 0 && (
          <ul className="mx-auto mt-2 max-h-48 max-w-4xl overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 text-xs">
            {[...missing, ...todo.filter((m) => m.need === "rating")].slice(0, 80).map((m) => (
              <li key={m.item.key}>
                <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-amber-100"
                  onClick={() => { setSection(m.item.sectionKey); setShowMissing(false); setTimeout(() => document.getElementById(`item-${m.item.key}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 80); }}>
                  <AlertTriangle size={12} className="flex-shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1 truncate text-slate-800">{m.item.label}</span>
                  <span className="flex-shrink-0 text-amber-800">{m.need === "rating" ? tr("not rated") : tr("note + photo")}</span>
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
      {confirm && (
        <SendSheet title={def.title} visit={visit} counts={counts} total={rated.length} unrated={unrated} busy={sending}
          under={items.filter((i) => answers[i.key]?.rating === "UNDER").map((i) => ({ item: i, note: answers[i.key]?.note ?? "", photos: photos.filter((p) => p.item === i.key).length }))}
          photos={photos.length} onClose={() => setConfirm(false)} onSend={(sig, name) => void submit(sig, name)} />
      )}
      <ConfirmDialog open={discarding} onClose={() => setDiscarding(false)} onConfirm={() => void discard()} danger
        title={tr("Delete this draft?")} confirmLabel={tr("Delete")} description={tr("Every rating, note and photo of this draft is removed.")} />
    </div>
  );
}

/** Before sending: the visit at a glance, the findings, an optional signature with the signer's name. */
function SendSheet({ title, visit, counts, total, unrated, under, photos, busy, onClose, onSend }: {
  title: string; visit: Visit; counts: Record<Rating, number>; total: number; unrated: number; busy: boolean; photos: number;
  under: { item: Item & { section: string }; note: string; photos: number }[]; onClose: () => void; onSend: (signature: string | null, name: string) => void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [name, setName] = useState(visit.name);
  const nameMissing = !!signature && !name.trim();
  return (
    <Drawer open onClose={onClose} size="lg" icon={<ClipboardCheck size={18} />} title={tr("Check before sending")}
      description={`${title} · ${visit.branchName}`} locked={busy} focusFirstField={false}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className={cx("text-xs sm:mr-auto", nameMissing ? "text-red-600" : "text-slate-500")}>
            {nameMissing ? tr("Write the signer's name under the signature.") : tr("After sending the visit cannot be changed; your location is recorded.")}
          </p>
          <Button variant="secondary" onClick={onClose} disabled={busy}>{tr("Back to the form")}</Button>
          <Button loading={busy} disabled={nameMissing} onClick={() => onSend(signature, name.trim())}>
            <Send size={15} /> {signature ? tr("Sign & send") : tr("Send")}
          </Button>
        </div>
      }>
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Info k={tr("Outlet")} v={visit.branchName} />
            <Info k={tr("PIC")} v={visit.name} />
            <Info k={tr("Started")} v={wibDateTime(visit.startedAt)} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {RATINGS.map((r) => (
              <div key={r} className="rounded-lg bg-white px-1 py-2 ring-1 ring-slate-200">
                <p className={cx("text-xl font-semibold tabular-nums", RATING_STYLE[r].text)}>{counts[r]}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{r}</p>
              </div>
            ))}
            <div className="rounded-lg bg-white px-1 py-2 ring-1 ring-slate-200">
              <p className="text-xl font-semibold tabular-nums text-slate-900">{photos}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Photos")}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{tr("{0} of {1} rated", counts.UNDER + counts.MEET + counts.EXCEED, total)}</p>
          {unrated > 0 && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> {tr("{0} items are not rated: they are sent empty and left out of the score.", unrated)}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle size={15} className="text-red-500" /> {tr("Findings (UNDER)")}</h3>
          {under.length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">{tr("No UNDER in this visit.")}</p> : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-red-100">
              {under.map((u) => (
                <li key={u.item.key} className="px-3 py-2.5 text-sm">
                  <p className="font-medium text-slate-900">{u.item.label}</p>
                  <p className="text-xs text-slate-500">{u.item.section} · {tr("{0} photos", u.photos)}</p>
                  {u.note && <p className="mt-1 text-slate-700">{u.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><PenLine size={16} className="text-slate-500" /> {tr("Signature")} <span className="font-normal text-slate-500">({tr("optional")})</span></h3>
          <p className="mb-3 mt-0.5 text-xs text-slate-500">{tr("By signing, I confirm the ratings above reflect the visit.")}</p>
          <SignaturePad onChange={setSignature} />
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{tr("Signer's name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={cx(inputClass, nameMissing && "border-red-400")} />
          </label>
        </section>
      </div>
    </Drawer>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</p>
      <p className="truncate font-medium text-slate-800" title={v}>{v}</p>
    </div>
  );
}

/** Stars of the outlet on a platform: Google Maps read automatically, the delivery apps typed by the PIC. */
function PlatformStars({ item, answer, auto, onAnswer }: { item: Item; answer: Answer; auto: AutoStars | null; onAnswer: (v: Answer, now?: boolean) => void }) {
  const [text, setText] = useState(answer.stars != null ? fmtStars(answer.stars) : "");
  const [bad, setBad] = useState(false);
  const name = PLATFORM_LABEL[item.platform!];
  if (item.platform === "google") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        {auto ? (
          <>
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-slate-900"><Star size={15} className="fill-amber-400 text-amber-400" /> {fmtStars(auto.stars)}</span>
            {auto.reviews != null && <span className="text-xs text-slate-500">{tr("{0} reviews", auto.reviews.toLocaleString(locale()))}</span>}
            <span className="text-xs text-slate-400">{tr("Google Maps, automatic")}{auto.fetchedAt ? ` · ${wibDateTime(auto.fetchedAt)}` : ""}</span>
            {auto.mapsUri && <a href={auto.mapsUri} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">{tr("View on Maps")} <ExternalLink size={11} /></a>}
          </>
        ) : <span className="text-xs text-slate-500">{tr("No Google Maps rating for this outlet yet (Rating & Review → Google Maps)")}</span>}
      </div>
    );
  }
  const commit = () => {
    const t = text.trim().replace(",", ".");
    if (!t) { setBad(false); if (answer.stars != null) onAnswer({ stars: null }, true); return; }
    const n = Math.round(Number(t) * 10) / 10;
    if (!Number.isFinite(n) || n < 1 || n > 5) { setBad(true); return; }
    setBad(false);
    setText(fmtStars(n));
    if (n !== answer.stars) onAnswer({ stars: n }, true);
  };
  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="relative">
          <Star size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 fill-amber-400 text-amber-400" />
          <input value={text} onChange={(e) => setText(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 3))} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            inputMode="decimal" placeholder="4.5" aria-label={tr("{0} stars", name)} aria-invalid={bad || undefined}
            className={cx(inputClass, "h-10 w-24 pl-8 text-sm font-semibold tabular-nums", bad && "border-red-300")} />
        </span>
        <span className="text-xs text-slate-500">{tr("{0} rating, typed from the app (1.0–5.0)", name)}</span>
      </label>
      {bad && <p className="mt-1 text-xs text-red-600">{tr("Type a number from 1.0 to 5.0")}</p>}
    </div>
  );
}

function ItemRow({ item, answer, auto, photos, onAnswer, onCamera, onRemovePhoto }: {
  item: Item; answer: Answer; auto: AutoStars | null; photos: VisitPhoto[]; onAnswer: (v: Answer, now?: boolean) => void; onCamera: () => void; onRemovePhoto: (id: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(!!answer.note);
  const under = answer.rating === "UNDER";
  const ratedNeeds = !!answer.rating && !item.platform; // every rated item: a note and a photo (2026-10-23)
  const showNote = item.kind === "text" || noteOpen || ratedNeeds || !!answer.note;
  const needNote = ratedNeeds && !answer.note;
  const needPhoto = ratedNeeds && photos.length === 0;
  return (
    <li id={`item-${item.key}`} className={cx("px-4 py-3.5", under && "bg-red-50/40")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{item.no}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-slate-900">{item.label}</p>
          {item.platform && <PlatformStars item={item} answer={answer} auto={auto} onAnswer={onAnswer} />}
          {item.kind === "rating" && (
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={item.label}>
              {RATINGS.map((r) => (
                <button key={r} type="button" role="radio" aria-checked={answer.rating === r} title={answer.rating === r ? tr("Tap again to clear") : undefined}
                  onClick={() => onAnswer({ rating: answer.rating === r ? null : r }, true)}
                  className={cx("h-10 rounded-lg border text-xs font-bold tracking-wide transition-colors",
                    answer.rating === r ? RATING_STYLE[r].on : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>{r}</button>
              ))}
            </div>
          )}
          {showNote && (
            <textarea value={answer.note ?? ""} onChange={(e) => onAnswer({ note: e.target.value })} rows={2} maxLength={1000}
              placeholder={item.kind === "text" ? tr("Names, separated by commas") : ratedNeeds ? tr("What you see (required)") : tr("Note")}
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


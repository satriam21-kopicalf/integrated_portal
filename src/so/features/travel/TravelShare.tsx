"use client";

// A Travel Path opened from its link in the WhatsApp group (no sign-in; /share/travel/{token}, integrated_portal_be
// app/travel_path.py shared, 2026-11-26): the score and the automatic evaluation, the findings with their photos and the
// photo of every area, zone by zone. Made for a phone first; a photo opens full size.

import { Skeleton, SkeletonList } from "@/components/kc/Skeleton";
import { CheckCircle2, Clock, MapPin, ShieldCheck, X } from "lucide-react";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { cx } from "@/so/ui";
import { wibDateTime } from "@/so/lib/wib";
import { LANG_KEY, tr, useLang } from "@/lib/i18n";
import { thumb } from "@/lib/assets";
import { type Definition, tl } from "@/so/features/visit/visit";
import { type Band, type Finding, type Report, type TravelPhoto, bandClass, bandText } from "./travel";

type Answer = { rating?: "OK" | "NOK" | "NA" | null; note?: string | null; fix?: string | null };
type Shared = Omit<Report, "id"> & { answers: Record<string, Answer>; photos: TravelPhoto[]; definition: Definition; findings?: Finding[]; evaluation?: string[] };
const RATING: Record<"OK" | "NOK" | "NA", { label: () => string; cls: string }> = {
  OK: { label: () => tr("Meets"), cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  NOK: { label: () => tr("Does not meet"), cls: "bg-red-50 text-red-700 ring-red-200" },
  NA: { label: () => "N/A", cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
};
const CAT: Record<string, string> = { Kritikal: "bg-red-600 text-white", Mayor: "bg-amber-100 text-amber-800", Minor: "bg-neutral-100 text-neutral-600" };

export default function TravelShare() {
  return <Suspense><View /></Suspense>;
}

function View() {
  const { token } = useParams<{ token: string }>();
  const { setLang } = useLang();
  const [d, setD] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [big, setBig] = useState<string | null>(null);
  useEffect(() => { try { if (!window.localStorage.getItem(LANG_KEY)) setLang("id"); } catch { /* English */ } }, [setLang]);
  useEffect(() => {
    fetch(`/api/public/travel/${encodeURIComponent(token)}`)
      .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw new Error(b.error ?? b.detail ?? tr("The link is not found or has expired")); setD(b); })
      .catch((e) => setError((e as Error).message));
  }, [token]);
  const url = (id: string) => `/api/public/travel/${encodeURIComponent(token)}/photos/${id}`;
  if (error) return <div className="flex min-h-dvh items-center justify-center bg-neutral-100 p-6 text-center text-sm text-neutral-600">{error}</div>;
  if (!d) return <div className="min-h-dvh bg-neutral-100"><div className="mx-auto max-w-2xl space-y-3 px-4 py-6"><Skeleton className="h-24 w-full" /><SkeletonList rows={6} className="rounded-xl border border-neutral-200 bg-white" /></div></div>;
  const photosOf = (key: string, kind?: "MAIN" | "AFTER") => d.photos.filter((p) => p.item === key && (!kind || p.kind === kind));
  const c = d.counts;
  const Pics = ({ list }: { list: TravelPhoto[] }) => list.length ? (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{list.map((p) => (
      <button key={p.id} type="button" onClick={() => setBig(p.id)} className="relative shrink-0" aria-label={tr("Open the photo")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- photo through the share link */}
        <img src={thumb(url(p.id), 320)} alt="" loading="lazy" decoding="async" className="h-28 w-28 rounded-xl object-cover ring-1 ring-neutral-200 sm:h-32 sm:w-32" />
        {p.kind === "AFTER" && <span className="absolute bottom-1 left-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{tr("After")}</span>}
      </button>))}</div>) : null;
  return (
    <div className="min-h-dvh bg-neutral-100">
      <header className="bg-[#0b1f4d] text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/calf-logo.png" alt="Kopi Calf" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain p-1" />
          <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-200">Travel Path · {d.sessionLabel}</p>
            <h1 className="truncate text-lg font-semibold leading-tight">{d.branchName}</h1>
            <p className="text-xs text-white/70">{wibDateTime(d.submittedAt)}</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 px-3 py-4 sm:px-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <span className={cx("rounded-2xl px-4 py-3 text-3xl font-bold tabular-nums", bandClass(d.band as Band | null))}>{d.score != null ? `${d.score}%` : "—"}</span>
            <div className="min-w-0 text-sm"><p className="font-semibold text-neutral-900">{d.band ? bandText(d.band as Band) : "—"}</p>
              <p className="text-neutral-600">{tr("{0} meet · {1} findings · {2} N/A", c?.ok ?? 0, c?.nok ?? 0, c?.na ?? 0)}</p>
              <p className="text-xs text-neutral-500">{[d.crew, d.supervisor].filter(Boolean).join(" & ")}</p></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {d.late && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800"><Clock size={12} /> {tr("Sent late")}</span>}
            {d.outsideRadius && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800"><MapPin size={12} /> {tr("Outside the outlet radius")}</span>}
          </div>
        </section>
        {!!d.evaluation?.length && (
          <section className="rounded-2xl bg-white p-4 shadow-sm"><h2 className="text-sm font-semibold text-neutral-900">{tr("Evaluation")}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">{d.evaluation.map((e) => <li key={e} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{e}</li>)}</ul></section>)}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="flex items-center justify-between text-sm font-semibold text-neutral-900">{tr("Findings")}<span className="text-xs font-normal text-neutral-500">{d.findings?.length ?? 0}</span></h2>
          {!d.findings?.length ? <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 size={15} /> {tr("No finding in this Travel Path.")}</p> : (
            <ul className="mt-2 space-y-3">{d.findings.map((f) => (
              <li key={f.id} className={cx("rounded-xl border p-3", f.status === "FIXED" ? "border-emerald-100 bg-emerald-50/40" : "border-red-100 bg-red-50/40")}>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-neutral-900">{f.category && <span className={cx("rounded px-1.5 py-px text-[10px] font-bold uppercase", CAT[f.category] ?? CAT.Minor)}>{f.category}</span>}{f.label}</p>
                {f.zone && <p className="text-[11px] text-neutral-500">{f.zone}</p>}
                {f.note && <p className="mt-1 text-sm text-neutral-700">{f.note}</p>}
                <p className={cx("mt-1 text-xs font-medium", f.status === "FIXED" ? "text-emerald-700" : f.overdue ? "text-red-700" : "text-amber-800")}>
                  {f.status === "FIXED" ? `${tr("Repaired")} ${wibDateTime(f.fixedAt)}${f.fixNote ? ` · ${f.fixNote}` : ""}` : f.overdue ? tr("Overdue, was due {0}", wibDateTime(f.dueAt)) : tr("Repair before {0}", wibDateTime(f.dueAt))}</p>
                <Pics list={photosOf(f.itemKey)} />
              </li>))}</ul>)}
        </section>
        {d.definition.groups.flatMap((g) => g.sections).map((z) => (
          <section key={z.key} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <h2 className="border-b border-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-900">{tl(z, "title")}</h2>
            <ul className="divide-y divide-neutral-100">{z.items.map((i) => {
              const a = d.answers[i.key];
              return (
                <li key={i.key} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-neutral-900">{i.no}. {tl(i)}</p>
                    {a?.rating ? <span className={cx("shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset", RATING[a.rating].cls)}>{RATING[a.rating].label()}</span> : <span className="text-neutral-300">—</span>}</div>
                  {a?.note && <p className="mt-0.5 text-sm text-neutral-600">{a.note}</p>}
                  <Pics list={photosOf(i.key)} />
                </li>);
            })}</ul>
          </section>))}
        <p className="flex items-center justify-center gap-1.5 pb-6 pt-2 text-center text-[11px] text-neutral-400"><ShieldCheck size={12} /> {tr("Read-only copy of the Travel Path sent by the outlet.")}</p>
      </main>
      {big && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" role="dialog" aria-modal="true" onClick={() => setBig(null)}>
          <button type="button" className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white" aria-label={tr("Close")}><X size={20} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url(big)} alt="" className="max-h-full max-w-full object-contain" />
        </div>)}
    </div>
  );
}

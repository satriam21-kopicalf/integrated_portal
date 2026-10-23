"use client";

// One Damaged Equipment request as everyone reads it — the PIC (their requests), the team (monitoring drawer) and the
// share link — in numbered cards like the other drawers: status & steps, time per stage, items, analysis, evidence,
// handling (technicians, cost, invoices, photos of the work done), the timeline with every note and the signature.

import { AlertTriangle, Calendar, CalendarClock, Camera, Check, CircleDot, Download, FileText, Handshake, MapPin, PauseCircle, User, Video, Wrench, XCircle } from "lucide-react";
import { Badge, cx } from "@/so/ui";
import { FormCard } from "@/so/ui/Simple";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type DeEvent, type Media, type MediaUrls, type Request, CAUSES, STATUS_LABEL, STATUS_TONE, STEPS, URGENCY_LABEL, URGENCY_TONE, fmtHours, fmtMb, fmtRp } from "./de";

const EVENT_LABEL: Record<DeEvent["kind"], () => string> = {
  SUBMIT: () => tr("Request sent"), STATUS: () => tr("Status"), ASSIGN: () => tr("Technician assigned"), RELEASE: () => tr("Technician released"),
  SWAP: () => tr("Technician moved"), COST: () => tr("Cost updated"), NOTE: () => tr("Note"), DUPLICATE: () => tr("Marked as duplicate"),
  WORK: () => tr("Technician photo link"), TARGET: () => tr("Target adjusted"), HANDOVER: () => tr("Handover from the PIC"),
};

export function StatusBadge({ r }: { r: Pick<Request, "status"> }) {
  return <Badge tone={STATUS_TONE[r.status]} dot>{STATUS_LABEL[r.status]()}</Badge>;
}

export function UrgencyBadge({ u }: { u: Request["urgency"] }) {
  return <Badge tone={URGENCY_TONE[u]} icon={u === "CRITICAL" ? <AlertTriangle size={11} /> : undefined}>{URGENCY_LABEL[u]()}</Badge>;
}

/** Pending → … → Done with the current step; on hold / reject shown on the step where it stopped. */
export function Steps({ r }: { r: Request }) {
  const at = r.status === "ON_HOLD" ? r.holdFrom : r.status;
  const idx = at ? STEPS.indexOf(at) : -1;
  return (
    <div>
      <ol className="flex items-start">
        {STEPS.map((s, i) => {
          const done = r.status === "DONE" || i < idx;
          const here = i === idx && r.status !== "DONE";
          return (
            <li key={s} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span className={cx("absolute right-1/2 top-3 h-0.5 w-full", done || here ? "bg-blue-600" : "bg-slate-200")} aria-hidden />}
              <span className={cx("relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold",
                done ? "bg-blue-600 text-white" : here ? (r.status === "ON_HOLD" ? "bg-amber-500 text-white" : r.status === "REJECTED" ? "bg-red-600 text-white" : "bg-blue-600 text-white ring-4 ring-blue-100")
                  : "bg-slate-200 text-slate-500")}>
                {done ? <Check size={13} /> : here && r.status === "ON_HOLD" ? <PauseCircle size={13} /> : here && r.status === "REJECTED" ? <XCircle size={13} /> : i + 1}
              </span>
              <span className={cx("mt-1 text-[10px] font-medium leading-tight sm:text-[11px]", done || here ? "text-slate-900" : "text-slate-400")}>{STATUS_LABEL[s]()}</span>
            </li>
          );
        })}
      </ol>
      {(r.status === "ON_HOLD" || r.status === "REJECTED") && (
        <p className={cx("mt-2 rounded-lg px-3 py-1.5 text-center text-xs font-medium", r.status === "ON_HOLD" ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700")}>
          {r.status === "ON_HOLD" ? tr("On hold at {0}", r.holdFrom ? STATUS_LABEL[r.holdFrom]() : "—") : r.duplicateOf ? tr("Rejected: duplicate of {0}", r.duplicateOf.number ?? "—") : tr("Rejected")}
        </p>
      )}
    </div>
  );
}

function Tracker({ r }: { r: Request }) {
  const t = r.tracker!;
  const max = Math.max(1, ...t.stages.map((s) => s.hours));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-100 text-center">
        {[[tr("Total"), t.totalHours], [tr("Handled"), t.workHours], [tr("On hold"), t.holdHours]].map(([k, v]) => (
          <div key={String(k)} className="px-2 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{fmtHours(v as number)}</p></div>
        ))}
      </div>
      <ul className="space-y-1.5">
        {t.stages.map((s) => (
          <li key={s.status} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-600">{STATUS_LABEL[s.status]()}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", s.status === "ON_HOLD" ? "bg-amber-400" : "bg-blue-500")} style={{ width: `${(s.hours / max) * 100}%` }} /></span>
            <span className="text-right tabular-nums text-slate-700">{fmtHours(s.hours)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Photos as even 4:3 tiles with their number, time and who took them on the picture; optional remove and an add tile. */
export function EvidenceGrid({ list, urls, onRemove, add, empty, by = false }: {
  list: Media[]; urls: MediaUrls; onRemove?: (id: string) => void; add?: React.ReactNode; empty?: string; by?: boolean;
}) {
  if (!list.length && !add) return <p className="rounded-xl border border-dashed border-slate-200 px-3 py-5 text-center text-sm text-slate-400">{empty ?? tr("No photo")}</p>;
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((m, i) => (
        <li key={m.id}>
          <figure className="group relative overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            <a href={urls.media(m.id)} target="_blank" rel="noreferrer" title={wibDateTime(m.takenAt ?? m.uploadedAt)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
              <img src={urls.media(m.id)} alt={tr("Photo {0}", i + 1)} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-[1.02]" />
            </a>
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2.5 pb-1.5 pt-6 text-white">
              <span className="block text-[11px] font-semibold">#{i + 1}{by && m.uploadedBy ? ` · ${m.uploadedBy}` : ""}</span>
              <span className="block truncate text-[10px] text-white/80">{wibDateTime(m.takenAt ?? m.uploadedAt)}</span>
            </figcaption>
            {onRemove && (
              <button type="button" onClick={() => onRemove(m.id)} aria-label={tr("Remove photo {0}", i + 1)}
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-red-600"><XCircle size={15} /></button>
            )}
          </figure>
        </li>
      ))}
      {add && <li>{add}</li>}
    </ul>
  );
}

/** The add tile of an evidence grid (camera). */
export function AddPhotoTile({ onClick, label, tone = "slate" }: { onClick: () => void; label: string; tone?: "slate" | "blue" }) {
  return (
    <button type="button" onClick={onClick}
      className={cx("flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-xs font-medium transition-colors",
        tone === "blue" ? "border-blue-300 bg-blue-50/50 text-blue-700 hover:bg-blue-50" : "border-slate-300 bg-slate-50/60 text-slate-500 hover:border-blue-400 hover:text-blue-700")}>
      <Camera size={20} />{label}
    </button>
  );
}

export function Gallery({ r, urls, kind, empty }: { r: Request; urls: MediaUrls; kind: Media["kind"]; empty?: string }) {
  const list = (r.media ?? []).filter((m) => m.kind === kind);
  return <EvidenceGrid list={list} urls={urls} by={kind !== "PHOTO"} empty={empty ?? (kind === "AFTER" ? tr("No photo of the work done yet") : tr("No photo"))} />;
}

/** Invoices / receipts of the cost (team), each one a download. */
export function Invoices({ list, urls, onRemove }: { list: Media[]; urls: MediaUrls; onRemove?: (id: string) => void }) {
  if (!list.length) return <p className="text-sm text-slate-400">{tr("No invoice attached yet")}</p>;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
      {list.map((m) => (
        <li key={m.id} className="flex items-center gap-3 px-3 py-2">
          <span className={cx("flex h-8 w-10 flex-shrink-0 items-center justify-center rounded-md text-[10px] font-bold uppercase", m.mime === "application/pdf" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700")}>
            {m.mime === "application/pdf" ? "PDF" : <FileText size={14} />}
          </span>
          <a href={urls.media(m.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:text-blue-700">
            <span className="block truncate text-sm font-medium text-slate-900">{m.fileName ?? tr("Invoice")}</span>
            <span className="block truncate text-[11px] text-slate-500">{m.note ? `${m.note} · ` : ""}{fmtMb(m.bytes)} · {m.uploadedBy ?? "—"} · {wibDateTime(m.uploadedAt)}</span>
          </a>
          <a href={urls.media(m.id)} download={m.fileName ?? undefined} aria-label={tr("Download {0}", m.fileName ?? tr("Invoice"))} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Download size={15} /></a>
          {onRemove && <button type="button" onClick={() => onRemove(m.id)} aria-label={tr("Remove {0}", m.fileName ?? tr("Invoice"))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><XCircle size={15} /></button>}
        </li>
      ))}
    </ul>
  );
}

export function Timeline({ events }: { events: DeEvent[] }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {[...events].reverse().map((e) => {
        const tech = e.details?.technician as string | undefined;
        const what = e.kind === "STATUS" ? `${e.from ? STATUS_LABEL[e.from]() : ""} → ${e.to ? STATUS_LABEL[e.to]() : ""}`
          : e.kind === "SWAP" ? `${EVENT_LABEL.SWAP()}: ${tech ?? ""} ${e.details?.to ? tr("to {0}", String(e.details.to)) : e.details?.from ? tr("from {0}", String(e.details.from)) : ""}`
          : e.kind === "DUPLICATE" ? tr("Marked as duplicate of {0}", String(e.details?.of ?? ""))
          : e.kind === "TARGET" ? tr("Estimated finish adjusted to {0}", wibDateTime(String(e.details?.to ?? "")))
          : e.kind === "HANDOVER" ? tr("Handover sent by the PIC · {0} photo(s)", String(e.details?.photos ?? 0)) + (e.details?.vendor ? ` · ${tr("signed by the vendor {0}", String(e.details.vendor))}` : "")
          : e.kind === "WORK" ? (e.details?.link === "sent" ? tr("Technician sent {0} photo(s) of the work", String(e.details?.photos ?? 0)) : tr("Photo link sent to {0}", String(tech ?? "")))
          : e.kind === "COST" ? (e.details?.invoice !== undefined ? tr("Invoice attached: {0}", String(e.details.invoice)) : `${EVENT_LABEL.COST()}: ${fmtRp(e.details?.estCost as number)} / ${fmtRp(e.details?.actualCost as number)}`)
          : `${EVENT_LABEL[e.kind]()}${tech ? `: ${tech}` : ""}${e.details?.scheduledFor ? ` · ${tr("scheduled {0}", String(e.details.scheduledFor))}` : ""}`;
        return (
          <li key={e.id} className="relative">
            <span className={cx("absolute -left-[1.6rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white",
              e.to === "REJECTED" ? "bg-red-500" : e.to === "ON_HOLD" ? "bg-amber-500" : e.to === "DONE" || e.kind === "HANDOVER" || (e.kind === "WORK" && e.details?.link === "sent") ? "bg-emerald-500" : e.kind === "TARGET" ? "bg-violet-500" : e.kind === "NOTE" ? "bg-slate-400" : "bg-blue-500")}>
              <CircleDot size={10} className="text-white" />
            </span>
            <p className="text-sm font-medium text-slate-900">{what}</p>
            <p className="text-[11px] text-slate-500">{wibDateTime(e.at)}{e.actor ? ` · ${e.actor}` : ""}</p>
            {e.note && <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** The estimated finish; when the team adjusted it, a note with the new time and the reason (the PIC follows it). */
export function TargetNote({ r }: { r: Request }) {
  if (!r.tracker?.targetAdjusted || !r.target || !["PENDING", "VALIDATION", "REVIEW", "ON_HOLD", "ACCEPTED", "IN_PROGRESS", "HANDOVER"].includes(r.status)) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900">
      <CalendarClock size={14} className="mt-px flex-shrink-0" />
      <span><b>{tr("Estimated finish adjusted by the maintenance team: {0}", wibDateTime(r.target.at))}</b>
        {r.target.note ? ` — ${r.target.note}` : ""}<span className="text-violet-700/80"> · {r.target.by ?? ""}{r.target.setAt ? `, ${wibDateTime(r.target.setAt)}` : ""}</span></span>
    </p>
  );
}

/** The head of a request: kind and number, status and urgency, the key facts, the steps and the reason of a hold / reject. */
export function RequestHero({ r, compact = false }: { r: Request; compact?: boolean }) {
  const why = r.status === "ON_HOLD" || r.status === "REJECTED" ? [...(r.events ?? [])].reverse().find((e) => e.to === r.status && e.note)?.note : null;
  const techs = (r.assignments ?? []).filter((a) => a.status !== "RELEASED").map((a) => a.name);
  const facts: [React.ReactNode, string, React.ReactNode][] = [
    [<User key="u" size={13} />, "PIC", r.picName],
    [<Calendar key="c" size={13} />, tr("Sent"), wibDateTime(r.submittedAt)],
    [<CalendarClock key="t" size={13} />, tr("Estimated finish"), <span key="v" className={r.tracker?.overdue || r.tracker?.late ? "text-red-600" : undefined}>
      {r.tracker?.dueAt ? wibDateTime(r.tracker.dueAt) : "—"}{r.tracker?.targetAdjusted ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">{tr("adjusted")}</span> : null}
      <span className="block text-[11px] font-normal text-slate-400">{tr("handled {0}", fmtHours(r.tracker?.workHours))}</span></span>],
    [<Wrench key="w" size={13} />, r.mode === "VENDOR" ? tr("Vendor") : tr("Technician"), <span key="w">{techs.join(", ") || "—"}
      {r.mode && <span className="block text-[11px] font-normal text-slate-400">{r.mode === "VENDOR" ? tr("Vendor work") : tr("Internal technician")}</span>}</span>],
  ];
  return (
    <section className={cx("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", compact && "rounded-xl")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-blue-700">{r.number}</p>
          <h2 className={cx("font-semibold text-slate-900", compact ? "text-base" : "text-lg sm:text-xl")}>{r.kindLabel}</h2>
          <p className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {r.branchName} ({r.branchCode})
            {r.distanceM !== null && <span className={r.outsideRadius ? "text-red-600" : undefined}> · {tr("sent {0} m from the outlet", r.distanceM)}</span>}</p>
        </div>
        <span className="flex flex-wrap gap-1.5"><StatusBadge r={r} /><UrgencyBadge u={r.urgency} /></span>
      </div>
      <dl className="grid grid-cols-2 border-y border-slate-100 bg-slate-50/60 sm:grid-cols-4">
        {facts.map(([icon, k, v], i) => (
          <div key={k} className={cx("px-4 py-2.5 sm:px-5", i % 2 === 1 && "border-l border-slate-100", i >= 2 && "border-t border-slate-100 sm:border-t-0", i === 2 && "sm:border-l")}>
            <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{icon}{k}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="px-4 py-4 sm:px-5">
        <Steps r={r} />
        <div className="mt-2"><TargetNote r={r} /></div>
        {why && <p className={cx("mt-2 rounded-lg px-3 py-2 text-xs", r.status === "ON_HOLD" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800")}><b>{tr("Reason")}:</b> {why}</p>}
      </div>
    </section>
  );
}

function SignBox({ title, name, src }: { title: string; name: string; src?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- private signature through the API */}
      {src ? <img src={src} alt={tr("Signature")} className="my-1 h-16 w-auto max-w-full object-contain" /> : <div className="my-1 h-4" />}
      <p className="text-sm font-semibold text-slate-900">{name}</p>
    </div>
  );
}

type Part = "all" | "detail" | "handling" | "history";

/** The request in cards. part: all (the PIC's view: everything in order), detail (items, analysis, evidence, signature),
 *  handling (technicians, cost, invoices, work photos), history (time per stage and the timeline). `children` (the team's
 *  actions) come after the status card in "all". */
export default function RequestView({ r, urls, children, part = "all", numbered = true }: {
  r: Request; urls: MediaUrls; children?: React.ReactNode; part?: Part; numbered?: boolean;
}) {
  const video = (r.media ?? []).find((m) => m.kind === "VIDEO");
  const photos = (r.media ?? []).filter((m) => m.kind === "PHOTO").length;
  const invoices = (r.media ?? []).filter((m) => m.kind === "INVOICE");
  const active = (r.assignments ?? []).filter((a) => a.status !== "RELEASED");
  const handled = active.length > 0 || invoices.length > 0 || (r.media ?? []).some((m) => m.kind === "AFTER" || m.kind === "MONITOR") || r.estCost !== null || r.actualCost !== null;
  const ho = r.handover;
  const show = (p: Part) => part === "all" || part === p;
  let n = 0;
  const next = () => (numbered ? ++n : undefined);
  return (
    <div className="space-y-4">
      {part === "all" && (
        <FormCard n={next()} title={tr("Status & progress")} hint={`${r.kindLabel} · ${r.branchName}`}
          aside={<span className="flex flex-wrap justify-end gap-1"><StatusBadge r={r} /><UrgencyBadge u={r.urgency} /></span>}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-[11px] text-slate-400">PIC</dt><dd className="font-medium text-slate-900">{r.picName}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Sent")}</dt><dd className="text-slate-900">{wibDateTime(r.submittedAt)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Location when sent")}</dt>
              <dd className={cx("inline-flex items-center gap-1", r.outsideRadius ? "text-red-700" : "text-slate-900")}><MapPin size={12} />{r.distanceM === null ? "—" : tr("{0} m from the outlet", r.distanceM)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">{tr("Estimated finish")}</dt>
              <dd className={cx("font-medium tabular-nums", r.tracker?.overdue ? "text-red-600" : "text-slate-900")}>{r.tracker?.dueAt ? wibDateTime(r.tracker.dueAt) : "—"}
                <span className="block text-[11px] font-normal text-slate-400">{tr("handled {0}", fmtHours(r.tracker?.workHours))}</span></dd></div>
          </dl>
          <Steps r={r} />
          <TargetNote r={r} />
        </FormCard>
      )}

      {part === "all" && children}

      {show("history") && r.tracker && r.tracker.totalHours !== null && (
        <FormCard n={next()} title={tr("Time tracker")} hint={tr("Time per stage from sending; on hold counted apart")}
          aside={r.tracker.slaHours !== null ? <Badge tone={r.tracker.overdue ? "red" : "green"}>{r.tracker.overdue ? tr("Past target ({0})", fmtHours(r.tracker.slaHours)) : tr("Target {0}", fmtHours(r.tracker.slaHours))}</Badge> : undefined}>
          <Tracker r={r} />
        </FormCard>
      )}

      {show("detail") && (
        <>
          <FormCard n={next()} title={tr("Items ({0})", r.items?.length ?? 0)} hint={r.kind === "REPAIR" ? tr("What is damaged") : tr("What to add")}>
            <ul className="divide-y divide-slate-100">
              {(r.items ?? []).map((it, i) => (
                <li key={it.id ?? i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">{it.name} <span className="font-normal text-slate-500">× {it.qty}</span></span>
                    <span className="block text-xs text-slate-500">{it.category} · {it.group}{it.location ? ` · ${it.location}` : ""}</span>
                    {it.note && <span className="mt-0.5 block text-xs text-slate-600">{it.note}</span>}
                  </span>
                  <UrgencyBadge u={it.urgency} />
                </li>
              ))}
            </ul>
          </FormCard>

          <FormCard n={next()} title={r.kind === "REPAIR" ? tr("Damage analysis") : tr("Reason for the procurement")}
            hint={r.kind === "REPAIR" && r.cause ? `${tr("Cause")}: ${CAUSES.find((c) => c.value === r.cause)?.label() ?? r.cause}` : undefined}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{r.analysis || "—"}</p>
          </FormCard>

          <FormCard n={next()} title={tr("Evidence")} hint={`${tr("{0} photos", photos)}${video ? ` · ${tr("1 video")}` : ""}`}>
            <Gallery r={r} urls={urls} kind="PHOTO" />
            {video && (
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs text-slate-500"><Video size={13} /> {video.fileName ?? tr("Video")} · {fmtMb(video.bytes)}</p>
                <video src={urls.media(video.id)} controls preload="metadata" className="max-h-80 w-full rounded-lg bg-black" />
              </div>
            )}
          </FormCard>
        </>
      )}

      {(show("handling") && handled) && (
        <FormCard n={next()} title={tr("Handling")} hint={tr("Technicians, cost, invoices and photos of the work done")}
          aside={r.mode ? <Badge tone={r.mode === "VENDOR" ? "amber" : "blue"}>{r.mode === "VENDOR" ? tr("Vendor") : tr("Internal")}</Badge> : undefined}>
          {active.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {active.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-2 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{a.name}</span>
                  <span className="text-xs text-slate-500">{a.kind === "VENDOR" ? a.company ?? tr("Vendor") : tr("Internal")}{a.scheduledFor ? ` · ${tr("scheduled {0}", a.scheduledFor)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {(r.estCost !== null || r.actualCost !== null || r.vendor) && (
            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div><dt className="text-slate-400">{tr("Estimated cost")}</dt><dd className="font-semibold tabular-nums text-slate-900">{fmtRp(r.estCost)}</dd></div>
              <div><dt className="text-slate-400">{tr("Actual cost")}</dt><dd className="font-semibold tabular-nums text-slate-900">{fmtRp(r.actualCost)}</dd></div>
              <div><dt className="text-slate-400">{tr("Vendor")}</dt><dd className="truncate font-semibold text-slate-900">{r.vendor ?? "—"}</dd></div>
            </dl>
          )}
          {invoices.length > 0 && <div><p className="mb-1.5 text-xs font-semibold text-slate-500">{tr("Invoices / receipts")}</p><Invoices list={invoices} urls={urls} /></div>}
          {r.mode !== "VENDOR" && <div><p className="mb-1.5 text-xs font-semibold text-slate-500">{tr("Photos of the work done")}</p><Gallery r={r} urls={urls} kind="AFTER" /></div>}
          {(r.media ?? []).some((m) => m.kind === "MONITOR") && <div><p className="mb-1.5 text-xs font-semibold text-slate-500">{tr("PIC photos while the work ran")}</p><Gallery r={r} urls={urls} kind="MONITOR" /></div>}
        </FormCard>
      )}

      {show("handling") && ho?.at && (
        <FormCard n={next()} title={tr("Handover at the outlet")} hint={`${wibDateTime(ho.at)}${ho.distanceM !== null ? ` · ${tr("{0} m from the outlet", ho.distanceM)}` : ""}`}
          aside={<Badge tone="green" icon={<Handshake size={11} />}>{tr("Received")}</Badge>}>
          <Gallery r={r} urls={urls} kind="HANDOVER" />
          {ho.note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{ho.note}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {ho.vendorName && <SignBox title={tr("Vendor")} name={ho.vendorName} src={urls.handover?.(r.id, "vendor")} />}
            {ho.picName && <SignBox title={tr("PIC outlet")} name={ho.picName} src={urls.handover?.(r.id, "pic")} />}
          </div>
          {ho.approvedBy && <p className="text-xs text-slate-500">{tr("Approved Done by {0}", ho.approvedBy)}</p>}
        </FormCard>
      )}

      {show("history") && (
        <FormCard n={next()} title={tr("Progress & notes")} hint={tr("Every step of the team, newest first")}>
          <Timeline events={r.events ?? []} />
        </FormCard>
      )}

      {show("detail") && r.signature && (
        <FormCard n={next()} title={tr("PIC signature")} hint={tr("By signing I confirm this request is true and needed for the outlet.")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element -- private signature through the API */}
            <img src={urls.signature(r.id)} alt={tr("Signature")} className="h-24 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
            <div className="text-sm"><p className="font-semibold text-slate-900">{r.signature.name}</p><p className="text-xs text-slate-500">{wibDateTime(r.signature.signedAt)}</p></div>
          </div>
        </FormCard>
      )}
    </div>
  );
}

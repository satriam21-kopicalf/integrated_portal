"use client";

// One Damaged Equipment request as everyone reads it — the PIC (their requests), the team (monitoring drawer) and the
// share link: progress steps, time per stage, items, analysis, evidence, technicians, the timeline with every note.

import { AlertTriangle, Check, CircleDot, Clock, Hammer, Image as ImageIcon, MapPin, PauseCircle, PenLine, Video, XCircle } from "lucide-react";
import { Badge, cx } from "@/so/ui";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type DeEvent, type MediaUrls, type Request, CAUSES, STATUS_LABEL, STATUS_TONE, STEPS, URGENCY_LABEL, URGENCY_TONE, fmtHours, fmtMb, fmtRp } from "./de";

const EVENT_LABEL: Record<DeEvent["kind"], () => string> = {
  SUBMIT: () => tr("Request sent"), STATUS: () => tr("Status"), ASSIGN: () => tr("Technician assigned"), RELEASE: () => tr("Technician released"),
  SWAP: () => tr("Technician moved"), COST: () => tr("Cost updated"), NOTE: () => tr("Note"), DUPLICATE: () => tr("Marked as duplicate"),
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

export function TrackerCard({ r }: { r: Request }) {
  const t = r.tracker;
  if (!t || t.totalHours === null) return null;
  const max = Math.max(1, ...t.stages.map((s) => s.hours));
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Clock size={15} className="text-slate-500" /> {tr("Time tracker")}</h3>
        {t.slaHours !== null && <Badge tone={t.overdue ? "red" : "green"}>{t.overdue ? tr("Past target ({0})", fmtHours(t.slaHours)) : tr("Target {0}", fmtHours(t.slaHours))}</Badge>}
      </header>
      <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
        {[[tr("Total"), t.totalHours], [tr("Handled"), t.workHours], [tr("On hold"), t.holdHours]].map(([k, v]) => (
          <div key={String(k)} className="px-2 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{fmtHours(v as number)}</p></div>
        ))}
      </div>
      <ul className="space-y-1.5 border-t border-slate-100 px-4 py-3">
        {t.stages.map((s) => (
          <li key={s.status} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-600">{STATUS_LABEL[s.status]()}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", s.status === "ON_HOLD" ? "bg-amber-400" : "bg-blue-500")} style={{ width: `${(s.hours / max) * 100}%` }} /></span>
            <span className="text-right tabular-nums text-slate-700">{fmtHours(s.hours)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Section({ title, icon, children, aside }: { title: string; icon?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{icon}{title}</h3>{aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Gallery({ r, urls, kind }: { r: Request; urls: MediaUrls; kind: "PHOTO" | "AFTER" }) {
  const list = (r.media ?? []).filter((m) => m.kind === kind);
  if (!list.length) return <p className="text-sm text-slate-400">{kind === "AFTER" ? tr("No photo of the work done yet") : tr("No photo")}</p>;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {list.map((m) => (
        <li key={m.id}>
          <a href={urls.media(m.id)} target="_blank" rel="noreferrer" title={wibDateTime(m.takenAt ?? m.uploadedAt)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
            <img src={urls.media(m.id)} alt={tr("Photo")} loading="lazy" className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200" />
          </a>
          <span className="mt-0.5 block truncate text-[10px] text-slate-400">{wibDateTime(m.takenAt ?? m.uploadedAt)}</span>
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
          : e.kind === "COST" ? `${EVENT_LABEL.COST()}: ${fmtRp(e.details?.estCost as number)} / ${fmtRp(e.details?.actualCost as number)}`
          : `${EVENT_LABEL[e.kind]()}${tech ? `: ${tech}` : ""}${e.details?.scheduledFor ? ` · ${tr("scheduled {0}", String(e.details.scheduledFor))}` : ""}`;
        return (
          <li key={e.id} className="relative">
            <span className={cx("absolute -left-[1.6rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white",
              e.to === "REJECTED" ? "bg-red-500" : e.to === "ON_HOLD" ? "bg-amber-500" : e.to === "DONE" ? "bg-emerald-500" : "bg-blue-500")}>
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

export default function RequestView({ r, urls, children }: { r: Request; urls: MediaUrls; children?: React.ReactNode }) {
  const video = (r.media ?? []).find((m) => m.kind === "VIDEO");
  const active = (r.assignments ?? []).filter((a) => a.status === "ACTIVE");
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge r={r} /> <UrgencyBadge u={r.urgency} /> <Badge tone="slate">{r.kind === "REPAIR" ? tr("Repair") : tr("Procurement")}</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt className="text-[11px] text-slate-400">{tr("Branch")}</dt><dd className="font-medium text-slate-900">{r.branchName}</dd></div>
          <div><dt className="text-[11px] text-slate-400">PIC</dt><dd className="font-medium text-slate-900">{r.picName}</dd></div>
          <div><dt className="text-[11px] text-slate-400">{tr("Sent")}</dt><dd className="text-slate-900">{wibDateTime(r.submittedAt)}</dd></div>
          <div><dt className="text-[11px] text-slate-400">{tr("Location when sent")}</dt>
            <dd className={cx("inline-flex items-center gap-1", r.outsideRadius ? "text-red-700" : "text-slate-900")}><MapPin size={12} />{r.distanceM === null ? "—" : tr("{0} m from the outlet", r.distanceM)}</dd></div>
        </dl>
        <div className="mt-4"><Steps r={r} /></div>
      </section>

      {children}

      <TrackerCard r={r} />

      <Section title={tr("Items ({0})", r.items?.length ?? 0)}>
        <ul className="divide-y divide-slate-100">
          {(r.items ?? []).map((it, i) => (
            <li key={it.id ?? i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
              <span className="w-5 flex-shrink-0 text-right text-xs font-semibold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-900">{it.name} <span className="font-normal text-slate-500">× {it.qty}</span></span>
                <span className="block text-xs text-slate-500">{it.category} · {it.group}{it.location ? ` · ${it.location}` : ""}</span>
                {it.note && <span className="mt-0.5 block text-xs text-slate-600">{it.note}</span>}
              </span>
              <UrgencyBadge u={it.urgency} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={r.kind === "REPAIR" ? tr("Damage analysis") : tr("Reason for the procurement")}>
        <p className="whitespace-pre-line text-sm text-slate-700">{r.analysis || "—"}</p>
        {r.kind === "REPAIR" && r.cause && <p className="mt-2 text-xs text-slate-500">{tr("Cause")}: {CAUSES.find((c) => c.value === r.cause)?.label() ?? r.cause}</p>}
      </Section>

      <Section title={tr("Evidence")} icon={<ImageIcon size={15} className="text-slate-500" />}>
        <Gallery r={r} urls={urls} kind="PHOTO" />
        {video && (
          <div className="mt-3">
            <p className="mb-1 flex items-center gap-1 text-xs text-slate-500"><Video size={13} /> {video.fileName ?? tr("Video")} · {fmtMb(video.bytes)}</p>
            <video src={urls.media(video.id)} controls preload="metadata" className="max-h-80 w-full rounded-lg bg-black" />
          </div>
        )}
      </Section>

      {(active.length > 0 || (r.media ?? []).some((m) => m.kind === "AFTER") || r.estCost !== null || r.actualCost !== null) && (
        <Section title={tr("Handling")} icon={<Hammer size={15} className="text-slate-500" />}>
          {active.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {active.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium text-slate-900">{a.name}</span>
                  <span className="text-xs text-slate-500">{a.kind === "VENDOR" ? a.company ?? tr("Vendor") : tr("Internal")}{a.scheduledFor ? ` · ${tr("scheduled {0}", a.scheduledFor)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {(r.estCost !== null || r.actualCost !== null) && (
            <p className="mb-3 text-xs text-slate-600">{tr("Estimated cost")}: <b>{fmtRp(r.estCost)}</b> · {tr("Actual cost")}: <b>{fmtRp(r.actualCost)}</b>{r.vendor ? ` · ${r.vendor}` : ""}</p>
          )}
          <p className="mb-2 text-xs font-semibold text-slate-500">{tr("Photos of the work done")}</p>
          <Gallery r={r} urls={urls} kind="AFTER" />
        </Section>
      )}

      <Section title={tr("Progress & notes")}>
        <Timeline events={r.events ?? []} />
      </Section>

      {r.signature && (
        <Section title={tr("PIC signature")} icon={<PenLine size={15} className="text-slate-500" />}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {/* eslint-disable-next-line @next/next/no-img-element -- private signature through the API */}
            <img src={urls.signature(r.id)} alt={tr("Signature")} className="h-24 w-auto max-w-full rounded-lg bg-white object-contain ring-1 ring-slate-200" />
            <div className="text-sm"><p className="font-semibold text-slate-900">{r.signature.name}</p><p className="text-xs text-slate-500">{wibDateTime(r.signature.signedAt)}</p></div>
          </div>
        </Section>
      )}
    </div>
  );
}

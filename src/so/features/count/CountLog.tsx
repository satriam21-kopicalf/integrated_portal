"use client";

// Log of one count (2026-11-05): started, every submit (also after a recount), recount asked with its reason, approved,
// corrected … with who, when and, for start and submit, where the device was against the outlet.

import { SkeletonList } from "@/components/kc/Skeleton";
import { AlertTriangle, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/kc";
import { cx, fmtDate } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { mapsUrl } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type LogEvent = {
  action: string; at: string; by: string | null; note: string | null; status: string | null; lines: number | null;
  lat?: number | null; lng?: number | null; distance_m?: number | null; accuracy_m?: number | null; located_at?: string | null;
  outside_radius?: boolean | null; low_accuracy?: boolean | null; late?: boolean | null; device?: string | null;
};
type Log = { facility: { name: string; lat: number | null; lng: number | null; radius_m: number | null }; events: LogEvent[] };

const LABEL: Record<string, () => string> = {
  START: () => tr("Started"), START_ENTRY: () => tr("Entered by Cost Control"), SUBMIT: () => tr("Submitted"),
  RECOUNT: () => tr("Recount Asked"), APPROVE: () => tr("Approved"), CANCEL: () => tr("Cancelled"),
  COUNT_CORRECT: () => tr("Corrected by Cost Control"), COUNT_WIP: () => tr("Premix Saved"), FILE: () => tr("File Attached"),
  FILE_DELETE: () => tr("File Removed"),
};
const DOT: Record<string, string> = { START: "bg-brand-500", SUBMIT: "bg-emerald-500", RECOUNT: "bg-amber-500", APPROVE: "bg-emerald-600", CANCEL: "bg-red-500" };

export default function CountLog({ countId, reload, bare = false }: { countId: string; reload?: unknown; /** without its card (inside another one) */ bare?: boolean }) {
  const [log, setLog] = useState<Log | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Log>(`/api/so/counts/${countId}/log`).then(setLog, (e) => setError(errorText(e)));
  }, [countId, reload]);

  const body = (
    <>
      {error ? <p className="text-sm text-red-600">{error}</p> : !log ? <SkeletonList rows={4} /> : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {log.events.map((e, i) => (
            <li key={i} className="relative">
              <span className={cx("absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white", DOT[e.action] ?? "bg-slate-400")} />
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-slate-900">{LABEL[e.action]?.() ?? e.action}</span>
                <span className="text-slate-500">{fmtDate(e.at)}</span>
                {e.by && <span className="text-slate-600">· {e.by}</span>}
                {e.late && <span className="rounded bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800">{tr("Late")}</span>}
              </div>
              {e.note && <p className="mt-0.5 text-[13px] text-slate-700">{tr("Reason")}: {e.note}</p>}
              {e.lines ? <p className="text-[12px] text-slate-500">{tr("{0} lines", e.lines)}</p> : null}
              {(e.action === "START" || e.action === "SUBMIT") && (
                e.lat != null && e.lng != null ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                    <a className="inline-flex items-center gap-1 text-brand-700 hover:underline" href={mapsUrl(e.lat, e.lng)} target="_blank" rel="noreferrer">
                      <MapPin size={12} />{e.lat.toFixed(5)}, {e.lng.toFixed(5)}
                    </a>
                    {e.distance_m != null && <span>{tr("{0} m from the outlet", e.distance_m)}</span>}
                    {e.accuracy_m != null && <span>{tr("accuracy ±{0} m", Math.round(e.accuracy_m))}</span>}
                    {e.outside_radius && <span className="inline-flex items-center gap-1 font-medium text-red-600"><AlertTriangle size={12} />{tr("Outside the radius")}</span>}
                    {e.low_accuracy && <span className="font-medium text-amber-700">{tr("Low accuracy")}</span>}
                  </div>
                ) : <p className="mt-1 text-[12px] text-slate-400">{tr("No location")}</p>
              )}
            </li>
          ))}
          {log.events.length === 0 && <li className="text-sm text-slate-400">{tr("Nothing logged yet")}</li>}
        </ol>
      )}
    </>
  );
  return bare ? body : <Card title={tr("Log")} subtitle={tr("Start, submit, recount and review of this count, with the position of the device")}>{body}</Card>;
}

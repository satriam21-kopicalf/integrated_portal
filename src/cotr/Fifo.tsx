"use client";

// Storage & Assignment → batch codes to give, first expiring first (recommendation #13): the lots of the pool from its
// last physical count — expiring today in red, tomorrow in amber, the expired ones apart (not to be given) — and per
// driver of the day which batch codes and how many cups to put on the fleet.

import { ListOrdered, PackageX } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { SkeletonList } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Lot = { batchNo: string | null; qty: number; expiresOn: string | null; daysLeft: number | null; new?: boolean };
type Line = { menu: string; name: string; batchNo: string | null; qty: number; expiresOn: string | null; short?: boolean };
type Fifo = { counted: string | null; menus: { menu: string; name: string; lots: Lot[]; expired: Lot[]; left: Lot[] }[];
  drivers: { code: string; name: string; status: string; lines: Line[] }[] };

const tone = (days: number | null): "red" | "amber" | "slate" => (days === null ? "slate" : days <= 0 ? "red" : days === 1 ? "amber" : "slate");
const when = (l: { expiresOn: string | null; daysLeft?: number | null }) =>
  l.daysLeft === 0 ? tr("expires today") : l.daysLeft === 1 ? tr("expires tomorrow") : l.expiresOn ? tr("until {0}", dmyOf(l.expiresOn)) : "";

export function FifoPanel({ pool, day, version }: { pool: string; day: string; version?: number }) {
  const [data, setData] = useState<Fifo | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    call<Fifo>(`/api/cotr/fifo?pool=${encodeURIComponent(pool)}&day=${day}`).then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setData(null); });
    return () => { alive = false; };
  }, [pool, day, version]);
  if (data && !data.menus.length) return null;
  const expired = data?.menus.flatMap((m) => m.expired.map((l) => ({ ...l, name: m.name }))) ?? [];
  return (
    <Panel title={tr("Batch codes to give (FIFO)")} description={data?.counted ? tr("From the physical leftover of {0}: the first to expire goes out first", dmyOf(data.counted)) : tr("First to expire goes out first")}>
      {!data ? <SkeletonList rows={3} /> : (
        <div className="space-y-4 p-4">
          {expired.length > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200"><PackageX size={15} className="mt-0.5 flex-shrink-0" />
              <span>{tr("Expired, do not give")}: {expired.map((l) => `${l.name} ${l.batchNo ?? "—"} (${l.qty})`).join(", ")}</span></p>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {data.menus.filter((m) => m.lots.length).map((m) => (
              <div key={m.menu} className="rounded-lg border border-neutral-200 p-3">
                <p className="mb-2 text-sm font-semibold text-neutral-900">{m.name}</p>
                <ol className="flex flex-wrap gap-1.5">
                  {m.lots.map((l, i) => (
                    <li key={`${l.batchNo}:${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-neutral-50 px-2 py-1 text-xs ring-1 ring-neutral-200">
                      <span className="text-[10px] font-bold tabular-nums text-neutral-400">{i + 1}</span>
                      <span className="font-mono font-semibold text-neutral-900">{l.new ? tr("New stock") : l.batchNo ?? tr("No code")}</span>
                      <span className="tabular-nums text-neutral-600">{l.qty}</span>
                      {when(l) && <Badge tone={tone(l.daysLeft)}>{when(l)}</Badge>}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          {data.drivers.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500"><ListOrdered size={13} />{tr("Per driver of the day")}</p>
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {data.drivers.map((d) => (
                  <li key={d.code} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
                    <span className="w-40 flex-shrink-0 truncate text-sm font-medium text-neutral-900">{d.name}</span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {d.lines.map((l, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ${l.short ? "bg-red-50 text-red-700 ring-red-200" : "bg-white text-neutral-700 ring-neutral-200"}`}>
                          {l.name} · <span className="font-mono font-semibold">{l.short ? tr("short") : l.batchNo ?? tr("new")}</span> × {l.qty}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

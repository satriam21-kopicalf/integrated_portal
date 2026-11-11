"use client";

// Storage & Assignment → what the pool can still assign to its drivers on the day, per menu: the opening (the physical
// leftover of the day before) + arrived / transfer (the workbook, else the simple transfers the team enters in ESB COTR,
// else the batches received) − already given to the drivers + brought back − waste / cupping of the pool. An assignment
// above it is refused.

import { PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Row = { menu: string; name: string; opening: number; in: number; given: number; back: number; used: number; left: number };

export function PoolAvailable({ pool, day, version }: { pool: string; day: string; version?: number }) {
  const [data, setData] = useState<{ counted: boolean; rows: Row[] } | null>(null);
  useEffect(() => {
    if (!pool) return;
    let alive = true;
    setData(null);
    call<{ counted: boolean; rows: Row[] }>(`/api/cotr/pool-available?pool=${encodeURIComponent(pool)}&day=${day}`)
      .then((r) => { if (alive) setData(r); }).catch(() => { if (alive) setData({ counted: false, rows: [] }); });
    return () => { alive = false; };
  }, [pool, day, version]);
  if (!pool) return null;
  return (
    <Panel title={tr("Stock ready to assign")} description={tr("Opening stock + arrived / transfer (ESB COTR or the workbook) − given to the drivers + back − waste / cupping of the pool")}>
      {!data ? <SkeletonList rows={2} /> : !data.counted ? (
        <p className="px-4 py-3 text-sm text-neutral-500">{tr("No physical leftover of the pool yet: set the opening stock in Product stock of the pool; assignments are not limited until then.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-neutral-500"><tr>
              <th className="px-4 py-2 text-left font-medium">{tr("Menu")}</th><th className="px-3 py-2 text-right font-medium">{tr("Opening Stock")}</th>
              <th className="px-3 py-2 text-right font-medium">{tr("Arrived / Transfer")}</th><th className="px-3 py-2 text-right font-medium">{tr("Given to drivers")}</th>
              <th className="px-3 py-2 text-right font-medium">{tr("Back from drivers")}</th><th className="px-3 py-2 text-right font-medium">{tr("Waste / cupping of the pool")}</th>
              <th className="px-4 py-2 text-right font-medium">{tr("Ready to assign")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.rows.map((r) => (
                <tr key={r.menu}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{r.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.opening}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.in ? `+${r.in}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.given ? `−${r.given}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.back ? `+${r.back}` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.used ? `−${r.used}` : "—"}</td>
                  <td className="px-4 py-2 text-right"><Badge tone={r.left <= 0 ? "red" : r.left < 50 ? "amber" : "green"}><PackageCheck size={12} /> {r.left}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

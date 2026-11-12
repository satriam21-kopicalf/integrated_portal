"use client";

// How fresh the figures of every pool / HUB are (recommendation #3, 2026-11-12): the newest ESB document per kind, the
// last workbook day, the last physical count and the last app shift, coloured by how many days behind today they are,
// and when ESB was last synced (every 30 minutes) — so the team knows whether a day is complete.

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, useToast } from "@/so/ui";
import { hasPage, useAuth } from "@/lib/auth";
import { Panel } from "@/components/kc/compat";
import { kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Row = { pool: string; name: string; esbSales: string | null; esbTransfer: string | null; esbJournal: string | null; sheet: string | null; count: string | null; app: string | null };
type Fresh = { synced: string | null; today: string; pools: Row[] };

const behind = (d: string | null, today: string) => (d ? Math.round((Date.parse(today) - Date.parse(d)) / 864e5) : null);

function Cell({ d, today }: { d: string | null; today: string }) {
  const n = behind(d, today);
  if (n === null) return <td className="px-3 py-2 text-right text-neutral-300">—</td>;
  const cls = n <= 1 ? "bg-emerald-50 text-emerald-800" : n <= 3 ? "bg-amber-50 text-amber-800" : "bg-neutral-100 text-neutral-500";
  return (
    <td className="px-3 py-2 text-right">
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs tabular-nums ${cls}`} title={n === 0 ? tr("today") : tr("{0} days ago", n)}>
        {dmyOf(d!).slice(0, 5)}{n > 1 && <span className="text-[10px] opacity-70">−{n}</span>}</span>
    </td>
  );
}

type Sync = { requested: string | null; done: string | null; every: number };

/** #4: ask the server to read ESB COTR now; waits for it (the host starts it within a minute) and reloads the figures. */
function SyncNow({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [s, setS] = useState<Sync | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<Sync>("/api/cotr/esb/sync-now").then(setS).catch(() => setS(null)); }, []);
  useEffect(() => {
    if (!s?.requested) return;
    const was = s.done;
    const timer = setInterval(() => {
      call<Sync>("/api/cotr/esb/sync-now").then((n) => { setS(n); if (!n.requested && n.done !== was) { toast(tr("ESB COTR synced")); onDone(); } }).catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [s?.requested, s?.done, onDone, toast]);
  if (!user || !hasPage(user, "cotr.production")) return null;
  const ask = async () => {
    setBusy(true);
    try { setS(await call<Sync>("/api/cotr/esb/sync-now", { method: "POST" })); toast(tr("Sync asked: it starts within a minute")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="secondary" loading={busy || !!s?.requested} onClick={() => void ask()} title={s?.done ? tr("Last sync by hand: {0}", wibDateTime(s.done)) : undefined}>
      <RefreshCw size={14} /> {s?.requested ? tr("Syncing…") : tr("Sync now")}</Button>
  );
}

export function Freshness() {
  const [data, setData] = useState<Fresh | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { call<Fresh>("/api/cotr/freshness").then(setData).catch(() => setData(null)); }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return (
    <Panel title={tr("How fresh the data is")} description={data?.synced ? tr("ESB last synced {0} (every 30 minutes); green = today or yesterday", wibDateTime(data.synced)) : tr("Newest day of every source per pool / HUB")}
      actions={<SyncNow onDone={reload} />}>
      {!data ? <SkeletonTable cols={7} /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Pool / HUB")}</th><th className="px-3 py-2.5 text-right">{tr("ESB sales")}</th>
              <th className="px-3 py-2.5 text-right">{tr("ESB transfers")}</th><th className="px-3 py-2.5 text-right">{tr("ESB journals")}</th>
              <th className="px-3 py-2.5 text-right">{tr("Workbook")}</th><th className="px-3 py-2.5 text-right">{tr("Physical count")}</th><th className="px-3 py-2.5 text-right">{tr("App")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {data.pools.map((p) => (
                <tr key={p.pool}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{p.name}</td>
                  <Cell d={p.esbSales} today={data.today} /><Cell d={p.esbTransfer} today={data.today} /><Cell d={p.esbJournal} today={data.today} />
                  <Cell d={p.sheet} today={data.today} /><Cell d={p.count} today={data.today} /><Cell d={p.app} today={data.today} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

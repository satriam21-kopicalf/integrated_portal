"use client";

// Master → Menu → the COTR products of ESB and the menu each one counts as (recommendation #5, migration 095): matched
// from the name by itself, or mapped here by hand once (a new product such as "Smooth Banana - COTR"); the workbooks and
// the ESB figures (pool stock, reconciliation, dashboard) follow the mapping.

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { Menu } from "@/cotr/types";
import { tr } from "@/lib/i18n";

type Product = { name: string; key: string; lines: number; qty: number; last: string | null; menu: string | null; menuName: string | null };

export function EsbProducts({ menus, onSaved }: { menus: Menu[]; onSaved: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Product[] | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { call<{ data: Product[] }>("/api/cotr/esb/products").then((r) => setRows(r.data)).catch(() => setRows([])); }, [tick]);
  const map = async (p: Product, code: string) => {
    setBusy(p.key);
    try {
      // the name leaves the menus that had it, and joins the one chosen
      for (const m of menus.filter((m) => (m.esb_aliases ?? []).includes(p.key) && m.code !== code)) {
        await call(`/api/cotr/masters/menus/${encodeURIComponent(m.code)}`, { method: "PUT", json: { esb_aliases: (m.esb_aliases ?? []).filter((a) => a !== p.key) } });
      }
      const to = menus.find((m) => m.code === code);
      if (to) await call(`/api/cotr/masters/menus/${encodeURIComponent(to.code)}`, { method: "PUT", json: { esb_aliases: [...(to.esb_aliases ?? []), p.key] } });
      toast(code ? tr("{0} counts as {1}", p.name, to?.name ?? code) : tr("Mapping removed"));
      onSaved(); setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const open = (rows ?? []).filter((p) => !p.menu).length;
  return (
    <Panel title={tr("ESB COTR products")} description={tr("The menu each product of ESB counts as (last 120 days): by its name, or mapped here once for a new product")}
      actions={rows ? (open ? <Badge tone="amber">{tr("{0} not mapped", open)}</Badge> : <Badge tone="green">{tr("All mapped")}</Badge>) : undefined}>
      {!rows ? <SkeletonTable cols={4} /> : (
        <table className="m-cards w-full text-sm">
          <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("ESB product")}</th><th className="px-3 py-2.5 text-right">{tr("Lines")}</th>
            <th className="px-3 py-2.5">{tr("Last seen")}</th><th className="px-4 py-2.5">{tr("Counts as menu")}</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((p) => {
              const byHand = menus.some((m) => (m.esb_aliases ?? []).includes(p.key));
              return (
                <tr key={p.key} className={p.menu ? undefined : "bg-amber-50/40"}>
                  <td className="px-4 py-2 font-medium text-neutral-900">{p.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{p.lines.toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2 tabular-nums text-neutral-600">{p.last ? dmyOf(p.last) : "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Select value={p.menu ?? ""} disabled={busy === p.key} onChange={(e) => void map(p, e.target.value)} className="h-9 w-52">
                        <option value="">{tr("Not a menu")}</option>{menus.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}</Select>
                      {p.menu && <span className="text-[11px] text-neutral-500">{byHand ? <span className="inline-flex items-center gap-1"><Link2 size={11} />{tr("mapped")}</span> : tr("by name")}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

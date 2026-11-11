"use client";

// Monitoring COTR → Storage & Production → ESB COTR (migration 090): the documents of the ESB company COTR (CALF5),
// synced every 30 minutes by the ESB engine (integration_esb_cotr) — simple sales and transfers of the HUBs, cupping /
// waste journals, the manufacturing of the storage, purchases, sales to the outlets, receipts and journals. Listed per
// module with the branch and period, a document opens with its lines, and every line goes to Excel.

import { Database, Download, FileText, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, kcTable } from "@/components/kc";
import Drawer from "@/components/kc/Drawer";
import { SkeletonList, SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { rupiah } from "@/cotr/ui";
import { tr } from "@/lib/i18n";
import { downloadXlsx } from "@/lib/xlsx";

type Mod = { module: string; name: string; docs: number; first: string | null; last: string | null; synced: string | null };
type Summary = { modules: Mod[]; branches: { code: string; name: string; pool: string | null }[] };
type Doc = { docNum: string; day: string; branch: string | null; location: string | null; counterparty: string | null; ref: string | null; type: string | null;
  status: string | null; total: number | null; info: string | null; by: string | null; lines: number | null };
type Line = { type: string; no: number; code: string | null; product: string | null; uom: string | null; qty: number | null; price: number | null; total: number | null;
  ref: string | null; notes: string | null; purpose: string | null };
type Detail = Doc & { name: string; synced: string | null; lines: Line[] };

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const num = (n: number | null) => (n === null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));

export function EsbCotr() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [module, setModule] = useState("simple_sales");
  const [branch, setBranch] = useState("");
  const [from, setFrom] = useState(`${todayWib().slice(0, 8)}01`);
  const [to, setTo] = useState(todayWib());
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Doc[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { call<Summary>("/api/cotr/esb/summary").then(setSummary).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let alive = true;
    setRows(null); setError(null);
    const p = new URLSearchParams({ module, dateFrom: from, dateTo: to });
    if (branch) p.set("branch", branch);
    if (query) p.set("q", query);
    call<{ rows: Doc[]; more: boolean }>(`/api/cotr/esb/documents?${p}`)
      .then((r) => { if (alive) { setRows(r.rows); setMore(r.more); } }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [module, branch, from, to, query, tick]);
  const mod = summary?.modules.find((m) => m.module === module);
  const lastSync = summary?.modules.map((m) => m.synced).filter(Boolean).sort().pop();
  const exportXlsx = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams({ module, dateFrom: from, dateTo: to });
      if (branch) p.set("branch", branch);
      const { data } = await call<{ data: (Line & { docNum: string; day: string; branch: string | null; counterparty: string | null; status: string | null; info: string | null; product: string | null })[] }>(`/api/cotr/esb/lines?${p}`);
      await downloadXlsx({ fileName: `ESB COTR ${mod?.name ?? module} ${from} - ${to}`, sheet: (mod?.name ?? module).slice(0, 31),
        title: `ESB COTR · ${mod?.name ?? module} · ${branch || tr("All branches")} · ${dmyOf(from)} – ${dmyOf(to)}`,
        header: [tr("Document"), tr("Day"), tr("Branch"), tr("Counterparty"), tr("Status"), tr("Note"), tr("Line"), tr("Code"), tr("Product"), tr("Unit"), tr("Qty"), tr("Price"), tr("Total"), tr("Purpose")],
        rows: data.map((l) => [l.docNum, l.day, l.branch, l.counterparty, l.status, l.info, l.type, l.code, l.product, l.uom, l.qty, l.price, l.total, l.purpose]) });
    } catch (e) { toast((e as Error).message, "error"); } finally { setExporting(false); }
  };
  return (
    <>
      <StatGrid label={tr("ESB COTR")} cols={3}>
        <StatCard label={tr("Modules synced")} tone="brand" icon={<Database />} value={summary ? summary.modules.filter((m) => m.docs).length : "…"} sub={tr("company CALF5 · Calf COTR")} />
        <StatCard label={tr("Documents")} icon={<FileText />} value={summary ? summary.modules.reduce((a, m) => a + m.docs, 0).toLocaleString("id-ID") : "…"} sub={summary ? tr("{0} branches", summary.branches.length) : undefined} />
        <StatCard label={tr("Last sync")} value={lastSync ? wibDateTime(lastSync) : "—"} sub={tr("every 30 minutes")} />
      </StatGrid>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={tr("Module")}><Select value={module} onChange={(e) => setModule(e.target.value)}>
          {(summary?.modules ?? [{ module: "simple_sales", name: "Simple Sales", docs: 0 } as Mod]).map((m) => <option key={m.module} value={m.module}>{m.name}{m.docs ? ` (${m.docs.toLocaleString("id-ID")})` : ""}</option>)}
        </Select></Field>
        <Field label={tr("Branch")}><Select value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">{tr("All branches")}</option>
          {(summary?.branches ?? []).map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}</Select></Field>
        <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label={tr("Until")}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <label className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search number, note, counterparty")} className="pl-8" /></label>
        <Button variant="secondary" loading={exporting} disabled={!rows?.length} onClick={() => void exportXlsx()}><Download size={15} /> {tr("Export Excel")}</Button>
      </div>
      <Panel title={mod?.name ?? tr("Documents")} description={mod?.first ? tr("Synced from {0} to {1}", dmyOf(mod.first), dmyOf(mod.last ?? mod.first)) : tr("The documents of the ESB company COTR")}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !rows ? <SkeletonTable cols={6} /> : rows.length === 0 ? (
          <EmptyState icon={<FileText />} title={tr("No documents in this period")} />
        ) : (
          <>
            {more && <p className="px-4 pt-3 text-xs text-amber-700">{tr("Only the first 2,000 are shown: narrow the period or the branch")}</p>}
            <table className="m-cards w-full text-sm">
              <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Document")}</th><th className="px-3 py-2.5">{tr("Day")}</th><th className="px-3 py-2.5">{tr("Branch")}</th>
                <th className="px-3 py-2.5">{tr("Counterparty")}</th><th className="px-3 py-2.5">{tr("Note")}</th><th className="px-3 py-2.5 text-right">{tr("Total")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => (
                  <tr key={r.docNum} className="cursor-pointer hover:bg-neutral-50" onClick={() => setOpen(r.docNum)}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-neutral-900">{r.docNum}<span className="block font-sans text-[11px] font-normal text-neutral-400">{tr("{0} lines", r.lines ?? 0)}</span></td>
                    <td className="px-3 py-2.5 tabular-nums">{dmyOf(r.day)}</td>
                    <td className="px-3 py-2.5">{r.branch ?? "—"}</td>
                    <td className="px-3 py-2.5">{r.counterparty ?? "—"}</td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 text-xs text-neutral-600" title={r.info ?? undefined}>{r.info ?? "—"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.total !== null ? rupiah(r.total) : "—"}</td>
                    <td className="px-4 py-2.5">{r.status ? <Badge tone={/author|approv|close|done/i.test(r.status) ? "green" : "slate"}>{r.status}</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Panel>
      {open && <DocDrawer module={module} docNum={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function DocDrawer({ module, docNum, onClose }: { module: string; docNum: string; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { call<Detail>(`/api/cotr/esb/documents/${module}/${encodeURIComponent(docNum)}`).then(setD).catch((e: Error) => setError(e.message)); }, [module, docNum]);
  return (
    <Drawer open onClose={onClose} icon={<FileText size={18} />} title={docNum} description={d ? `${d.name} · ${dmyOf(d.day)} · ${d.branch ?? ""}` : undefined}
      footer={<Button variant="ghost" onClick={onClose}>{tr("Close")}</Button>}>
      {error ? <p className="text-sm text-red-600">{error}</p> : !d ? <SkeletonList rows={5} /> : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {([[tr("Branch"), d.branch], [tr("Location"), d.location], [tr("Counterparty"), d.counterparty], [tr("Reference"), d.ref], [tr("Type"), d.type],
              [tr("Status"), d.status], [tr("Total"), d.total !== null ? rupiah(d.total) : null], [tr("Created by"), d.by]] as [string, string | null][])
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[11px] text-neutral-500">{k}</dt><dd className="font-medium text-neutral-900">{v}</dd></div>)}
          </dl>
          {d.info && <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{d.info}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-neutral-500"><tr><th className="py-1.5 text-left">{tr("Product")}</th><th className="py-1.5 text-right">{tr("Qty")}</th><th className="py-1.5 text-left pl-2">{tr("Unit")}</th>
                <th className="py-1.5 text-right">{tr("Price")}</th><th className="py-1.5 text-right">{tr("Total")}</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {d.lines.map((l) => (
                  <tr key={`${l.type}:${l.no}`}>
                    <td className="py-1.5 pr-2"><span className="font-medium text-neutral-900">{l.product ?? l.notes ?? "—"}</span>
                      <span className="block text-[10px] text-neutral-400">{[l.code, l.purpose, l.type !== "detail" ? l.type : null].filter(Boolean).join(" · ")}</span></td>
                    <td className="py-1.5 text-right tabular-nums">{num(l.qty)}</td>
                    <td className="py-1.5 pl-2 text-neutral-500">{l.uom ?? ""}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.price !== null ? num(l.price) : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{l.total !== null ? num(l.total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.synced && <p className="text-[11px] text-neutral-400">{tr("Synced {0}", wibDateTime(d.synced))}</p>}
        </div>
      )}
    </Drawer>
  );
}

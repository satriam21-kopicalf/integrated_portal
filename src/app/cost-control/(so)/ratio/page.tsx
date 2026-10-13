"use client";

// Outlet ratio (Cost Control): the sheet the team builds by hand in "CALF – Rasio Outlet" (e.g. SEP-W5), from the ESB
// data the portal syncs: gross sales, purchases from Warehouse (BB), Central Kitchen (espresso) and CK Food (dimsum),
// COGS & usage ratios with the stock opname of the day before and the last day. SO values and the MDR of a month can
// be corrected here (with the reason), as the team does in the workbook.

import { ArrowDown, ArrowUp, Download, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, Field, Input, Page, Panel, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import { serverMsg, tr } from "@/lib/i18n";

type So = { value: number | null; esb: number | null; doc: string | null; docDate: string | null; docStatus: string | null; date: string;
  override: { value: number; note: string; by: string | null; at: string } | null };
type Row = {
  branchCode: string; branchName: string; gross: number; nett: number; pendapatan: number | null; mdrPct: number | null; netBasis: string;
  bb: number; espresso: number; dimsum: number; otherPurchases: number; cogs: number; espressoShare: number | null; bbRatio: number | null;
  espressoRatio: number | null; cogsRatioGross: number | null; cogsRatioNet: number | null; soStart: So; soEnd: So; usage: number | null;
  usageRatioGross: number | null; usageRatioNet: number | null; delta: number | null; nonSales: number; itemJournal: number;
};
type Total = Omit<Row, "branchCode" | "branchName" | "soStart" | "soEnd" | "pendapatan" | "mdrPct" | "netBasis" | "delta"> & {
  net: number; soStart: number; soEnd: number; outlets: number; outletsWithSo: number; nonSalesPct: number | null; itemJournalPct: number | null;
};
type Data = { period: { from: string; to: string; soStart: string; soEnd: string; month: string; mdrEditable: boolean }; outlets: Row[]; total: Total };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const rp = (v: number | null | undefined) => (v === null || v === undefined ? "-" : Math.round(v).toLocaleString("id-ID"));
const pc = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${(v * 100).toFixed(1)}%`);
const dmy = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
  return body as T;
}

/** Periods of the workbook: cumulative from the 1st (1-7, 1-14, 1-21, 1-28) or the whole month. */
function presets(month: Date) {
  const y = month.getFullYear(), m = month.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const cap = (d: number) => {
    const day = new Date(y, m, d);
    return day > today ? today : day;
  };
  return [7, 14, 21, 28].map((d, i) => ({ key: `W${i + 1}`, label: `W${i + 1} (1–${d})`, from: iso(new Date(y, m, 1)), to: iso(cap(d)) }))
    .concat([{ key: "M", label: tr("Whole month (1–{0})", last), from: iso(new Date(y, m, 1)), to: iso(cap(last)) }]);
}

type SortKey = keyof Row;
const COLS: { key: SortKey; label: string; kind: "rp" | "pct" | "so" | "mdr"; group?: string }[] = [
  { key: "gross", label: "Gross sales", kind: "rp" },
  { key: "mdrPct", label: "MDR", kind: "mdr" },
  { key: "bb", label: "Pembelian BB", kind: "rp", group: "buy" },
  { key: "espresso", label: "Espresso", kind: "rp", group: "buy" },
  { key: "dimsum", label: "Dimsum", kind: "rp", group: "buy" },
  { key: "cogs", label: "COGS value", kind: "rp" },
  { key: "espressoShare", label: "% Esp", kind: "pct" },
  { key: "bbRatio", label: "BB ratio", kind: "pct" },
  { key: "espressoRatio", label: "Esp ratio", kind: "pct" },
  { key: "cogsRatioGross", label: "COGS gross", kind: "pct" },
  { key: "cogsRatioNet", label: "COGS net", kind: "pct" },
  { key: "soStart", label: "SO awal", kind: "so" },
  { key: "soEnd", label: "SO akhir", kind: "so" },
  { key: "usageRatioGross", label: "Usage gross", kind: "pct" },
  { key: "usageRatioNet", label: "Usage net", kind: "pct" },
  { key: "delta", label: "Δ COGS−usage", kind: "pct" },
  { key: "nonSales", label: "Non sales", kind: "rp" },
  { key: "itemJournal", label: "Item journal", kind: "rp" },
];

export default function RatioPage() {
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [range, setRange] = useState(() => presets(new Date(new Date().getFullYear(), new Date().getMonth(), 1)).at(-1)!);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "cogsRatioGross", desc: true });
  const [editSo, setEditSo] = useState<{ row: Row; which: "soStart" | "soEnd" } | null>(null);

  const query = `dateFrom=${range.from}&dateTo=${range.to}`;
  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      setData(await call<Data>(`/api/cost-control/ratio?${query}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const val = (r: Row) => { const v = r[sort.key]; return typeof v === "object" && v ? (v as So).value : (v as number | string | null); };
    return (data?.outlets ?? []).filter(r => !s || r.branchName.toLowerCase().includes(s) || r.branchCode.toLowerCase().includes(s))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1);
      });
  }, [data, q, sort]);

  const saveMdr = async (row: Row, value: string) => {
    const pct = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (pct !== null && (Number.isNaN(pct) || pct < 0 || pct >= 100)) { toast(tr("MDR must be between 0 and 100"), "error"); return; }
    if (pct === row.mdrPct) return;
    try {
      await call("/api/cost-control/ratio/mdr", { method: "PUT", body: JSON.stringify({ branchCode: row.branchCode, month: data!.period.month, pct }) });
      void load();
    } catch (e) { toast((e as Error).message, "error"); }
  };

  const t = data?.total;
  const monthLabel = month.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return (
    <Page title={tr("Outlet ratio")} subtitle={tr("COGS, BB, espresso and usage ratio per outlet, as the Cost Control workbook, from ESB data")}
      actions={<a href={`/api/cost-control/ratio/export?${query}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><Download size={16} /> Excel</a>}>
      <Panel>
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
          <input type="month" value={iso(month).slice(0, 7)} aria-label={tr("Month")}
            onChange={e => { if (!e.target.value) return; const [y, m] = e.target.value.split("-").map(Number); const d = new Date(y, m - 1, 1); setMonth(d); setRange(presets(d).at(-1)!); }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm" />
          {presets(month).map(p => (
            <button key={p.key} type="button" onClick={() => setRange(p)} aria-pressed={range.key === p.key && range.from === p.from}
              className={cx("h-9 rounded-lg border px-3 text-xs font-medium", range.key === p.key && range.from === p.from ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
              {p.label}
            </button>
          ))}
          <div className="relative ml-auto w-full sm:w-64">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search outlet")} aria-label={tr("Search outlet")}
              className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm" />
          </div>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          {monthLabel} · {dmy(range.from)} – {dmy(range.to)} · {data ? tr("SO awal {0}, SO akhir {1}", dmy(data.period.soStart), dmy(data.period.soEnd)) : ""}
          {" · "}{tr("Net = Pendapatan (gross × (1 − MDR)) when the MDR is filled in, otherwise ESB nett sales")}
        </p>
      </Panel>

      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : (
        <>
          <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Tile label={tr("Gross sales")} value={rp(t?.gross)} sub={t ? tr("{0} outlets", t.outlets) : ""} />
            <Tile label={tr("COGS value")} value={rp(t?.cogs)} sub={t ? `BB ${rp(t.bb)} · Esp ${rp(t.espresso)}` : ""} />
            <Tile label={tr("COGS ratio gross")} value={pc(t?.cogsRatioGross)} sub={t ? tr("net {0}", pc(t.cogsRatioNet)) : ""} strong />
            <Tile label={tr("Usage ratio gross")} value={pc(t?.usageRatioGross)} sub={t ? tr("net {0} · {1} outlets with SO", pc(t.usageRatioNet), t.outletsWithSo) : ""} />
            <Tile label={tr("BB ratio")} value={pc(t?.bbRatio)} sub={t ? tr("espresso {0}", pc(t.espressoRatio)) : ""} />
            <Tile label={tr("Non sales · item journal")} value={rp(t ? t.nonSales + t.itemJournal : null)} sub={t ? `${pc(t.nonSalesPct)} · ${pc(t.itemJournalPct)}` : ""} />
          </div>
          <Panel>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[1600px] text-xs">
                <thead className={cx(theadClass, "sticky top-0 z-10")}>
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5">{tr("Outlet")}</th>
                    {COLS.map(c => (
                      <th key={c.key} className="whitespace-nowrap px-2 py-2.5 text-right">
                        <button type="button" onClick={() => setSort(s => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}
                          className="inline-flex items-center gap-0.5 uppercase hover:text-slate-800">
                          {c.label}{sort.key === c.key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!data ? <SkeletonRows cols={COLS.length + 1} /> : rows.map(r => (
                    <tr key={r.branchCode} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 z-[1] max-w-[15rem] bg-white px-3 py-2">
                        <span className="block truncate font-medium text-slate-900" title={r.branchName}>{r.branchName}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{r.branchCode}</span>
                      </td>
                      {COLS.map(c => (
                        <td key={c.key} className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {c.kind === "rp" ? rp(r[c.key] as number) : c.kind === "pct" ? pc(r[c.key] as number | null)
                            : c.kind === "mdr" ? (data.period.mdrEditable ? (
                              <input defaultValue={r.mdrPct ?? ""} placeholder="—" inputMode="decimal" aria-label={`MDR ${r.branchName}`}
                                onBlur={e => void saveMdr(r, e.target.value)} onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className="h-7 w-16 rounded border border-slate-200 px-1.5 text-right" />
                            ) : (r.mdrPct === null ? "-" : `${r.mdrPct}%`))
                            : <SoCell so={r[c.key] as So} onEdit={() => setEditSo({ row: r, which: c.key as "soStart" | "soEnd" })} />}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data && rows.length === 0 && <tr><td colSpan={COLS.length + 1} className="py-10 text-center text-sm text-slate-400">{tr("No outlet matches")}</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
      {editSo && data && <SoDialog row={editSo.row} which={editSo.which} onClose={() => setEditSo(null)} onSaved={() => { setEditSo(null); void load(); }} />}
    </Page>
  );
}

function Tile({ label, value, sub, strong }: { label: string; value: string; sub: string; strong?: boolean }) {
  return (
    <div className={cx("rounded-xl border bg-white p-3 shadow-sm", strong ? "border-slate-900" : "border-slate-200")}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function SoCell({ so, onEdit }: { so: So; onEdit: () => void }) {
  return (
    <button type="button" onClick={onEdit} className="group inline-flex items-center gap-1 rounded px-1 hover:bg-slate-100"
      title={so.override ? `${tr("Corrected")}: ${so.override.note}` : so.doc ? `${so.doc} · ${so.docDate} · ${so.docStatus}` : tr("No stock opname document")}>
      {so.override && <Badge tone="violet">{tr("Corrected")}</Badge>}
      <span className={so.value === null ? "text-slate-300" : ""}>{rp(so.value)}</span>
      <Pencil size={11} className="text-slate-300 group-hover:text-slate-600" />
    </button>
  );
}

function SoDialog({ row, which, onClose, onSaved }: { row: Row; which: "soStart" | "soEnd"; onClose: () => void; onSaved: () => void }) {
  const so = row[which];
  const [value, setValue] = useState(so.override ? String(so.override.value) : so.esb !== null ? String(Math.round(so.esb)) : "");
  const [note, setNote] = useState(so.override?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      await call("/api/cost-control/ratio/so-override", { method: "PUT", body: JSON.stringify({ branchCode: row.branchCode, date: so.date, ...body }) });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open size="sm" onClose={onClose} title={tr("{0} · {1}", which === "soStart" ? tr("SO awal") : tr("SO akhir"), row.branchName)}
      description={tr("Stock value on {0}", dmy(so.date))}
      footer={<>
        {so.override && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={() => void send({ value: null, note: "" })}>{tr("Use the ESB value")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!value.trim() || !note.trim()} onClick={() => void send({ value: Number(value.replace(/\./g, "").replace(",", ".")), note })}>{tr("Save correction")}</Button>
      </>}>
      <div className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {so.doc ? tr("ESB stock opname {0} ({1}, {2}): Rp {3}", so.doc, so.docDate ?? "", so.docStatus ?? "", rp(so.esb)) : tr("No ESB stock opname document around this date.")}
        </p>
        <Field label={tr("Value used (Rp)")} required><Input inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} /></Field>
        <Field label={tr("Reason")} required><Input value={note} onChange={e => setNote(e.target.value)} placeholder={tr("e.g. espresso stock counted separately")} /></Field>
        {so.override && <p className="text-[11px] text-slate-400">{tr("Last corrected by {0}", so.override.by ?? "-")}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}



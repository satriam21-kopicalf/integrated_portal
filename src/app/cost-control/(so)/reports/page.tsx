"use client";

// SO report (06.9 §12.11): the stock opname reviewed by Cost Control (approved and/or exported) of a period as one tidy
// .xlsx: sheet "Stock Opname" in the columns of the Stock Opname Report (one row per branch x item, ESB unit, actual
// qty, price, value), "Summary" with one row per count, "WIP premix" and one sheet per branch. Every filter sits in
// one drawer; the figures show what the file will hold.

import { Building2, FileSpreadsheet, Layers, ListChecks } from "lucide-react";
import ExcelIconButton from "@/components/ExcelIconButton";
import { useEffect, useMemo, useState } from "react";
import { Badge, Checkbox, Empty, Page, Panel, SkeletonRows, fmtNumber, theadClass, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { STATUS, countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Facility = { id: string; name: string; code: string; facility_type: string };
type CountType = { code: string; name: string };
type Row = { id: string; number: string; facility_id: string; facility_name: string; count_type: string; business_date: string; status: string; lines: number };
type F = { period: Period; type: string; facility: string; status: string; perBranch: boolean };

const DEFAULT: () => F = () => ({ period: { from: wibDay(-6), to: wibDay(0) }, type: "", facility: "", status: "REVIEWED", perBranch: true });
const STATUS_LABEL: Record<string, () => string> = {
  REVIEWED: () => tr("Approved + exported"), APPROVED: () => tr("Approved"), EXPORTED: () => tr("Exported"),
};

export default function ReportsPage() {
  const toast = useToast();
  const [f, setF] = useState<F>(DEFAULT);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [types, setTypes] = useState<CountType[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Facility[]>("/api/so/count-settings/facilities").then(setFacilities).catch(() => setFacilities([]));
    void api<CountType[]>("/api/so/count-settings/types").then(setTypes).catch(() => setTypes([]));
  }, []);
  useEffect(() => {
    setRows(null);
    const q = (s: string) => `/api/so/counts?date_from=${f.period.from}&date_to=${f.period.to}&status=${s}${f.type ? `&count_type=${f.type}` : ""}${f.facility ? `&facility_id=${f.facility}` : ""}`;
    const wanted = f.status === "REVIEWED" ? ["APPROVED", "EXPORTED"] : [f.status];
    Promise.all(wanted.map((s) => api<Row[]>(q(s))))
      .then((r) => setRows(r.flat().sort((a, b) => b.business_date.localeCompare(a.business_date) || a.facility_name.localeCompare(b.facility_name))))
      .catch((e) => { setRows([]); toast(errorText(e), "error"); });
  }, [f, toast]);

  const all = useMemo(() => rows ?? [], [rows]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => !s || r.facility_name.toLowerCase().includes(s) || r.number.toLowerCase().includes(s));
  }, [all, search]);
  const branches = new Set(all.map((r) => r.facility_id)).size;
  const lines = all.reduce((a, r) => a + r.lines, 0);
  const typesIn = new Set(all.map((r) => r.count_type));

  const download = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ date_from: f.period.from, date_to: f.period.to, status: f.status, per_branch: String(f.perBranch),
        ...(f.type ? { count_type: f.type } : {}), ...(f.facility ? { facility_id: f.facility } : {}) });
      const res = await fetch(`/api/so/count-reports/file?${qs}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname Report ${f.period.from} - ${f.period.to}.xlsx` }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const def = DEFAULT();
  const facilityName = facilities.find((x) => x.id === f.facility)?.name;
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to
      ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.type ? [{ key: "t", label: countTypeLabel(f.type, types.find((t) => t.code === f.type)?.name), onRemove: () => setF({ ...f, type: "" }) }] : []),
    ...(f.facility ? [{ key: "b", label: facilityName ?? tr("Branch"), onRemove: () => setF({ ...f, facility: "" }) }] : []),
    ...(f.status !== "REVIEWED" ? [{ key: "s", label: STATUS_LABEL[f.status](), onRemove: () => setF({ ...f, status: "REVIEWED" }) }] : []),
    ...(!f.perBranch ? [{ key: "pb", label: tr("Without branch sheets"), onRemove: () => setF({ ...f, perBranch: true }) }] : []),
  ];

  return (
    <Page title={tr("SO report")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("reviewed stock opname in the layout of the Stock Opname Report")}`}
      actions={<ExcelIconButton label={tr("Download SO report")} loading={busy} disabled={!rows?.length} onClick={download} />}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Counts")} emphasis icon={<ListChecks size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{STATUS_LABEL[f.status]()}</p>}
          </Stat>
          <Stat label={tr("Branches")} icon={<Building2 size={13} />} value={rows ? fmtNumber(branches) : <StatSkeleton />}>
            {rows && <p>{f.perBranch ? tr("one sheet per branch") : tr("one table for every branch")}</p>}
          </Stat>
          <Stat label={tr("Item lines")} icon={<Layers size={13} />} value={rows ? fmtNumber(lines) : <StatSkeleton />}>
            {rows && <p>{tr("rows in the Stock Opname sheet")}</p>}
          </Stat>
          <Stat label={tr("Count types")} value={rows ? fmtNumber(typesIn.size) : <StatSkeleton />}>
            {rows && <p className="truncate">{[...typesIn].map((t) => countTypeLabel(t)).join(", ") || "—"}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search branch or count number")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(DEFAULT())} />}
        footer={<span className="flex items-center gap-1.5"><FileSpreadsheet size={13} /> {tr("Sheets: Stock Opname · Summary · WIP premix{0} · dates as 14/09/2026 · qty with two decimals", f.perBranch ? ` · ${tr("one per branch")}` : "")}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Date")}</th><th className="px-4 py-2.5">{tr("Branch")}</th>
              <th className="px-4 py-2.5">{tr("Count type")}</th><th className="px-4 py-2.5 text-right">{tr("Lines")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows === null ? <SkeletonRows cols={5} rows={4} /> : shown.length === 0 ? (
                <tr><td colSpan={5}><Empty icon={<FileSpreadsheet size={28} />} title={tr("No reviewed stock opname in this period")}>{tr("Change the period or the filters.")}</Empty></td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{dmy(r.business_date)}</td>
                  <td className="px-4 py-2.5"><span className="block font-medium text-slate-900">{r.facility_name}</span><span className="font-mono text-[11px] text-slate-400">{r.number}</span></td>
                  <td className="px-4 py-2.5">{countTypeLabel(r.count_type)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(r.lines)}</td>
                  <td className="px-4 py-2.5"><Badge tone={STATUS[r.status]?.tone ?? "slate"}>{STATUS[r.status]?.label() ?? r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {sheet && <ReportFilters value={f} facilities={facilities} types={types} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Page>
  );
}

function ReportFilters({ value, facilities, types, onApply, onClose }: {
  value: F; facilities: Facility[]; types: CountType[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(DEFAULT())} applyDisabled={days > 93}>
      <FilterSection title={tr("Count day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={93} /></FilterSection>
      <FilterSection title={tr("Status")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={["REVIEWED", "APPROVED", "EXPORTED"].map((s) => ({ value: s, label: STATUS_LABEL[s]() }))} />
      </FilterSection>
      <FilterSection title={tr("Count type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All types") }, ...types.map((t) => ({ value: t.code, label: countTypeLabel(t.code, t.name) }))]} />
      </FilterSection>
      <FilterSection title={tr("Branch")}>
        <SearchChoice label="" anyLabel={tr("All branches")} value={d.facility} onChange={(v) => setD({ ...d, facility: v })} placeholder={tr("Search branch name or code")}
          options={facilities.map((x) => ({ value: x.id, label: x.name, meta: <span className="font-mono text-[10px] text-slate-400">{x.code}</span> }))} />
      </FilterSection>
      <FilterSection title={tr("File")}>
        <Checkbox label={tr("One sheet per branch")} hint={tr("Besides the table of every branch, the Summary and the WIP premix sheet")}
          checked={d.perBranch} onChange={(e) => setD({ ...d, perBranch: e.target.checked })} />
      </FilterSection>
    </FilterSheet>
  );
}

"use client";

// SO report (06.9 §12.11): the stock opname reviewed by Cost Control (approved and/or exported) of a period as one tidy
// .xlsx: sheet "Stock Opname" in the columns of the Stock Opname Report (one row per branch x item, ESB unit, actual
// qty, price, value), "Summary" with one row per count, "WIP premix" and one sheet per branch. Every filter sits in
// one drawer; the figures show what the file will hold.

import { ccUrl } from "@/lib/company";
import { SortTh, useSort } from "@/so/ui/Sort";
import { Building2, FileSpreadsheet, Layers, ListChecks } from "lucide-react";
import ExcelIconButton from "@/components/ExcelIconButton";
import { useEffect, useMemo, useState } from "react";
import { Badge, Checkbox, Empty, Page, Panel, SkeletonRows, fmtNumber, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { SoGroupTabs, soGroupOf, soGroupTypes, useSoGroup } from "@/so/ui/SoGroupTabs";
import { STATUS, countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Facility = { id: string; name: string; code: string; facility_type: string };
type CountType = { code: string; name: string };
type Row = { id: string; number: string; facility_id: string; facility_name: string; count_type: string; business_date: string; status: string; lines: number };
type F = { period: Period; type: string; facility: string; status: string; perBranch: boolean };
type RKey = "date" | "branch" | "type" | "lines" | "status";
const rValue = (r: Row, k: RKey) => ({ date: r.business_date, branch: r.facility_name, type: r.count_type, lines: r.lines, status: r.status }[k]);

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
  const [group, setGroupOnly] = useSoGroup();
  const setGroup = (g: typeof group) => { setGroupOnly(g); setF((x) => ({ ...x, type: "" })); };

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

  // Daily apart from Weekly - Monthly (2026-11-09): the list, the figures and the download follow the tab
  const all = useMemo(() => (rows ?? []).filter((r) => soGroupOf(r.count_type) === group), [rows, group]);
  const groupTypes = types.filter((t) => soGroupOf(t.code) === group && ((t as CountType & { is_active?: boolean }).is_active !== false || all.some((r) => r.count_type === t.code)));
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => !s || r.facility_name.toLowerCase().includes(s) || r.number.toLowerCase().includes(s));
  }, [all, search]);
  const sorted = useSort<Row, RKey>(shown, rValue);
  const paged = usePaged(sorted.rows, shown.length + search + JSON.stringify(f) + JSON.stringify(sorted.sort));
  const branches = new Set(all.map((r) => r.facility_id)).size;
  const lines = all.reduce((a, r) => a + r.lines, 0);
  const typesIn = new Set(all.map((r) => r.count_type));

  const download = async () => {
    setBusy(true);
    try {
      const kinds = f.type || soGroupTypes([...groupTypes.map((t) => t.code), ...all.map((r) => r.count_type)], group);
      if (!kinds) throw new Error(tr("No count with this status in the period"));
      const qs = new URLSearchParams({ date_from: f.period.from, date_to: f.period.to, status: f.status, per_branch: String(f.perBranch),
        count_type: kinds, ...(f.facility ? { facility_id: f.facility } : {}) });
      const res = await fetch(ccUrl(`/api/so/count-reports/file?${qs}`), { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname Report ${group === "daily" ? "Daily" : "Weekly-Monthly"} ${f.period.from} - ${f.period.to}.xlsx` }).click();
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
    ...(!f.perBranch ? [{ key: "pb", label: tr("Without Branch Sheets"), onRemove: () => setF({ ...f, perBranch: true }) }] : []),
  ];

  return (
    <Page title={tr("Report Stock Opname")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("reviewed stock opname in the layout of the Stock Opname Report")}`}
      stats={<>
        <SoGroupTabs value={group} onChange={setGroup} counts={rows ? { daily: rows.filter((r) => soGroupOf(r.count_type) === "daily").length, periodic: rows.filter((r) => soGroupOf(r.count_type) === "periodic").length } : undefined} />
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Counts")} emphasis icon={<ListChecks size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{STATUS_LABEL[f.status]()}</p>}
          </Stat>
          <Stat label={tr("Branches")} icon={<Building2 size={13} />} value={rows ? fmtNumber(branches) : <StatSkeleton />}>
            {rows && <p>{f.perBranch ? tr("one sheet per branch") : tr("one table for every branch")}</p>}
          </Stat>
          <Stat label={tr("Item Lines")} icon={<Layers size={13} />} value={rows ? fmtNumber(lines) : <StatSkeleton />}>
            {rows && <p>{tr("rows in the Stock Opname sheet")}</p>}
          </Stat>
          <Stat label={tr("Count Types")} icon={<FileSpreadsheet size={13} />} value={rows ? fmtNumber(typesIn.size) : <StatSkeleton />}>
            {rows && <p className="truncate">{[...typesIn].map((t) => countTypeLabel(t)).join(", ") || "—"}</p>}
          </Stat>
        </StatStrip>
      </>}>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search branch or count number")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setF(DEFAULT())}
        extra={<div className="ml-auto"><ExcelIconButton label={tr("Download Report Stock Opname")} loading={busy} disabled={!all.length} onClick={download} /></div>} />}
        footer={<><span className="flex items-center gap-1.5"><FileSpreadsheet size={13} /> {tr("Sheets: Stock Opname · Summary · WIP premix{0} · dates as 14/09/2026 · qty with two decimals", f.perBranch ? ` · ${tr("one per branch")}` : "")}</span><PageNav paged={paged} /></>}>
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[600px] text-sm">
            <thead className={theadClass}><tr><SortTh k="date" sort={sorted.sort} onSort={sorted.toggle} first="desc">{tr("Date")}</SortTh><SortTh k="branch" sort={sorted.sort} onSort={sorted.toggle}>{tr("Branch")}</SortTh>
              <SortTh k="type" sort={sorted.sort} onSort={sorted.toggle}>{tr("Count Type")}</SortTh><SortTh k="lines" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Lines")}</SortTh><SortTh k="status" sort={sorted.sort} onSort={sorted.toggle}>{tr("Status")}</SortTh></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {rows === null ? <SkeletonRows cols={5} rows={4} /> : shown.length === 0 ? (
                <tr><td colSpan={5}><Empty icon={<FileSpreadsheet size={28} />} title={tr("No reviewed stock opname in this period")}>{tr("Change the period or the filters.")}</Empty></td></tr>
              ) : paged.rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50/70">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{dmy(r.business_date)}</td>
                  <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{r.facility_name}</span><span className="font-mono text-[11px] text-neutral-400">{r.number}</span></td>
                  <td className="px-4 py-2.5">{countTypeLabel(r.count_type)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(r.lines)}</td>
                  <td className="px-4 py-2.5"><Badge tone={STATUS[r.status]?.tone ?? "slate"}>{STATUS[r.status]?.label() ?? r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {sheet && <ReportFilters value={f} facilities={facilities} types={groupTypes} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
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
      <FilterSection title={tr("Count Day")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={93} /></FilterSection>
      <FilterSection title={tr("Status")}>
        <ChoiceGroup label="" value={d.status} onChange={(v) => setD({ ...d, status: v })}
          choices={["REVIEWED", "APPROVED", "EXPORTED"].map((s) => ({ value: s, label: STATUS_LABEL[s]() }))} />
      </FilterSection>
      <FilterSection title={tr("Count Type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })}
          choices={[{ value: "", label: tr("All Types") }, ...types.map((t) => ({ value: t.code, label: countTypeLabel(t.code, t.name) }))]} />
      </FilterSection>
      <FilterSection title={tr("Branch")}>
        <SearchChoice label="" anyLabel={tr("All Branches")} value={d.facility} onChange={(v) => setD({ ...d, facility: v })} placeholder={tr("Search branch name or code")}
          options={facilities.map((x) => ({ value: x.id, label: x.name, meta: <span className="font-mono text-[10px] text-neutral-400">{x.code}</span> }))} />
      </FilterSection>
      <FilterSection title={tr("File")}>
        <Checkbox label={tr("One Sheet per Branch")} hint={tr("Besides the table of every branch, the Summary and the WIP premix sheet")}
          checked={d.perBranch} onChange={(e) => setD({ ...d, perBranch: e.target.checked })} />
      </FilterSection>
    </FilterSheet>
  );
}

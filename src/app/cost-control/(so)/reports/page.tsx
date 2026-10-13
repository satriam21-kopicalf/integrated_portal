"use client";

// SO report (06.9 §12.11): the stock opname reviewed by Cost Control (approved and/or exported) of a period as one tidy
// .xlsx: sheet "Stock Opname" in the columns of the Stock Opname Report (one row per branch x item, ESB unit, actual
// qty, price, value) and sheet "Summary" with one row per count (who counted, who reviewed, total value).

import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Input, Page, Panel, Select, SkeletonRows, fmtDay, theadClass, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { STATUS, countTypeLabel } from "@/so/lib/counts";
import { wibDate } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Facility = { id: string; name: string; facility_type: string };
type CountType = { code: string; name: string };
type Row = { id: string; number: string; facility_name: string; count_type: string; business_date: string; status: string; lines: number };

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00+07:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function ReportsPage() {
  const toast = useToast();
  const [from, setFrom] = useState(() => shift(wibDate(), -6));
  const [to, setTo] = useState(wibDate());
  const [type, setType] = useState("");
  const [facility, setFacility] = useState("");
  const [status, setStatus] = useState("REVIEWED");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [types, setTypes] = useState<CountType[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<Facility[]>("/api/so/count-settings/facilities").then(setFacilities).catch(() => setFacilities([]));
    void api<CountType[]>("/api/so/count-settings/types").then(setTypes).catch(() => setTypes([]));
  }, []);
  useEffect(() => {
    setRows(null);
    const q = (s: string) => `/api/so/counts?date_from=${from}&date_to=${to}&status=${s}${type ? `&count_type=${type}` : ""}${facility ? `&facility_id=${facility}` : ""}`;
    const wanted = status === "REVIEWED" ? ["APPROVED", "EXPORTED"] : [status];
    Promise.all(wanted.map((s) => api<Row[]>(q(s))))
      .then((r) => setRows(r.flat().sort((a, b) => b.business_date.localeCompare(a.business_date) || a.facility_name.localeCompare(b.facility_name))))
      .catch((e) => { setRows([]); toast(errorText(e), "error"); });
  }, [from, to, type, facility, status, toast]);

  const days = useMemo(() => Math.round((Date.parse(to) - Date.parse(from)) / 864e5), [from, to]);
  const tooLong = days > 92 || days < 0;

  const download = async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ date_from: from, date_to: to, status, ...(type ? { count_type: type } : {}), ...(facility ? { facility_id: facility } : {}) });
      const res = await fetch(`/api/so/count-reports/file?${qs}`, { credentials: "same-origin" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? body?.detail ?? tr("The file could not be downloaded"));
      }
      const href = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href, download: `Stock Opname Report ${from} - ${to}.xlsx` }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={tr("SO report (xlsx)")} subtitle={tr("Download the stock opname reviewed by Cost Control in the layout of the Stock Opname Report")}>
      <Panel title={tr("Filter")} toolbar={
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[150px_150px_1fr_1fr_170px]">
          <Field label={tr("From")}><Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
          <Field label={tr("To")}><Input type="date" value={to} min={from} max={wibDate()} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
          <Field label={tr("Count type")}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{tr("All types")}</option>
              {types.map((t) => <option key={t.code} value={t.code}>{countTypeLabel(t.code, t.name)}</option>)}
            </Select>
          </Field>
          <Field label={tr("Branch")}>
            <Select value={facility} onChange={(e) => setFacility(e.target.value)}>
              <option value="">{tr("All branches")}</option>
              {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </Select>
          </Field>
          <Field label={tr("Status")}>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="REVIEWED">{tr("Approved + exported")}</option>
              <option value="APPROVED">{tr("Approved")}</option>
              <option value="EXPORTED">{tr("Exported")}</option>
            </Select>
          </Field>
        </div>
      }>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="text-sm text-slate-600">
            {tooLong ? <span className="text-red-600">{tr("Choose a period of at most 93 days")}</span>
              : rows === null ? tr("Loading…") : tr("{0} reviewed counts in this period", rows.length)}
          </p>
          <Button loading={busy} disabled={!rows?.length || tooLong} onClick={download}><Download size={16} /> {tr("Download .xlsx")}</Button>
        </div>
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full min-w-[560px] text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Date")}</th><th className="px-4 py-2.5">{tr("Branch")}</th>
              <th className="px-4 py-2.5">{tr("Count type")}</th><th className="px-4 py-2.5 text-right">{tr("Lines")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows === null ? <SkeletonRows cols={5} rows={4} /> : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500"><FileSpreadsheet size={24} className="mx-auto mb-2 text-slate-300" />{tr("No reviewed stock opname in this period")}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2.5">{fmtDay(r.business_date)}</td>
                  <td className="px-4 py-2.5"><span className="block font-medium text-slate-900">{r.facility_name}</span><span className="font-mono text-[11px] text-slate-400">{r.number}</span></td>
                  <td className="px-4 py-2.5">{countTypeLabel(r.count_type)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.lines}</td>
                  <td className="px-4 py-2.5"><Badge tone={STATUS[r.status]?.tone ?? "slate"}>{STATUS[r.status]?.label() ?? r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}

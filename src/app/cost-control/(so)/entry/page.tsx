"use client";

// Enter / import SO (06.9 §12.11, D-56): Cost Control fills in the stock opname of a branch on a form, or imports the
// actual quantities of many branches from a file in the "Stock Opname Report" layout. Optional: every branch still
// counts itself. What Cost Control enters goes to Review like a crew count, and someone else has to approve it.

import { Tabs } from "@/components/kc";
import { CheckCircle2, ClipboardEdit, FileSpreadsheet, FileUp, Info, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, Field, Input, Page, Panel, Select, cx, fmtNumber, theadClass, useToast } from "@/so/ui";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { wibDate } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Facility = { id: string; code: string; name: string; facility_type: string; city?: string | null };
type CountType = { code: string; name: string; is_active: boolean };
type ImportBranch = { facility_id: string; facility: string; rows: number; status: string; lines?: number; number?: string; count_id?: string;
  existing?: { number: string; status: string } };
type ImportResult = { applied: boolean; branches: ImportBranch[];
  problems: { branches: string[]; items: { code: string; name: string }[]; units: { code: string; name: string; unit: string; base_uom: string }[] } };

const TYPE_LABEL: Record<string, string> = { OUTLET: "Outlet", HUB_WH: "HUB WH", HUB_CK: "HUB CK", VIRTUAL: "Virtual" };
const STATUS_TONE: Record<string, "green" | "blue" | "amber" | "slate" | "red"> = { READY: "blue", CREATED: "green", EXISTS: "amber", EMPTY: "slate", NO_ACCESS: "red" };
const STATUS_LABEL: Record<string, () => string> = {
  READY: () => tr("Ready"), CREATED: () => tr("Imported"), EXISTS: () => tr("Already has a count"), EMPTY: () => tr("No quantity"),
  NO_ACCESS: () => tr("No access"),
};

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",").pop() ?? "");
    r.onerror = () => reject(new Error(tr("The file could not be read")));
    r.readAsDataURL(file);
  });
}

export default function EntryPage() {
  const [tab, setTab] = useState<"form" | "import">("form");
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [types, setTypes] = useState<CountType[]>([]);
  useEffect(() => {
    void api<Facility[]>("/api/so/count-settings/facilities").then(setFacilities).catch(() => setFacilities([]));
    void api<CountType[]>("/api/so/count-settings/types").then((t) => setTypes(t.filter((x) => x.is_active))).catch(() => setTypes([]));
  }, []);

  return (
    <Page title={tr("Enter / Import SO")} subtitle={tr("Optional: fill in or import the stock opname of branches. Branches can still count themselves.")}>
      <p className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <span>{tr("What you enter or import goes to Review as Submitted. Another Cost Control member approves it (you cannot approve your own entry).")}</span>
      </p>
      <Tabs label={tr("Entry")} value={tab} onChange={(k) => setTab(k as typeof tab)}
        tabs={([["form", tr("Fill in a Form"), ClipboardEdit], ["import", tr("Import a file"), FileUp]] as const).map(([k, label, Icon]) => ({ key: k, label: <><Icon size={15} />{label}</> }))} />
      {tab === "form" ? <FormEntry facilities={facilities} types={types} /> : <ImportEntry types={types} />}
    </Page>
  );
}

function FormEntry({ facilities, types }: { facilities: Facility[]; types: CountType[] }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [facility, setFacility] = useState("");
  const [type, setType] = useState("WEEKLY_RAW");
  const [day, setDay] = useState(wibDate());
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return facilities.filter((f) => !s || f.name.toLowerCase().includes(s) || f.code.toLowerCase().includes(s));
  }, [facilities, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Facility[]>();
    for (const f of shown) m.set(f.facility_type, [...(m.get(f.facility_type) ?? []), f]);
    return [...m.entries()];
  }, [shown]);

  const open = async () => {
    setBusy(true);
    try {
      const c = await api<{ id: string }>("/api/so/counts/entries", { method: "POST", json: { facility_id: facility, count_type: type, business_date: day } });
      router.push(`/cost-control/entry/${c.id}`);
    } catch (e) {
      toast(errorText(e), "error");
      setBusy(false);
    }
  };

  return (
    <Panel title={tr("Fill in a Form")} description={tr("Opens the count form of the branch with its list (items, units, premix in grams). No photos or location are needed.")}>
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_220px_180px]">
        <div className="space-y-2">
          <Field label={tr("Branch")} required>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search branch name or code")} aria-label={tr("Search branch name or code")} />
          </Field>
          <Select value={facility} onChange={(e) => setFacility(e.target.value)} aria-label={tr("Branch")} size={8} className="h-auto py-1">
            {groups.map(([t, list]) => (
              <optgroup key={t} label={TYPE_LABEL[t] ?? t}>
                {list.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <Field label={tr("Count Type")} required>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t.code} value={t.code}>{countTypeLabel(t.code, t.name)}</option>)}
          </Select>
        </Field>
        <Field label={tr("Count Day (WIB)")} required hint={tr("Today or an earlier day")}>
          <Input type="date" value={day} max={wibDate()} onChange={(e) => e.target.value && setDay(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 sm:px-5">
        <p className="min-w-0 truncate text-sm text-neutral-600">{facility ? facilities.find((f) => f.id === facility)?.name : tr("Choose a branch")}</p>
        <Button loading={busy} disabled={!facility} onClick={open}><ClipboardEdit size={16} /> {tr("Open the Form")}</Button>
      </div>
    </Panel>
  );
}

function ImportEntry({ types }: { types: CountType[] }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("WEEKLY_RAW");
  const [day, setDay] = useState(wibDate());
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"check" | "apply" | null>(null);

  const send = async (apply: boolean) => {
    if (!file) return;
    setBusy(apply ? "apply" : "check");
    try {
      const r = await api<ImportResult>("/api/so/counts/imports", {
        method: "POST", json: { file: await toBase64(file), file_name: file.name, business_date: day, count_type: type, apply },
      });
      setResult(r);
      if (apply) toast(tr("{0} branches imported", r.branches.filter((b) => b.status === "CREATED").length));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };
  const ready = (result?.branches ?? []).filter((b) => b.status === "READY");
  const p = result?.problems;

  return (
    <Panel title={tr("Import a File")} description={tr('A file in the "Stock Opname Report" layout: Branch, Product Code, Unit and Actual Opname Qty per row. Rows without a quantity are skipped.')}>
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_220px_180px]">
        <Field label={tr("File (.xlsx)")} required>
          <label className={cx("flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 text-sm", file ? "border-brand-400 bg-brand-50 text-brand-800" : "border-neutral-300 text-neutral-500 hover:border-neutral-400")}>
            <Upload size={15} /> <span className="truncate">{file ? file.name : tr("Choose a file")}</span>
            <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
          </label>
        </Field>
        <Field label={tr("Count Type")} required>
          <Select value={type} onChange={(e) => { setType(e.target.value); setResult(null); }}>
            {types.filter((t) => t.code !== "ADHOC").map((t) => <option key={t.code} value={t.code}>{countTypeLabel(t.code, t.name)}</option>)}
          </Select>
        </Field>
        <Field label={tr("Count Day (WIB)")} required>
          <Input type="date" value={day} max={wibDate()} onChange={(e) => { if (e.target.value) { setDay(e.target.value); setResult(null); } }} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-4 py-3 sm:px-5">
        <Button variant="secondary" loading={busy === "check"} disabled={!file || !!busy} onClick={() => send(false)}><FileSpreadsheet size={16} /> {tr("Check the File")}</Button>
        <Button loading={busy === "apply"} disabled={!result || result.applied || ready.length === 0 || !!busy} onClick={() => send(true)}>
          <FileUp size={16} /> {tr("Import {0} branches", ready.length)}
        </Button>
      </div>
      {result && (
        <div className="space-y-4 border-t border-neutral-100 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={tr("Branches in the File")} value={result.branches.length + (p?.branches.length ?? 0)} />
            <Stat label={result.applied ? tr("Imported") : tr("Ready to import")} value={result.applied ? result.branches.filter((b) => b.status === "CREATED").length : ready.length} tone="green" />
            <Stat label={tr("Unknown Branches")} value={p?.branches.length ?? 0} tone={p?.branches.length ? "amber" : undefined} />
            <Stat label={tr("Unknown Items / Units")} value={(p?.items.length ?? 0) + (p?.units.length ?? 0)} tone={(p?.items.length ?? 0) + (p?.units.length ?? 0) ? "amber" : undefined} />
          </div>
          {(p?.branches.length || p?.items.length || p?.units.length) ? (
            <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <summary className="cursor-pointer font-medium">{tr("Rows that are skipped")}</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {p.branches.map((b) => <li key={b}>{tr("Branch not found: {0}", b)}</li>)}
                {p.items.slice(0, 50).map((i) => <li key={i.code}>{tr("Item not in the item master: {0} {1}", i.code, i.name)}</li>)}
                {p.units.slice(0, 50).map((u) => <li key={u.code + u.unit}>{tr("Unit {0} is not set up for {1} (base {2})", u.unit, `${u.code} ${u.name}`, u.base_uom)}</li>)}
              </ul>
            </details>
          ) : null}
          {result.branches.length === 0 ? <Empty icon={<FileSpreadsheet size={28} />} title={tr("No branch of the file was recognised")} /> : (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="m-cards w-full min-w-[560px] text-sm">
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Branch")}</th><th className="px-4 py-2.5 text-right">{tr("Rows")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Items with Quantity")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {result.branches.map((b) => (
                    <tr key={b.facility_id}>
                      <td className="px-4 py-2.5 font-medium text-neutral-900">{b.facility}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(b.rows)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{b.lines ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={STATUS_TONE[b.status] ?? "slate"}>{STATUS_LABEL[b.status]?.() ?? b.status}</Badge>
                        {b.existing && <span className="ml-2 text-xs text-neutral-500">{b.existing.number}</span>}
                        {b.count_id && <Link href={`/cost-control/reviews/${b.count_id}`} className="ml-2 text-xs font-semibold text-brand-700 hover:underline">{b.number}</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.applied && (
            <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> {tr("The imported counts are waiting in Review.")}
              <Link href="/cost-control/reviews" className="font-semibold underline">{tr("Open Review")}</Link></p>
          )}
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" }) {
  return (
    <div className={cx("rounded-lg border px-3 py-2", tone === "green" ? "border-emerald-200 bg-emerald-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-white")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-neutral-900">{fmtNumber(value)}</p>
    </div>
  );
}

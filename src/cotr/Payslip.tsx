"use client";

// Monitoring COTR → Incentive Calculator → pay of an employee (migration 092): the bonus and the deductions split as the
// sheets of the COTR team (kasbon, minus, warning, other) with their notes, and the payslip — base salary and allowance
// of Master Driver + incentive + bonus − deductions = take home pay — printed or saved as PDF. The employees see their own
// payslips in the COTR app once the month is published.

import { FileText, Plus, Printer, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Input, Select, useToast } from "@/so/ui";
import Drawer from "@/components/kc/Drawer";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { rupiah } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

export type PayKind = "bonus" | "kasbon" | "minus" | "warning" | "other";
type Adjustment = { id: number; driver: string; kind: PayKind; amount: number; note: string | null; by: string | null; at: string };
export type Slip = { month: string; employee: { code: string; name: string; nickname: string | null; employeeId: string | null; department: string | null;
  position: string | null; pool: string | null; bank: string | null; account: string | null; holder: string | null };
  salary: number; allowance: number; incentive: number; cups: number; attendance: { scheduled: number; worked: number; late: number; absent: number } | null;
  bonus: number; bonusItems: Adjustment[]; deductions: Adjustment[]; deductionTotal: number; takeHome: number; published: boolean };

export const PAY_LABEL: Record<PayKind, () => string> = {
  bonus: () => tr("Bonus"), kasbon: () => tr("Kasbon"), minus: () => tr("Minus"), warning: () => tr("Warning"), other: () => tr("Other deduction"),
};

/** The bonus and deductions of one employee in a month: listed, added, removed (until the month is published). */
export function PayPanel({ driver, month, published, onChanged }: { driver: string; month: string; published: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Adjustment[] | null>(null);
  const [form, setForm] = useState({ kind: "kasbon" as PayKind, amount: "", note: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    call<{ data: Adjustment[] }>(`/api/cotr/pay-adjustments?month=${month}&driver=${encodeURIComponent(driver)}`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [driver, month]);
  useEffect(load, [load]);
  const add = async () => {
    setBusy(true);
    try {
      await call("/api/cotr/pay-adjustments", { method: "POST", json: { driver, month, kind: form.kind, amount: Number(form.amount), note: form.note.trim() || null } });
      setForm({ ...form, amount: "", note: "" }); load(); onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    try { await call(`/api/cotr/pay-adjustments/${id}`, { method: "DELETE" }); load(); onChanged(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-700">{tr("Bonus & deductions of the month")}</p>
      {!rows ? <SkeletonList rows={2} /> : rows.length === 0 ? <p className="text-xs text-neutral-400">{tr("None yet")}</p> : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white text-xs">
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-3 py-1.5">
              <Badge tone={a.kind === "bonus" ? "green" : "red"}>{PAY_LABEL[a.kind]()}</Badge>
              <span className="min-w-0 flex-1 truncate text-neutral-600" title={a.note ?? undefined}>{a.note ?? "—"}</span>
              <span className={`tabular-nums ${a.kind === "bonus" ? "text-emerald-700" : "text-red-700"}`}>{a.kind === "bonus" ? "+" : "−"}{rupiah(a.amount)}</span>
              {!published && <button type="button" aria-label={tr("Delete")} onClick={() => void remove(a.id)} className="text-neutral-400 hover:text-red-600"><Trash2 size={13} /></button>}
            </li>
          ))}
        </ul>
      )}
      {published ? <p className="text-[11px] text-neutral-500">{tr("The payslips of this month are published: withdraw them to change.")}</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PayKind })} className="h-9 w-36">
            {(Object.keys(PAY_LABEL) as PayKind[]).map((k) => <option key={k} value={k}>{PAY_LABEL[k]()}</option>)}
          </Select>
          <Input inputMode="numeric" value={form.amount} placeholder={tr("Amount (Rp)")} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} className="h-9 w-32 text-right tabular-nums" />
          <Input value={form.note} maxLength={300} placeholder={form.kind === "bonus" ? tr("Note (optional)") : tr("Note (required)")} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-9 min-w-[12rem] flex-1" />
          <Button size="sm" loading={busy} disabled={!Number(form.amount) || (form.kind !== "bonus" && !form.note.trim())} onClick={() => void add()}><Plus size={14} /> {tr("Add")}</Button>
        </div>
      )}
    </div>
  );
}

const monthText = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale(), { month: "long", year: "numeric" });

function Row({ label, value, sign, strong }: { label: string; value: number; sign?: "+" | "−"; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1 ${strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>
      <span>{label}</span><span className="tabular-nums">{sign && value ? sign : ""}{rupiah(value)}</span>
    </div>
  );
}

/** The payslip as a printable sheet (print, or save as PDF from the print dialog). */
export function SlipSheet({ slip }: { slip: Slip }) {
  const e = slip.employee;
  return (
    <div className="payslip mx-auto max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-5 text-sm">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 pb-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Calf On The Road</p>
          <p className="text-lg font-bold text-neutral-900">{tr("Payslip")}</p><p className="text-xs text-neutral-500">{monthText(slip.month)}</p></div>
        {!slip.published && <Badge tone="amber">{tr("Not published yet")}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-neutral-500">{tr("Name")}</span><span className="font-medium text-neutral-900">{e.name}</span>
        <span className="text-neutral-500">{tr("Employee code")}</span><span>{e.employeeId ?? e.code}</span>
        <span className="text-neutral-500">{tr("Department / position")}</span><span>{[e.department, e.position].filter(Boolean).join(" · ") || "—"}</span>
        <span className="text-neutral-500">{tr("Pool / HUB")}</span><span>{e.pool ?? "—"}</span>
        {slip.attendance && <><span className="text-neutral-500">{tr("Attendance")}</span><span>{slip.attendance.worked}/{slip.attendance.scheduled} · {tr("{0} cups sold", slip.cups)}</span></>}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("Income")}</p>
        <Row label={tr("Base salary")} value={slip.salary} />
        <Row label={tr("Allowance")} value={slip.allowance} />
        <Row label={tr("Incentive")} value={slip.incentive} />
        {slip.bonusItems.map((b) => <Row key={b.id} label={`${tr("Bonus")}${b.note ? ` · ${b.note}` : ""}`} value={b.amount} />)}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("Deductions")}</p>
        {slip.deductions.length === 0 ? <p className="py-1 text-neutral-400">—</p> : slip.deductions.map((d) => (
          <Row key={d.id} label={`${PAY_LABEL[d.kind]()}${d.note ? ` · ${d.note}` : ""}`} value={d.amount} sign="−" />))}
      </div>
      <div className="border-t border-neutral-200 pt-2">
        <Row label={tr("Take home pay")} value={slip.takeHome} strong />
        {e.account && <p className="text-xs text-neutral-500">{tr("Paid to")} {e.bank ?? ""} {e.account}{e.holder ? ` a.n. ${e.holder}` : ""}</p>}
      </div>
    </div>
  );
}

/** Opens the payslip of an employee for the COTR management (before or after publishing). */
export function PayslipDrawer({ driver, month, onClose }: { driver: string; month: string; onClose: () => void }) {
  const [slip, setSlip] = useState<Slip | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { call<Slip>(`/api/cotr/payslips/${month}/${encodeURIComponent(driver)}`).then(setSlip).catch((e: Error) => setError(e.message)); }, [driver, month]);
  return (
    <Drawer open onClose={onClose} icon={<FileText size={18} />} title={tr("Payslip")} description={slip ? `${slip.employee.name} · ${monthText(month)}` : undefined}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Close")}</Button><Button disabled={!slip} onClick={() => window.print()}><Printer size={15} /> {tr("Print / PDF")}</Button></>}>
      {error ? <p className="text-sm text-red-600">{error}</p> : !slip ? <SkeletonList rows={6} /> : <SlipSheet slip={slip} />}
      <style>{`@media print { body * { visibility: hidden; } .payslip, .payslip * { visibility: visible; } .payslip { position: absolute; inset: 0; border: 0; } }`}</style>
    </Drawer>
  );
}

export const publishedText = (at: string | null) => (at ? wibDateTime(at) : "");

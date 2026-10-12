"use client";

// Count types (D-36): frequency, day, count window and the ESB purpose used in the import file. Data, not code.

import { CalendarCog, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Checkbox, ErrorState, Field, Input, Page, Panel, Select, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type CountType = { code: string; name: string; frequency: string; weekday: number | null; window_start: string; window_end: string; esb_purpose: string | null; sort: number; is_active: boolean };
const WEEKDAYS = () => [tr("Monday"), tr("Tuesday"), tr("Wednesday"), tr("Thursday"), tr("Friday"), tr("Saturday"), tr("Sunday")];
const FREQ: Record<string, () => string> = { DAILY: () => tr("Every day"), WEEKLY: () => tr("Weekly"), MONTHLY: () => tr("Last day of the month"), ADHOC: () => tr("When needed") };

export default function TypesPage() {
  const [rows, setRows] = useState<CountType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CountType | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<CountType[]>("/api/so/count-settings/types"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const when = (t: CountType) => (t.frequency === "WEEKLY" && t.weekday ? `${FREQ.WEEKLY()} · ${WEEKDAYS()[t.weekday - 1]}` : FREQ[t.frequency]?.() ?? t.frequency);

  return (
    <Page title={tr("Count types")} subtitle={tr("When each stock opname is due and how it is named in ESB")}>
      <Panel>
        {error ? <ErrorState message={error} onRetry={load} /> : (
          <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {(rows ?? []).map((t) => (
                <li key={t.code}>
                  <button type="button" onClick={() => setOpen(t)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{countTypeLabel(t.code, t.name)}</span>
                      <span className="block text-xs text-slate-500">{when(t)} · {t.window_start}–{t.window_end}</span></span>
                    {t.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge dot>{tr("Inactive")}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead className={theadClass}>
                  <tr><th className="px-4 py-2.5">{tr("Count type")}</th><th className="px-4 py-2.5">{tr("When")}</th><th className="px-4 py-2.5">{tr("Window")}</th>
                    <th className="px-4 py-2.5">{tr("ESB purpose")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows === null ? <SkeletonRows cols={5} rows={4} /> : rows.map((t) => (
                    <tr key={t.code} className="group cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(t)}>
                      <td className="px-4 py-3"><span className="block font-medium text-slate-900 group-hover:text-blue-700">{countTypeLabel(t.code, t.name)}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{t.code}</span></td>
                      <td className="px-4 py-3 text-slate-700">{when(t)}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{t.window_start}–{t.window_end}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{t.esb_purpose ?? <span className="text-amber-700">{tr("Not set")}</span>}</td>
                      <td className="px-4 py-3">{t.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge dot>{tr("Inactive")}</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      {open && <TypeDrawer type={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
    </Page>
  );
}

function TypeDrawer({ type, onClose, onSaved }: { type: CountType; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(type);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/so/count-settings/types/${type.code}`, {
        method: "PUT",
        json: { name: f.name, frequency: f.frequency, weekday: f.frequency === "WEEKLY" ? f.weekday ?? 1 : null, window_start: f.window_start,
          window_end: f.window_end, esb_purpose: f.esb_purpose || null, is_active: f.is_active },
      });
      toast(tr("Count type saved"));
      onSaved();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} icon={<CalendarCog size={18} />} title={countTypeLabel(type.code, type.name)} description={type.code}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} onClick={save}><Save size={16} /> {tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Name")}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr("Frequency")}>
            <Select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>
              {Object.keys(FREQ).map((k) => <option key={k} value={k}>{FREQ[k]()}</option>)}
            </Select>
          </Field>
          {f.frequency === "WEEKLY" && (
            <Field label={tr("Day")}>
              <Select value={f.weekday ?? 1} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}>
                {WEEKDAYS().map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={tr("Window start")}><Input type="time" value={f.window_start} onChange={(e) => setF({ ...f, window_start: e.target.value })} /></Field>
          <Field label={tr("Window end")} hint={tr("Later submits are marked late")}><Input type="time" value={f.window_end} onChange={(e) => setF({ ...f, window_end: e.target.value })} /></Field>
        </div>
        <Field label={tr("ESB purpose")} hint={tr("Exactly as the purpose is named in ESB, used in the import file")}>
          <Input value={f.esb_purpose ?? ""} onChange={(e) => setF({ ...f, esb_purpose: e.target.value })} />
        </Field>
        <Checkbox label={tr("Active")} hint={tr("An inactive count type is not scheduled anywhere")} checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
      </div>
    </Drawer>
  );
}

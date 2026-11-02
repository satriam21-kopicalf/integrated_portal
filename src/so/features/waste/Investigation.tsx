"use client";

// Waste investigation (integrated_portal_be app/waste.py, migration 055): Cost Control opens it from Waste review for
// entries of one outlet; the report follows the form FM-QAQC-03 "Investigasi Komplain & Waste" (docs/Form Investigasi
// Waste): A the incident, B the object and the chronology, C the root cause (six QA checks), D corrective / preventive
// action, signed by QA, the PIC / leader of the outlet and the operations manager. Also the categories of the two forms
// (Form Waste, Usage Management), managed by Cost Control only.

import { ExternalLink, FileSearch, Pencil, Plus, Printer, Save, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import SignaturePad from "@/so/features/count/SignaturePad";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { dmy } from "@/so/ui/Filters";
import { tr } from "@/lib/i18n";
import { CHECKS, type Entry, fmtQty, type Investigation, type Report, SIGNERS, type Signer, SOURCES, WASTE_KINDS, scopeLabel } from "./waste";

export const printUrl = (id: string) => `/cost-control/waste/reviews/investigation?id=${id}`;

/** The ingredients of a premix entry (grams, rounded up as the premix calculator), as filled by the outlet. */
export function Ingredients({ entry }: { entry: Entry }) {
  if (!entry.ingredients?.length) return null;
  return (
    <div className="rounded-xl border border-neutral-200">
      <p className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
        {tr("Breakdown of the premix")}{entry.grams ? ` · ${fmtQty(entry.grams)} g` : ""}
      </p>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-neutral-100">
          {entry.ingredients.map((c) => (
            <tr key={c.code ?? c.name} className={c.isStock ? "" : "text-neutral-400"}>
              <td className="px-3 py-1.5">{c.name}{c.code ? <span className="ml-1 text-[10px] text-neutral-400">{c.code}</span> : null}{!c.isStock && ` (${tr("not stock")})`}</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{fmtQty(c.grams)} g</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The list of the investigations of the period's branches. */
export function InvestigationList({ onOpen }: { onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Investigation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | "open" | "closed">("");
  const load = useCallback(() => {
    setError(null);
    call<{ data: Investigation[] }>(`/api/waste/investigations?status=${status}`).then((r) => setRows(r.data)).catch((e: Error) => setError(e.message));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  if (error) return <ErrorState message={error} onRetry={load} />;
  return (
    <div>
      <div className="flex gap-2 px-4 py-3">
        {(["", "open", "closed"] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={cx("rounded-full px-3 py-1 text-xs font-medium", status === s ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-600")}>
            {s === "" ? tr("All") : s === "open" ? tr("Open") : tr("Closed")}
          </button>
        ))}
      </div>
      {!rows ? <SkeletonRows cols={5} /> : rows.length === 0 ? <Empty title={tr("No investigation yet")}>{tr("Tick waste entries of one outlet in Entries and choose Investigate.")}</Empty> : (
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("No.")}</th><th className="px-4 py-2.5">{tr("Outlet")}</th><th className="px-4 py-2.5">{tr("Object")}</th>
            <th className="px-4 py-2.5">{tr("Status")}</th><th className="px-4 py-2.5">{tr("Updated")}</th><th /></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => onOpen(r.id)}>
                <td className="px-4 py-2 font-mono text-xs">{String(r.reportNo).padStart(2, "0")}</td>
                <td className="px-4 py-2">{r.branchName}</td>
                <td className="max-w-[18rem] truncate px-4 py-2 text-neutral-600">{r.report.object} <span className="text-[11px] text-neutral-400">· {tr("{0} entries", r.entries as number)}</span></td>
                <td className="px-4 py-2"><Badge tone={r.status === "open" ? "violet" : "green"}>{r.status === "open" ? tr("Open") : tr("Closed")}</Badge></td>
                <td className="px-4 py-2 text-xs text-neutral-500">{wibDateTime(r.updatedAt)}{r.updatedBy ? ` · ${r.updatedBy}` : ""}</td>
                <td className="px-2 text-right"><a href={printUrl(r.id)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex rounded p-1.5 text-neutral-400 hover:text-brand-700" aria-label={tr("Print")}><Printer size={15} /></a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const field = "block text-xs font-medium text-neutral-600";

/** The editor of an investigation: the form FM-QAQC-03 section by section, the signatures, close / reopen, print. */
export function InvestigationDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [sigs, setSigs] = useState<Investigation["signatures"]>({});
  const [signing, setSigning] = useState<Signer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    call<Investigation>(`/api/waste/investigations/${id}`).then((r) => { setInv(r); setReport(r.report); setSigs(r.signatures); }).catch((e: Error) => setError(e.message));
  }, [id]);
  const set = <K extends keyof Report>(k: K, v: Report[K]) => setReport((r) => (r ? { ...r, [k]: v } : r));
  const save = async (status?: "open" | "closed") => {
    if (!report) return;
    setBusy(true);
    try {
      const out = await call<Investigation>(`/api/waste/investigations/${id}`, { method: "PUT", json: { report, signatures: sigs, status } });
      setInv(out); setSigs(out.signatures);
      toast(status === "closed" ? tr("Investigation closed") : tr("Saved"));
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const entries = Array.isArray(inv?.entries) ? inv.entries : [];
  return (
    <Drawer open onClose={onClose} size="lg" icon={<FileSearch size={18} />} title={inv ? tr("Investigation No. {0}", String(inv.reportNo).padStart(2, "0")) : tr("Investigation")}
      description={inv ? `${inv.branchName} · FM-QAQC-03` : ""}
      footer={inv && report ? (
        <div className="flex flex-wrap justify-end gap-2">
          <a href={printUrl(id)} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"><Printer size={15} />{tr("Print / PDF")}<ExternalLink size={12} /></a>
          {inv.status === "open"
            ? <Button variant="secondary" disabled={busy} onClick={() => void save("closed")}>{tr("Save & close")}</Button>
            : <Button variant="secondary" disabled={busy} onClick={() => void save("open")}>{tr("Reopen")}</Button>}
          <Button loading={busy} onClick={() => void save()}><Save size={15} />{tr("Save")}</Button>
        </div>
      ) : undefined}>
      {error ? <ErrorState message={error} /> : !inv || !report ? <div className="skeleton h-96 rounded-xl" /> : (
        <div className="space-y-5 text-sm">
          <section className="space-y-2">
            <h3 className="font-semibold text-neutral-900">{tr("Waste Entries")}</h3>
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/waste/entries/${e.id}/photo`} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg bg-neutral-100 object-cover" />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="text-sm font-semibold text-neutral-900">{e.itemName}</p>
                      <p className="text-neutral-600">{fmtQty(e.qty)} {e.unit} · {scopeLabel(e.scope)} · {e.category}</p>
                      <p className="text-neutral-500">{dmy(e.businessDate)} · {e.name}{e.note ? ` · “${e.note}”` : ""}</p>
                    </div>
                  </div>
                  {e.ingredients?.length ? <div className="mt-2"><Ingredients entry={e} /></div> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-neutral-900">A. {tr("Incident Category")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>{tr("Investigation date")}<input type="date" className={cx(inputClass, "mt-1")} value={report.date} onChange={(e) => set("date", e.target.value)} /></label>
              <label className={field}>{tr("Incident")}
                <select className={cx(inputClass, "mt-1")} value={report.incident} onChange={(e) => set("incident", e.target.value as Report["incident"])}>
                  <option value="waste">{tr("Waste incident")}</option><option value="complaint">{tr("Customer complaint")}</option><option value="both">{tr("Complaint & waste")}</option>
                </select>
              </label>
            </div>
            {report.incident !== "waste" && (
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <button key={s} type="button" onClick={() => set("source", report.source === s ? null : s)}
                    className={cx("rounded-full border px-3 py-1 text-xs", report.source === s ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600")}>{s}</button>
                ))}
              </div>
            )}
            {report.incident !== "complaint" && (
              <div className="flex flex-wrap gap-2">
                {WASTE_KINDS.map((k) => {
                  const on = report.wasteKinds.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => set("wasteKinds", on ? report.wasteKinds.filter((x) => x !== k) : [...report.wasteKinds, k])}
                      className={cx("rounded-full border px-3 py-1 text-xs", on ? "border-brand-600 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600")}>{k}</button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-neutral-900">B. {tr("Object & Chronology")}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>{tr("Menu / raw material")}<input className={cx(inputClass, "mt-1")} value={report.object} onChange={(e) => set("object", e.target.value)} /></label>
              <label className={field}>{tr("Quantity")}<input className={cx(inputClass, "mt-1")} value={report.qty} onChange={(e) => set("qty", e.target.value)} /></label>
              <label className={field}>{tr("Batch / production code")}<input className={cx(inputClass, "mt-1")} value={report.batch ?? ""} onChange={(e) => set("batch", e.target.value || null)} /></label>
              <label className={field}>{tr("Date & time of the incident")}<input className={cx(inputClass, "mt-1")} value={report.incidentAt} onChange={(e) => set("incidentAt", e.target.value)} /></label>
              <label className={field}>{tr("Outlet")}<input className={cx(inputClass, "mt-1")} value={report.outlet} onChange={(e) => set("outlet", e.target.value)} /></label>
              <label className={field}>{tr("PIC / staff in charge")}<input className={cx(inputClass, "mt-1")} value={report.pic} onChange={(e) => set("pic", e.target.value)} /></label>
            </div>
            <label className={field}>{tr("Chronology / findings")}<textarea rows={4} className={cx(inputClass, "mt-1 h-auto py-2")} value={report.chronology} onChange={(e) => set("chronology", e.target.value)} /></label>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-neutral-900">C. {tr("Root Cause Analysis")}</h3>
            {CHECKS.map((c) => {
              const v = report.checks[c] ?? { checked: false, finding: "" };
              return (
                <div key={c} className="grid items-center gap-2 sm:grid-cols-[16rem_1fr]">
                  <label className="flex items-center gap-2 text-xs text-neutral-700">
                    <input type="checkbox" checked={v.checked} onChange={(e) => set("checks", { ...report.checks, [c]: { ...v, checked: e.target.checked } })} />{c}
                  </label>
                  <input className={cx(inputClass, "h-9")} placeholder={tr("Finding")} value={v.finding}
                    onChange={(e) => set("checks", { ...report.checks, [c]: { ...v, finding: e.target.value, checked: v.checked || !!e.target.value } })} />
                </div>
              );
            })}
            <label className={field}>{tr("Conclusion of the root cause")}<textarea rows={3} className={cx(inputClass, "mt-1 h-auto py-2")} value={report.rootCause} onChange={(e) => set("rootCause", e.target.value)} /></label>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-neutral-900">D. {tr("Corrective & Preventive Action")}</h3>
            <label className={field}>{tr("Corrective action (immediate: return / compensation / handling of the waste)")}<textarea rows={3} className={cx(inputClass, "mt-1 h-auto py-2")} value={report.corrective} onChange={(e) => set("corrective", e.target.value)} /></label>
            <label className={field}>{tr("Preventive action (long term)")}<textarea rows={3} className={cx(inputClass, "mt-1 h-auto py-2")} value={report.preventive} onChange={(e) => set("preventive", e.target.value)} /></label>
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-neutral-900">{tr("Signatures")}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {SIGNERS.map((s) => {
                const v = sigs[s.key];
                return (
                  <div key={s.key} className="rounded-xl border border-neutral-200 p-3 text-xs">
                    <p className="font-semibold text-neutral-700">{s.title}</p>
                    <div className="my-2 flex h-20 items-center justify-center rounded-lg bg-neutral-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {v?.image ? <img src={v.image} alt="" className="max-h-20 object-contain" /> : <span className="text-neutral-300">—</span>}
                    </div>
                    <input className={cx(inputClass, "h-8 text-xs")} placeholder={tr("Name")} value={v?.name ?? ""}
                      onChange={(e) => setSigs({ ...sigs, [s.key]: { name: e.target.value, role: v?.role ?? s.role, image: v?.image ?? null, at: v?.at ?? "" } })} />
                    <p className="mt-1 text-[11px] text-neutral-400">{v?.role || s.role}</p>
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => setSigning(s.key)}><Pencil size={12} />{v?.image ? tr("Sign again") : tr("Sign")}</Button>
                  </div>
                );
              })}
            </div>
            {signing && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
                <p className="mb-2 text-xs font-semibold text-neutral-700">{SIGNERS.find((x) => x.key === signing)!.title}</p>
                <SignaturePad onChange={(img) => setSigs((all) => ({ ...all, [signing]: { name: all[signing]?.name ?? "", role: all[signing]?.role ?? SIGNERS.find((x) => x.key === signing)!.role, image: img, at: new Date().toISOString().slice(0, 10) } }))} />
                <div className="mt-2 flex justify-end"><Button size="sm" onClick={() => setSigning(null)}>{tr("Done")}</Button></div>
              </div>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

type Category = { id: number; scope: "waste" | "usage"; name: string; sort: number; isActive: boolean; used: number };

/** Categories of Form Waste and Usage Management: Cost Control adds, renames and switches them off (outlets only pick). */
export function CategoriesDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Category[] | null>(null);
  const [draft, setDraft] = useState<{ scope: "waste" | "usage"; name: string }>({ scope: "waste", name: "" });
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const load = useCallback(() => { void call<{ data: Category[] }>("/api/waste/categories").then((r) => setRows(r.data)); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    try { await call("/api/waste/categories", { method: "POST", json: draft }); setDraft({ ...draft, name: "" }); load(); toast(tr("Category added")); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  const patch = async (id: number, body: object) => {
    try { await call(`/api/waste/categories/${id}`, { method: "PATCH", json: body }); setEditing(null); load(); }
    catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Tags size={18} />} title={tr("Waste Categories")} description={tr("The categories outlets pick in Form Waste and Usage Management; only Cost Control adds or changes them")}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <select className={cx(inputClass, "w-44")} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value as Category["scope"] })} aria-label={tr("Form")}>
            <option value="waste">{tr("Form Waste")}</option><option value="usage">{tr("Usage Management")}</option>
          </select>
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={tr("New category")}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.name.trim()) void add(); }} />
          <Button disabled={!draft.name.trim()} onClick={() => void add()}><Plus size={15} />{tr("Add")}</Button>
        </div>
        {!rows ? <div className="skeleton h-40 rounded-xl" /> : (["waste", "usage"] as const).map((sc) => (
          <div key={sc}>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400"><Tags size={12} />{sc === "waste" ? tr("Form Waste") : tr("Usage Management")}</p>
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {rows.filter((r) => r.scope === sc).map((r) => (
                <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {editing?.id === r.id ? (
                    <input autoFocus className={cx(inputClass, "h-8 flex-1")} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") void patch(r.id, { name: editing.name }); if (e.key === "Escape") setEditing(null); }}
                      onBlur={() => (editing.name.trim() && editing.name !== r.name ? void patch(r.id, { name: editing.name }) : setEditing(null))} />
                  ) : (
                    <span className={cx("flex-1", !r.isActive && "text-neutral-400 line-through")}>{r.name}</span>
                  )}
                  <span className="text-[11px] text-neutral-400">{tr("used {0}×", r.used)}</span>
                  <button type="button" onClick={() => setEditing({ id: r.id, name: r.name })} className="rounded p-1 text-neutral-400 hover:text-brand-700" aria-label={tr("Rename")}><Pencil size={13} /></button>
                  <label className="flex items-center gap-1 text-[11px] text-neutral-500">
                    <input type="checkbox" checked={r.isActive} onChange={(e) => void patch(r.id, { isActive: e.target.checked })} />{tr("Active")}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

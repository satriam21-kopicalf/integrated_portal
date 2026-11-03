"use client";

// Monitoring WW-WR (page mon.wwwr; integrated_portal_be app/wwwr.py): the tabs of its own beside Audits and Analysis —
// Schedule (the audits planned: outlet, day, lead and members of the SWAT team; new / change / cancel) and Comparison
// (every audit sent against the latest Product and Outlet visits of the PIC of the outlet in the 7 days before: per PIC
// the conformity, the items the PIC passed and the team found UNDER; one audit item by item in a drawer).

import { AlertTriangle, CalendarPlus, CheckCircle2, Copy, Crown, Printer, Pencil, Scale, Search, Trash2, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Panel, cx, fmtNumber, inputClass, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { ComboFilter } from "@/so/ui/MonitorFilters";
import { type Period, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { locale, tr } from "@/lib/i18n";
import { type Audit, type AuditStatus, type AuditTeam, type Person, type Rating, RATING_STYLE, ratingLabel, scoreTone, sentAudit, tl } from "./visit";
import { SkeletonList } from "@/components/kc/Skeleton";

type BranchOpt = { branch_code: string; branch_name: string };
const STATUS: Record<AuditStatus, { tone: "slate" | "amber" | "green" | "red" | "blue"; label: () => string }> = {
  scheduled: { tone: "blue", label: () => tr("Scheduled") }, in_progress: { tone: "amber", label: () => tr("In progress") },
  follow_up: { tone: "amber", label: () => tr("Follow-up") }, completed: { tone: "green", label: () => tr("Completed") }, cancelled: { tone: "slate", label: () => tr("Cancelled") },
};
const dayShort = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// ------------------------------------------------------------------------------------------------- schedule

export function SchedulePanel({ branches, onOpenVisit }: { branches: BranchOpt[]; onOpenVisit: (id: string) => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Audit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<Person[]>([]);
  const [edit, setEdit] = useState<Audit | "new" | null>(null);
  const [cancel, setCancel] = useState<Audit | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try { setRows((await call<{ data: Audit[] }>(`/api/monitoring/wwwr/schedule?dateFrom=${wibDay(-60)}&dateTo=${wibDay(90)}`)).data); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<Person[]>("/api/monitoring/wwwr/team").then(setTeam).catch(() => setTeam([])); }, []);
  const today = wibDay(0);
  const list = (rows ?? []).filter((a) => showCancelled || a.status !== "cancelled");
  const next = list.filter((a) => a.day >= today && !sentAudit(a.status)).sort((a, b) => a.day.localeCompare(b.day));
  const past = list.filter((a) => !(a.day >= today && !sentAudit(a.status)));
  const doCancel = async () => {
    if (!cancel) return;
    try {
      await call(`/api/monitoring/wwwr/schedule/${cancel.id}/cancel`, { method: "POST" });
      toast(tr("Audit cancelled"));
      setCancel(null);
      void load();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Panel title={tr("Audit schedule")} description={tr("Plan the SWAT audits: outlet, day and team. Only the members open the form; the lead sends it.")}
      actions={<>
        <label className="flex items-center gap-1.5 text-xs text-neutral-500"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> {tr("Show cancelled")}</label>
        <Button size="sm" onClick={() => setEdit("new")} disabled={!team.length}><CalendarPlus size={14} /> {tr("New audit")}</Button>
      </>}>
      {!team.length && rows && (
        <p className="m-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-px flex-shrink-0" /> {tr("No SWAT account yet: give the page “WW-WR (form, SWAT)” to the team in User Accounts.")}
        </p>
      )}
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <SkeletonList rows={4} /> : list.length === 0 ? (
        <Empty icon={<CalendarPlus size={28} />} title={tr("No audit scheduled")}>{tr("Schedule the first audit with New audit.")}</Empty>
      ) : (
        <div className="divide-y divide-neutral-100">
          {[[tr("Today and upcoming"), next], [tr("Earlier"), past]].map(([title, items]) => (items as Audit[]).length > 0 && (
            <div key={title as string}>
              <p className="bg-neutral-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 sm:px-5">{title as string}</p>
              <ul className="divide-y divide-neutral-100">
                {(items as Audit[]).map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5">
                    <div className="w-28 flex-shrink-0 text-xs">
                      <p className={cx("font-semibold", a.day === today ? "text-brand-700" : "text-neutral-900")}>{a.day === today ? tr("Today") : dayShort(a.day)}</p>
                      <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label()}</Badge>
                    </div>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-semibold text-neutral-900">{a.branchName}</p>
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-neutral-600"><UsersRound size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{a.members.map((m) => m.id === a.lead.id ? `${m.name} (${tr("lead")})` : m.name).join(", ")}</span></p>
                      {a.note && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{a.note}</p>}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {a.status === "follow_up" && <span className="text-[11px] text-amber-700">{tr("{0} of {1} action plans open", a.actions.filter((x) => x.status === "open").length, a.actions.length)}{a.revisitOn ? ` · ${tr("revisit {0}", dayShort(a.revisitOn))}` : ""}</span>}
                      {sentAudit(a.status) && a.visitId && (
                        <button type="button" onClick={() => onOpenVisit(a.visitId!)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                          <span className={cx("tabular-nums", scoreTone(a.score ?? null))}>{a.score ?? "—"}%</span> {tr("Result")}
                        </button>
                      )}
                      {a.status === "in_progress" && <span className="text-[11px] tabular-nums text-neutral-500">{tr("{0} of {1} rated", a.counts?.rated ?? 0, a.counts?.total ?? 0)}</span>}
                      {(a.status === "scheduled" || a.status === "in_progress") && <>
                        <button type="button" onClick={() => setEdit(a)} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr("Edit")}><Pencil size={15} /></button>
                        <button type="button" onClick={() => setCancel(a)} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Cancel the audit")}><Trash2 size={15} /></button>
                      </>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {edit && <AuditDrawer audit={edit === "new" ? null : edit} team={team} branches={branches} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); }} />}
      <ConfirmDialog open={!!cancel} onClose={() => setCancel(null)} onConfirm={() => void doCancel()} danger confirmLabel={tr("Cancel the audit")}
        title={tr("Cancel the audit of {0}?", cancel?.branchName ?? "")} description={tr("What the team filled so far is removed.")} />
    </Panel>
  );
}

function AuditDrawer({ audit, team, branches, onClose, onSaved }: { audit: Audit | null; team: Person[]; branches: BranchOpt[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [branch, setBranch] = useState(audit?.branchCode ?? "");
  const [day, setDay] = useState(audit?.day ?? wibDay(1));
  const [lead, setLead] = useState(audit?.lead.id ?? "");
  const [members, setMembers] = useState<Set<string>>(new Set(audit?.members.map((m) => m.id) ?? []));
  const [note, setNote] = useState(audit?.note ?? "");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = team.filter((t) => !q.trim() || t.name.toLowerCase().includes(q.trim().toLowerCase()) || (t.username ?? "").includes(q.trim().toLowerCase()));
  const toggle = (id: string) => setMembers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const outlets = useMemo(() => branches.filter((b) => b.branch_name.startsWith("Kopi Calf")).map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code })), [branches]);
  const save = async () => {
    setBusy(true);
    try {
      const json = { branchCode: branch, day, leadId: lead, memberIds: [...new Set([...members, lead])], note: note.trim() || null };
      await call(audit ? `/api/monitoring/wwwr/schedule/${audit.id}` : "/api/monitoring/wwwr/schedule", { method: audit ? "PUT" : "POST", json });
      toast(audit ? tr("Audit changed") : tr("Audit scheduled"));
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} size="md" icon={<CalendarPlus size={18} />} title={audit ? tr("Change the audit") : tr("New audit")}
      description={tr("One audit per outlet per day")} focusFirstField={false}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!branch || !day || !lead} onClick={() => void save()}>{tr("Save")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Outlet")} required>
          <ComboFilter value={branch} onChange={setBranch} options={outlets} allLabel={tr("Choose the outlet")} placeholder={tr("Search outlet")} />
        </Field>
        <Field label={tr("Day of the audit")} required>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={cx(inputClass, "h-10")} />
        </Field>
        <Field label={tr("Team")} required hint={tr("Tick the members, then crown the lead who sends the audit")}>
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="relative border-b border-neutral-100 p-2">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search member")} className={cx(inputClass, "h-9 pl-8 text-sm")} />
            </div>
            <ul className="max-h-64 divide-y divide-neutral-100 overflow-y-auto">
              {shown.map((t) => {
                const on = members.has(t.id) || lead === t.id;
                return (
                  <li key={t.id} className={cx("flex items-center gap-2.5 px-3 py-2", on && "bg-brand-50/50")}>
                    <input type="checkbox" checked={on} onChange={() => { toggle(t.id); if (lead === t.id) setLead(""); }} aria-label={t.name} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm text-neutral-800">{t.name}</span><span className="text-[11px] text-neutral-400">@{t.username}</span></span>
                    <button type="button" onClick={() => { setLead(t.id); setMembers((s) => new Set(s).add(t.id)); }} aria-pressed={lead === t.id}
                      className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", lead === t.id ? "bg-amber-100 text-amber-800" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700")}>
                      <Crown size={12} /> {lead === t.id ? tr("Lead") : tr("Make lead")}
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("No match")}</li>}
            </ul>
          </div>
          <p className="mt-1 text-xs text-neutral-500">{tr("{0} members", new Set([...members, ...(lead ? [lead] : [])]).size)}{lead ? ` · ${tr("lead {0}", team.find((t) => t.id === lead)?.name ?? "")}` : ` · ${tr("choose the lead")}`}</p>
        </Field>
        <Field label={tr("Note for the team")}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={cx(inputClass, "py-2")} placeholder={tr("e.g. focus on the bar and the stock")} />
        </Field>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------------------- comparison

type Pic = { visitId: string; userId: string; name: string; username: string; submittedAt: string; score: number | null;
  compared: number; agree: number; overrated: number; underrated: number; conformity: number | null };
type Part = { part: "product" | "outlet"; swatScore: number | null; swatUnder: number; pic: Pic | null;
  items?: { key: string; label: string; labelEn?: string; section: string; sectionEn?: string; swat: Rating | null; swatNote?: string; swatBy?: string;
    pic: Rating | null; picNote?: string; verdict: "agree" | "overrated" | "underrated" | null }[] };
type CompAudit = { visitId: string; branchCode: string; branchName: string; submittedAt: string; score: number | null; team: { lead: Person; members: Person[] } | null; parts: Part[] };
type Comparison = { days: number; summary: { audits: number; withPic: number; conformity: number | null; overrated: number; underrated: number };
  audits: CompAudit[]; pics: { id: string; name: string; audits: number; compared: number; agree: number; overrated: number; underrated: number; conformity: number; branches: string[] }[] };
const PART = { product: "Product", outlet: "Outlet" } as const;

export function ComparisonPanel({ period, branch, group }: { period: Period; branch: string; group: string }) {
  const [res, setRes] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}), ...(group ? { group } : {}) });
    setRes(null);
    call<Comparison>(`/api/monitoring/wwwr/comparison?${q}`).then((r) => { if (live) { setRes(r); setError(null); } }).catch((e) => live && setError((e as Error).message));
    return () => { live = false; };
  }, [period, branch, group]);
  if (error) return <Panel><ErrorState message={error} /></Panel>;
  if (!res) return <SkeletonList rows={5} />;
  const s = res.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={tr("Audits compared")} value={fmtNumber(s.withPic)} note={tr("of {0} audits sent", fmtNumber(s.audits))} />
        <Tile label={tr("Conformity of the PICs")} value={<span className={scoreTone(s.conformity)}>{s.conformity === null ? "—" : `${s.conformity}%`}</span>} note={tr("items where the PIC and SWAT agree")} />
        <Tile label={tr("Overrated by the PIC")} value={<span className={s.overrated ? "text-red-600" : undefined}>{fmtNumber(s.overrated)}</span>} note={tr("PIC passed, SWAT found UNDER")} />
        <Tile label={tr("Underrated by the PIC")} value={fmtNumber(s.underrated)} note={tr("PIC UNDER, SWAT passed")} />
      </div>

      <Panel title={tr("Evaluation per PIC")} description={tr("Lowest conformity first: the PIC's own visits against the SWAT audits of the same outlet ({0} days before)", res.days)}>
        {res.pics.length === 0 ? <p className="px-4 py-10 text-center text-sm text-neutral-400">{tr("No audit with a PIC visit to compare in this period")}</p> : (
          <div className="overflow-x-auto">
            <table className="m-cards w-full text-sm">
              <thead className={theadClass}><tr>
                <th className="py-2.5 pl-5 pr-3">{tr("PIC")}</th><th className="px-3 py-2.5 text-right">{tr("Audits")}</th><th className="px-3 py-2.5 text-right">{tr("Items compared")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Overrated")}</th><th className="px-3 py-2.5 text-right">{tr("Underrated")}</th><th className="px-3 py-2.5 pr-5 text-right">{tr("Conformity")}</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {res.pics.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pl-5 pr-3" data-label={tr("PIC")}><span className="block font-medium text-neutral-900">{p.name}</span><span className="block truncate text-[11px] text-neutral-400" title={p.branches.join(", ")}>{p.branches.join(", ")}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Audits")}>{p.audits}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums" data-label={tr("Items compared")}>{p.compared}</td>
                    <td className={cx("px-3 py-2.5 text-right tabular-nums", p.overrated ? "font-semibold text-red-600" : "text-neutral-400")} data-label={tr("Overrated")}>{p.overrated}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-neutral-600" data-label={tr("Underrated")}>{p.underrated}</td>
                    <td className="px-3 py-2.5 pr-5 text-right" data-label={tr("Conformity")}><Meter pct={p.conformity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={tr("Audits against the PIC")} description={tr("Tap an audit to see every item side by side")}>
        {res.audits.length === 0 ? <Empty icon={<Scale size={28} />} title={tr("No audit sent in this period")}>{tr("The comparison appears when the SWAT team sends its audits.")}</Empty> : (
          <ul className="divide-y divide-neutral-100">
            {res.audits.map((a) => (
              <li key={a.visitId}>
                <button type="button" onClick={() => setOpen(a.visitId)} className="grid w-full gap-3 px-4 py-3 text-left hover:bg-brand-50/40 sm:grid-cols-[minmax(0,14rem)_1fr_1fr] sm:px-5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-neutral-900">{a.branchName}</span>
                    <span className="block text-[11px] text-neutral-500">{wibDateTime(a.submittedAt)}{a.team ? ` · ${a.team.lead.name}` : ""}</span>
                  </span>
                  {a.parts.map((p) => (
                    <span key={p.part} className="min-w-0 rounded-lg border border-neutral-100 bg-neutral-50/60 px-3 py-2">
                      <span className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{PART[p.part]}
                        {p.pic?.conformity != null && <span className={cx("normal-case", scoreTone(p.pic.conformity))}>{tr("{0}% conform", p.pic.conformity)}</span>}</span>
                      {p.pic ? (
                        <span className="mt-0.5 block truncate text-xs text-neutral-700">{p.pic.name} · PIC {p.pic.score ?? "—"}% · SWAT {p.swatScore ?? "—"}%
                          {p.pic.overrated > 0 && <span className="ml-1 font-semibold text-red-600">· {tr("{0} overrated", p.pic.overrated)}</span>}</span>
                      ) : <span className="mt-0.5 block text-xs text-neutral-400">{tr("No PIC visit in the {0} days before", res.days)} · SWAT {p.swatScore ?? "—"}%</span>}
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {open && <ComparisonDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ComparisonDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [c, setC] = useState<(CompAudit & { days: number }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [only, setOnly] = useState(true);
  useEffect(() => { call<CompAudit & { days: number }>(`/api/monitoring/wwwr/comparison/${id}`).then(setC).catch((e) => setError((e as Error).message)); }, [id]);
  return (
    <Drawer open onClose={onClose} size="xl" icon={<Scale size={18} />} title={c ? c.branchName : tr("Comparison")}
      description={c ? `${tr("SWAT audit")} · ${wibDateTime(c.submittedAt)}${c.team ? ` · ${c.team.members.map((m) => m.name).join(", ")}` : ""}` : undefined} focusFirstField={false}>
      {error ? <ErrorState message={error} /> : !c ? <SkeletonList rows={5} /> : (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> {tr("Only the items where the PIC and SWAT disagree")}</label>
          {c.parts.map((p) => {
            const rows = (p.items ?? []).filter((r) => !only || (r.verdict && r.verdict !== "agree"));
            return (
              <section key={p.part} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">{PART[p.part]}</h3>
                    <p className="text-xs text-neutral-500">{p.pic ? tr("PIC {0} · sent {1}", p.pic.name, wibDateTime(p.pic.submittedAt)) : tr("No PIC visit in the {0} days before", c.days)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge>PIC {p.pic?.score ?? "—"}%</Badge><Badge tone="blue">SWAT {p.swatScore ?? "—"}%</Badge>
                    {p.pic?.conformity != null && <Badge tone={p.pic.conformity >= 90 ? "green" : p.pic.conformity >= 75 ? "amber" : "red"}>{tr("{0}% conform", p.pic.conformity)}</Badge>}
                  </div>
                </header>
                {rows.length === 0 ? <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-emerald-700"><CheckCircle2 size={16} /> {only ? tr("The PIC and SWAT agree on every item") : tr("No item")}</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className={theadClass}><tr><th className="py-2 pl-4 pr-3">{tr("Item")}</th><th className="px-3 py-2">PIC</th><th className="px-3 py-2">SWAT</th><th className="px-3 py-2 pr-4">{tr("Verdict")}</th></tr></thead>
                      <tbody className="divide-y divide-neutral-100">
                        {rows.map((r) => (
                          <tr key={r.key} className={r.verdict === "overrated" ? "bg-red-50/40" : undefined}>
                            <td className="py-2.5 pl-4 pr-3"><span className="block font-medium text-neutral-800">{tl(r)}</span><span className="text-[11px] text-neutral-400">{tl(r, "section")}</span></td>
                            <td className="px-3 py-2.5"><Chip r={r.pic} />{r.picNote && <span className="mt-0.5 block max-w-[14rem] text-[11px] text-neutral-500">{r.picNote}</span>}</td>
                            <td className="px-3 py-2.5"><Chip r={r.swat} />{r.swatNote && <span className="mt-0.5 block max-w-[14rem] text-[11px] text-neutral-500">{r.swatNote}</span>}
                              {r.swatBy && <span className="block text-[10px] text-neutral-400">{r.swatBy}</span>}</td>
                            <td className="px-3 py-2.5 pr-4 text-xs">{r.verdict === "agree" ? <span className="text-emerald-700">{tr("Agree")}</span>
                              : r.verdict === "overrated" ? <span className="font-semibold text-red-600">{tr("PIC overrated")}</span>
                              : r.verdict === "underrated" ? <span className="text-amber-700">{tr("PIC underrated")}</span> : <span className="text-neutral-400">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}

function Chip({ r }: { r: Rating | null }) {
  return r ? <span className={cx("inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-semibold", RATING_STYLE[r].on)}>{ratingLabel(r)}</span> : <span className="text-xs text-neutral-400">—</span>;
}

function Meter({ pct }: { pct: number | null }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="hidden h-1.5 w-20 rounded-full bg-neutral-100 sm:block"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct ?? 0}%` }} /></span>
      <span className={cx("w-12 text-right text-sm font-semibold tabular-nums", scoreTone(pct))}>{pct === null ? "—" : `${pct}%`}</span>
    </span>
  );
}

function Tile({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{note}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- one audit: the evaluation

/** In the audit drawer of the monitoring: the status of the follow-up, the evaluation, the action plans and the share link. */
export function AuditEvaluation({ audit }: { audit: AuditTeam }) {
  const toast = useToast();
  const actions = audit.actions ?? [];
  const open = actions.filter((x) => x.status === "open").length;
  const url = audit.shareToken ? `${window.location.origin}/share/wwwr/${audit.shareToken}` : null;
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); toast(tr("Link copied: share it with the PIC")); } catch { toast(url); } };
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{tr("Evaluation & action plan")}</h3>
          <p className="text-xs text-neutral-500">{audit.status === "completed" ? tr("Completed {0}", wibDateTime(audit.completedAt ?? null)) : tr("Follow-up: {0} of {1} action plans open", open, actions.length)}
            {audit.revisitOn ? ` · ${tr("revisit {0}", dayShort(audit.revisitOn))}` : ""}</p>
        </div>
        {url && <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => void copy()}><Copy size={13} /> {tr("Copy link")}</Button>
          <a href={`${url}?print=1`} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><Printer size={13} /> {tr("Print / PDF")}</Button></a>
        </div>}
      </header>
      <div className="space-y-3 px-4 py-3 text-sm">
        <p className="whitespace-pre-line text-neutral-700">{audit.summary || <span className="text-neutral-400">{tr("No evaluation written")}</span>}</p>
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
          {actions.map((x) => (
            <li key={x.id} className="flex items-start gap-2.5 px-3 py-2">
              {x.status === "done" ? <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-600" /> : <span className="mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 border-amber-400" />}
              <span className="min-w-0 flex-1"><span className={cx("block", x.status === "done" ? "text-neutral-500 line-through" : "font-medium text-neutral-900")}>{x.title}</span>
                <span className="text-[11px] text-neutral-500">{x.assignee ?? "—"} · {tr("Due {0}", x.dueOn ? dayShort(x.dueOn) : "—")}{x.doneNote ? ` · “${x.doneNote}”` : ""}</span></span>
            </li>
          ))}
          {actions.length === 0 && <li className="px-3 py-3 text-xs text-neutral-400">{tr("No action plan yet")}</li>}
        </ul>
        {audit.revisitNote && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">{tr("Revisit")}: {audit.revisitNote}</p>}
      </div>
    </section>
  );
}

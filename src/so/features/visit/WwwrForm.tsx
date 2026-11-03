"use client";

// Form → WW-WR (page form.wwwr, the SWAT team; integrated_portal_be app/wwwr.py): the audits the member is assigned to
// (scheduled by the management in Monitoring WW-WR). From its day an audit opens the one shared visit of the team:
// every item of Monitoring Product and Monitoring Outlet, each answer saved with who filled it. The lead adds colleagues
// (SWAT / Operations) to the team. Before the lead sends it, the team writes the evaluation: the general evaluation, the
// action plans (who handles each, by when) and the day of the revisit. A sent audit is followed up here: the action
// plans are marked done and the lead closes the revisit (then it is complete); its result is shared with the PIC by a
// link (print / PDF). The team never sees a score.

import { CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, ClipboardList, Copy, Crown, Plus, Printer, Search, ShieldCheck, Store,
  Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Page, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { wibDay } from "@/so/ui/Filters";
import { locale, tr } from "@/lib/i18n";
import { VisitEditor } from "./VisitForm";
import { type ActionPlan, type Audit, type AuditTeam, type Person, type Visit, type WwwrState } from "./visit";
import { SkeletonList } from "@/components/kc/Skeleton";

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dayShort = (d: string | null | undefined) => (d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" }) : "—");
export const shareUrl = (token: string) => `${window.location.origin}/share/wwwr/${token}`;

export default function WwwrForm() {
  const toast = useToast();
  const [data, setData] = useState<WwwrState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sent, setSent] = useState<Visit | null>(null);
  const [team, setTeam] = useState<Audit | null>(null);
  const [follow, setFollow] = useState<Audit | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await call<WwwrState>("/api/forms/wwwr");
      setData(d);
      setFollow((f) => (f ? d.audits.find((a) => a.id === f.id) ?? null : f));
      setTeam((t) => (t ? d.audits.find((a) => a.id === t.id) ?? null : t));
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const open = async (a: Audit) => {
    setOpening(a.id);
    try {
      setVisit(await call<Visit>("/api/forms/wwwr/visits", { method: "POST", json: { auditId: a.id } }));
      setSent(null);
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setOpening(null);
    }
  };

  if (visit && data && visit.audit) {
    const audit = visit.audit;
    const ready = !!audit.summary && !!audit.revisitOn && (audit.actions?.length ?? 0) > 0;
    return <VisitEditor form="wwwr" data={data} visit={visit} canDiscard={false} canSend={audit.lead.id === data.user.id}
      evaluation={{ ready, node: <EvaluationPanel audit={audit} me={data.user.id} onSaved={(a) => setVisit({ ...visit, audit: { ...audit, ...a } })} /> }}
      onClose={() => { setVisit(null); void load(); }}
      onSubmitted={(v) => { setVisit(null); setSent(v); void load(); window.scrollTo({ top: 0 }); }} />;
  }

  const today = wibDay(0);
  const audits = data?.audits ?? [];
  const todo = (a: Audit) => a.status === "scheduled" || a.status === "in_progress";
  const active = audits.filter((a) => todo(a) && a.day <= today);
  const upcoming = audits.filter((a) => todo(a) && a.day > today).reverse();
  const following = audits.filter((a) => a.status === "follow_up");
  const done = audits.filter((a) => a.status === "completed").slice(0, 10);
  const card = (a: Audit, onOpen?: () => void) => (
    <AuditCard key={a.id} a={a} me={data!.user.id} busy={opening === a.id} onOpen={onOpen} onTeam={() => setTeam(a)} onFollow={() => setFollow(a)} />
  );
  return (
    <Page title="WW-WR" subtitle={tr("SWAT audit of the outlet: Product and Outlet in one form")}>
      {error ? <div className="rounded-xl border border-neutral-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="mx-auto max-w-4xl space-y-4"><SkeletonList rows={4} /><SkeletonList rows={5} /></div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {sent && (
            <p className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span><b>{tr("Audit sent for {0}", sent.branchName)}</b><br /><span className="text-xs">{wibDateTime(sent.submittedAt)} · {tr("Follow the action plans until the revisit")}</span></span>
            </p>
          )}
          <p className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-2.5 text-xs leading-relaxed text-brand-900">
            <ShieldCheck size={15} className="mt-px flex-shrink-0 text-brand-700" />
            <span>{tr("Only the members of an audit open it. Everyone in the team fills the same form (each item shows who filled it); the lead reviews and sends it.")}</span>
          </p>

          <Section title={tr("To do")} count={active.length}>
            {active.length === 0 ? <Empty icon={<ClipboardCheck size={26} />} title={tr("No audit for today")}>{tr("Audits appear here when the management assigns you to one.")}</Empty>
              : active.map((a) => card(a, () => void open(a)))}
          </Section>
          {following.length > 0 && <Section title={tr("Follow-up")} count={following.length}>{following.map((a) => card(a))}</Section>}
          {upcoming.length > 0 && <Section title={tr("Upcoming")} count={upcoming.length}>{upcoming.map((a) => card(a))}</Section>}
          {done.length > 0 && <Section title={tr("Completed")} count={done.length}>{done.map((a) => card(a))}</Section>}
        </div>
      )}
      {team && data && <TeamDrawer audit={team} me={data.user.id} onClose={() => setTeam(null)} onChanged={() => void load()} />}
      {follow && data && <FollowUpDrawer audit={follow} me={data.user.id} onClose={() => setFollow(null)} onChanged={() => void load()} />}
    </Page>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <p className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5 text-sm font-semibold text-neutral-900 sm:px-5">
        {title}<span className="rounded-full bg-neutral-100 px-1.5 text-[11px] tabular-nums text-neutral-600">{count}</span>
      </p>
      <ul className="divide-y divide-neutral-100">{children}</ul>
    </section>
  );
}

function AuditCard({ a, me, busy, onOpen, onTeam, onFollow }: { a: Audit; me: string; busy?: boolean; onOpen?: () => void; onTeam: () => void; onFollow: () => void }) {
  const lead = a.lead.id === me;
  const open = a.actions.filter((x) => x.status === "open").length;
  const sent = a.status === "follow_up" || a.status === "completed";
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Store size={18} /></span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="truncate text-sm font-semibold text-neutral-900">{a.branchName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500"><CalendarClock size={12} /> {dayLabel(a.day)}</p>
        <p className="mt-1 flex items-start gap-1 text-xs text-neutral-600"><UsersRound size={12} className="mt-0.5 flex-shrink-0" />
          <span>{a.members.map((m) => m.name).join(", ")}</span></p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {lead ? <Badge tone="blue" icon={<Crown size={11} />}>{tr("You lead")}</Badge> : <Badge>{tr("Lead: {0}", a.lead.name)}</Badge>}
          {a.status === "in_progress" && <Badge tone="amber">{tr("In progress · {0} of {1} rated", a.counts?.rated ?? 0, a.counts?.total ?? 0)}</Badge>}
          {a.status === "follow_up" && <Badge tone="amber">{tr("Follow-up · {0} action plans open", open)}</Badge>}
          {a.status === "follow_up" && a.revisitOn && <Badge>{tr("Revisit {0}", dayShort(a.revisitOn))}</Badge>}
          {a.status === "completed" && <Badge tone="green">{tr("Completed {0}", wibDateTime(a.completedAt))}</Badge>}
        </p>
        {a.note && <p className="mt-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{a.note}</p>}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {lead && a.status !== "completed" && <Button size="sm" variant="secondary" onClick={onTeam}><UserPlus size={14} /> {tr("Team")}</Button>}
        {onOpen && <Button size="sm" loading={busy} onClick={onOpen}>{a.status === "in_progress" ? tr("Continue") : tr("Start")} <ChevronRight size={14} /></Button>}
        {sent && <Button size="sm" variant={a.status === "follow_up" ? "primary" : "secondary"} onClick={onFollow}>{a.status === "follow_up" ? tr("Follow up") : tr("Result")} <ChevronRight size={14} /></Button>}
      </div>
    </li>
  );
}

// ------------------------------------------------------------------------------------------------- team

function useColleagues() {
  const [list, setList] = useState<Person[] | null>(null);
  useEffect(() => { void call<Person[]>("/api/forms/wwwr/colleagues").then(setList).catch(() => setList([])); }, []);
  return list;
}

function TeamDrawer({ audit, me, onClose, onChanged }: { audit: Audit | AuditTeam & { branchName?: string }; me: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const colleagues = useColleagues();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const inTeam = new Set(audit.members.map((m) => m.id));
  const shown = (colleagues ?? []).filter((c) => !inTeam.has(c.id) && (!q.trim() || `${c.name} ${c.username ?? ""} ${c.jobTitle ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())));
  const add = async () => {
    setBusy(true);
    try {
      await call(`/api/forms/wwwr/audits/${audit.id}/members`, { method: "POST", json: { ids: [...pick] } });
      toast(tr("{0} added to the team", pick.size));
      setPick(new Set());
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (p: Person) => {
    if (!window.confirm(tr("Remove {0} from the team?", p.name))) return;
    try { await call(`/api/forms/wwwr/audits/${audit.id}/members/${p.id}`, { method: "DELETE" }); onChanged(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Drawer open onClose={onClose} size="md" icon={<UsersRound size={18} />} title={tr("Audit team")} description={"branchName" in audit ? audit.branchName : undefined} focusFirstField={false}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Close")}</Button><Button disabled={!pick.size} loading={busy} onClick={() => void add()}><UserPlus size={15} /> {tr("Add {0}", pick.size)}</Button></>}>
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("In the team")} ({audit.members.length})</h3>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {audit.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-neutral-800">{m.name}</span><span className="text-[11px] text-neutral-400">{m.jobTitle ?? `@${m.username ?? ""}`}</span></span>
                {m.id === audit.lead.id ? <Badge tone="amber" icon={<Crown size={11} />}>{tr("Lead")}</Badge>
                  : audit.lead.id === me && <button type="button" onClick={() => void remove(m)} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><X size={15} /></button>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("Add colleagues")}</h3>
          <p className="mb-2 text-xs text-neutral-500">{tr("SWAT / Operations accounts. They see this audit in Form WW-WR and fill it with you; only you send it.")}</p>
          <div className="overflow-hidden rounded-xl border border-neutral-200">
            <div className="relative border-b border-neutral-100 p-2"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search colleague")} className={cx(inputClass, "h-9 pl-8")} /></div>
            <ul className="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
              {colleagues === null ? <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("Loading…")}</li> : shown.map((c) => (
                <li key={c.id}>
                  <label className={cx("flex cursor-pointer items-center gap-2.5 px-3 py-2", pick.has(c.id) && "bg-brand-50/60")}>
                    <input type="checkbox" checked={pick.has(c.id)} onChange={() => setPick((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-neutral-800">{c.name}</span><span className="text-[11px] text-neutral-400">{c.jobTitle ?? `@${c.username}`}</span></span>
                  </label>
                </li>
              ))}
              {colleagues && shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("No colleague to add")}</li>}
            </ul>
          </div>
        </section>
      </div>
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------------------- evaluation

type ActionDraft = { id?: string; title: string; detail: string; assigneeId: string; dueOn: string };
const toDraft = (x: ActionPlan): ActionDraft => ({ id: x.id, title: x.title, detail: x.detail ?? "", assigneeId: x.assigneeId ?? "", dueOn: x.dueOn ?? "" });

/** The general evaluation, the action plans (assignee, due date) and the revisit; saved by any member before sending. */
function EvaluationPanel({ audit, me, onSaved }: { audit: AuditTeam; me: string; onSaved: (a: Partial<AuditTeam>) => void }) {
  const toast = useToast();
  const [summary, setSummary] = useState(audit.summary ?? "");
  const [revisit, setRevisit] = useState(audit.revisitOn ?? "");
  const [actions, setActions] = useState<ActionDraft[]>(() => (audit.actions ?? []).map(toDraft));
  const [busy, setBusy] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [members, setMembers] = useState(audit.members);
  const saved = JSON.stringify([audit.summary ?? "", audit.revisitOn ?? "", (audit.actions ?? []).map(toDraft)]);
  const dirty = JSON.stringify([summary, revisit, actions]) !== saved;
  const set = (i: number, patch: Partial<ActionDraft>) => setActions((all) => all.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const save = async () => {
    setBusy(true);
    try {
      const a = await call<Audit>(`/api/forms/wwwr/audits/${audit.id}/evaluation`, { method: "PUT",
        json: { summary: summary.trim() || null, revisitOn: revisit || null,
          actions: actions.filter((x) => x.title.trim()).map((x) => ({ id: x.id, title: x.title.trim(), detail: x.detail.trim() || null, assigneeId: x.assigneeId || null, dueOn: x.dueOn || null })) } });
      setActions(a.actions.map(toDraft));
      onSaved({ summary: a.summary, revisitOn: a.revisitOn, actions: a.actions, members: a.members });
      toast(tr("Evaluation saved"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const missing = [!audit.summary && tr("general evaluation"), !audit.revisitOn && tr("revisit day"), !(audit.actions?.length) && tr("one action plan")].filter(Boolean);
  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">{tr("Before sending")}</p>
        <p className="text-lg font-semibold text-neutral-900">{tr("Evaluation & action plan")}</p>
        <p className="text-xs text-neutral-500">{tr("The team writes what it found, what the outlet must do, who of the team follows it and when the team comes back.")}</p>
      </div>
      {!dirty && missing.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{tr("Still needed before the lead sends: {0}", missing.join(", "))}</p>}

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">{tr("Team")}</h3>
          {audit.lead.id === me && <Button size="sm" variant="secondary" onClick={() => setTeamOpen(true)}><UserPlus size={14} /> {tr("Add colleagues")}</Button>}
        </div>
        <p className="flex flex-wrap gap-1.5">{members.map((m) => <Badge key={m.id} tone={m.id === audit.lead.id ? "amber" : "slate"}>{m.name}{m.id === audit.lead.id ? ` · ${tr("lead")}` : ""}</Badge>)}</p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-neutral-900">{tr("General evaluation")} <span className="text-red-500">*</span>
          <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={4000} className={cx(inputClass, "mt-2 py-2 font-normal")}
            placeholder={tr("e.g. Bar clean, but the stock of premix is under par and two shelf-life labels are missing …")} /></label>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div><h3 className="text-sm font-semibold text-neutral-900">{tr("Action plans")} <span className="text-red-500">*</span></h3><p className="text-xs text-neutral-500">{tr("What must be done, who of the team handles it and by when")}</p></div>
          <Button size="sm" variant="secondary" onClick={() => setActions((a) => [...a, { title: "", detail: "", assigneeId: "", dueOn: revisit }])}><Plus size={14} /> {tr("Action plan")}</Button>
        </div>
        <ol className="space-y-2">
          {actions.map((x, i) => (
            <li key={x.id ?? `n${i}`} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{i + 1}</span>
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6">
                  <input value={x.title} onChange={(e) => set(i, { title: e.target.value })} maxLength={300} placeholder={tr("What to do, e.g. Restock premix and relabel shelf life")} className={cx(inputClass, "h-9 sm:col-span-6")} />
                  <input value={x.detail} onChange={(e) => set(i, { detail: e.target.value })} maxLength={2000} placeholder={tr("Detail (optional)")} className={cx(inputClass, "h-9 sm:col-span-6")} />
                  <label className="text-[11px] font-medium text-neutral-500 sm:col-span-4">{tr("Handled by")}
                    <select value={x.assigneeId} onChange={(e) => set(i, { assigneeId: e.target.value })} className={cx(inputClass, "mt-1 h-9")}>
                      <option value="">{tr("— Choose —")}</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select></label>
                  <label className="text-[11px] font-medium text-neutral-500 sm:col-span-2">{tr("Due")}
                    <input type="date" value={x.dueOn} min={audit.day} onChange={(e) => set(i, { dueOn: e.target.value })} className={cx(inputClass, "mt-1 h-9")} /></label>
                </div>
                <button type="button" onClick={() => setActions((a) => a.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Delete")}><Trash2 size={15} /></button>
              </div>
            </li>
          ))}
          {actions.length === 0 && <li className="rounded-xl border border-dashed border-neutral-200 px-3 py-5 text-center text-xs text-neutral-400">{tr("No action plan yet")}</li>}
        </ol>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-neutral-900">{tr("Revisit")} <span className="text-red-500">*</span>
          <span className="block text-xs font-normal text-neutral-500">{tr("When the team comes back to check the progress; the audit stays open until then")}</span>
          <input type="date" value={revisit} min={audit.day} onChange={(e) => setRevisit(e.target.value)} className={cx(inputClass, "mt-2 h-10 max-w-[14rem] font-normal")} /></label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <span className={cx("text-xs", dirty ? "text-amber-700" : "text-emerald-700")}>{dirty ? tr("Not saved yet") : tr("Saved")}</span>
        <Button loading={busy} disabled={!dirty} onClick={() => void save()}><ClipboardList size={15} /> {tr("Save evaluation")}</Button>
      </div>
      {teamOpen && <TeamDrawer audit={{ ...audit, members }} me={me} onClose={() => setTeamOpen(false)}
        onChanged={() => { void call<WwwrState>("/api/forms/wwwr").then((d) => { const a = d.audits.find((x) => x.id === audit.id); if (a) { setMembers(a.members); onSaved({ members: a.members }); } }); }} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- follow-up

/** A sent audit: the action plans marked done, the revisit closed by the lead, the result shared with the PIC. */
function FollowUpDrawer({ audit, me, onClose, onChanged }: { audit: Audit; me: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const lead = audit.lead.id === me;
  const done = audit.status === "completed";
  const left = useMemo(() => audit.actions.filter((x) => x.status === "open").length, [audit.actions]);
  const toggle = async (x: ActionPlan) => {
    const text = x.status === "open" ? window.prompt(tr("What was done? (optional)"), "") : "";
    if (text === null) return;
    setBusy(x.id);
    try { await call(`/api/forms/wwwr/actions/${x.id}`, { method: "POST", json: { done: x.status === "open", note: text || null } }); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const complete = async () => {
    setBusy("complete");
    try { await call(`/api/forms/wwwr/audits/${audit.id}/complete`, { method: "POST", json: { note: note.trim() || null } }); toast(tr("Audit completed")); onChanged(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl(audit.shareToken!)); toast(tr("Link copied: share it with the PIC")); } catch { toast(shareUrl(audit.shareToken!)); }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<ClipboardCheck size={18} />} title={audit.branchName} description={`${tr("SWAT audit")} · ${dayShort(audit.day)}`} focusFirstField={false}
      footer={<>
        {audit.shareToken && <>
          <Button variant="secondary" onClick={() => void copy()}><Copy size={14} /> {tr("Copy link")}</Button>
          <a href={`/share/wwwr/${audit.shareToken}?print=1`} target="_blank" rel="noreferrer"><Button variant="secondary"><Printer size={14} /> {tr("Print / PDF")}</Button></a>
        </>}
        <Button onClick={onClose}>{tr("Close")}</Button>
      </>}>
      <div className="space-y-4 text-sm">
        <div className={cx("rounded-xl border px-4 py-3", done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
          <p className="font-semibold">{done ? tr("Completed {0}", wibDateTime(audit.completedAt)) : tr("Follow-up: {0} of {1} action plans open", left, audit.actions.length)}</p>
          <p className="text-xs">{tr("Revisit {0}", dayShort(audit.revisitOn))}{audit.revisitNote ? ` · ${audit.revisitNote}` : ""}</p>
        </div>
        {audit.summary && <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("General evaluation")}</h3><p className="whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-neutral-700">{audit.summary}</p></section>}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{tr("Action plans")}</h3>
          <ul className="space-y-2">
            {audit.actions.map((x) => (
              <li key={x.id} className={cx("flex items-start gap-3 rounded-xl border p-3", x.status === "done" ? "border-emerald-200 bg-emerald-50/50" : "border-neutral-200")}>
                <button type="button" disabled={done || busy === x.id} onClick={() => void toggle(x)} aria-pressed={x.status === "done"}
                  className={cx("mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border", x.status === "done" ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 bg-white hover:border-brand-500")}>
                  {x.status === "done" && <CheckCircle2 size={13} />}</button>
                <div className="min-w-0 flex-1">
                  <p className={cx("font-medium", x.status === "done" ? "text-neutral-500 line-through" : "text-neutral-900")}>{x.title}</p>
                  {x.detail && <p className="text-xs text-neutral-500">{x.detail}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-neutral-500"><span>{tr("Handled by {0}", x.assignee ?? "—")}</span><span>{tr("Due {0}", dayShort(x.dueOn))}</span>
                    {x.status === "done" && <span className="text-emerald-700">{tr("Done by {0} · {1}", x.doneBy ?? "—", wibDateTime(x.doneAt))}</span>}</p>
                  {x.doneNote && <p className="mt-1 text-xs text-neutral-600">“{x.doneNote}”</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
        {!done && lead && (
          <section className="rounded-xl border border-neutral-200 p-3">
            <h3 className="text-sm font-semibold text-neutral-900">{tr("Close the revisit")}</h3>
            <p className="mb-2 text-xs text-neutral-500">{left ? tr("Mark every action plan done first ({0} open)", left) : tr("Every action plan is done: close the revisit to complete the audit")}</p>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Result of the revisit (optional)")} className={cx(inputClass, "py-2")} />
            <div className="mt-2 flex justify-end"><Button disabled={left > 0} loading={busy === "complete"} onClick={() => void complete()}><CheckCircle2 size={15} /> {tr("Complete the audit")}</Button></div>
          </section>
        )}
      </div>
    </Drawer>
  );
}

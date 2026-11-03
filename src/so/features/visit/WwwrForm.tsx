"use client";

// Form → WW-WR (page form.wwwr, the SWAT team; integrated_portal_be app/wwwr.py): the audits the member is assigned to
// (scheduled by the management in Monitoring WW-WR). From its day an audit opens the one shared visit of the team:
// every item of Monitoring Product and Monitoring Outlet, each answer saved with who filled it; the lead sends it with
// the signature. The team never sees a score.

import { CalendarClock, CheckCircle2, ChevronRight, ClipboardCheck, Crown, ShieldCheck, Store, UsersRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Page, cx, useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { wibDay } from "@/so/ui/Filters";
import { locale, tr } from "@/lib/i18n";
import { VisitEditor } from "./VisitForm";
import { type Audit, type Visit, type WwwrState } from "./visit";

const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function WwwrForm() {
  const toast = useToast();
  const [data, setData] = useState<WwwrState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [sent, setSent] = useState<Visit | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<WwwrState>("/api/forms/wwwr")); } catch (e) { setError((e as Error).message); }
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

  if (visit && data) {
    return <VisitEditor form="wwwr" data={data} visit={visit} canDiscard={false} canSend={visit.audit?.lead.id === data.user.id}
      onClose={() => { setVisit(null); void load(); }}
      onSubmitted={(v) => { setVisit(null); setSent(v); void load(); window.scrollTo({ top: 0 }); }} />;
  }

  const today = wibDay(0);
  const audits = data?.audits ?? [];
  const active = audits.filter((a) => a.status !== "submitted" && a.day <= today);
  const upcoming = audits.filter((a) => a.status !== "submitted" && a.day > today).reverse();
  const done = audits.filter((a) => a.status === "submitted").slice(0, 10);
  return (
    <Page title="WW-WR" subtitle={tr("SWAT audit of the outlet: Product and Outlet in one form")}>
      {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="mx-auto max-w-4xl space-y-4"><div className="skeleton h-32 rounded-xl" /><div className="skeleton h-48 rounded-xl" /></div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-4">
          {sent && (
            <p className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span><b>{tr("Audit sent for {0}", sent.branchName)}</b><br /><span className="text-xs">{wibDateTime(sent.submittedAt)} · {tr("{0} items rated", sent.counts.rated)}</span></span>
            </p>
          )}
          <p className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs leading-relaxed text-blue-900">
            <ShieldCheck size={15} className="mt-px flex-shrink-0 text-blue-700" />
            <span>{tr("Only the members of an audit open it. Everyone in the team fills the same form (each item shows who filled it); the lead reviews and sends it.")}</span>
          </p>

          <Section title={tr("To do")} count={active.length}>
            {active.length === 0 ? <Empty icon={<ClipboardCheck size={26} />} title={tr("No audit for today")}>{tr("Audits appear here when the management assigns you to one.")}</Empty>
              : active.map((a) => <AuditCard key={a.id} a={a} me={data.user.id} busy={opening === a.id} onOpen={() => void open(a)} />)}
          </Section>
          {upcoming.length > 0 && (
            <Section title={tr("Upcoming")} count={upcoming.length}>
              {upcoming.map((a) => <AuditCard key={a.id} a={a} me={data.user.id} />)}
            </Section>
          )}
          {done.length > 0 && (
            <Section title={tr("Sent")} count={done.length}>
              {done.map((a) => <AuditCard key={a.id} a={a} me={data.user.id} />)}
            </Section>
          )}
        </div>
      )}
    </Page>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <p className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 sm:px-5">
        {title}<span className="rounded-full bg-slate-100 px-1.5 text-[11px] tabular-nums text-slate-600">{count}</span>
      </p>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function AuditCard({ a, me, busy, onOpen }: { a: Audit; me: string; busy?: boolean; onOpen?: () => void }) {
  const lead = a.lead.id === me;
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Store size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{a.branchName}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><CalendarClock size={12} /> {dayLabel(a.day)}</p>
        <p className="mt-1 flex items-start gap-1 text-xs text-slate-600"><UsersRound size={12} className="mt-0.5 flex-shrink-0" />
          <span>{a.members.map((m) => m.name).join(", ")}</span></p>
        <p className="mt-1.5 flex flex-wrap gap-1.5">
          {lead ? <Badge tone="blue" icon={<Crown size={11} />}>{tr("You lead")}</Badge> : <Badge>{tr("Lead: {0}", a.lead.name)}</Badge>}
          {a.status === "in_progress" && <Badge tone="amber">{tr("In progress · {0} of {1} rated", a.counts?.rated ?? 0, a.counts?.total ?? 0)}</Badge>}
          {a.status === "submitted" && <Badge tone="green">{tr("Sent {0}", wibDateTime(a.submittedAt))}</Badge>}
        </p>
        {a.note && <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">{a.note}</p>}
      </div>
      {onOpen && (
        <Button size="sm" loading={busy} onClick={onOpen} className={cx("flex-shrink-0")}>
          {a.status === "in_progress" ? tr("Continue") : tr("Start")} <ChevronRight size={14} />
        </Button>
      )}
    </li>
  );
}

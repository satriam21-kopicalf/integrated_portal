"use client";

// Aggregator Insight → Handle Schedule (page agg.schedule, 2026-11-24): which member of the Aggregator team works on
// which outlet. A weekly template (member, outlets, slot, weekdays, from a date) with exceptions for one date; a change
// starts on its date, so every past day keeps who handled it (the reports stamp each event with that member).

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, UserRoundCheck } from "lucide-react";
import Drawer from "@/components/kc/Drawer";
import { Button, ErrorState, Input, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { JSelect, Lozenge, QuickChips, Toolbar, WorkCard } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { type Handle, type Member, type OutletRow, WEEKDAYS } from "@/aggregator/shared";
import { DataTable, FilterBar, Label, OutletCell, useCtx, useFilters, useScope, type Col } from "@/aggregator/kit";
import { daysAgo, fmtDay, nf } from "@/aggregator/time";

const step = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

export default function HandleSchedule() {
  const toast = useToast();
  const ctx = useCtx();
  const a = useFilters();
  const [day, setDay] = useState(daysAgo(0));
  const [data, setData] = useState<Handle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [slot, setSlot] = useState("day");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "none" | "handled" | "exc">("all");
  const [who, setWho] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [exc, setExc] = useState<OutletRow | null>(null);
  const load = useCallback(() => { setErr(null); call<Handle>(`/api/aggregator/handle?date=${day}`).then(setData).catch((e: Error) => setErr(e.message)); }, [day]);
  useEffect(() => {
    let off = false;
    setData(null); setErr(null);
    call<Handle>(`/api/aggregator/handle?date=${day}`).then((r) => { if (!off) setData(r); }).catch((e: Error) => { if (!off) setErr(e.message); });
    return () => { off = true; };
  }, [day]);
  useEffect(() => { call<Member[]>("/api/aggregator/members").then(setMembers).catch(() => setMembers([])); }, []);
  const t = q.trim().toLowerCase();
  const key = `${day}${slot}${a.f.outlet}${a.f.group}${only}${who}${t}`;
  // only what is on screen may be assigned
  useEffect(() => { setSel(new Set()); }, [key]);
  const scoped = useScope(data?.outlets, a.f, ctx).filter((o) => !who || o.slots[slot]?.userId === who);
  const is = (o: OutletRow, k: typeof only) => k === "all" || (k === "none" ? !o.slots[slot]?.userId : k === "handled" ? !!o.slots[slot]?.userId : o.slots[slot]?.source === "exception");
  const n = (k: typeof only) => scoped.filter((o) => is(o, k)).length;
  const rows = scoped.filter((o) => is(o, only) && (!t || `${o.branchName} ${o.branchCode} ${o.slots[slot]?.name ?? ""}`.toLowerCase().includes(t)));
  const load_ = Object.entries(scoped.reduce<Record<string, number>>((m, o) => { const x = o.slots[slot]; if (x?.userId && x.name) m[x.name] = (m[x.name] ?? 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]);
  const memberOpts = members.map((m) => ({ value: m.id, label: m.name, hint: m.jobTitle ?? undefined }));
  const cols: Col<OutletRow>[] = [
    { key: "o", label: tr("Outlet"), sort: (o) => o.branchName, render: (o) => <OutletCell name={o.branchName} code={o.branchCode} ctx={ctx} /> },
    { key: "g", label: tr("Branch group"), sort: (o) => ctx?.outlets.find((x) => x.code === o.branchCode)?.group ?? "", className: "text-neutral-600", render: (o) => ctx?.outlets.find((x) => x.code === o.branchCode)?.group ?? "—" },
    { key: "m", label: tr("Handled by"), sort: (o) => o.slots[slot]?.name ?? "", render: (o) => { const x = o.slots[slot]; return x?.userId ? <span className="inline-flex flex-wrap items-center gap-2 font-medium text-neutral-900">{x.name}{x.source === "exception" && <Lozenge tone="violet" title={x.note ?? undefined}>{tr("This date only")}</Lozenge>}</span> : x?.source === "exception" ? <Lozenge tone="amber" title={x.note ?? undefined}>{tr("Nobody this date")}</Lozenge> : <span className="text-neutral-400">{tr("Not handled")}</span>; } },
    { key: "d", label: tr("Days"), className: "text-xs text-neutral-500", render: (o) => { const x = o.slots[slot]; return x?.source === "template" ? (x.weekdays?.length ? x.weekdays.map((w) => WEEKDAYS()[w - 1]).join(", ") : tr("Every day")) : "—"; } },
    { key: "x", label: "", right: true, render: (o) => <button type="button" className="whitespace-nowrap text-xs font-semibold text-brand-700 hover:underline" onClick={(e) => { e.stopPropagation(); setExc(o); }}>{tr("Change this date")}</button> },
  ];
  return (
    <Page title={tr("Handle Schedule")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Which member of the Aggregator team works on which outlet")} media={<CalendarDays size={19} />}
      actions={<Button size="sm" disabled={sel.size === 0} onClick={() => setAssignOpen(true)}><UserRoundCheck size={14} /> {tr("Assign {0} outlets", sel.size)}</Button>}>
      <FilterBar a={a} ctx={ctx} period={false} platform={false} note={`${tr("The schedule of {0}", fmtDay(day))}${day === daysAgo(0) ? ` · ${tr("Today")}` : ""}`}
        extra={[{ key: "who", label: tr("Member"), value: who, onChange: setWho, options: memberOpts }]}
        lead={<div className="min-w-0 col-span-2"><Label t={tr("Date")} /><div className="flex items-center gap-1.5"><Button variant="secondary" size="sm" className="h-9 px-2" aria-label={tr("The day before")} onClick={() => setDay(step(day, -1))}><ChevronLeft size={15} /></Button>
          <Input type="date" value={day} aria-label={tr("Date")} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9" /><Button variant="secondary" size="sm" className="h-9 px-2" aria-label={tr("The day after")} onClick={() => setDay(step(day, 1))}><ChevronRight size={15} /></Button>
          {day !== daysAgo(0) && <Button variant="ghost" size="sm" className="h-9" onClick={() => setDay(daysAgo(0))}>{tr("Today")}</Button>}</div></div>} />
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <>
          <StatStrip columns={4} label={tr("Handle Schedule")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Outlets")} value={data ? nf(scoped.length) : <StatSkeleton />} /><Stat label={tr("Handled")} value={data ? nf(n("handled")) : <StatSkeleton />} />
            <Stat label={tr("Not handled")} value={data ? nf(n("none")) : <StatSkeleton />} />
            <Stat label={tr("Members on duty")} value={data ? nf(load_.length) : <StatSkeleton />}>{load_.length > 0 && <p className="truncate">{load_.slice(0, 3).map(([m, c]) => `${m} ${c}`).join(" · ")}</p>}</Stat>
          </StatStrip>
          <WorkCard tabs={(data?.slots ?? [{ code: "day", label: tr("All day") }]).map((s) => ({ key: s.code, label: s.label }))} active={slot} onTab={setSlot} label={tr("Slots")}>
            <Toolbar><div className="flex flex-wrap items-center gap-2"><div className="w-full sm:w-72"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet or member")} /></div>
              <QuickChips<typeof only> value={only} onChange={setOnly} label={tr("Filter")} items={[{ key: "all", label: tr("All"), count: n("all") }, { key: "none", label: tr("Not handled"), dot: "bg-amber-400", count: n("none") }, { key: "handled", label: tr("Handled"), dot: "bg-emerald-500", count: n("handled") }, { key: "exc", label: tr("This date only"), count: n("exc") }]} /></div></Toolbar>
            <DataTable cols={cols} rows={rows} loading={!data} rowKey={(o) => o.branchCode} resetKey={key} initial={{ key: "o", dir: "asc" }} minWidth={720} empty={tr("No outlet")} select={{ picked: sel, onChange: setSel, label: (o) => o.branchName }} note={tr("Choose outlets, then assign them to a member from a date; the days before keep who handled them.")} />
          </WorkCard>
        </>
      )}
      {assignOpen && <AssignDrawer codes={[...sel]} slot={slot} day={day} members={memberOpts} onClose={() => setAssignOpen(false)} onDone={(m) => { setAssignOpen(false); setSel(new Set()); toast(m); load(); }} />}
      {exc && <ExceptionDrawer outlet={exc} slot={slot} day={day} members={memberOpts} onClose={() => setExc(null)} onDone={(m) => { setExc(null); toast(m); load(); }} />}
    </Page>
  );
}

function AssignDrawer({ codes, slot, day, members, onClose, onDone }: {
  codes: string[]; slot: string; day: string; members: { value: string; label: string }[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [member, setMember] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [from, setFrom] = useState(day);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = (remove = false) => {
    setBusy(true); setErr(null);
    (remove ? call("/api/aggregator/handle/remove", { method: "POST", json: { branchCodes: codes, slot, validFrom: from } })
      : call("/api/aggregator/handle", { method: "PUT", json: { memberId: member, branchCodes: codes, slot, weekdays: days.length ? days : null, validFrom: from } }))
      .then(() => onDone(remove ? tr("{0} outlets no longer handled from {1}", codes.length, fmtDay(from)) : tr("{0} outlets assigned from {1}", codes.length, fmtDay(from))))
      .catch((e) => { setErr(e.message); setBusy(false); });
  };
  return (
    <Drawer open title={tr("Assign {0} outlets", codes.length)} description={tr("Applies every week from the date chosen; the days before keep who handled them.")} onClose={onClose}
      icon={<UserRoundCheck size={18} />}
      footer={<div className="flex w-full flex-wrap justify-between gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => save(true)}>{tr("Remove from these outlets")}</Button>
        <Button disabled={!member} loading={busy} onClick={() => save()}>{tr("Save")}</Button></div>}>
      <div className="space-y-4 p-4">
        {members.length === 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{tr("No member yet: give accounts the page Aggregator Insight in User Accounts.")}</p>}
        <label className="block text-sm font-medium text-neutral-800">{tr("Member")}
          <JSelect value={member} onChange={setMember} options={members} placeholder={tr("Choose a member")} className="mt-1" /></label>
        <div className="text-sm font-medium text-neutral-800">{tr("Days")}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEKDAYS().map((w, i) => (
              <button key={w} type="button" aria-pressed={days.includes(i + 1)} onClick={() => setDays((d) => d.includes(i + 1) ? d.filter((x) => x !== i + 1) : [...d, i + 1])}
                className={cx("h-9 min-w-11 rounded-md border px-2 text-sm", days.includes(i + 1) ? "border-brand-600 bg-brand-50 font-semibold text-brand-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")}>{w}</button>
            ))}
          </div>
          <p className="mt-1 text-xs font-normal text-neutral-500">{tr("None chosen = every day")}</p>
        </div>
        <label className="block text-sm font-medium text-neutral-800">{tr("From")}
          <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="mt-1" /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Drawer>
  );
}

function ExceptionDrawer({ outlet, slot, day, members, onClose, onDone }: {
  outlet: OutletRow; slot: string; day: string; members: { value: string; label: string }[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  const cur = outlet.slots[slot];
  const [member, setMember] = useState(cur?.source === "exception" ? (cur.userId ?? "none") : "");
  const [note, setNote] = useState(cur?.source === "exception" ? cur.note ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = (clear: boolean) => {
    setBusy(true); setErr(null);
    call("/api/aggregator/handle/exception", { method: "PUT", json: { date: day, branchCode: outlet.branchCode, slot, memberId: member === "none" ? null : member || null, note: note || null, clear } })
      .then(() => onDone(clear ? tr("Back to the weekly schedule") : tr("Saved for {0}", fmtDay(day))))
      .catch((e) => { setErr(e.message); setBusy(false); });
  };
  return (
    <Drawer open title={outlet.branchName} description={tr("Only for {0}: leave, swap or a replacement. The weekly schedule stays.", fmtDay(day))} onClose={onClose} icon={<CalendarDays size={18} />}
      footer={<div className="flex w-full flex-wrap justify-between gap-2">
        {cur?.source === "exception" ? <Button variant="ghost" disabled={busy} onClick={() => send(true)}>{tr("Back to the weekly schedule")}</Button> : <span />}
        <Button disabled={!member} loading={busy} onClick={() => send(false)}>{tr("Save")}</Button></div>}>
      <div className="space-y-4 p-4">
        <label className="block text-sm font-medium text-neutral-800">{tr("Handled by on this date")}
          <JSelect value={member} onChange={setMember} options={[{ value: "none", label: tr("Nobody") }, ...members]} placeholder={tr("Choose a member")} className="mt-1" /></label>
        <label className="block text-sm font-medium text-neutral-800">{tr("Note")}
          <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={tr("e.g. leave, replaced by …")} className="mt-1" /></label>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </Drawer>
  );
}

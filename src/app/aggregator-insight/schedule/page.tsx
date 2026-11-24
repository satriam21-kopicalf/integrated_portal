"use client";

// Aggregator Insight → Handle Schedule (page agg.schedule, 2026-11-24): which member of the Aggregator team works on
// which outlet. A weekly template (member, outlets, slot, weekdays, from a date) with exceptions for one date; a change
// starts on its date, so every past day keeps who handled it (the reports stamp each event with that member).

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, UserRoundCheck } from "lucide-react";
import Drawer from "@/components/kc/Drawer";
import { Button, ErrorState, Input, SearchBox, cx, useToast } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { CardFooter, JSelect, Lozenge, QuickChips, Toolbar, WorkCard, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { type Handle, type Member, type OutletRow, WEEKDAYS } from "@/aggregator/shared";

const todayWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

export default function HandleSchedule() {
  const toast = useToast();
  const [day, setDay] = useState(todayWib());
  const [data, setData] = useState<Handle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [slot, setSlot] = useState("day");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "none" | "mine">("all");
  const [who, setWho] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [exc, setExc] = useState<OutletRow | null>(null);

  const load = () => {
    setErr(null);
    call<Handle>(`/api/aggregator/handle?date=${day}`).then(setData).catch((e) => setErr(e.message));
  };
  useEffect(load, [day]);
  useEffect(() => { call<Member[]>("/api/aggregator/members").then(setMembers).catch(() => setMembers([])); }, []);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.outlets ?? []).filter((o) => {
      const a = o.slots[slot];
      if (only === "none" && a?.userId) return false;
      if (only === "mine" && (!who || a?.userId !== who)) return false;
      return !t || o.branchName.toLowerCase().includes(t) || o.branchCode.toLowerCase().includes(t) || (a?.name ?? "").toLowerCase().includes(t);
    });
  }, [data, q, only, who, slot]);
  const unhandled = (data?.outlets ?? []).filter((o) => !o.slots[slot]?.userId).length;
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.branchCode));
  const toggle = (c: string) => setSel((s) => { const x = new Set(s); if (x.has(c)) x.delete(c); else x.add(c); return x; });
  const memberOpts = members.map((m) => ({ value: m.id, label: m.name, hint: m.jobTitle ?? undefined }));

  return (
    <Page title={tr("Handle Schedule")} eyebrow={tr("Aggregator Insight")} subtitle={tr("Which member of the Aggregator team works on which outlet")} media={<CalendarDays size={19} />}>
      {err ? <ErrorState message={err} onRetry={load} /> : (
        <WorkCard tabs={(data?.slots ?? [{ code: "day", label: tr("All day") }]).map((s) => ({ key: s.code, label: s.label }))} active={slot}
          onTab={setSlot} label={tr("Slots")}
          left={<label className="flex items-center gap-2 text-sm text-neutral-600">{tr("Date")}
            <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 w-auto" /></label>}>
          <Toolbar>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet or member")} /></div>
              <QuickChips value={only} onChange={setOnly} label={tr("Filter")} items={[
                { key: "all", label: tr("All"), count: data?.outlets.length ?? null },
                { key: "none", label: tr("Not handled"), count: unhandled },
                { key: "mine", label: tr("One member") },
              ]} />
              {only === "mine" && <JSelect value={who} onChange={setWho} options={memberOpts} placeholder={tr("Choose a member")} className="w-56" />}
            </div>
            <Button size="sm" disabled={sel.size === 0} onClick={() => setAssignOpen(true)}><UserRoundCheck size={14} /> {tr("Assign {0} outlets", sel.size)}</Button>
          </Toolbar>
          <div className="overflow-x-auto">
            <table className={jTable}>
              <thead><tr className={jHeadRow}>
                <th className={cx(jTh, "w-10")}><input type="checkbox" aria-label={tr("Select all")} checked={allSel}
                  onChange={() => setSel(allSel ? new Set() : new Set(rows.map((r) => r.branchCode)))} /></th>
                <th className={jTh}>{tr("Outlet")}</th><th className={jTh}>{tr("Handled by")}</th><th className={jTh}>{tr("Days")}</th><th className={cx(jTh, "text-right")} />
              </tr></thead>
              <tbody>
                {!data ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">…</td></tr>
                  : rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">{tr("No outlet")}</td></tr>
                  : rows.map((o) => {
                    const a = o.slots[slot];
                    return (
                      <tr key={o.branchCode} className="border-b border-neutral-100 hover:bg-neutral-50">
                        <td className={jTd}><input type="checkbox" aria-label={o.branchName} checked={sel.has(o.branchCode)} onChange={() => toggle(o.branchCode)} /></td>
                        <td className={jTd}><span className="font-medium text-neutral-900">{o.branchName}</span> <span className="text-xs text-neutral-400">{o.branchCode}</span></td>
                        <td className={jTd}>{a?.userId ? <span className="flex items-center gap-2">{a.name}{a.source === "exception" && <Lozenge tone="violet" title={a.note ?? undefined}>{tr("This date only")}</Lozenge>}</span>
                          : a?.source === "exception" ? <Lozenge tone="amber" title={a.note ?? undefined}>{tr("Nobody this date")}</Lozenge>
                          : <span className="text-neutral-400">{tr("Not handled")}</span>}</td>
                        <td className={cx(jTd, "text-xs text-neutral-500")}>{a?.source === "template" ? (a.weekdays?.length ? a.weekdays.map((w) => WEEKDAYS()[w - 1]).join(", ") : tr("Every day")) : ""}</td>
                        <td className={cx(jTd, "text-right")}><button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => setExc(o)}>{tr("Change this date")}</button></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <CardFooter><span className="text-xs text-neutral-500">{tr("{0} of {1} outlets", rows.length, data?.outlets.length ?? 0)}</span></CardFooter>
        </WorkCard>
      )}
      {assignOpen && <AssignDrawer codes={[...sel]} slot={slot} day={day} members={memberOpts} onClose={() => setAssignOpen(false)}
        onDone={(m) => { setAssignOpen(false); setSel(new Set()); toast(m); load(); }} />}
      {exc && <ExceptionDrawer outlet={exc} slot={slot} day={day} members={memberOpts} onClose={() => setExc(null)}
        onDone={(m) => { setExc(null); toast(m); load(); }} />}
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
      .then(() => onDone(remove ? tr("{0} outlets no longer handled from {1}", codes.length, from) : tr("{0} outlets assigned from {1}", codes.length, from)))
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
      .then(() => onDone(clear ? tr("Back to the weekly schedule") : tr("Saved for {0}", day)))
      .catch((e) => { setErr(e.message); setBusy(false); });
  };
  return (
    <Drawer open title={outlet.branchName} description={tr("Only for {0}: leave, swap or a replacement. The weekly schedule stays.", day)} onClose={onClose} icon={<CalendarDays size={18} />}
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

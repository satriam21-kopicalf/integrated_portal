"use client";

// Monitoring → Branch groups (page mon.branch-groups, 2026-10-21): the classes of outlets (CCI, CTG, CTGP …) the PIC
// Check In, Monitoring Product and Monitoring Outlet are judged by. One group per branch; a branch picked for a group
// moves out of its former group. Used by Monitoring → Overview and the group filter of the monitoring pages.

import { AlarmClock, Boxes, Check, Footprints, ListChecks, Plus, Save, Store, Trash2, TrendingUp } from "lucide-react";
import { CardBody, CardFooter, Lozenge, TypeIcon, WorkCard, jHeadRow, jKey, jRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Page, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { FormCard } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { useAuth, hasPage } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import { CheckInDeadlines, FormItems, SalesTargets } from "./settings";
import { TravelSettings } from "./travel";

type Branch = { code: string; name: string };
type Group = { id: string; code: string; name: string; description: string | null; sort: number; branches: Branch[];
  /** PIC check-ins an outlet of the group takes per day (null = once a day, migration 066) */ checkin_max_per_day: number | null;
  /** HH:MM, the first check-in of the PIC's day by then is on time (null = 11:00, migration 069) */ checkin_deadline: string | null };
type Data = { groups: Group[]; unassigned: Branch[] };

export default function BranchGroupsPage() {
  const { user } = useAuth();
  const canEdit = hasPage(user, "mon.branch-groups");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Group | "new" | null>(null);
  const [tab, setTab] = useState("groups");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await call<Data>("/api/monitoring/branch-groups"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const total = data ? data.groups.reduce((a, g) => a + g.branches.length, 0) + data.unassigned.length : 0;

  return (
    <Page title={tr("Branch Groups")} subtitle={tr("Classes of outlets the forms are assessed by (CCI, CTG, CTGP …); one group per branch")}
      actions={canEdit && tab === "groups" ? <Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New Group")}</Button> : undefined}>
      {/* Jira-like (2026-11-18): one card, the settings as tabs, the groups as an issue table */}
      <WorkCard label={tr("Branch Groups")} active={tab} onTab={setTab}
        tabs={[{ key: "groups", label: tr("Groups"), icon: <Boxes size={15} />, count: data?.groups.length }, { key: "deadlines", label: tr("Check-In Deadlines"), icon: <AlarmClock size={15} /> },
          { key: "items", label: tr("Form Items"), icon: <ListChecks size={15} /> }, { key: "travel", label: "Travel Path", icon: <Footprints size={15} /> }, { key: "targets", label: tr("Net Sales"), icon: <TrendingUp size={15} /> }]}>
      {tab === "deadlines" ? <CardBody><CheckInDeadlines canEdit={canEdit} /></CardBody> : tab === "items" ? <CardBody><FormItems canEdit={canEdit} /></CardBody>
        : tab === "travel" ? <CardBody><TravelSettings canEdit={canEdit} /></CardBody>
        : tab === "targets" ? <CardBody><SalesTargets /></CardBody> : error ? <div className="p-4"><ErrorState message={error} onRetry={load} /></div> : !data ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-10 rounded-[3px]" />)}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className={cx(jTable, "min-w-[860px]")}>
              <thead>
                <tr className={jHeadRow}>
                  <th className={cx(jTh, "w-8")} aria-label={tr("Type")} /><th className={jTh}>Key</th><th className={jTh}>{tr("Name")}</th>
                  <th className={jTh}>{tr("Outlets")}</th><th className={cx(jTh, "text-right")}>{tr("Check-ins per day")}</th><th className={jTh}>{tr("On time until")}</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.id} onClick={() => canEdit && setOpen(g)} className={cx(jRow, !canEdit && "cursor-default")}>
                    <td className={jTd}><TypeIcon tone="bg-[color:var(--j-0C66E4)]" title={tr("Group")}><Boxes size={11} /></TypeIcon></td>
                    <td className={cx(jTd, "whitespace-nowrap")}><span className={jKey}>{g.code}</span></td>
                    <td className={cx(jTd, "max-w-[16rem]")}><span className="block truncate text-[color:var(--j-172B4D)]">{g.name}</span>
                      {g.description && <span className="block truncate text-[11px] text-[color:var(--j-626F86)]">{g.description}</span>}</td>
                    <td className={cx(jTd, "max-w-[26rem]")}>
                      <span className="flex flex-wrap items-center gap-1">
                        <Lozenge tone={g.branches.length ? "blue" : "amber"}>{g.branches.length}</Lozenge>
                        {g.branches.slice(0, 4).map((b) => <span key={b.code} className="max-w-[9rem] truncate rounded-[3px] bg-[color:var(--j-091E420F)] px-1.5 py-0.5 text-[11px] text-[color:var(--j-44546F)]">{b.name.replace(/^Kopi Calf (To Go )?/, "")}</span>)}
                        {g.branches.length > 4 && <span className="text-[11px] text-[color:var(--j-626F86)]">+{g.branches.length - 4}</span>}
                        {g.branches.length === 0 && <span className="text-xs text-[color:var(--j-7F5F01)]">{tr("No branch yet")}</span>}
                      </span>
                    </td>
                    <td className={cx(jTd, "text-right tabular-nums text-[color:var(--j-172B4D)]")}>{g.checkin_max_per_day ?? 1}×</td>
                    <td className={cx(jTd, "tabular-nums text-[color:var(--j-172B4D)]")}>{g.checkin_deadline ?? "11:00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[color:var(--j-DCDFE4)] px-4 py-3 sm:px-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{tr("Without a group ({0})", data.unassigned.length)}</p>
            {data.unassigned.length === 0 ? <p className="flex items-center gap-1.5 text-sm text-[color:var(--j-216E4E)]"><Check size={14} /> {tr("Every outlet is in a group")}</p> : (
              <ul className="flex flex-wrap gap-1.5">
                {data.unassigned.map((b) => <li key={b.code}><Badge tone="amber" icon={<Store size={11} />}>{b.name} · {b.code}</Badge></li>)}
              </ul>
            )}
          </div>
          <CardFooter><span>{tr("{0} Kopi Calf outlets in total; outlets without a group appear as “Without a group” in the Overview", total)}</span></CardFooter>
        </>
      )}
      </WorkCard>
      {open && data && <GroupDrawer group={open === "new" ? null : open} data={data} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
    </Page>
  );
}

function GroupDrawer({ group, data, onClose, onSaved }: { group: Group | null; data: Data; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState(group?.code ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [maxCheckin, setMaxCheckin] = useState(group?.checkin_max_per_day ? String(group.checkin_max_per_day) : "");
  const [deadline, setDeadline] = useState(group?.checkin_deadline ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set(group?.branches.map((b) => b.code) ?? []));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // every outlet with the group it belongs to now
  const all = useMemo(() => {
    const out: (Branch & { group: string | null })[] = data.unassigned.map((b) => ({ ...b, group: null }));
    data.groups.forEach((g) => g.branches.forEach((b) => out.push({ ...b, group: g.id === group?.id ? null : g.code })));
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data, group]);
  const s = q.trim().toLowerCase();
  const shown = all.filter((b) => !s || b.name.toLowerCase().includes(s) || b.code.toLowerCase().includes(s));
  const moving = all.filter((b) => picked.has(b.code) && b.group).length;
  const allShown = shown.length > 0 && shown.every((b) => picked.has(b.code));
  const toggle = (c: string) => setPicked((p) => { const n = new Set(p); if (n.has(c)) n.delete(c); else n.add(c); return n; });

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { code: code.trim().toUpperCase(), name: name.trim(), description: description.trim() || null, sort: group?.sort ?? 50,
        checkinMaxPerDay: maxCheckin ? Number(maxCheckin) : null, checkinDeadline: deadline || null };
      const r = group ? await call<{ id: string }>(`/api/monitoring/branch-groups/${group.id}`, { method: "PATCH", json: body })
        : await call<{ id: string }>("/api/monitoring/branch-groups", { method: "POST", json: body });
      await call(`/api/monitoring/branch-groups/${r.id}/branches`, { method: "PUT", json: { branchCodes: [...picked] } });
      toast(group ? tr("Group saved") : tr("Group created"));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await call(`/api/monitoring/branch-groups/${group!.id}`, { method: "DELETE" });
      toast(tr("Group deleted"));
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Drawer open onClose={onClose} size="lg" icon={<Boxes size={18} />} title={group ? group.code : tr("New Branch Group")}
      description={tr("{0} branches selected", picked.size)} focusFirstField={!group}
      footer={<>
        {group && <Button variant="ghost" className="mr-auto text-[color:var(--j-C9372C)]" onClick={() => setDeleting(true)}><Trash2 size={15} /> {tr("Delete")}</Button>}
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-[color:var(--j-C9372C)]">{error}</p>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!code.trim() || !name.trim()} onClick={() => void save()}><Save size={16} /> {group ? tr("Save changes") : tr("Create group")}</Button>
      </>}>
      <div className="space-y-4">
        <FormCard n={1} title={tr("Group")} hint={tr("Short code shown in the Overview and the filters, e.g. CTGP")}>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <Field label={tr("Code")} required><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={20} className="font-mono" /></Field>
            <Field label={tr("Name")} required><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={tr("e.g. Kopi Calf To Go Premium")} /></Field>
          </div>
          <Field label={tr("Description")} hint={tr("Optional")}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} className={cx(inputClass, "h-auto py-2")} />
          </Field>
          <Field label={tr("PIC Check-Ins per Outlet per Day")} hint={tr("The most check-ins a PIC does at one outlet of this group in a day; also the daily target of the PIC score. Empty = once a day.")}>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={maxCheckin} onChange={(e) => setMaxCheckin(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="1" className="w-24 text-right tabular-nums" />
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => setMaxCheckin(String(n))}
                  className={cx("rounded-[3px] border px-3 py-1 text-xs font-medium", Number(maxCheckin || 1) === n ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]" : "border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:border-[color:var(--j-8590A2)]")}>{tr("{0}× a day", n)}</button>
              ))}
            </div>
          </Field>
          <Field label={tr("Check-In Deadline")} hint={tr("The first check-in of the PIC's day by this time (on the outlet's clock) is on time. An outlet can have its own in the Check-In Deadlines tab. Empty = 11:00.")}>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="time" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-32 tabular-nums" aria-label={tr("Check-In Deadline")} />
              {["10:00", "10:15", "10:30"].map((t) => (
                <button key={t} type="button" onClick={() => setDeadline(t)}
                  className={cx("rounded-full border px-3 py-1 text-xs font-medium tabular-nums", deadline === t ? "border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0C66E4)]" : "border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:border-[color:var(--j-8590A2)]")}>{t}</button>
              ))}
            </div>
          </Field>
        </FormCard>
        <FormCard n={2} title={tr("Branches")} hint={tr("A branch belongs to one group: picking it here moves it out of its former group")}
          aside={<Badge tone={picked.size ? "blue" : "slate"}>{picked.size}</Badge>}>
          <div className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search outlet or code")} className="h-9" />
            <Button size="sm" variant="secondary" className="h-9 whitespace-nowrap" onClick={() => setPicked((p) => { const n = new Set(p); shown.forEach((b) => (allShown ? n.delete(b.code) : n.add(b.code))); return n; })}>
              {allShown ? tr("Clear shown") : tr("Select shown")} ({shown.length})
            </Button>
          </div>
          {moving > 0 && <p className="rounded-[3px] bg-[color:var(--j-FFF7D6)] px-3 py-2 text-xs text-[color:var(--j-7F5F01)]">{tr("{0} branches move from another group", moving)}</p>}
          <ul className="max-h-[24rem] divide-y divide-[color:var(--j-F1F2F4)] overflow-y-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
            {shown.map((b) => (
              <li key={b.code}>
                <label className={cx("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[color:var(--j-F7F8F9)]", picked.has(b.code) && "bg-[color:var(--j-E9F2FF)]")}>
                  <input type="checkbox" className="h-4 w-4 rounded border-[color:var(--j-8590A2)]" checked={picked.has(b.code)} onChange={() => toggle(b.code)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[color:var(--j-172B4D)]">{b.name}</span>
                    <span className="text-[11px] text-[color:var(--j-626F86)]">{b.code}</span>
                  </span>
                  {b.group && <Badge tone={picked.has(b.code) ? "amber" : "slate"}>{picked.has(b.code) ? tr("moves from {0}", b.group) : b.group}</Badge>}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-[color:var(--j-626F86)]">{tr("No branch matches")}</li>}
          </ul>
        </FormCard>
      </div>
      <ConfirmDialog open={deleting} danger onClose={() => setDeleting(false)} onConfirm={() => void remove()} title={tr("Delete this group?")}
        confirmLabel={tr("Delete")} description={tr("Its branches become “Without a group”. Forms already sent are not changed.")} />
    </Drawer>
  );
}

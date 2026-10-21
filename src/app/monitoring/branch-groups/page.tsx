"use client";

// Monitoring → Branch groups (page mon.branch-groups, 2026-10-21): the classes of outlets (CCI, CTG, CTGP …) the PIC
// Check In, Monitoring Product and Monitoring Outlet are judged by. One group per branch; a branch picked for a group
// moves out of its former group. Used by Monitoring → Overview and the group filter of the monitoring pages.

import { Boxes, Check, Plus, Save, Store, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Input, Page, Panel, cx, inputClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { FormCard } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { useAuth, hasPage } from "@/lib/auth";
import { tr } from "@/lib/i18n";

type Branch = { code: string; name: string };
type Group = { id: string; code: string; name: string; description: string | null; sort: number; branches: Branch[] };
type Data = { groups: Group[]; unassigned: Branch[] };

export default function BranchGroupsPage() {
  const { user } = useAuth();
  const canEdit = hasPage(user, "mon.branch-groups");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Group | "new" | null>(null);

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
    <Page title={tr("Branch groups")} subtitle={tr("Classes of outlets the forms are assessed by (CCI, CTG, CTGP …); one group per branch")}
      actions={canEdit ? <Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New group")}</Button> : undefined}>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel> : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.groups.map((g) => (
              <button key={g.id} type="button" onClick={() => canEdit && setOpen(g)} disabled={!canEdit}
                className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow disabled:cursor-default">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-slate-900 group-hover:text-blue-700">{g.code}</span>
                    <span className="block truncate text-xs text-slate-500">{g.name !== g.code ? g.name : g.description ?? ""}</span>
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-sm font-semibold tabular-nums text-blue-700">{g.branches.length}</span>
                </span>
                <span className="mt-3 flex flex-wrap gap-1">
                  {g.branches.slice(0, 6).map((b) => <span key={b.code} className="max-w-full truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{b.name.replace(/^Kopi Calf (To Go )?/, "")}</span>)}
                  {g.branches.length > 6 && <span className="rounded-md px-1.5 py-0.5 text-[11px] text-slate-400">+{g.branches.length - 6}</span>}
                  {g.branches.length === 0 && <span className="text-xs text-amber-700">{tr("No branch yet")}</span>}
                </span>
                {g.description && g.name !== g.code && <span className="mt-3 text-xs text-slate-500">{g.description}</span>}
              </button>
            ))}
          </div>
          <Panel title={tr("Without a group ({0})", data.unassigned.length)} description={tr("{0} Kopi Calf outlets in total; outlets without a group appear as “Without a group” in the Overview", total)}>
            {data.unassigned.length === 0 ? <Empty icon={<Check size={26} />} title={tr("Every outlet is in a group")} /> : (
              <ul className="flex flex-wrap gap-1.5 p-4">
                {data.unassigned.map((b) => <li key={b.code}><Badge tone="amber" icon={<Store size={11} />}>{b.name} · {b.code}</Badge></li>)}
              </ul>
            )}
          </Panel>
        </>
      )}
      {open && data && <GroupDrawer group={open === "new" ? null : open} data={data} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
    </Page>
  );
}

function GroupDrawer({ group, data, onClose, onSaved }: { group: Group | null; data: Data; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState(group?.code ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
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
      const body = { code: code.trim().toUpperCase(), name: name.trim(), description: description.trim() || null, sort: group?.sort ?? 50 };
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
    <Drawer open onClose={onClose} size="lg" icon={<Boxes size={18} />} title={group ? group.code : tr("New branch group")}
      description={tr("{0} branches selected", picked.size)} focusFirstField={!group}
      footer={<>
        {group && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setDeleting(true)}><Trash2 size={15} /> {tr("Delete")}</Button>}
        {error && <p role="alert" className="mr-auto line-clamp-2 text-xs text-red-600">{error}</p>}
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
        </FormCard>
        <FormCard n={2} title={tr("Branches")} hint={tr("A branch belongs to one group: picking it here moves it out of its former group")}
          aside={<Badge tone={picked.size ? "blue" : "slate"}>{picked.size}</Badge>}>
          <div className="flex items-center gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search outlet or code")} className="h-9" />
            <Button size="sm" variant="secondary" className="h-9 whitespace-nowrap" onClick={() => setPicked((p) => { const n = new Set(p); shown.forEach((b) => (allShown ? n.delete(b.code) : n.add(b.code))); return n; })}>
              {allShown ? tr("Clear shown") : tr("Select shown")} ({shown.length})
            </Button>
          </div>
          {moving > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("{0} branches move from another group", moving)}</p>}
          <ul className="max-h-[24rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {shown.map((b) => (
              <li key={b.code}>
                <label className={cx("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50", picked.has(b.code) && "bg-blue-50/60")}>
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={picked.has(b.code)} onChange={() => toggle(b.code)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-900">{b.name}</span>
                    <span className="text-[11px] text-slate-400">{b.code}</span>
                  </span>
                  {b.group && <Badge tone={picked.has(b.code) ? "amber" : "slate"}>{picked.has(b.code) ? tr("moves from {0}", b.group) : b.group}</Badge>}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">{tr("No branch matches")}</li>}
          </ul>
        </FormCard>
      </div>
      <ConfirmDialog open={deleting} danger onClose={() => setDeleting(false)} onConfirm={() => void remove()} title={tr("Delete this group?")}
        confirmLabel={tr("Delete")} description={tr("Its branches become “Without a group”. Forms already sent are not changed.")} />
    </Drawer>
  );
}

"use client";

// Item groups (Cost Control): build a set of items once (e.g. espresso bar, packaging to go) and assign it to the count
// lists of many branches; a change to the group reaches every branch that uses it.

import { Boxes, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ItemsEditor, { type EditorItem, toPayload } from "@/so/features/settings/ItemsEditor";
import { Badge, Button, Checkbox, Empty, ErrorState, Field, Input, Page, Panel, SearchBox, Select, SkeletonRows, fmtDate, theadClass, useToast } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Group = { id: string; code: string; name: string; description: string | null; is_active: boolean; updated_at: string; items: number; lists: number };
type GroupDetail = Omit<Group, "items"> & {
  items: EditorItem[];
  used_by: { list_id: string; count_type: string; facility_type: string; facility_code: string | null; facility_name: string | null }[];
};
type Facility = { id: string; code: string; name: string; facility_type: string; legal_entity_code: string; own_lists: number };
const COUNT_TYPES = ["DAILY_PACKAGING", "WEEKLY_RAW", "MONTHLY_RAW", "ADHOC"];

export default function GroupsPage() {
  const [rows, setRows] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<Group[]>("/api/so/count-settings/groups"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows ?? []).filter((g) => !s || g.name.toLowerCase().includes(s) || g.code.toLowerCase().includes(s));
  }, [rows, search]);

  return (
    <Page title={tr("Item groups")} subtitle={tr("Reusable sets of items to assign to the count lists of many branches")}
      actions={<Button onClick={() => setCreating(true)}><Plus size={16} /> {tr("New group")}</Button>}>
      <Panel toolbar={<SearchBox value={search} onChange={setSearch} placeholder={tr("Search group")} />}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<Boxes size={28} />} title={rows.length ? tr("No group matches the search") : tr("No item groups yet")}>
            {!rows.length && tr("Create a group, add its items, then assign it to branches.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className={theadClass}>
                <tr><th className="px-4 py-2.5">{tr("Group")}</th><th className="px-4 py-2.5 text-right">{tr("Items")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Used by lists")}</th><th className="px-4 py-2.5">{tr("Updated")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows === null ? <SkeletonRows cols={4} /> : shown.map((g) => (
                  <tr key={g.id} className="group cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(g.id)}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900 group-hover:text-blue-700">{g.name} {!g.is_active && <Badge>{tr("Inactive")}</Badge>}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{g.code}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{g.items}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{g.lists}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(g.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {creating && <CreateGroup onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); void load(); setOpen(id); }} />}
      {open && <GroupDrawer groupId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

function CreateGroup({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const g = await api<Group>("/api/so/count-settings/groups", { method: "POST", json: { name, description: description || null } });
      toast(tr("Group {0} created", g.name));
      onCreated(g.id);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open title={tr("New item group")} onClose={onClose} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!name.trim()} onClick={save}>{tr("Create")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Name")} required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Espresso bar")} /></Field>
        <Field label={tr("Description")}><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function GroupDrawer({ groupId, onClose, onChanged }: { groupId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [g, setG] = useState<GroupDetail | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    const d = await api<GroupDetail>(`/api/so/count-settings/groups/${groupId}`);
    setG(d);
    setItems(d.items);
    setDirty(false);
  }, [groupId]);
  useEffect(() => { void load().catch((e) => toast(errorText(e), "error")); }, [load, toast]);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/so/count-settings/groups/${groupId}/items`, { method: "PUT", json: { items: toPayload(items) } });
      toast(tr("Group saved"));
      await load();
      onChanged();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const setActive = async (active: boolean) => {
    try {
      await api(`/api/so/count-settings/groups/${groupId}`, { method: "PATCH", json: { is_active: active } });
      await load();
      onChanged();
    } catch (e) {
      toast(errorText(e), "error");
    }
  };

  return (
    <Drawer open onClose={onClose} size="xl" icon={<Boxes size={18} />} title={g?.name ?? tr("Item group")} description={g ? `${g.code} · ${tr("{0} items", items.length)}` : undefined}
      footer={
        <>
          <Button variant="secondary" className="mr-auto" onClick={() => setAssigning(true)} disabled={!g}>{tr("Assign to branches")}</Button>
          <Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
          <Button loading={busy} disabled={!dirty} onClick={save}><Save size={16} /> {tr("Save items")}</Button>
        </>
      }>
      {!g ? <div className="skeleton h-64 rounded-lg" /> : (
        <div className="space-y-6">
          <DrawerSection title={tr("Items")} description={tr("Area groups the items on the count screen; a package unit lets the crew count packs plus the rest.")}>
            <ItemsEditor items={items} onChange={(v) => { setItems(v); setDirty(true); }} />
          </DrawerSection>
          <DrawerSection title={tr("Used by")}>
            {g.used_by.length === 0 ? <p className="text-sm text-slate-500">{tr("Not assigned to any branch yet.")}</p> : (
              <div className="flex flex-wrap gap-1.5">
                {g.used_by.map((u) => <Badge key={u.list_id}>{u.facility_name ?? `${u.facility_type} (${tr("default")})`} · {countTypeLabel(u.count_type)}</Badge>)}
              </div>
            )}
            <Checkbox label={tr("Active")} hint={tr("An inactive group is ignored by every list that uses it")} checked={g.is_active} onChange={(e) => setActive(e.target.checked)} />
          </DrawerSection>
        </div>
      )}
      {assigning && g && <AssignDialog group={g} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); void load(); onChanged(); }} />}
    </Drawer>
  );
}

function AssignDialog({ group, onClose, onDone }: { group: GroupDetail; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [countType, setCountType] = useState("WEEKLY_RAW");
  const [type, setType] = useState("OUTLET");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<Facility[]>("/api/so/count-settings/facilities").then(setFacilities).catch(() => {}); }, []);
  const types = useMemo(() => Array.from(new Set(facilities.map((f) => f.facility_type))), [facilities]);
  const shown = facilities.filter((f) => (!type || f.facility_type === type) && (!q || f.name.toLowerCase().includes(q.toLowerCase()) || f.code.toLowerCase().includes(q.toLowerCase())));
  const allPicked = shown.length > 0 && shown.every((f) => picked.has(f.id));
  const run = async (remove: boolean) => {
    setBusy(true);
    try {
      const r = await api<{ changed: number }>(`/api/so/count-settings/groups/${group.id}/assign`, {
        method: "POST", json: { count_type: countType, facility_ids: Array.from(picked), remove },
      });
      toast(remove ? tr("Removed from {0} lists", r.changed) : tr("Added to {0} lists", r.changed));
      onDone();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open size="lg" title={tr("Assign {0}", group.name)} onClose={onClose}
      description={tr("Branches without their own list get one, starting from their type's default list.")}
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-red-600" disabled={!picked.size || busy} onClick={() => run(true)}>{tr("Remove from selected")}</Button>
          <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button loading={busy} disabled={!picked.size} onClick={() => run(false)}>{tr("Add to {0} branches", picked.size)}</Button>
        </>
      }>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label={tr("Count")}><Select value={countType} onChange={(e) => setCountType(e.target.value)}>
            {COUNT_TYPES.map((c) => <option key={c} value={c}>{countTypeLabel(c)}</option>)}</Select></Field>
          <Field label={tr("Facility type")}><Select value={type} onChange={(e) => { setType(e.target.value); setPicked(new Set()); }}>
            <option value="">{tr("All")}</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder={tr("Search branch")} />
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={allPicked}
            onChange={() => setPicked((s) => { const n = new Set(s); shown.forEach((f) => (allPicked ? n.delete(f.id) : n.add(f.id))); return n; })} />
          {tr("Select all shown")} ({shown.length})
        </label>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {shown.map((f) => (
            <li key={f.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={picked.has(f.id)}
                  onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                <span className="min-w-0 flex-1"><span className="block truncate text-slate-900">{f.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">{f.code} · {f.facility_type}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

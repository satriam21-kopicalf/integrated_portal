"use client";

// Items Groups (Cost Control): build a set of items once (e.g. espresso bar, packaging to go) and assign it to the count
// lists of many branches; a change to the group reaches every branch that uses it.
// New group = a 3-step wizard (details → items → branches); an existing group opens on tabs (items, branches, details).

import { Boxes, Check, ChevronLeft, ChevronRight, FileSpreadsheet, MapPin, PackagePlus, Plus, Save, Search, Store, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ItemsEditor, { type EditorItem, toPayload } from "@/so/features/settings/ItemsEditor";
import NewItemDialog, { type ItemDraft } from "@/so/features/settings/NewItemDialog";
import { Badge, Button, cx, Empty, ErrorState, Field, Input, Page, Panel, SearchBox, SkeletonRows, fmtDate, fmtNumber, inputClass, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { FormCard, Segmented, Switch } from "@/so/ui/Simple";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Group = { id: string; code: string; name: string; description: string | null; is_active: boolean; updated_at: string;
  /** date asked for this group's items: null = follow the count type, "NONE" = no date */
  date_field: "NONE" | "roasted_date" | "expired_date" | null; items: number; lists: number;
  pending: number; source_ref: string | null };
type Pending = { id: number; code: string; name: string; category: string | null; sub_category: string | null; unit: string | null; area: string | null; suggested_category_id: string | null };
type UsedBy = { list_id: string; count_type: string; facility_type: string; facility_id: string | null; facility_code: string | null; facility_name: string | null };
type GroupDetail = Omit<Group, "items"> & { items: EditorItem[]; used_by: UsedBy[]; pending_items: Pending[] };
type Facility = { id: string; code: string; name: string; facility_type: string; city: string | null; legal_entity_code: string; own_lists: number };
type CountType = { code: string; name: string; frequency: string; is_active: boolean };
/** the date asked for a group's items (count_item_group.date_field); "" = follow the count type */
const GROUP_DATE_OPTIONS: { value: string; label: () => string }[] = [
  { value: "", label: () => tr("Follow count type") }, { value: "NONE", label: () => tr("No date") },
  { value: "roasted_date", label: () => tr("Roasted date") }, { value: "expired_date", label: () => tr("Expired date") },
];

/** Branches and count types for the branch picker (loaded once per page). */
function usePickerData() {
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [types, setTypes] = useState<CountType[]>([]);
  useEffect(() => {
    void api<Facility[]>("/api/so/count-settings/facilities").then(setFacilities).catch(() => setFacilities([]));
    void api<CountType[]>("/api/so/count-settings/types").then((t) => setTypes(t.filter((x) => x.is_active))).catch(() => setTypes([]));
  }, []);
  return { facilities, types };
}

type GF = { status: string; assigned: string; pending: string; source: string };
const GF_EMPTY: GF = { status: "", assigned: "", pending: "", source: "" };

export default function GroupsPage() {
  const [rows, setRows] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [gf, setGf] = useState<GF>(GF_EMPTY);
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const picker = usePickerData();

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
    return (rows ?? []).filter((g) => (!s || g.name.toLowerCase().includes(s) || g.code.toLowerCase().includes(s))
      && (!gf.status || (gf.status === "active") === g.is_active)
      && (!gf.assigned || (gf.assigned === "yes") === g.lists > 0)
      && (!gf.pending || (gf.pending === "yes") === g.pending > 0)
      && (!gf.source || (gf.source === "template") === Boolean(g.source_ref)));
  }, [rows, search, gf]);
  const paged = usePaged(shown, shown.length + search + JSON.stringify(gf));
  const all = rows ?? [];
  const label: Record<string, Record<string, () => string>> = {
    status: { active: () => tr("Active"), inactive: () => tr("Inactive") },
    assigned: { yes: () => tr("Assigned to branches"), no: () => tr("Not assigned") },
    pending: { yes: () => tr("Items not in the item master"), no: () => tr("All items in the item master") },
    source: { template: () => tr("From the template"), manual: () => tr("Made by hand") },
  };
  const chips: ActiveFilter[] = (Object.keys(GF_EMPTY) as (keyof GF)[]).filter((k) => gf[k])
    .map((k) => ({ key: k, label: label[k][gf[k]](), onRemove: () => setGf({ ...gf, [k]: "" }) }));

  return (
    <Page title={tr("Items Groups")} subtitle={tr("Reusable sets of items to assign to the count lists of many branches")}
      actions={<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet size={16} /> {tr("Import template")}</Button>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> {tr("New group")}</Button></div>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Groups")} icon={<Boxes size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} from the template", fmtNumber(all.filter((g) => g.source_ref).length))}</p>}
          </Stat>
          <Stat label={tr("Assigned to branches")} emphasis value={rows ? fmtNumber(all.filter((g) => g.lists > 0).length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} count lists use a group", fmtNumber(all.reduce((a, g) => a + g.lists, 0)))}</p>}
          </Stat>
          <Stat label={tr("Items in groups")} value={rows ? fmtNumber(all.reduce((a, g) => a + g.items, 0)) : <StatSkeleton />}>
            {rows && <p>{tr("over every group")}</p>}
          </Stat>
          <Stat label={tr("Not in the item master")} value={rows ? fmtNumber(all.reduce((a, g) => a + g.pending, 0)) : <StatSkeleton />}>
            {rows && <p>{tr("create them from the group")}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search group")} filters={chips}
        onOpen={() => setSheet(true)} onClear={() => setGf(GF_EMPTY)} />}
        footer={rows ? <><span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(all.length))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : rows && shown.length === 0 ? (
          <Empty icon={<Boxes size={28} />} title={rows.length ? tr("Nothing matches the search or filters") : tr("No item groups yet")}>
            {!rows.length && tr("Create a group, add its items, then assign it to branches.")}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="m-cards w-full min-w-[560px] text-sm">
              <thead className={theadClass}>
                <tr><th className="px-4 py-2.5">{tr("Group")}</th><th className="px-4 py-2.5 text-right">{tr("Items")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Used by lists")}</th><th className="px-4 py-2.5">{tr("Updated")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows === null ? <SkeletonRows cols={4} /> : paged.rows.map((g) => (
                  <tr key={g.id} className="group cursor-pointer hover:bg-slate-50/70" onClick={() => setOpen(g.id)}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900 group-hover:text-blue-700">{g.name} {!g.is_active && <Badge>{tr("Inactive")}</Badge>}
                        {g.date_field && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{GROUP_DATE_OPTIONS.find((x) => x.value === g.date_field)?.label()}</span>}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{g.code}{g.source_ref ? ` · ${g.source_ref}` : ""}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {g.items}
                      {g.pending > 0 && <span className="block text-[11px] font-medium text-amber-700">{tr("+{0} not in the item master", g.pending)}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {g.lists || <span className="text-xs font-medium text-amber-700">{tr("Not assigned")}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(g.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {sheet && <GroupFilters value={gf} label={label} onClose={() => setSheet(false)} onApply={(v) => { setGf(v); setSheet(false); }} />}
      {creating && <CreateWizard {...picker} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); void load(); setOpen(id); }} />}
      {open && <GroupDrawer groupId={open} {...picker} onClose={() => setOpen(null)} onChanged={load} />}
      {importing && <ImportTemplateDrawer onClose={() => setImporting(false)} onDone={() => void load()} />}
    </Page>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
const FILTER_TITLES: [keyof GF, () => string, () => string][] = [
  ["status", () => tr("Status"), () => tr("Inactive groups are not offered to new count lists")],
  ["assigned", () => tr("Branches"), () => tr("Whether the group is on the count list of a branch")],
  ["pending", () => tr("Item master"), () => tr("Items of the template not created in the item master yet")],
  ["source", () => tr("Source"), () => tr("Imported from the template or made on this page")],
];

/** Every filter of Items Groups in one drawer (same sheet as Monitoring Stock Opname). */
function GroupFilters({ value, label, onApply, onClose }: {
  value: GF; label: Record<string, Record<string, () => string>>; onApply: (v: GF) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(GF_EMPTY)}>
      {FILTER_TITLES.map(([k, title, hint]) => (
        <FilterSection key={k} title={title()} hint={hint()}>
          <ChoiceGroup label="" value={d[k]} onChange={(v) => setD({ ...d, [k]: v })}
            choices={[{ value: "", label: tr("All") }, ...Object.entries(label[k]).map(([v, l]) => ({ value: v, label: l() }))]} />
        </FilterSection>
      ))}
    </FilterSheet>
  );
}

// Branch picker: count types to assign to + branches filtered by type, city and search, select all, already-assigned marks

function BranchPicker({ facilities, types, usedBy, countTypes, setCountTypes, picked, setPicked }: {
  facilities: Facility[] | null; types: CountType[]; usedBy: UsedBy[];
  countTypes: string[]; setCountTypes: (v: string[]) => void; picked: Set<string>; setPicked: (v: Set<string>) => void;
}) {
  const [ftype, setFtype] = useState("OUTLET");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const all = useMemo(() => facilities ?? [], [facilities]);
  const ftypes = useMemo(() => Array.from(new Set(all.map((f) => f.facility_type))), [all]);
  useEffect(() => { if (all.length && ftype && !ftypes.includes(ftype)) setFtype(""); }, [all, ftype, ftypes]);
  const cities = useMemo(() => Array.from(new Set(all.map((f) => f.city).filter(Boolean) as string[])).sort(), [all]);
  const assigned = useMemo(() => {
    const m = new Map<string, string[]>();
    usedBy.forEach((u) => { if (u.facility_id) m.set(u.facility_id, [...(m.get(u.facility_id) ?? []), u.count_type]); });
    return m;
  }, [usedBy]);
  const s = q.trim().toLowerCase();
  const shown = all.filter((f) => (!ftype || f.facility_type === ftype) && (!city || f.city === city)
    && (!s || f.name.toLowerCase().includes(s) || f.code.toLowerCase().includes(s)));
  const allPicked = shown.length > 0 && shown.every((f) => picked.has(f.id));
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };
  const chip = (on: boolean) => cx("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300");

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("Counted in")}</p>
        <div className="flex flex-wrap gap-1.5">
          {types.map((t) => {
            const on = countTypes.includes(t.code);
            return (
              <button key={t.code} type="button" aria-pressed={on} className={chip(on)}
                onClick={() => setCountTypes(on ? countTypes.filter((c) => c !== t.code) : [...countTypes, t.code])}>
                {on && <Check size={12} className="-ml-0.5 mr-1 inline" />}{countTypeLabel(t.code, t.name)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(!ftype)} onClick={() => setFtype("")}>{tr("All")}</button>
          {ftypes.map((t) => <button key={t} type="button" className={chip(ftype === t)} onClick={() => setFtype(t)}>{t}</button>)}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_12rem]">
          <SearchBox value={q} onChange={setQ} placeholder={tr("Search branch")} />
          {cities.length > 1 && (
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label={tr("City")}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
              <option value="">{tr("All cities")}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <label className="flex items-center gap-2 font-medium text-slate-600">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={allPicked}
            onChange={() => { const n = new Set(picked); shown.forEach((f) => (allPicked ? n.delete(f.id) : n.add(f.id))); setPicked(n); }} />
          {tr("Select all shown")} ({shown.length})
        </label>
        <span className="text-slate-500">
          {tr("{0} selected", picked.size)}
          {picked.size > 0 && <button type="button" className="ml-2 font-medium text-blue-700 hover:underline" onClick={() => setPicked(new Set())}>{tr("Clear")}</button>}
        </span>
      </div>
      <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
        {facilities === null ? <li className="skeleton m-2 h-24 rounded" /> : shown.map((f) => {
          const has = assigned.get(f.id) ?? [];
          return (
            <li key={f.id}>
              <label className={cx("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50", picked.has(f.id) && "bg-blue-50/60")}>
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={picked.has(f.id)} onChange={() => toggle(f.id)} />
                <Store size={15} className="flex-shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-900">{f.name}</span>
                  <span className="block truncate text-[11px] text-slate-400">{f.code} · {f.facility_type}{f.city ? ` · ${f.city}` : ""}</span>
                </span>
                {has.length > 0 && (
                  <span className="flex flex-wrap justify-end gap-1">
                    {has.map((c) => <Badge key={c} tone={countTypes.includes(c) ? "green" : "slate"} icon={<Check size={11} />}>{countTypeLabel(c)}</Badge>)}
                  </span>
                )}
              </label>
            </li>
          );
        })}
        {facilities !== null && shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">{tr("No branch matches")}</li>}
      </ul>
    </div>
  );
}

/** Adds (or removes) a group on the lists of the picked branches for every chosen count type; returns lists changed. */
async function assign(groupId: string, countTypes: string[], facilityIds: string[], remove: boolean): Promise<number> {
  let changed = 0;
  for (const c of countTypes) {
    const r = await api<{ changed: number }>(`/api/so/count-settings/groups/${groupId}/assign`, {
      method: "POST", json: { count_type: c, facility_ids: facilityIds, remove },
    });
    changed += r.changed;
  }
  return changed;
}

const defaultTypes = (types: CountType[]) => types.filter((t) => t.frequency === "WEEKLY").map((t) => t.code).slice(0, 1);

// ---------------------------------------------------------------------------------------------------------------------
// New group wizard

const STEPS = [() => tr("Details"), () => tr("Items"), () => tr("Branches")];
const STEP_HINTS = [() => tr("Name and purpose"), () => tr("What is counted"), () => tr("Who counts it (optional)")];

function Stepper({ step, onStep, maxStep }: { step: number; onStep: (n: number) => void; maxStep: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((label, i) => (
        <li key={i}>
          <button type="button" disabled={i > maxStep} onClick={() => onStep(i)}
            className={cx("w-full rounded-lg border-t-4 bg-white px-1 pt-2 text-left disabled:cursor-not-allowed",
              i < step ? "border-blue-600" : i === step ? "border-blue-600" : "border-slate-200")}>
            <span className={cx("flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide", i <= step ? "text-blue-700" : "text-slate-400")}>
              {i < step ? <Check size={12} /> : null}{tr("Step {0}", i + 1)}
            </span>
            <span className={cx("block text-sm font-semibold", i <= step ? "text-slate-900" : "text-slate-400")}>{label()}</span>
            <span className="hidden text-xs text-slate-500 sm:block">{STEP_HINTS[i]()}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function CreateWizard({ facilities, types, onClose, onCreated }: {
  facilities: Facility[] | null; types: CountType[]; onClose: () => void; onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<EditorItem[]>([]);
  const [countTypes, setCountTypes] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (types.length) setCountTypes((c) => (c.length ? c : defaultTypes(types))); }, [types]);

  const canNext = step === 0 ? !!name.trim() : step === 1 ? items.length > 0 : true;
  const maxStep = !name.trim() ? 0 : items.length ? 2 : 1;
  const finish = async () => {
    setBusy(true);
    let id: string | null = null;
    try {
      const g = await api<Group>("/api/so/count-settings/groups", { method: "POST", json: { name: name.trim(), description: description.trim() || null } });
      id = g.id;
      await api(`/api/so/count-settings/groups/${g.id}/items`, { method: "PUT", json: { items: toPayload(items) } });
      const changed = picked.size && countTypes.length ? await assign(g.id, countTypes, Array.from(picked), false) : 0;
      toast(changed ? tr("Group {0} created and added to {1} lists", g.name, changed) : tr("Group {0} created", g.name));
      onCreated(g.id);
    } catch (e) {
      toast(errorText(e), "error");
      if (id) onCreated(id); // created part-way: continue in the group editor
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open onClose={onClose} size="xl" icon={<Boxes size={18} />} title={tr("New item group")}
      description={name.trim() ? `${name.trim()} · ${tr("{0} items", items.length)}` : tr("Build a set of items once and assign it to many branches")}
      footer={
        <>
          {step > 0 && <Button variant="secondary" className="mr-auto" onClick={() => setStep(step - 1)}><ChevronLeft size={16} /> {tr("Back")}</Button>}
          <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          {step < 2 ? (
            <Button disabled={!canNext} onClick={() => setStep(step + 1)}>{tr("Next")} <ChevronRight size={16} /></Button>
          ) : (
            <Button loading={busy} onClick={finish}>
              <Save size={16} /> {picked.size && countTypes.length ? tr("Create & assign to {0} branches", picked.size) : tr("Create without branches")}
            </Button>
          )}
        </>
      }>
      <div className="space-y-6">
        <Stepper step={step} onStep={setStep} maxStep={maxStep} />
        {step === 0 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <FormCard title={tr("Group details")} hint={tr("A clear name helps Cost Control find the group when assigning it")}>
              <Field label={tr("Name")} required><Input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder={tr("e.g. Espresso bar")} /></Field>
              <Field label={tr("Description")} hint={tr("Optional")}>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={tr("What the crew counts with this group")}
                  className={cx(inputClass, "h-auto py-2")} />
              </Field>
            </FormCard>
            <aside className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">{tr("How a group works")}</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-xs">
                <li>{tr("Add its items once (a whole category or single items).")}</li>
                <li>{tr("Assign it to the count lists of many branches.")}</li>
                <li>{tr("A later change to the group reaches every branch that uses it.")}</li>
              </ol>
            </aside>
          </div>
        )}
        {step === 1 && (
          <FormCard title={tr("Items")} hint={tr("Add a whole category at once or search single items; area groups them on the count screen.")}
            aside={<Badge tone={items.length ? "blue" : "slate"}>{tr("{0} items", items.length)}</Badge>}>
            <ItemsEditor items={items} onChange={setItems} />
          </FormCard>
        )}
        {step === 2 && (
          <FormCard title={tr("Branches")} hint={tr("Pick the count(s) and the branches that count this group. You can also do this later.")}
            aside={<Badge tone={picked.size ? "blue" : "slate"}>{tr("{0} selected", picked.size)}</Badge>}>
            <BranchPicker facilities={facilities} types={types} usedBy={[]} countTypes={countTypes} setCountTypes={setCountTypes} picked={picked} setPicked={setPicked} />
          </FormCard>
        )}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Existing group: tabs

type Tab = "items" | "branches" | "details";

function GroupDrawer({ groupId, facilities, types, onClose, onChanged }: {
  groupId: string; facilities: Facility[] | null; types: CountType[]; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [g, setG] = useState<GroupDetail | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [items, setItems] = useState<EditorItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [countTypes, setCountTypes] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newItem, setNewItem] = useState<ItemDraft | null>(null);

  const load = useCallback(async () => {
    const d = await api<GroupDetail>(`/api/so/count-settings/groups/${groupId}`);
    setG(d);
    setItems(d.items);
    setName(d.name);
    setDescription(d.description ?? "");
    setDirty(false);
  }, [groupId]);
  useEffect(() => { void load().catch((e) => toast(errorText(e), "error")); }, [load, toast]);
  useEffect(() => { if (types.length) setCountTypes((c) => (c.length ? c : defaultTypes(types))); }, [types]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const saveItems = () => run(async () => {
    await api(`/api/so/count-settings/groups/${groupId}/items`, { method: "PUT", json: { items: toPayload(items) } });
    toast(tr("Group saved"));
  });
  const saveDetails = () => run(async () => {
    await api(`/api/so/count-settings/groups/${groupId}`, { method: "PATCH", json: { name: name.trim(), description: description.trim() || null } });
    toast(tr("Group saved"));
  });
  const setActive = (active: boolean) => run(async () => {
    await api(`/api/so/count-settings/groups/${groupId}`, { method: "PATCH", json: { is_active: active } });
  });
  const setDateField = (v: string) => run(async () => {
    await api(`/api/so/count-settings/groups/${groupId}`, { method: "PATCH", json: { date_field: v || null } });
    toast(tr("Group saved"));
  });
  const applyBranches = (remove: boolean) => run(async () => {
    const n = await assign(groupId, countTypes, Array.from(picked), remove);
    toast(remove ? tr("Removed from {0} lists", n) : tr("Added to {0} lists", n));
    setPicked(new Set());
  });
  const unassign = (u: UsedBy) => u.facility_id && run(async () => {
    await assign(groupId, [u.count_type], [u.facility_id!], true);
    toast(tr("Removed from {0} lists", 1));
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "items", label: `${tr("Items")} (${items.length})` },
    { key: "branches", label: `${tr("Branches")} (${g?.used_by.length ?? 0})` },
    { key: "details", label: tr("Details") },
  ];
  const footer = tab === "items" ? (
    <><Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
      <Button loading={busy} disabled={!dirty} onClick={saveItems}><Save size={16} /> {tr("Save items")}</Button></>
  ) : tab === "branches" ? (
    <><Button variant="ghost" className="mr-auto text-red-600" disabled={!picked.size || !countTypes.length || busy} onClick={() => applyBranches(true)}>{tr("Remove from selected")}</Button>
      <Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
      <Button loading={busy} disabled={!picked.size || !countTypes.length} onClick={() => applyBranches(false)}>{tr("Add to {0} branches", picked.size)}</Button></>
  ) : (
    <><Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
      <Button loading={busy} disabled={!name.trim() || (name === g?.name && description === (g?.description ?? ""))} onClick={saveDetails}><Save size={16} /> {tr("Save")}</Button></>
  );

  return (
    <Drawer open onClose={onClose} size="xl" icon={<Boxes size={18} />} title={g?.name ?? tr("Item group")}
      description={g ? `${g.code} · ${tr("{0} items", items.length)}` : undefined} footer={footer}>
      {!g ? <div className="skeleton h-64 rounded-lg" /> : (
        <div className="space-y-5">
          <dl className="grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 text-center">
            <div className="px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Items")}</dt><dd className="text-lg font-semibold tabular-nums text-slate-900">{items.length}</dd></div>
            <div className="px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Used by lists")}</dt><dd className={cx("text-lg font-semibold tabular-nums", g.used_by.length ? "text-slate-900" : "text-amber-600")}>{g.used_by.length}</dd></div>
            <div className="px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Status")}</dt><dd className="mt-1">{g.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge>{tr("Inactive")}</Badge>}</dd></div>
          </dl>
          <div role="tablist" className="flex gap-1 border-b border-slate-200">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={cx("-mb-px border-b-2 px-3 py-2 text-sm font-medium", tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
                {t.label}{t.key === "items" && dirty ? " •" : ""}
              </button>
            ))}
          </div>
          {tab === "items" && (
            <DrawerSection description={tr("Area groups the items on the count screen; a package unit lets the crew count packs plus the rest.")}>
              <ItemsEditor items={items} onChange={(v) => { setItems(v); setDirty(true); }} />
            </DrawerSection>
          )}
          {tab === "items" && g.pending_items.length > 0 && (
            <DrawerSection title={tr("Not in the item master yet ({0})", g.pending_items.length)}
              description={tr("Products of the template the item master does not have. Create one and it joins this group (and every other group that lists it).")}>
              <ul className="divide-y divide-slate-100 rounded-lg border border-amber-200 bg-amber-50/40">
                {g.pending_items.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{p.name}</span>
                      <span className="block truncate text-[11px] text-slate-500"><span className="font-mono">{p.code}</span>{p.category ? ` · ${p.category}` : ""}{p.unit ? ` · ${p.unit}` : ""}</span>
                    </span>
                    <Button variant="secondary" onClick={() => setNewItem({ code: p.code, name: p.name, category_id: p.suggested_category_id, unit: p.unit })}>
                      <PackagePlus size={15} /> {tr("Create item")}
                    </Button>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}
          {newItem && (
            <NewItemDialog draft={newItem} onClose={() => setNewItem(null)}
              onCreated={(n) => {
                setNewItem(null);
                toast(tr("Item {0} created", n.item_code));
                if (dirty) setG((cur) => cur && ({ ...cur, pending_items: cur.pending_items.filter((x) => x.code !== n.item_code) }));
                else void load();
                onChanged();
              }} />
          )}
          {tab === "branches" && (
            <>
              <DrawerSection title={tr("Used by")}>
                {g.used_by.length === 0 ? <p className="text-sm text-amber-700">{tr("Not assigned to any branch yet: pick branches below.")}</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {g.used_by.map((u) => (
                      <span key={u.list_id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1 text-xs text-slate-700">
                        <MapPin size={11} className="text-slate-400" />
                        {u.facility_name ?? `${u.facility_type} (${tr("default")})`} · {countTypeLabel(u.count_type)}
                        {u.facility_id ? (
                          <button type="button" disabled={busy} onClick={() => unassign(u)} aria-label={tr("Remove")}
                            className="rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={12} /></button>
                        ) : <span className="w-1" />}
                      </span>
                    ))}
                  </div>
                )}
              </DrawerSection>
              <DrawerSection title={tr("Add or remove branches")} description={tr("Branches without their own list get one, starting from their type's default list.")}>
                <BranchPicker facilities={facilities} types={types} usedBy={g.used_by} countTypes={countTypes} setCountTypes={setCountTypes} picked={picked} setPicked={setPicked} />
              </DrawerSection>
            </>
          )}
          {tab === "details" && (
            <div className="max-w-xl space-y-4">
              <FormCard title={tr("Group details")}>
                <Field label={tr("Name")} required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
                <Field label={tr("Description")} hint={tr("Optional")}>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cx(inputClass, "h-auto py-2")} />
                </Field>
                <p className="text-xs text-slate-400">{tr("Code")}: <span className="font-mono">{g.code}</span>{g.source_ref ? ` · ${g.source_ref}` : ""}</p>
              </FormCard>
              <FormCard title={tr("Status")}>
                <Switch label={tr("Active")} hint={tr("An inactive group is ignored by every list that uses it")} checked={g.is_active} disabled={busy} onChange={setActive} />
              </FormCard>
              <FormCard title={tr("Date asked per item")} hint={tr("For the items of this group, whatever the count type asks. Always optional on the count form.")}>
                <Segmented label={tr("Date asked per item")} value={g.date_field ?? ""} onChange={(v) => { if (!busy) setDateField(v); }}
                  options={GROUP_DATE_OPTIONS.map((x) => ({ value: x.value, label: x.label() }))} />
              </FormCard>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Import of the Cost Control template "TEMPLATE SO PER CATEGORY": one group per sheet, check first

type TemplateReport = {
  applied: boolean; pending_codes: string[]; unit_gaps: number;
  sheets: { sheet: string; code: string; rows: number; items: number; status: "NEW" | "UPDATE"; group_id?: string;
    pending: { code: string; name: string; category: string; unit: string }[]; unit_gaps: { code: string; name: string; unit: string }[] }[];
};

function ImportTemplateDrawer({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [report, setReport] = useState<TemplateReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setFile({ name: f.name, data: String(r.result).split(",").pop() ?? "" }); setReport(null); };
    r.readAsDataURL(f);
  };
  const run = async (apply: boolean) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<TemplateReport>("/api/so/count-settings/groups/import", { method: "POST", json: { file: file.data, file_name: file.name.replace(/\.xlsx$/i, ""), apply } });
      setReport(r);
      if (apply) { toast(tr("{0} item groups imported", r.sheets.length)); onDone(); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open onClose={onClose} size="xl" icon={<FileSpreadsheet size={18} />} title={tr("Import template")}
      description={tr("Each sheet of the template becomes an item group (not assigned to branches yet)")}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
        <Button variant="secondary" loading={busy && !report} disabled={!file} onClick={() => run(false)}><Search size={15} /> {tr("Check")}</Button>
        <Button loading={busy && !!report} disabled={!report || report.applied} onClick={() => run(true)}>{tr("Import {0} groups", report?.sheets.length ?? 0)}</Button></>}>
      <div className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm hover:border-blue-400 hover:bg-blue-50/40">
          <Upload size={18} className="text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-slate-700">{file ? file.name : tr("Choose TEMPLATE SO PER CATEGORY (.xlsx)")}</span>
          <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        <p className="text-xs text-slate-500">{tr("Items are matched by product code. Category becomes the area, the template unit the ESB unit (and pack when the item has it). Codes the item master does not have are kept on the group to create later. Importing again replaces the items of these groups; their branches stay.")}</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {report && (
          <>
            <p className={cx("rounded-lg px-3 py-2 text-sm", report.applied ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700")}>
              {report.applied ? tr("Imported.") : tr("Check result, nothing saved yet.")}{" "}
              {tr("{0} codes not in the item master, {1} units the item does not have.", report.pending_codes.length, report.unit_gaps)}
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="m-cards w-full min-w-[620px] text-sm">
                <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Sheet / group")}</th><th className="px-3 py-2 text-right">{tr("Rows")}</th>
                  <th className="px-3 py-2 text-right">{tr("Items")}</th><th className="px-3 py-2">{tr("Not in the item master")}</th><th className="px-3 py-2">{tr("Unit missing")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {report.sheets.map((sh) => (
                    <tr key={sh.code} className="align-top">
                      <td className="px-3 py-2"><span className="block font-medium text-slate-900">{sh.sheet}</span>
                        <span className="block text-[11px] text-slate-400">{sh.code} · {sh.status === "NEW" ? tr("new group") : tr("replaces the items")}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{sh.rows}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{sh.items}</td>
                      <td className="px-3 py-2 text-xs text-amber-800">{sh.pending.length ? sh.pending.map((x) => x.code).join(", ") : "-"}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{sh.unit_gaps.length ? sh.unit_gaps.map((x) => `${x.code} ${x.unit}`).join(", ") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.applied && <p className="text-xs text-slate-500">{tr("Open a group to create its missing items and to assign it to branches.")}</p>}
          </>
        )}
      </div>
    </Drawer>
  );
}

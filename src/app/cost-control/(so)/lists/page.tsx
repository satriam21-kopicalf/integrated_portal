"use client";

// Count lists per branch (06.9 §3): every facility type has a default list per count type; a branch can have its own
// list (built from its ESB stock opname documents or edited here) which replaces the default. A list counts its own
// items plus the items of its item groups.

import { Boxes, Building2, ListChecks, Plus, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ItemsEditor, { type EditorItem, toPayload } from "@/so/features/settings/ItemsEditor";
import { Badge, Button, Empty, ErrorState, Page, Panel, cx, fmtDate, fmtNumber, useToast, PageNav, usePaged } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, SearchChoice } from "@/so/ui/Filters";
import { api, errorText } from "@/so/lib/api";
import { countTypeLabel } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Facility = { id: string; code: string; name: string; facility_type: string; legal_entity_code: string; own_lists: number; city?: string | null };
type LF = { type: string; lists: string; city: string };
type ListRow = {
  id: string; facility_type: string; count_type: string; name: string; is_active: boolean; facility_id: string | null;
  facility_code: string | null; facility_name: string | null; source: string; source_ref: string | null; updated_at: string; items: number;
};
type ListDetail = ListRow & { items: EditorItem[]; groups: { id: string; code: string; name: string; items: number }[]; effective_items: number; groups_only?: boolean };
type Group = { id: string; code: string; name: string; items: number; is_active: boolean };
const COUNT_TYPES = ["DAILY_PACKAGING", "WEEKLY_RAW", "MONTHLY_RAW", "ADHOC"];
const SOURCE: Record<string, () => string> = { ESB_SO: () => tr("From ESB stock opname"), MANUAL: () => tr("Edited by Cost Control"), IMPORT: () => tr("Imported") };

export default function ListsPage() {
  const toast = useToast();
  const [facilities, setFacilities] = useState<Facility[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [lf, setLf] = useState<LF>({ type: "OUTLET", lists: "", city: "" });
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [resetting, setResetting] = useState<ListRow | null>(null);
  const [busy, setBusy] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const loadFacilities = useCallback(async () => {
    setError(null);
    try {
      setFacilities(await api<Facility[]>("/api/so/count-settings/facilities"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void loadFacilities(); }, [loadFacilities]);
  const loadLists = useCallback(async (f: Facility) => {
    setLists(null);
    setLists(await api<ListRow[]>(`/api/so/count-settings/lists?facility_id=${f.id}`));
  }, []);
  useEffect(() => { if (selected) void loadLists(selected).catch((e) => toast(errorText(e), "error")); }, [selected, loadLists, toast]);

  const types = useMemo(() => Array.from(new Set((facilities ?? []).map((f) => f.facility_type))), [facilities]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (facilities ?? []).filter((f) => (!lf.type || f.facility_type === lf.type) && (!lf.city || f.city === lf.city)
      && (!lf.lists || (lf.lists === "own") === f.own_lists > 0)
      && (!s || f.name.toLowerCase().includes(s) || f.code.toLowerCase().includes(s)));
  }, [facilities, q, lf]);
  const paged = usePaged(shown, shown.length + q + JSON.stringify(lf));
  const cities = useMemo(() => Array.from(new Set((facilities ?? []).map((f) => f.city).filter(Boolean) as string[])).sort(), [facilities]);
  const scope = (facilities ?? []).filter((f) => !lf.type || f.facility_type === lf.type);
  const chips: ActiveFilter[] = [
    ...(lf.type ? [{ key: "t", label: lf.type, onRemove: () => setLf({ ...lf, type: "" }) }] : []),
    ...(lf.lists ? [{ key: "l", label: lf.lists === "own" ? tr("Own lists") : tr("Default list"), onRemove: () => setLf({ ...lf, lists: "" }) }] : []),
    ...(lf.city ? [{ key: "c", label: lf.city, onRemove: () => setLf({ ...lf, city: "" }) }] : []),
  ];

  /** a branch's own list starts as a copy of its type's default (items and groups) */
  const createOwn = async (countType: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      const def = lists?.find((l) => !l.facility_id && l.count_type === countType);
      const own = await api<ListDetail>("/api/so/count-settings/lists", { method: "PUT", json: { facility_id: selected.id, count_type: countType } });
      if (def) {
        const d = await api<ListDetail>(`/api/so/count-settings/lists/${def.id}`);
        await api(`/api/so/count-settings/lists/${own.id}/items`, { method: "PUT", json: { items: toPayload(d.items) } });
        if (d.groups.length) await api(`/api/so/count-settings/lists/${own.id}/groups`, { method: "PUT", json: { group_ids: d.groups.map((g) => g.id) } });
      }
      await loadLists(selected);
      void loadFacilities();
      setOpen(own.id);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (!resetting || !selected) return;
    setBusy(true);
    try {
      await api(`/api/so/count-settings/lists/${resetting.id}`, { method: "DELETE" });
      toast(tr("{0} uses the default list again", selected.name));
      setResetting(null);
      await loadLists(selected);
      void loadFacilities();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={tr("Count Lists")} subtitle={tr("Items each branch counts per count type")}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={lf.type ? tr("Branches · {0}", lf.type) : tr("Branches")} icon={<Building2 size={13} />} value={facilities ? fmtNumber(scope.length) : <StatSkeleton />}>
            {facilities && <p>{tr("{0} facility types", fmtNumber(types.length))}</p>}
          </Stat>
          <Stat label={tr("With own lists")} emphasis value={facilities ? fmtNumber(scope.filter((f) => f.own_lists > 0).length) : <StatSkeleton />}>
            {facilities && <p>{tr("a list or item group of their own")}</p>}
          </Stat>
          <Stat label={tr("Using the default")} value={facilities ? fmtNumber(scope.filter((f) => !f.own_lists).length) : <StatSkeleton />}>
            {facilities && <p>{tr("the list of their facility type")}</p>}
          </Stat>
          <Stat label={tr("Own lists")} value={facilities ? fmtNumber(scope.reduce((a, f) => a + f.own_lists, 0)) : <StatSkeleton />}>
            {facilities && <p>{tr("over every count type")}</p>}
          </Stat>
        </StatStrip>
      }>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <Panel toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search branch")} filters={chips} onOpen={() => setSheet(true)}
          onClear={() => setLf({ type: "", lists: "", city: "" })} />}
          footer={facilities ? <><span>{tr("{0} of {1} shown", fmtNumber(shown.length), fmtNumber(facilities.length))}</span><PageNav paged={paged} /></> : undefined}>
          {error ? <ErrorState message={error} onRetry={loadFacilities} /> : (
            <ul className="max-h-[32rem] divide-y divide-slate-100 overflow-y-auto lg:max-h-[calc(100dvh-16rem)]">
              {facilities === null ? [0, 1, 2, 3].map((i) => <li key={i} className="p-3"><div className="skeleton h-9 rounded" /></li>) : paged.rows.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => {
                    setSelected(f);
                    // phones: the branch detail sits under the list
                    if (window.innerWidth < 1024) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                  }}
                    className={cx("flex w-full items-center gap-3 px-4 py-2.5 text-left", selected?.id === f.id ? "bg-blue-50" : "hover:bg-slate-50")}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{f.name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{f.code} · {f.facility_type}</span></span>
                    {f.own_lists > 0 ? <Badge tone="blue">{tr("{0} own", f.own_lists)}</Badge> : <Badge>{tr("Default")}</Badge>}
                  </button>
                </li>
              ))}
              {facilities && shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">{tr("No branch matches")}</li>}
            </ul>
          )}
        </Panel>

        <div ref={detailRef} className="scroll-mt-4">
        {!selected ? (
          <Panel><Empty icon={<Building2 size={28} />} title={tr("Choose a branch")}>{tr("Its count lists per count type are shown here.")}</Empty></Panel>
        ) : (
          <Panel title={selected.name} description={`${selected.code} · ${selected.facility_type} · ${selected.legal_entity_code}`}>
            {lists === null ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div> : (
              <ul className="divide-y divide-slate-100">
                {COUNT_TYPES.map((ct) => {
                  const own = lists.find((l) => l.facility_id === selected.id && l.count_type === ct);
                  const def = lists.find((l) => !l.facility_id && l.count_type === ct);
                  const used = own ?? def;
                  return (
                    <li key={ct} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ListChecks size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{countTypeLabel(ct)}</p>
                        <p className="text-xs text-slate-500">
                          {own ? tr("Own list · {0} items · {1}", own.items, SOURCE[own.source]?.() ?? own.source)
                            : def ? tr("Uses the {0} default · {1} items", selected.facility_type, def.items) : tr("No list: not counted here")}
                        </p>
                        {used && <p className="text-[11px] text-slate-400">{tr("Updated {0}", fmtDate(used.updated_at))}{used.source_ref ? ` · ${used.source_ref}` : ""}</p>}
                      </div>
                      <div className="flex w-full gap-2 sm:w-auto">
                        {own && <Button variant="ghost" size="sm" onClick={() => setResetting(own)}><RotateCcw size={14} /> {tr("Use default")}</Button>}
                        {own ? <Button size="sm" onClick={() => setOpen(own.id)}>{tr("Edit")}</Button>
                          : <>
                            {def && <Button variant="secondary" size="sm" onClick={() => setOpen(def.id)}>{tr("View default")}</Button>}
                            <Button size="sm" loading={busy} onClick={() => createOwn(ct)}><Plus size={14} /> {tr("Own list")}</Button>
                          </>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}
        </div>
      </div>
      {sheet && <ListFilters value={lf} types={types} cities={cities} onClose={() => setSheet(false)} onApply={(v) => { setLf(v); setSheet(false); }} />}
      {open && <ListDrawer listId={open} onClose={() => setOpen(null)} onChanged={() => selected && void loadLists(selected)} />}
      <ConfirmDialog open={!!resetting} busy={busy} onClose={() => setResetting(null)} onConfirm={reset}
        title={tr("Remove the own list?")} description={tr("The branch counts its type's default list again. The own list and its items are deleted.")} confirmLabel={tr("Use default")} danger />
    </Page>
  );
}

function ListDrawer({ listId, onClose, onChanged }: { listId: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<ListDetail | null>(null);
  const [items, setItems] = useState<EditorItem[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const x = await api<ListDetail>(`/api/so/count-settings/lists/${listId}`);
    setD(x);
    setItems(x.items);
    setGroupIds(x.groups.map((g) => g.id));
    setDirty(false);
  }, [listId]);
  useEffect(() => {
    void load().catch((e) => toast(errorText(e), "error"));
    void api<Group[]>("/api/so/count-settings/groups").then(setGroups).catch(() => {});
  }, [load, toast]);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/so/count-settings/lists/${listId}/items`, { method: "PUT", json: { items: toPayload(items) } });
      await api(`/api/so/count-settings/lists/${listId}/groups`, { method: "PUT", json: { group_ids: groupIds } });
      toast(tr("Count list saved"));
      await load();
      onChanged();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const toggleGroup = (id: string) => { setGroupIds((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id])); setDirty(true); };

  return (
    <Drawer open onClose={onClose} size="xl" icon={<ListChecks size={18} />}
      title={d ? `${d.facility_name ?? `${d.facility_type} (${tr("default")})`} · ${countTypeLabel(d.count_type)}` : tr("Count list")}
      description={d ? (d.groups_only ? tr("Counts its item groups only: {0} items", d.effective_items) : tr("{0} own items + groups = {1} items counted", d.items.length, d.effective_items)) : undefined}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Close")}</Button><Button loading={busy} disabled={!dirty} onClick={save}><Save size={16} /> {tr("Save")}</Button></>}>
      {!d ? <div className="skeleton h-64 rounded-lg" /> : (
        <div className="space-y-6">
          <DrawerSection title={tr("Item groups")} description={tr("When a group is assigned, the count shows the items of the assigned groups only (the branch template). This list's own settings still apply to those items.")}>
            {groups.length === 0 ? <p className="text-sm text-slate-500">{tr("No item groups yet. Create them under Items Groups.")}</p> : (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const on = groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" onClick={() => toggleGroup(g.id)} aria-pressed={on}
                      className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", on ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                      <Boxes size={14} /> {g.name} <span className="text-xs text-slate-400">{g.items}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </DrawerSection>
          <DrawerSection title={tr("Own items")} description={d.source_ref ? `${SOURCE[d.source]?.() ?? d.source} · ${d.source_ref}` : undefined}>
            {groupIds.length > 0 && (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {tr("Groups are assigned: own items that are not in a group are not counted. Remove all groups to count the own items again.")}
              </p>
            )}
            <ItemsEditor items={items} onChange={(v) => { setItems(v); setDirty(true); }} />
          </DrawerSection>
        </div>
      )}
    </Drawer>
  );
}

function ListFilters({ value, types, cities, onApply, onClose }: {
  value: LF; types: string[]; cities: string[]; onApply: (v: LF) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD({ type: "", lists: "", city: "" })}>
      <FilterSection title={tr("Facility type")}>
        <ChoiceGroup label="" value={d.type} onChange={(v) => setD({ ...d, type: v })} choices={[{ value: "", label: tr("All") }, ...types.map((t) => ({ value: t, label: t }))]} />
      </FilterSection>
      <FilterSection title={tr("Count list")}>
        <ChoiceGroup label="" value={d.lists} onChange={(v) => setD({ ...d, lists: v })}
          choices={[{ value: "", label: tr("All") }, { value: "own", label: tr("Own lists") }, { value: "default", label: tr("Default list") }]} />
      </FilterSection>
      {cities.length > 0 && (
        <FilterSection title={tr("City")}>
          <SearchChoice label="" anyLabel={tr("All cities")} value={d.city} onChange={(v) => setD({ ...d, city: v })} placeholder={tr("Search city")}
            options={cities.map((c) => ({ value: c, label: c }))} />
        </FilterSection>
      )}
    </FilterSheet>
  );
}

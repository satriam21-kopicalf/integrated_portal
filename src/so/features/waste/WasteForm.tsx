"use client";

// Waste input (page "waste", integrated_portal_be app/waste.py): the outlet / HUB / PIC enters each wasted item of the
// branch and the day (today, or yesterday when late). Every item: Waste, Usage Management or Premix (the premix / WIP
// recipes of the premix calculator, in grams), the quantity in its unit, a waste category, a note / reason and a camera
// photo as evidence (stamped with the time, the branch and the item). An item is saved at once and listed under the
// form; its author may delete it while Cost Control has not reviewed it.

import { Camera, CheckCircle2, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, ErrorState, inputClass, Page, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { FormCard, Segmented } from "@/so/ui/Simple";
import LiveClock from "@/so/ui/LiveClock";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { useAuth } from "@/lib/auth";
import { locale, tr } from "@/lib/i18n";
import { TZ, wibDateTime } from "@/so/lib/wib";
import { type Entry, type FormData, type Scope, type WasteItem, SCOPES, fmtQty, photoUrl, scopeLabel, statusLabel, statusTone } from "./waste";

const BLANK = { item: null as WasteItem | null, qty: "", category: "", note: "" };

export default function WasteForm() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [data, setData] = useState<FormData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branch, setBranch] = useState("");
  const [day, setDay] = useState("");
  const [scope, setScope] = useState<Scope>("waste");
  const [line, setLine] = useState(BLANK);
  const [search, setSearch] = useState("");
  const [photo, setPhoto] = useState<Shot | null>(null);
  const [camera, setCamera] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remove, setRemove] = useState<Entry | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async (b: string, d: string) => {
    setError(null);
    const get = (branchCode: string, dayIso: string) => {
      const q = new URLSearchParams();
      if (branchCode) q.set("branch", branchCode);
      if (dayIso) q.set("date", dayIso);
      return call<FormData>(`/api/waste/entries?${q}`);
    };
    try {
      let out = await get(b, d);
      const dayIso = d || out.days.to;
      if (!b && out.branches.length === 1) {  // one branch: chosen at once
        b = out.branches[0].code;
        setBranch(b);
        out = await get(b, dayIso);
      }
      setDay(dayIso);
      setData(out);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load("", ""); }, [load]);

  const b = data?.branches.find((x) => x.code === branch);
  const items = useMemo(() => {
    const all = data?.items[scope] ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) : all;
  }, [data, scope, search]);
  const qty = Number(line.qty.replace(",", "."));
  const missing = [
    !b && tr("the branch"), !line.item && tr("the item"), !(qty > 0) && tr("the quantity"),
    !line.category && tr("the category"), !photo && tr("the photo"),
  ].filter(Boolean) as string[];

  const pickBranch = (code: string) => { setBranch(code); void load(code, day); };
  const pickDay = (d: string) => { setDay(d); void load(branch, d); };
  const pickScope = (s: Scope) => { setScope(s); setLine({ ...line, item: null }); setSearch(""); };

  const save = async () => {
    if (!b || !line.item || !photo || missing.length) return;
    setSaving(true);
    try {
      await call<Entry>("/api/waste/entries", { method: "POST", json: {
        branchCode: b.code, businessDate: day, scope, itemCode: line.item.code, qty, category: line.category,
        note: line.note.trim() || null, photo: photo.image, takenAt: photo.taken_at, latitude: photo.lat, longitude: photo.lng } });
      toast(tr("{0} saved", line.item.name));
      setLine({ ...BLANK, category: line.category });
      setPhoto(null);
      setSearch("");
      await load(branch, day);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await call(`/api/waste/entries/${remove.id}`, { method: "DELETE" });
      setRemove(null);
      await load(branch, day);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setRemoving(false);
    }
  };

  const subtitle = tr("Enter the waste of your branch");
  if (error || !data) {
    return (
      <Page title={tr("Waste")} subtitle={subtitle} actions={<LiveClock />}>
        {error ? <div className="rounded-2xl border border-slate-200/80 bg-white"><ErrorState message={error} onRetry={() => void load(branch, day)} /></div>
          : <div className="mx-auto max-w-5xl space-y-4"><div className="skeleton h-24 rounded-xl" /><div className="skeleton h-72 rounded-xl" /></div>}
      </Page>
    );
  }
  const dayName = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString(locale(), { timeZone: TZ, weekday: "long", day: "numeric", month: "short" });

  return (
    <Page title={tr("Waste")} subtitle={subtitle} actions={<LiveClock />}>
      <div className="mx-auto max-w-5xl space-y-4">
        {data.branches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-12 text-center text-sm text-slate-500">
            {tr("No branch is assigned to your account. Ask your administrator to assign the outlets you visit.")}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="space-y-4">
              <FormCard n={1} title={tr("Branch and day")} hint={tr("Waste is entered for today or, late, for yesterday")}>
                <select className={inputClass} value={branch} onChange={(e) => pickBranch(e.target.value)} aria-label={tr("Branch")}>
                  <option value="">{tr("Choose the branch")}</option>
                  {data.branches.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                </select>
                <Segmented label={tr("Day")} value={day} onChange={pickDay}
                  options={[{ value: data.days.to, label: `${tr("Today")} · ${dayName(data.days.to)}` }, { value: data.days.from, label: `${tr("Yesterday")} · ${dayName(data.days.from)}` }]} />
              </FormCard>

              <FormCard n={2} title={tr("Wasted item")} hint={tr("Every item needs its category, a note and a photo as evidence")}>
                <Segmented label={tr("Type")} value={scope} onChange={pickScope} options={SCOPES.map((s) => ({ value: s, label: scopeLabel(s) }))} />
                {line.item ? (
                  <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{line.item.name}</p>
                      <p className="text-xs text-slate-500">{line.item.code} · {line.item.unit}</p>
                    </div>
                    <button type="button" onClick={() => setLine({ ...line, item: null })} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" aria-label={tr("Change the item")}><X size={16} /></button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className={cx(inputClass, "pl-9")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search the item name or code")} />
                    </div>
                    <ul className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                      {items.slice(0, 80).map((i) => (
                        <li key={i.code}>
                          <button type="button" onClick={() => setLine({ ...line, item: i })} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50">
                            <span className="min-w-0"><span className="block truncate text-sm text-slate-800">{i.name}</span><span className="text-[11px] text-slate-400">{i.code}</span></span>
                            <span className="flex-shrink-0 text-xs text-slate-500">{i.unit}</span>
                          </button>
                        </li>
                      ))}
                      {!items.length && <li className="px-3 py-6 text-center text-xs text-slate-500">{tr("No item found")}</li>}
                    </ul>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600">{tr("Quantity")}{line.item ? ` (${line.item.unit})` : ""}
                    <input className={cx(inputClass, "mt-1")} inputMode="decimal" value={line.qty} onChange={(e) => setLine({ ...line, qty: e.target.value.replace(/[^0-9.,]/g, "") })} placeholder="0" />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">{tr("Waste category")}
                    <select className={cx(inputClass, "mt-1")} value={line.category} onChange={(e) => setLine({ ...line, category: e.target.value })}>
                      <option value="">{tr("Choose the category")}</option>
                      {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-medium text-slate-600">{tr("Note / reason")}
                  <textarea className={cx(inputClass, "mt-1 min-h-[72px] py-2")} maxLength={500} value={line.note} onChange={(e) => setLine({ ...line, note: e.target.value })}
                    placeholder={tr("What happened, e.g. dropped while serving")} />
                </label>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">{tr("Photo evidence")}</p>
                  {photo ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.image} alt={tr("Photo evidence")} className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200" />
                      <Button variant="secondary" size="sm" onClick={() => setCamera(true)}><Camera size={14} />{tr("Retake")}</Button>
                    </div>
                  ) : (
                    <Button variant="secondary" onClick={() => setCamera(true)} disabled={!b || !line.item}><Camera size={16} />{tr("Take photo")}</Button>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">{missing.length ? tr("Still missing: {0}", missing.join(", ")) : tr("Ready to save")}</p>
                  <Button onClick={() => void save()} loading={saving} disabled={missing.length > 0}><Plus size={16} />{tr("Save item")}</Button>
                </div>
              </FormCard>
            </div>

            <EntryList entries={data.data} branch={b?.name ?? ""} day={day ? dayName(day) : ""} me={me?.id ?? ""} onRemove={setRemove} />
          </div>
        )}
      </div>
      <CameraCapture open={camera} title={tr("Waste")} branch={b?.name ?? ""} countNumber={line.item?.name ?? ""}
        onClose={() => setCamera(false)} onShot={async (s) => { setPhoto(s); setCamera(false); }} />
      <ConfirmDialog open={!!remove} title={tr("Delete this waste?")} danger confirmLabel={tr("Delete")} busy={removing}
        description={remove ? `${remove.itemName} · ${fmtQty(remove.qty)} ${remove.unit}` : ""} onConfirm={() => void confirmRemove()} onClose={() => setRemove(null)} />
    </Page>
  );
}

function EntryList({ entries, branch, day, me, onRemove }: { entries: Entry[]; branch: string; day: string; me: string; onRemove: (e: Entry) => void }) {
  return (
    <section className="h-fit rounded-2xl border border-slate-200/80 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-900">{tr("Waste entered")}</span>
          <span className="block truncate text-xs text-slate-500">{branch ? `${branch} · ${day}` : tr("Choose the branch")}</span>
        </span>
        <Badge tone={entries.length ? "blue" : "slate"}>{tr("{0} items", entries.length)}</Badge>
      </header>
      {!entries.length ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">{branch ? tr("No waste entered yet for this day.") : tr("Choose the branch to see its waste.")}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 px-4 py-3">
              <a href={photoUrl(e.id)} target="_blank" rel="noreferrer" className="flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl(e.id)} alt="" loading="lazy" className="h-14 w-14 rounded-lg bg-slate-100 object-cover" />
              </a>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-slate-900">{e.itemName}</p>
                  <Badge tone={statusTone(e.status)}>{e.status === "approved" ? <CheckCircle2 size={11} /> : null}{statusLabel(e.status)}</Badge>
                </div>
                <p className="text-xs text-slate-600">{fmtQty(e.qty)} {e.unit} · {scopeLabel(e.scope)} · {e.category}</p>
                {e.note && <p className="mt-0.5 text-xs text-slate-500">“{e.note}”</p>}
                {e.review?.note && <p className="mt-0.5 text-xs text-slate-500">{tr("Cost Control")}: {e.review.note}</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">{e.name} · {wibDateTime(e.createdAt)}</p>
              </div>
              {e.status === "submitted" && e.userId === me && (
                <button type="button" onClick={() => onRemove(e)} className="h-fit rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Delete")}><Trash2 size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

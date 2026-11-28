"use client";

// Operations → Building & Renovation (page mon.building, 2026-11-27, Building team): the material catalog (price with its
// date, the store) and the directory of stores & suppliers, from the team's Excel. Projects, RAB and progress come next.

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, History, Pencil, Plus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Badge, Button, ErrorState, SearchBox, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { WorkCard, JSelect } from "@/so/ui/Jira";
import Drawer from "@/so/ui/Drawer";
import Floating from "@/components/kc/Floating";
import ExcelIconButton from "@/components/ExcelIconButton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { downloadSheets } from "@/aggregator/ui";
import { DataTable, type Col } from "@/aggregator/kit";
import { DateField, Facts, Group, Row, ctl } from "@/aggregator/fields";
import { dmy } from "@/so/ui/Filters";
import { useRouter } from "next/navigation";
import { ProjectForm, ProjectList } from "@/building/Projects";
import { FilterCount, filterBtnClass } from "@/jira/filters";

type Material = { id: number; group: string; category: string; spec: string | null; detail: string | null; unit: string | null; price: number | null;
  priceOn: string | null; priceAge: number | null; stale: boolean; vendorId: number | null; vendor: string | null; vendorPhone: string | null; note: string | null;
  repeat: boolean; active: boolean; updatedAt: string; updatedBy: string | null };
type Vendor = { id: number; kind: "STORE" | "SUPPLIER"; kindLabel: string; name: string; location: string | null; goods: string | null; contactName: string | null;
  phone: string | null; maps: string | null; website: string | null; bank: string | null; accountNo: string | null; accountName: string | null; note: string | null;
  active: boolean; materials: number; updatedAt: string; updatedBy: string | null };
type Res = { data: Material[]; groups: string[]; staleDays: number; vendors: Vendor[]; kinds: Record<string, string>;
  summary: { materials: number; no_price: number; stale: number; categories: number; stores: number; suppliers: number } };
type Price = { price: number; priceOn: string; vendor: string | null; source: string; note: string | null; by: string | null; at: string };
type Tab = "projects" | "materials" | "vendors";

const rp = (n: number | null | undefined) => (n == null ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const waLink = (p: string) => `https://wa.me/${p.replace(/\D/g, "").replace(/^0/, "62")}`;
const GROUP_ORDER = ["Sipil", "MEP", "CCTV, Alarm & Internet", "Alat Kerja", "Furniture", "Lighting"];
const SOURCE: Record<string, string> = { IMPORT: "Impor Excel", MANUAL: "Manual", INVOICE: "Invoice" };

/** One Filter button: the fields in a panel, what is chosen as chips (as Aggregator Insight). */
function Filters({ fields, q, onQ, placeholder, excel, add }: { fields: { key: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }[];
  q: string; onQ: (v: string) => void; placeholder: string; excel: () => void; add: () => void }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const chosen = fields.filter((f) => f.value);
  const clear = () => fields.forEach((f) => f.onChange(""));
  return (
    <div className="space-y-2.5 border-b border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-md"><SearchBox value={q} onChange={onQ} placeholder={placeholder} /></div>
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <button ref={btn} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={filterBtnClass(chosen.length)}>
            <SlidersHorizontal size={16} />{tr("Filter")}<FilterCount count={chosen.length} /></button>
          {chosen.length > 0 && <button type="button" onClick={clear} aria-label={tr("Clear the filters")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)] sm:h-10 sm:w-10"><RotateCcw size={16} /></button>}
          <ExcelIconButton boxed label={tr("Export to Excel")} onClick={excel} />
          <Button className="!h-11 sm:!h-10" onClick={add}><Plus size={15} /><span className="hidden sm:inline">{tr("Add")}</span></Button>
        </div>
      </div>
      {chosen.length > 0 && <ul className="flex flex-wrap gap-1.5">{chosen.map((f) => <li key={f.key}><button type="button" onClick={() => f.onChange("")} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color:var(--j-E9F2FF)] px-2.5 text-xs text-[color:var(--j-0055CC)]"><span className="text-[color:var(--j-0C66E4)]/70">{f.label}:</span><span className="font-semibold">{f.options.find((o) => o.value === f.value)?.label ?? f.value}</span><X size={13} /></button></li>)}</ul>}
      <Floating open={open} onClose={() => setOpen(false)} title={tr("Filter")} anchor={btn}
        footer={<><Button variant="secondary" className="flex-1" disabled={!chosen.length} onClick={clear}>{tr("Clear")}</Button><Button className="flex-1" onClick={() => setOpen(false)}>{tr("Show")}</Button></>}>
        <div className="space-y-4 px-4 py-4">{fields.map((f) => <Row key={f.key} label={f.label}><JSelect value={f.value} onChange={f.onChange} label={f.label} placeholder={tr("All")} options={[{ value: "", label: tr("All") }, ...f.options]} /></Row>)}</div>
      </Floating>
    </div>
  );
}

export default function BuildingPage() {
  const toast = useToast();
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("projects");
  const [newProject, setNewProject] = useState(false);
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState(""), [cat, setCat] = useState(""), [priceState, setPriceState] = useState(""), [vendorF, setVendorF] = useState("");
  const [kind, setKind] = useState(""), [loc, setLoc] = useState("");
  const [mat, setMat] = useState<Partial<Material> | null>(null);
  const [ven, setVen] = useState<Partial<Vendor> | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => { setErr(null); call<Res>("/api/building/catalog").then(setRes).catch((e: Error) => setErr(e.message)); }, [version]);
  const t = q.trim().toLowerCase();
  const has = (...v: (string | null | undefined)[]) => !t || v.some((x) => (x ?? "").toLowerCase().includes(t));
  const cats = useMemo(() => [...new Set((res?.data ?? []).filter((m) => !grp || m.group === grp).map((m) => m.category))].sort(), [res, grp]);
  const locs = useMemo(() => [...new Set((res?.vendors ?? []).map((v) => v.location).filter(Boolean) as string[])].sort(), [res]);
  const mats = (res?.data ?? []).filter((m) => (!grp || m.group === grp) && (!cat || m.category === cat) && (!vendorF || String(m.vendorId) === vendorF)
    && (!priceState || (priceState === "none" ? m.price == null : priceState === "stale" ? m.stale : priceState === "repeat" ? m.repeat : m.price != null && !m.stale))
    && has(m.category, m.spec, m.detail, m.vendor, m.note));
  const vens = (res?.vendors ?? []).filter((v) => (!kind || v.kind === kind) && (!loc || v.location === loc) && has(v.name, v.goods, v.location, v.contactName, v.phone));
  const s = res?.summary;
  const matCols: Col<Material>[] = [
    { key: "cat", card: "title", label: tr("Material"), sort: (r) => `${r.category} ${r.spec ?? ""} ${r.detail ?? ""}`, render: (r) => <><span className="font-medium text-[color:var(--j-172B4D)]">{r.category}{r.spec ? ` · ${r.spec}` : ""}</span>{r.detail && <span className="block text-xs text-[color:var(--j-626F86)]">{r.detail}</span>}{r.repeat && <Badge tone="blue">{tr("Repeat order")}</Badge>}</> },
    { key: "grp", label: tr("Group"), sort: (r) => `${String(GROUP_ORDER.indexOf(r.group) + 1).padStart(2, "0")} ${r.category} ${r.spec ?? ""} ${r.detail ?? ""}`, render: (r) => <span className="text-xs text-[color:var(--j-44546F)]">{r.group}</span> },
    { key: "price", card: "side", label: tr("Price"), right: true, first: "desc", sort: (r) => r.price, render: (r) => <><span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(r.price)}</span>{r.unit && <span className="block text-[11px] text-[color:var(--j-626F86)]">/ {r.unit}</span>}</> },
    { key: "on", label: tr("Price date"), sort: (r) => r.priceOn, render: (r) => r.priceOn ? <span className={cx("whitespace-nowrap text-xs", r.stale ? "text-[color:var(--j-7F5F01)]" : "text-[color:var(--j-44546F)]")}>{dmy(r.priceOn)}{r.stale && <span className="block">{tr("{0} days · check", r.priceAge ?? 0)}</span>}</span> : <span className="text-xs text-[color:var(--j-626F86)]">{tr("No price")}</span> },
    { key: "v", label: tr("Store"), sort: (r) => r.vendor, render: (r) => r.vendor ? <span className="text-xs">{r.vendor}{r.vendorPhone && <a href={waLink(r.vendorPhone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block text-[color:var(--j-0C66E4)] hover:underline">{r.vendorPhone}</a>}</span> : <span className="text-xs text-[color:var(--j-626F86)]">—</span> },
    { key: "note", label: tr("Note"), render: (r) => <span className="line-clamp-2 max-w-56 break-words text-xs text-[color:var(--j-626F86)]">{r.note ?? ""}</span> },
  ];
  const venCols: Col<Vendor>[] = [
    { key: "name", card: "title", label: tr("Name"), sort: (r) => r.name, render: (r) => <><span className="font-medium text-[color:var(--j-172B4D)]">{r.name}</span><span className="block text-xs text-[color:var(--j-626F86)]">{r.goods ?? ""}</span></> },
    { key: "kind", label: tr("Kind"), sort: (r) => r.kind, render: (r) => <Badge tone={r.kind === "STORE" ? "slate" : "violet"}>{r.kindLabel}</Badge> },
    { key: "loc", label: tr("Location"), sort: (r) => r.location, render: (r) => <span className="text-xs">{r.location ?? "—"}</span> },
    { key: "contact", label: tr("Contact"), render: (r) => <span className="text-xs">{r.contactName && <span className="block">{r.contactName}</span>}{r.phone ? <a href={waLink(r.phone)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[color:var(--j-0C66E4)] hover:underline">{r.phone}</a> : "—"}</span> },
    { key: "bank", label: tr("Bank account"), render: (r) => <span className="text-xs">{r.bank ? `${r.bank} ${r.accountNo ?? ""}` : "—"}{r.accountName && <span className="block text-[color:var(--j-626F86)]">a.n. {r.accountName}</span>}</span> },
    { key: "n", card: "side", label: tr("Materials"), right: true, first: "desc", sort: (r) => r.materials, render: (r) => r.materials || "—" },
  ];
  const exportXlsx = () => void downloadSheets(`Building Catalog ${today()}`, [
    { sheet: "Material", title: `Katalog Material · ${dmy(today())}`, header: ["Kelompok", "Kategori", "Merk / ukuran", "Detail", "Satuan", "Harga (Rp)", "Tanggal harga", "Umur harga (hari)", "Toko", "Telepon toko", "Repeat order", "Catatan"],
      rows: mats.map((m) => [m.group, m.category, m.spec, m.detail, m.unit, m.price, m.priceOn, m.priceAge, m.vendor, m.vendorPhone, m.repeat ? "Ya" : "", m.note]) },
    { sheet: "Toko & Supplier", title: `Toko & Supplier · ${dmy(today())}`, header: ["Jenis", "Nama", "Lokasi", "Barang", "Kontak", "Telepon", "Maps", "Website", "Bank", "No. rekening", "Atas nama", "Jumlah material", "Catatan"],
      rows: vens.map((v) => [v.kindLabel, v.name, v.location, v.goods, v.contactName, v.phone, v.maps, v.website, v.bank, v.accountNo, v.accountName, v.materials, v.note]) },
  ]).catch((e) => toast((e as Error).message, "error"));
  const key = `${tab}${grp}${cat}${priceState}${vendorF}${kind}${loc}${t}`;
  return (
    <Page title={tr("Building & Renovation")} eyebrow={tr("Operations")} media={<Building2 size={19} />}
      subtitle={tr("Projects with RAB and progress, the material catalog, stores and suppliers of the Building team")}>
      {err ? <ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /> : (
        <>
          <StatStrip columns={4} label={tr("Catalog")} gridClassName="grid-cols-2 lg:grid-cols-4">
            <Stat label={tr("Materials")} value={s ? s.materials.toLocaleString("id-ID") : <StatSkeleton />}>{s && <p>{tr("{0} categories", s.categories)}</p>}</Stat>
            <Stat label={tr("Price to check")} onClick={() => { setTab("materials"); setPriceState("stale"); }} active={priceState === "stale"} value={s ? s.stale.toLocaleString("id-ID") : <StatSkeleton />}>{res && <p>{tr("older than {0} days", res.staleDays)}</p>}</Stat>
            <Stat label={tr("Without price")} onClick={() => { setTab("materials"); setPriceState("none"); }} active={priceState === "none"} value={s ? s.no_price.toLocaleString("id-ID") : <StatSkeleton />} />
            <Stat label={tr("Stores & suppliers")} onClick={() => setTab("vendors")} active={tab === "vendors"} value={s ? (s.stores + s.suppliers).toLocaleString("id-ID") : <StatSkeleton />}>{s && <p>{tr("{0} stores · {1} suppliers", s.stores, s.suppliers)}</p>}</Stat>
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={(k) => { setTab(k); setQ(""); }} label={tr("Views")}
            tabs={[{ key: "projects", label: tr("Projects") }, { key: "materials", label: tr("Material Catalog"), count: res ? res.data.length : null }, { key: "vendors", label: tr("Stores & Suppliers"), count: res ? res.vendors.length : null }]}>
            {tab === "projects" ? <ProjectList onAdd={() => setNewProject(true)} /> : tab === "materials" ? <>
              <Filters q={q} onQ={setQ} placeholder={tr("Search material, brand, size or store")} excel={exportXlsx} add={() => setMat({ group: grp || "Sipil", category: cat || "", priceOn: today(), active: true })}
                fields={[{ key: "g", label: tr("Group"), value: grp, onChange: (v) => { setGrp(v); setCat(""); }, options: (res?.groups ?? []).map((x) => ({ value: x, label: x })) },
                  { key: "c", label: tr("Category"), value: cat, onChange: setCat, options: cats.map((x) => ({ value: x, label: x })) },
                  { key: "p", label: tr("Price"), value: priceState, onChange: setPriceState, options: [{ value: "ok", label: tr("Recent price") }, { value: "stale", label: tr("Price to check") }, { value: "none", label: tr("Without price") }, { value: "repeat", label: tr("Repeat order") }] },
                  { key: "v", label: tr("Store"), value: vendorF, onChange: setVendorF, options: (res?.vendors ?? []).filter((v) => v.materials).map((v) => ({ value: String(v.id), label: v.name })) }]} />
              <DataTable key="m" cols={matCols} rows={mats} loading={!res} rowKey={(r) => String(r.id)} resetKey={key} initial={{ key: "grp", dir: "asc" }} minWidth={980} onRow={(r) => setMat(r)} empty={tr("No material matches")} />
            </> : <>
              <Filters q={q} onQ={setQ} placeholder={tr("Search name, goods, location or contact")} excel={exportXlsx} add={() => setVen({ kind: "STORE", active: true })}
                fields={[{ key: "k", label: tr("Kind"), value: kind, onChange: setKind, options: [{ value: "STORE", label: tr("Store") }, { value: "SUPPLIER", label: tr("Supplier") }] },
                  { key: "l", label: tr("Location"), value: loc, onChange: setLoc, options: locs.map((x) => ({ value: x, label: x })) }]} />
              <DataTable key="v" cols={venCols} rows={vens} loading={!res} rowKey={(r) => String(r.id)} resetKey={key} initial={{ key: "name", dir: "asc" }} minWidth={900} onRow={(r) => setVen(r)} empty={tr("No store or supplier matches")} />
            </>}
          </WorkCard>
        </>
      )}
      {newProject && <ProjectForm onClose={() => setNewProject(false)} onSaved={(id) => router.push(`/monitoring/building/${id}`)} />}
      {mat && res && <MaterialDrawer m={mat} res={res} onClose={() => setMat(null)} onSaved={() => { setMat(null); setVersion((v) => v + 1); }} />}
      {ven && <VendorDrawer v={ven} onClose={() => setVen(null)} onSaved={() => { setVen(null); setVersion((x) => x + 1); }} />}
    </Page>
  );
}

function MaterialDrawer({ m, res, onClose, onSaved }: { m: Partial<Material>; res: Res; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ group: m.group ?? "Sipil", category: m.category ?? "", spec: m.spec ?? "", detail: m.detail ?? "", unit: m.unit ?? "",
    price: m.price != null ? String(Math.round(m.price)) : "", priceOn: m.priceOn ?? today(), vendorId: m.vendorId ? String(m.vendorId) : "", vendor: m.vendorId ? "" : m.vendor ?? "",
    note: m.note ?? "", repeat: !!m.repeat, active: m.active ?? true, priceNote: "" });
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<Price[] | null>(null);
  const changedPrice = m.id != null && (f.price !== (m.price != null ? String(Math.round(m.price)) : "") || f.priceOn !== (m.priceOn ?? today()));
  useEffect(() => { if (m.id) call<Price[]>(`/api/building/materials/${m.id}/prices`).then(setHist).catch(() => setHist([])); }, [m.id]);
  const set = (k: keyof typeof f) => (v: string | boolean) => setF({ ...f, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      await call(m.id ? `/api/building/materials/${m.id}` : "/api/building/materials", { method: m.id ? "PUT" : "POST", json: { ...f, vendorId: f.vendorId || null, price: f.price || null } });
      toast(tr("Saved"), "ok"); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const cats = [...new Set(res.data.filter((x) => x.group === f.group).map((x) => x.category))].sort();
  return (
    <Drawer open onClose={onClose} size="md" icon={m.id ? <Pencil size={18} /> : <Plus size={18} />} title={m.id ? `${m.category}${m.spec ? ` · ${m.spec}` : ""}` : tr("Add material")}
      description={m.id ? `${m.group}${m.updatedBy ? ` · ${tr("changed by {0}", m.updatedBy)}` : ""}` : tr("The price keeps its date; a new price keeps the old one in the history")}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || !f.category.trim()} onClick={() => void save()}>{tr("Save")}</Button></div>}>
      <Group title={tr("Material")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Group")} required><JSelect value={f.group} onChange={(v) => setF({ ...f, group: v })} label={tr("Group")} placeholder="" options={res.groups.map((g) => ({ value: g, label: g }))} /></Row>
          <Row label={tr("Category")} required hint={tr("e.g. ACP, Keramik, Kabel")}><input list="bld-cats" className={ctl} value={f.category} onChange={(e) => set("category")(e.target.value)} /><datalist id="bld-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Row>
          <Row label={tr("Brand / size")}><input className={ctl} value={f.spec} onChange={(e) => set("spec")(e.target.value)} /></Row>
          <Row label={tr("Detail / model")}><input className={ctl} value={f.detail} onChange={(e) => set("detail")(e.target.value)} /></Row>
        </div>
      </Group>
      <Group title={tr("Price")} note={m.priceAge != null && m.stale ? tr("This price is {0} days old: check it with the store", m.priceAge) : undefined}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label={tr("Price (Rp)")} hint={f.price ? rp(Number(f.price)) : undefined}><input inputMode="numeric" className={cx(ctl, "text-right tabular-nums")} value={f.price} onChange={(e) => set("price")(e.target.value.replace(/\D/g, ""))} /></Row>
          <Row label={tr("Unit")} hint={tr("lbr, pcs, m, dus …")}><input className={ctl} value={f.unit} onChange={(e) => set("unit")(e.target.value)} /></Row>
          <Row label={tr("Price date")}><DateField label={tr("Price date")} value={f.priceOn} max={today()} quick={false} onChange={set("priceOn")} /></Row>
        </div>
        {changedPrice && <Row label={tr("Source of the new price")}><input className={ctl} value={f.priceNote} placeholder={tr("e.g. quotation, invoice, call to the store")} onChange={(e) => set("priceNote")(e.target.value)} /></Row>}
        <Row label={tr("Store")} hint={tr("From the directory; type below when it is not there")}><JSelect value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v, vendor: "" })} label={tr("Store")} placeholder={tr("Not chosen")} options={[{ value: "", label: tr("Not chosen") }, ...res.vendors.map((v) => ({ value: String(v.id), label: v.name, hint: v.location ?? v.kindLabel }))]} /></Row>
        {!f.vendorId && <Row label={tr("Store (as written)")}><input className={ctl} value={f.vendor} onChange={(e) => set("vendor")(e.target.value)} /></Row>}
      </Group>
      <Group title={tr("Other")}>
        <Row label={tr("Note")}><textarea rows={2} className={cx(ctl, "h-auto py-2")} value={f.note} onChange={(e) => set("note")(e.target.value)} /></Row>
        <label className="flex min-h-11 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={f.repeat} onChange={(e) => set("repeat")(e.target.checked)} />{tr("Repeat order (ordered again and again)")}</label>
        {m.id != null && <label className="flex min-h-11 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={!f.active} onChange={(e) => set("active")(!e.target.checked)} />{tr("Not used any more (hidden from the catalog)")}</label>}
      </Group>
      {m.id != null && <Group title={tr("Price history")}>
        {!hist ? <p className="text-xs text-[color:var(--j-626F86)]">…</p> : !hist.length ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("No history yet")}</p> :
          <Facts rows={hist.map((h, i) => [`${dmy(h.priceOn)} · ${SOURCE[h.source] ?? h.source}`, <span key={i}>{rp(h.price)}<span className="block text-[11px] font-normal text-[color:var(--j-626F86)]">{[h.vendor, h.note, h.by].filter(Boolean).join(" · ")}</span></span>])} />}
        <p className="flex items-center gap-1 text-[11px] text-[color:var(--j-626F86)]"><History size={11} />{tr("Every price change stays here")}</p>
      </Group>}
    </Drawer>
  );
}

function VendorDrawer({ v, onClose, onSaved }: { v: Partial<Vendor>; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ kind: v.kind ?? "STORE", name: v.name ?? "", location: v.location ?? "", goods: v.goods ?? "", contactName: v.contactName ?? "", phone: v.phone ?? "",
    maps: v.maps ?? "", website: v.website ?? "", bank: v.bank ?? "", accountNo: v.accountNo ?? "", accountName: v.accountName ?? "", note: v.note ?? "", active: v.active ?? true });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      await call(v.id ? `/api/building/vendors/${v.id}` : "/api/building/vendors", { method: v.id ? "PUT" : "POST", json: f });
      toast(tr("Saved"), "ok"); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} size="md" icon={v.id ? <Pencil size={18} /> : <Plus size={18} />} title={v.id ? v.name ?? "" : tr("Add store or supplier")}
      description={v.id ? `${v.kindLabel}${v.materials ? ` · ${tr("{0} materials", v.materials)}` : ""}` : undefined}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || !f.name.trim()} onClick={() => void save()}>{tr("Save")}</Button></div>}>
      <Group title={tr("Store or supplier")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Kind")} required><JSelect value={f.kind} onChange={(k) => setF({ ...f, kind: k as Vendor["kind"] })} label={tr("Kind")} placeholder="" options={[{ value: "STORE", label: tr("Store") }, { value: "SUPPLIER", label: tr("Supplier") }]} /></Row>
          <Row label={tr("Name")} required><input className={ctl} value={f.name} onChange={set("name")} /></Row>
          <Row label={tr("Location")} hint={tr("City or area")}><input className={ctl} value={f.location} onChange={set("location")} /></Row>
          <Row label={tr("Goods")}><input className={ctl} value={f.goods} onChange={set("goods")} /></Row>
        </div>
      </Group>
      <Group title={tr("Contact")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Contact person")}><input className={ctl} value={f.contactName} onChange={set("contactName")} /></Row>
          <Row label={tr("Phone / WhatsApp")}><input inputMode="tel" className={ctl} value={f.phone} onChange={set("phone")} /></Row>
          <Row label={tr("Google Maps")}><input className={ctl} value={f.maps} onChange={set("maps")} placeholder="https://maps…" /></Row>
          <Row label={tr("Website / marketplace")}><input className={ctl} value={f.website} onChange={set("website")} /></Row>
        </div>
      </Group>
      <Group title={tr("Bank account")} note={tr("Used later for Fund Request payments to this store")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Row label={tr("Bank")}><input className={ctl} value={f.bank} onChange={set("bank")} /></Row>
          <Row label={tr("Account no.")}><input inputMode="numeric" className={ctl} value={f.accountNo} onChange={set("accountNo")} /></Row>
          <Row label={tr("Account name")}><input className={ctl} value={f.accountName} onChange={set("accountName")} /></Row>
        </div>
      </Group>
      <Group title={tr("Other")}>
        <Row label={tr("Note")}><textarea rows={2} className={cx(ctl, "h-auto py-2")} value={f.note} onChange={set("note")} /></Row>
        {v.id != null && <label className="flex min-h-11 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 sm:h-4 sm:w-4" checked={!f.active} onChange={(e) => setF({ ...f, active: !e.target.checked })} />{tr("Not used any more (hidden from the directory)")}</label>}
      </Group>
    </Drawer>
  );
}

"use client";

// Monitoring COTR → Master Pool / HUB (page cotr.pools): the main HUB, the parent pools under it where the drivers
// start and reload, and the storages (menus and raw materials) of each.

import { Boxes, Building2, MapPin, Warehouse } from "lucide-react";
import { Badge, Page } from "@/so/ui";
import { Driver, Fleet, Pool } from "@/cotr/types";
import { MasterTable, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const KIND: Record<Pool["kind"], { label: () => string; tone: "blue" | "violet" | "cyan"; icon: typeof Boxes }> = {
  main: { label: () => tr("Main HUB"), tone: "blue", icon: Building2 },
  parent: { label: () => tr("Parent pool"), tone: "violet", icon: Warehouse },
  storage: { label: () => tr("Storage"), tone: "cyan", icon: Boxes },
};

export default function CotrPoolsPage() {
  const master = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  const fleet = useMaster<Fleet>("fleet");
  const rows = master.rows ?? [];
  const mains = rows.filter((p) => p.kind === "main");
  return (
    <Page title={tr("Master Pool / HUB")} subtitle={tr("Main HUB, parent pools and the storage of menus and raw materials")}>
      {/* the hierarchy at a glance: main HUB → its pools and storages */}
      <div className="grid gap-4 lg:grid-cols-2">
        {mains.map((m) => (
          <section key={m.code} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 font-semibold text-slate-900"><Building2 size={16} className="text-blue-700" />{m.name}<span className="text-xs font-normal text-slate-400">{m.code} · {m.city}</span></p>
            <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
              {rows.filter((p) => p.parent_code === m.code).map((p) => {
                const k = KIND[p.kind];
                return (
                  <li key={p.code} className="text-sm">
                    <span className="flex flex-wrap items-center gap-2"><k.icon size={14} className="text-slate-400" /><span className="font-medium">{p.name}</span><Badge tone={k.tone}>{k.label()}</Badge></span>
                    <span className="ml-6 block text-xs text-slate-500">
                      {p.kind === "storage" ? p.storage.join(", ")
                        : tr("{0} drivers · {1} fleet", (drivers.rows ?? []).filter((d) => d.pool_code === p.code).length, (fleet.rows ?? []).filter((f) => f.pool_code === p.code).length)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <MasterTable noun={tr("pool")} title={tr("Pools, HUBs & storages")} master={master}
        blank={(): Partial<Pool> => ({ code: "", name: "", kind: "parent", parent_code: mains[0]?.code ?? null, city: "", address: "", storage: [], is_active: true, latitude: null, longitude: null, radius_m: 100 })}
        toForm={(p) => ({ ...p, storage: (p.storage ?? []).join(", ") })}
        fromForm={(v) => ({ ...v, storage: String(v.storage ?? "").split(",").map((s) => s.trim()).filter(Boolean) }) as Partial<Pool>}
        columns={[
          { label: tr("Name"), render: (p) => <><span className="block font-medium text-slate-900">{p.name || "—"}</span><span className="text-[11px] text-slate-400">{p.code}</span></> },
          { label: tr("Location"), render: (p) => p.latitude !== null && p.longitude !== null
            ? <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700"><MapPin size={12} />{tr("Map")} · {p.radius_m} m</a>
            : <Badge tone="amber">{tr("No coordinates")}</Badge> },
          { label: tr("Type"), render: (p) => <Badge tone={KIND[p.kind].tone}>{KIND[p.kind].label()}</Badge> },
          { label: tr("Under"), render: (p) => (p.parent_code ? rows.find((x) => x.code === p.parent_code)?.name ?? p.parent_code : "—") },
          { label: tr("Address"), render: (p) => <><span className="block">{p.address}</span><span className="text-[11px] text-slate-400">{p.city}</span></> },
          { label: tr("Stores"), render: (p) => <span className="text-xs text-slate-600">{p.storage.join(", ") || "—"}</span> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "POOL-XXX", section: tr("Pool / HUB") },
          { key: "name", label: tr("Name"), required: true, section: tr("Pool / HUB") },
          { key: "kind", label: tr("Type"), type: "select", required: true, section: tr("Pool / HUB"), options: (Object.keys(KIND) as Pool["kind"][]).map((k) => ({ value: k, label: KIND[k].label() })) },
          { key: "parent_code", label: tr("Under (main HUB)"), type: "search", hint: tr("Empty for a main HUB"), section: tr("Pool / HUB"), options: mains.map((m) => ({ value: m.code, label: m.name, hint: m.city })) },
          { key: "storage", label: tr("Stores"), hint: tr("Separate with commas: menus, raw materials, packaging …"), section: tr("Pool / HUB") },
          { key: "is_active", label: tr("Active"), type: "bool", section: tr("Pool / HUB") },

          { key: "city", label: tr("City"), required: true, section: tr("Location") },
          { key: "radius_m", label: tr("Check-in radius (m)"), type: "number", section: tr("Location"), hint: tr("A check in further than this is flagged") },
          { key: "address", label: tr("Address"), type: "textarea", section: tr("Location") },
          { key: "coords", label: tr("Coordinates"), type: "coords", coords: ["latitude", "longitude"], section: tr("Location") },

          { key: "pic_name", label: tr("PIC"), section: tr("Contact & hours") },
          { key: "phone", label: tr("Phone"), section: tr("Contact & hours") },
          { key: "open_time", label: tr("Opens"), type: "time", section: tr("Contact & hours") },
          { key: "close_time", label: tr("Closes"), type: "time", section: tr("Contact & hours") },
          { key: "note", label: tr("Note"), type: "textarea", section: tr("Contact & hours") },
        ]} />
    </Page>
  );
}

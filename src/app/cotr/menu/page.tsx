"use client";

// Monitoring COTR → Master Menu (page cotr.menu, prototype 2026-11-01): the menus the drivers sell, the price and the
// recipe (BOM) each is made with (Storage & Production → BOM / recipes).

import { Page } from "@/so/ui";
import { BOMS, MENUS, Menu, rupiah } from "@/cotr/mock";
import { MasterTable, PrototypeNote, YesNo, newId, useLocalList } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

export default function CotrMenuPage() {
  const list = useLocalList<Menu>("menus", MENUS);
  return (
    <Page title={tr("Master Menu")} subtitle={tr("Menus the COTR drivers sell, price and recipe")}>
      <PrototypeNote />
      <MasterTable noun={tr("menu")} title={tr("Menus ({0})", list.rows.length)} rows={list.rows}
        onSave={(m) => list.upsert({ ...m, active: String(m.active) === "true" })} onDelete={list.remove} onReset={list.reset}
        blank={(): Menu => ({ id: newId(), code: "COTR-", name: "", category: "Kopi susu", price: 15000, active: true, bom: null })}
        columns={[
          { label: tr("Menu"), render: (m) => <><span className="block font-medium text-slate-900">{m.name || "—"}</span><span className="text-[11px] text-slate-400">{m.code}</span></> },
          { label: tr("Category"), render: (m) => m.category },
          { label: tr("Price"), className: "text-right", render: (m) => <span className="tabular-nums">{rupiah(Number(m.price))}</span> },
          { label: tr("Recipe (BOM)"), render: (m) => m.bom ? BOMS.find((b) => b.code === m.bom)?.name ?? m.bom : <span className="text-amber-700">{tr("No recipe yet")}</span> },
          { label: tr("Status"), render: (m) => <YesNo on={String(m.active) === "true"} yes={tr("Sold")} no={tr("Not sold")} /> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true },
          { key: "name", label: tr("Name"), required: true },
          { key: "category", label: tr("Category"), type: "select", required: true, options: ["Kopi susu", "Kopi hitam", "Non kopi", "Snack"].map((c) => ({ value: c, label: c })) },
          { key: "price", label: tr("Price (Rp)"), type: "number", required: true },
          { key: "bom", label: tr("Recipe (BOM)"), type: "select", options: BOMS.filter((b) => b.yieldUnit === "cup").map((b) => ({ value: b.code, label: b.name })) },
          { key: "active", label: tr("Status"), type: "select", required: true, options: [{ value: "true", label: tr("Sold") }, { value: "false", label: tr("Not sold") }] },
        ]} />
    </Page>
  );
}

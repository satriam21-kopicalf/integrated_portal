"use client";

// Monitoring COTR → Master Menu (page cotr.menu): the menus the drivers sell (the active ones show in the driver app in
// this order), the price a sale takes and the recipe (BOM) each is made with (Storage & Production → BOM / recipes).

import { Page } from "@/so/ui";
import { Bom, Menu } from "@/cotr/types";
import { MasterTable, YesNo, rupiah, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

export default function CotrMenuPage() {
  const master = useMaster<Menu>("menus");
  const boms = useMaster<Bom>("boms");
  return (
    <Page title={tr("Master Menu")} subtitle={tr("Menus the COTR drivers sell, price and recipe")}>
      <MasterTable noun={tr("menu")} title={tr("Menus")} master={master}
        description={tr("Sold menus show in the driver app in this order; a sale takes the price of that moment.")}
        blank={() => ({ code: "COTR-", name: "", category: "Kopi susu", price: 15000, bom_code: null, is_active: true, sort: (master.rows?.length ?? 0) + 1 })}
        columns={[
          { label: tr("Menu"), render: (m) => <><span className="block font-medium text-slate-900">{m.name || "—"}</span><span className="text-[11px] text-slate-400">{m.code}</span></> },
          { label: tr("Category"), render: (m) => m.category },
          { label: tr("Price"), className: "text-right", render: (m) => <span className="tabular-nums">{rupiah(m.price)}</span> },
          { label: tr("Recipe (BOM)"), render: (m) => m.bom_code ? boms.rows?.find((b) => b.code === m.bom_code)?.name ?? m.bom_code : <span className="text-amber-700">{tr("No recipe yet")}</span> },
          { label: tr("Status"), render: (m) => <YesNo on={m.is_active} yes={tr("Sold")} no={tr("Not sold")} /> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true },
          { key: "name", label: tr("Name"), required: true },
          { key: "category", label: tr("Category"), type: "select", required: true, options: ["Kopi susu", "Kopi hitam", "Non kopi", "Snack"].map((c) => ({ value: c, label: c })) },
          { key: "price", label: tr("Price (Rp)"), type: "number", required: true },
          { key: "bom_code", label: tr("Recipe card"), type: "search", hint: tr("Made in Storage & Production → Recipe cards"), options: (boms.rows ?? []).filter((b) => b.kind === "menu").map((b) => ({ value: b.code, label: b.name, hint: b.code })) },
          { key: "is_active", label: tr("Sold"), type: "bool" },
          { key: "sort", label: tr("Order in the app"), type: "number" },
          { key: "shelf_life_days", label: tr("Shelf life (days)"), type: "number", hint: tr("The default expiry of a production batch") },
        ]} />
    </Page>
  );
}

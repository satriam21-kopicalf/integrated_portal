"use client";

// Monitoring COTR → Master Menu (page cotr.menu): the menus the drivers sell (the active ones show in the driver app in
// this order), the price a sale takes and the recipe (BOM) each is made with (Storage & Production → BOM / recipes).
// A summary on top (menus sold, without a recipe, price range), the list with its filters (category, status, recipe).

import { BookOpen, CircleDollarSign, Coffee, Layers, ShoppingBag, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Page } from "@/components/kc/compat";
import { Pill, StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { Bom, Menu } from "@/cotr/types";
import { type MasterFilter, MasterTable, YesNo, rupiah, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const CATEGORIES = ["Kopi susu", "Kopi hitam", "Non kopi", "Snack"];

export default function CotrMenuPage() {
  const master = useMaster<Menu>("menus");
  const boms = useMaster<Bom>("boms");
  const rows = master.rows;
  const s = useMemo(() => {
    if (!rows) return null;
    const sold = rows.filter((m) => m.is_active);
    const prices = sold.map((m) => Number(m.price));
    return { total: rows.length, sold: sold.length, noRecipe: sold.filter((m) => !m.bom_code).length,
      min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null,
      categories: new Set(rows.map((m) => m.category)).size };
  }, [rows]);
  const categories = useMemo(() => [...new Set([...CATEGORIES, ...(rows ?? []).map((m) => m.category)].filter(Boolean))], [rows]);
  const filters: MasterFilter<Menu>[] = [
    { key: "category", label: tr("Category"), icon: <Layers size={15} />, options: categories.map((c) => ({ value: c, label: c, test: (m) => m.category === c })) },
    { key: "status", label: tr("Status"), icon: <ShoppingBag size={15} />, options: [
      { value: "sold", label: tr("Sold"), test: (m) => m.is_active }, { value: "off", label: tr("Not sold"), test: (m) => !m.is_active }] },
    { key: "recipe", label: tr("Recipe (BOM)"), icon: <BookOpen size={15} />, options: [
      { value: "with", label: tr("With a recipe"), test: (m) => !!m.bom_code }, { value: "without", label: tr("No recipe yet"), test: (m) => !m.bom_code }] },
  ];
  return (
    <Page eyebrow="Monitoring COTR" media={<Coffee size={19} />} title={tr("Master Menu")} subtitle={tr("Menus the COTR drivers sell, price and recipe")}
      stats={
        <StatGrid label={tr("Summary")} cols={4}>
          <StatCard label={tr("Menus sold")} tone="brand" icon={<ShoppingBag />} value={s ? `${s.sold}/${s.total}` : <ValueSkeleton />} sub={s && tr("{0} categories", s.categories)} />
          <StatCard label={tr("Without a recipe")} icon={<TriangleAlert />} tone={s?.noRecipe ? "warn" : "default"} value={s ? s.noRecipe : <ValueSkeleton />}
            sub={tr("sold menus without a recipe card")} />
          <StatCard label={tr("Lowest price")} icon={<CircleDollarSign />} value={s ? (s.min === null ? "—" : rupiah(s.min)) : <ValueSkeleton />} />
          <StatCard label={tr("Highest price")} icon={<CircleDollarSign />} value={s ? (s.max === null ? "—" : rupiah(s.max)) : <ValueSkeleton />} />
        </StatGrid>
      }>
      <MasterTable noun={tr("menu")} title={tr("Menus")} master={master} filters={filters}
        description={tr("Sold menus show in the driver app in this order; a sale takes the price of that moment.")}
        blank={() => ({ code: "COTR-", name: "", category: "Kopi susu", price: 15000, bom_code: null, is_active: true, sort: (master.rows?.length ?? 0) + 1 })}
        columns={[
          { label: tr("Menu"), render: (m) => (
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold tabular-nums text-brand-700" title={tr("Order in the app")}>{m.sort}</span>
              <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{m.name || "—"}</span><span className="text-[11px] text-neutral-400">{m.code}</span></span>
            </span>
          ) },
          { label: tr("Category"), render: (m) => <Pill tone="gray">{m.category}</Pill> },
          { label: tr("Price"), className: "text-right", render: (m) => <span className="font-semibold tabular-nums text-neutral-900">{rupiah(m.price)}</span> },
          { label: tr("Recipe (BOM)"), render: (m) => m.bom_code
            ? <span className="inline-flex items-center gap-1.5 text-neutral-700"><BookOpen size={13} className="text-neutral-400" />{boms.rows?.find((b) => b.code === m.bom_code)?.name ?? m.bom_code}</span>
            : <Pill tone="amber" icon={<TriangleAlert size={11} />}>{tr("No recipe yet")}</Pill> },
          { label: tr("Shelf life"), className: "text-right", render: (m) => m.shelf_life_days ? <span className="tabular-nums">{tr("{0} days", m.shelf_life_days)}</span> : <span className="text-neutral-400">—</span> },
          { label: tr("Status"), render: (m) => <YesNo on={m.is_active} yes={tr("Sold")} no={tr("Not sold")} /> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, section: tr("Menu") },
          { key: "name", label: tr("Name"), required: true, section: tr("Menu") },
          { key: "category", label: tr("Category"), type: "select", required: true, section: tr("Menu"), options: categories.map((c) => ({ value: c, label: c })) },
          { key: "price", label: tr("Price (Rp)"), type: "number", required: true, section: tr("Menu") },
          { key: "bom_code", label: tr("Recipe card"), type: "search", section: tr("Recipe & production"), hint: tr("Made in Storage & Production → Recipe cards"), options: (boms.rows ?? []).filter((b) => b.kind === "menu").map((b) => ({ value: b.code, label: b.name, hint: b.code })) },
          { key: "shelf_life_days", label: tr("Shelf life (days)"), type: "number", section: tr("Recipe & production"), hint: tr("The default expiry of a production batch") },
          { key: "sort", label: tr("Order in the app"), type: "number", section: tr("Driver app") },
          { key: "is_active", label: tr("Sold"), type: "bool", section: tr("Driver app") },
        ]} />
    </Page>
  );
}

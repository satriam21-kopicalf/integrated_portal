"use client";

// Monitoring COTR → Master Menu (page cotr.menu): the menus the drivers sell (the active ones show in the driver app in
// this order), the price a sale takes and the recipe (BOM) each is made with (Storage & Production → BOM / recipes).
// A summary on top (menus sold, without a recipe, price range), the list with its filters (category, status, recipe).

import { Segmented } from "@/so/ui/Simple";
import { BookOpen, CircleDollarSign, Coffee, Layers, ShoppingBag, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "@/components/kc/compat";
import { Pill, StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { Bom, Menu } from "@/cotr/types";
import { type MasterFilter, MasterTable, YesNo, rupiah, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Category = { code: string; name: string; sort: number; is_active: boolean };

export default function CotrMenuPage() {
  const master = useMaster<Menu>("menus");
  const boms = useMaster<Bom>("boms");
  // the categories are a master of their own (migration 082): added and renamed here
  const cats = useMaster<Category>("menu-categories");
  const [part, setPart] = useState<"menus" | "categories">("menus");
  const rows = master.rows;
  const s = useMemo(() => {
    if (!rows) return null;
    const sold = rows.filter((m) => m.is_active);
    const prices = sold.map((m) => Number(m.price));
    return { total: rows.length, sold: sold.length, noRecipe: sold.filter((m) => !m.bom_code).length,
      min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null,
      categories: new Set(rows.map((m) => m.category)).size };
  }, [rows]);
  const categories = useMemo(() => [...new Set([...(cats.rows ?? []).filter((c) => c.is_active).map((c) => c.name), ...(rows ?? []).map((m) => m.category)].filter(Boolean))], [rows, cats.rows]);
  const filters: MasterFilter<Menu>[] = [
    { key: "category", label: tr("Category"), icon: <Layers size={15} />, options: categories.map((c) => ({ value: c, label: c, test: (m) => m.category === c })) },
    { key: "status", label: tr("Status"), icon: <ShoppingBag size={15} />, options: [
      { value: "sold", label: tr("Sold"), test: (m) => m.is_active }, { value: "off", label: tr("Not sold"), test: (m) => !m.is_active }] },
    { key: "recipe", label: tr("Recipe (BOM)"), icon: <BookOpen size={15} />, options: [
      { value: "with", label: tr("With a Recipe"), test: (m) => !!m.bom_code }, { value: "without", label: tr("No recipe yet"), test: (m) => !m.bom_code }] },
  ];
  return (
    <Page eyebrow="Monitoring COTR" media={<Coffee size={19} />} title={tr("Master Menu")} subtitle={tr("Menus the COTR drivers sell, price and recipe")}
      stats={
        <StatGrid label={tr("Summary")} cols={4}>
          <StatCard label={tr("Menus Sold")} tone="brand" icon={<ShoppingBag />} value={s ? `${s.sold}/${s.total}` : <ValueSkeleton />} sub={s && tr("{0} categories", s.categories)} />
          <StatCard label={tr("Without a Recipe")} icon={<TriangleAlert />} tone={s?.noRecipe ? "warn" : "default"} value={s ? s.noRecipe : <ValueSkeleton />}
            sub={tr("sold menus without a recipe card")} />
          <StatCard label={tr("Lowest Price")} icon={<CircleDollarSign />} value={s ? (s.min === null ? "—" : rupiah(s.min)) : <ValueSkeleton />} />
          <StatCard label={tr("Highest Price")} icon={<CircleDollarSign />} value={s ? (s.max === null ? "—" : rupiah(s.max)) : <ValueSkeleton />} />
        </StatGrid>
      }>
      <Segmented label={tr("Part")} value={part} onChange={setPart} options={[
        { value: "menus", label: tr("Menus ({0})", rows?.length ?? 0) }, { value: "categories", label: tr("Categories ({0})", cats.rows?.length ?? 0) }]} />
      {part === "menus" && <MasterTable noun={tr("menu")} title={tr("Menus")} master={master} filters={filters}
        description={tr("Sold menus show in the driver app in this order; a sale takes the price of that moment.")}
        blank={() => ({ code: "COTR-", name: "", category: categories[0] ?? "", price: 15000, bom_code: null, is_active: true, sort: (master.rows?.length ?? 0) + 1 })}
        columns={[
          { label: tr("Menu"), render: (m) => (
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold tabular-nums text-brand-700" title={tr("Order in the App")}>{m.sort}</span>
              <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{m.name || "—"}</span><span className="text-[11px] text-neutral-400">{m.code}</span></span>
            </span>
          ) },
          { label: tr("Category"), render: (m) => <Pill tone="gray">{m.category}</Pill> },
          { label: tr("Price"), className: "text-right", render: (m) => <span className="font-semibold tabular-nums text-neutral-900">{rupiah(m.price)}</span> },
          { label: tr("Recipe (BOM)"), render: (m) => m.bom_code
            ? <span className="inline-flex items-center gap-1.5 text-neutral-700"><BookOpen size={13} className="text-neutral-400" />{boms.rows?.find((b) => b.code === m.bom_code)?.name ?? m.bom_code}</span>
            : <Pill tone="amber" icon={<TriangleAlert size={11} />}>{tr("No recipe yet")}</Pill> },
          { label: tr("Shelf Life"), className: "text-right", render: (m) => m.shelf_life_days ? <span className="tabular-nums">{tr("{0} days", m.shelf_life_days)}</span> : <span className="text-neutral-400">—</span> },
          { label: tr("Status"), render: (m) => <YesNo on={m.is_active} yes={tr("Sold")} no={tr("Not sold")} /> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, section: tr("Menu") },
          { key: "name", label: tr("Name"), required: true, section: tr("Menu") },
          { key: "category", label: tr("Category"), type: "select", required: true, section: tr("Menu"), options: categories.map((c) => ({ value: c, label: c })) },
          { key: "price", label: tr("Price (Rp)"), type: "number", required: true, section: tr("Menu") },
          { key: "bom_code", label: tr("Recipe Card"), type: "search", section: tr("Recipe & production"), hint: tr("Made in Storage & Production → Recipe cards"), options: (boms.rows ?? []).filter((b) => b.kind === "menu").map((b) => ({ value: b.code, label: b.name, hint: b.code })) },
          { key: "shelf_life_days", label: tr("Shelf Life (Days)"), type: "number", section: tr("Recipe & production"), hint: tr("The default expiry of a production batch") },
          { key: "sort", label: tr("Order in the App"), type: "number", section: tr("Driver app") },
          { key: "is_active", label: tr("Sold"), type: "bool", section: tr("Driver app") },
        ]} />}
      {part === "categories" && <MasterTable noun={tr("category")} title={tr("Menu Categories")} master={cats}
        description={tr("The categories the menus are grouped in; a category used by a menu cannot be deleted")}
        blank={(): Partial<Category> => ({ code: "", name: "", sort: (cats.rows?.length ?? 0) + 1, is_active: true })}
        columns={[
          { label: tr("Category"), render: (c) => <><span className="block font-medium text-neutral-900">{c.name}</span><span className="text-[11px] text-neutral-400">{c.code}</span></> },
          { label: tr("Menus"), className: "text-right", render: (c) => <span className="tabular-nums">{(rows ?? []).filter((m) => m.category === c.name).length}</span> },
          { label: tr("Status"), render: (c) => <YesNo on={c.is_active} yes={tr("Active")} no={tr("Inactive")} /> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "KOPI-SUSU" },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. Kopi Susu") },
          { key: "sort", label: tr("Order"), type: "number" },
          { key: "is_active", label: tr("Active"), type: "bool" },
        ]} />}
    </Page>
  );
}

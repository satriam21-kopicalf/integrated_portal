// WIP / premix recipes (kopicalf /api/recipes through /api/so/recipes, D-52).

export type Issue = { level: "error" | "warning"; code: string; message: string; line_no?: number; ratio?: number };
export type RecipeLine = {
  line_no: number; item_id: string | null; item_code: string | null; item_name: string | null; base_uom: string | null;
  component_name: string; qty_base: number | string; is_stock: boolean; notes: string | null;
};
export type Version = {
  id: string; version_no: number; status: "DRAFT" | "ACTIVE" | "RETIRED"; effective_from: string | null;
  output_qty_base: number | string; source: "MANUAL" | "IMPORT"; note: string | null; created_at: string;
  approved_at: string | null; approved_by_name: string | null; lines: RecipeLine[]; issues: Issue[];
};
export type Unit = { uom: string; qty_base: number | string | null; per_batch: number | string | null; grams?: number | null };
export type Recipe = {
  id: string; code: string; name: string; recipe_type: string; output_item_id: string | null; facility_types: string[];
  is_active: boolean; units: Unit[]; active: Version | null; versions: number; drafts: number;
};
export type RecipeDetail = Omit<Recipe, "active" | "versions" | "drafts"> & { versions: Version[] };
export type CalcComponent = { item_id: string | null; item_code: string | null; name: string; is_stock: boolean; qty_base: number; rounded?: number };
export type CalcResult = {
  rows: { recipe_id: string; code: string; name: string; uom: string; qty: number; version_no: number; qty_base: number; components: CalcComponent[] }[];
  totals: (CalcComponent & { rounded: number })[];
};
export type ImportReport = {
  applied: boolean; summary: Record<"NEW" | "CHANGED" | "SAME", number>; only_in_input: string[]; unmapped: string[];
  recipes: { code: string; name: string; status: "NEW" | "CHANGED" | "SAME"; batch: number; units: string[]; components: number;
    unmapped: string[]; notes: string[]; version_no?: number; activated?: boolean }[];
};

export const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? 0 : Number(v));

/** Grams of one unit of a recipe: fixed grams or a share of the batch. */
export function unitGrams(u: Unit, batch: number): number {
  return u.qty_base !== null && u.qty_base !== undefined && u.qty_base !== "" ? num(u.qty_base) : batch / num(u.per_batch);
}

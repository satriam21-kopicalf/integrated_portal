"use client";

// Sales Calculator → Assign Menus: the contents of a bundle (2026-11-17). A bundle whose contents ESB does not hold
// (BUNDLING PROMO GOFOOD 3 ES KOPI …) or holds as a choice gets them here: existing recipe cards x a quantity. Saved as a
// card BND-<menu> of menu lines assigned to the menu, so its materials and HPP follow the cards of its contents.

import { useMemo, useState } from "react";
import { Layers, Plus, Save, Trash2 } from "lucide-react";
import Drawer from "@/so/ui/Drawer";
import { Button, inputClass, useToast } from "@/so/ui";
import { SearchSelect } from "@/cotr/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

type Card = { code: string; name: string; lines?: { type?: string; code: string; qty: number }[] };
type Row = { card: string; qty: string };

export function BundleDrawer({ menu, cards, current, suggested, onClose, onSaved }: {
  menu: { id: string; name: string };
  cards: Card[];
  /** the card the menu uses now (its BND- card: its lines are the contents) */ current?: Card | null;
  /** the contents ESB suggests (its package groups) */ suggested?: { card: string | null; qty: number }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const start = (): Row[] => {
    const own = (current?.lines ?? []).filter((l) => l.type === "menu").map((l) => ({ card: l.code, qty: String(l.qty) }));
    if (own.length) return own;
    const esb = (suggested ?? []).filter((s) => s.card).map((s) => ({ card: s.card!, qty: String(s.qty || 1) }));
    return esb.length ? esb : [{ card: "", qty: "1" }];
  };
  const [rows, setRows] = useState<Row[]>(start);
  const [busy, setBusy] = useState(false);
  // a bundle never holds a bundle card made here (its own BND- card)
  const options = useMemo(() => cards.filter((c) => !c.code.startsWith("BND-")).map((c) => ({ value: c.code, label: c.name, hint: c.code })), [cards]);
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.card && Number(r.qty.replace(",", ".")) > 0);
  const bad = rows.some((r) => r.card && !(Number(r.qty.replace(",", ".")) > 0));

  const save = async (contents: Row[]) => {
    setBusy(true);
    try {
      await call(`/api/cost-control/sales-calc/menus/${encodeURIComponent(menu.id)}/bundle`, { method: "PUT",
        json: { name: menu.name, contents: contents.map((r) => ({ card: r.card, qty: Number(r.qty.replace(",", ".")) })) } });
      toast(contents.length ? tr("Bundle contents saved") : tr("Bundle contents removed"));
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open onClose={onClose} size="md" icon={<Layers size={18} />} title={menu.name}
      description={tr("What one bundle holds: the recipe cards of its menus and how many; materials and HPP follow those cards")} focusFirstField={false}
      footer={<div className="flex w-full flex-wrap items-center justify-end gap-2">
        {current && <Button variant="secondary" className="mr-auto" disabled={busy} onClick={() => void save([])}><Trash2 size={14} />{tr("Remove contents")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!filled.length || bad} onClick={() => void save(filled)}><Save size={14} />{tr("Save")}</Button>
      </div>}>
      <div className="space-y-3">
        {/* one row per menu of the bundle: its recipe card, how many portions (2026-11-17) */}
        {rows.map((r, i) => (
          <div key={i} className="rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-[color:var(--j-626F86)]">{tr("Menu {0}", i + 1)}</span>
              <button type="button" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [{ card: "", qty: "1" }]))}
                aria-label={tr("Delete")} className="rounded-[3px] p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-FFECEB)] hover:text-[color:var(--j-C9372C)]"><Trash2 size={15} /></button>
            </div>
            <SearchSelect value={r.card} options={options} placeholder={tr("Choose the menu's recipe card")} onChange={(v) => set(i, { card: v ?? "" })} ariaLabel={tr("Recipe Card")} />
            <label className="mt-2 flex items-center gap-2 text-xs text-[color:var(--j-626F86)]">
              <span>{tr("Portions")}</span>
              <input value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} inputMode="decimal" aria-label={tr("Portions")}
                className={`${inputClass} w-24 text-right tabular-nums`} />
              <span>{tr("per bundle")}</span>
            </label>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, { card: "", qty: "1" }])}><Plus size={14} />{tr("Add a menu")}</Button>
        <p className="rounded-[3px] bg-[color:var(--j-F7F8F9)] px-3 py-2 text-xs text-[color:var(--j-44546F)]">
          {tr("Example: BUNDLING PROMO GOFOOD 3 ES KOPI CALF PREMIUM = the card of Es Kopi Calf Premium × 3. A bundle with a choice (Chocolate or Es Kopi) takes the usual mix.")}
        </p>
      </div>
    </Drawer>
  );
}

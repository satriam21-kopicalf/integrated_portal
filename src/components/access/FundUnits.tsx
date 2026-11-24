"use client";

// User Accounts → an account → Fund Request units (2026-11-24, backend app/fund_units.py): the units it asks for and
// monitors. None chosen: the units of its places; superadmin and admin every unit. Saved as it is ticked (superadmins).

import { useEffect, useState } from "react";
import { DrawerSection } from "@/components/ui/Drawer";
import { call } from "@/so/features/checkin/checkin";
import { useAuth } from "@/lib/auth";
import { tr } from "@/lib/i18n";

type Unit = { code: string; name: string; payer: string };

export default function FundUnits({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState("");
  const allowed = user?.role === "superadmin";
  useEffect(() => {
    if (!allowed) return;
    let off = false;
    call<{ units: Unit[]; chosen: string[] }>(`/api/pengajuan/user-units/${userId}`)
      .then((r) => { if (!off) { setUnits(r.units); setChosen(r.chosen); } }).catch(() => { if (!off) setUnits([]); });
    return () => { off = true; };
  }, [userId, allowed]);
  if (!allowed || !units?.length) return null;
  const toggle = async (code: string) => {
    const before = chosen;
    const next = before.includes(code) ? before.filter((c) => c !== code) : [...before, code];
    setChosen(next); setError("");
    try { await call(`/api/pengajuan/user-units/${userId}`, { method: "PUT", json: { units: next } }); } catch (e) { setChosen(before); setError((e as Error).message); }
  };
  return (
    <DrawerSection title={tr("Fund Request Units")} description={tr("The units this account asks for and monitors. None chosen: the units of its branches; superadmin and admin every unit. Saved at once.")}>
      <div className="grid gap-2 sm:grid-cols-2">
        {units.map((u) => (
          <label key={u.code} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50">
            <input type="checkbox" className="mt-0.5" checked={chosen.includes(u.code)} onChange={() => void toggle(u.code)} />
            <span className="min-w-0"><span className="block font-medium text-neutral-900">{u.name}</span><span className="block truncate text-[11px] text-neutral-500">{u.payer}</span></span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </DrawerSection>
  );
}

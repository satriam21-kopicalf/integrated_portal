"use client";

// User Accounts → an account → Fund Request units (2026-11-24, backend app/fund_units.py): the units it asks for and
// monitors. None chosen: the units of its places; superadmin and admin every unit. Saved as it is ticked (superadmins).

import { useEffect, useState } from "react";
import { DrawerSection } from "@/components/ui/Drawer";
import { call } from "@/so/features/checkin/checkin";
import { useAuth } from "@/lib/auth";
import { LOGOS } from "@/lib/company";
import { tr } from "@/lib/i18n";

type Unit = { code: string; name: string; payer: string };

export default function FundUnits({ userId }: { userId: string }) {
  const { user } = useAuth();
  const [preset, setPreset] = useState<string[]>([]);  // asked for while none is chosen
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState("");
  const allowed = user?.role === "superadmin";
  useEffect(() => {
    if (!allowed) return;
    let off = false;
    call<{ units: Unit[]; chosen: string[]; default?: string[] }>(`/api/pengajuan/user-units/${userId}`)
      .then((r) => { if (!off) { setUnits(r.units); setChosen(r.chosen); setPreset(r.default ?? []); } }).catch(() => { if (!off) setUnits([]); });
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
          <label key={u.code} className="flex cursor-pointer items-center gap-2.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 py-2 text-sm hover:bg-[color:var(--j-F7F8F9)]">
            <input type="checkbox" checked={chosen.includes(u.code)} onChange={() => void toggle(u.code)} />
            <span className="flex h-8 w-14 flex-shrink-0 items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {LOGOS[u.code] && <img src={LOGOS[u.code]} alt="" aria-hidden className="max-h-8 max-w-full object-contain" />}</span>
            <span className="min-w-0"><span className="block font-medium text-[color:var(--j-172B4D)]">{u.name}{chosen.length === 0 && preset.includes(u.code) && <span className="ml-1.5 rounded bg-[color:var(--j-E9F2FF)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--j-0C66E4)]" title={tr("The default of this account")}>{tr("Default")}</span>}</span><span className="block truncate text-[11px] text-[color:var(--j-626F86)]">{u.payer}</span></span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-xs text-[color:var(--j-C9372C)]">{error}</p>}
    </DrawerSection>
  );
}

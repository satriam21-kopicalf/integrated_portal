"use client";

// Stock-opname rights of the signed-in portal user, for menus and buttons only: kopicalf decides for real
// (warehouse-backend /portal grants role "user" OUTLET_CREW on its branches, cost_control and superadmin more).

import { useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";

const CREW = ["inventory.count.read", "inventory.count.create", "inventory.count.submit", "master.item.read"];

export type Me = { id: string; username: string; full_name: string; permissions: string[] };

export function useMe() {
  const { user, status } = useAuth();
  const me = useMemo<Me | null>(() => user ? {
    id: user.id, username: user.username, full_name: user.displayName,
    permissions: user.role === "user" ? CREW : ["*"],
  } : null, [user]);
  const can = useCallback(
    (permission: string) => !!me && (me.permissions.includes("*") || me.permissions.includes(permission)),
    [me],
  );
  return { me, loading: status === "loading", can, reload: async () => {} };
}

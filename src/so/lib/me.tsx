"use client";

// Stock-opname rights of the signed-in portal user, for menus and buttons only, from the pages the user opens:
// the portal gateway checks the page of every API path and kopicalf decides for real.

import { useCallback, useMemo } from "react";
import { AuthUser, hasPage, useAuth } from "@/lib/auth";
import { PageKey } from "@/lib/pages";

const CREW = ["inventory.count.read", "inventory.count.create", "inventory.count.submit", "master.item.read"];
// Cost Control pages → kopicalf permissions the screens check (the portal gateway allows the matching API paths)
const BY_PAGE: [PageKey, string[]][] = [
  ["cc.monitor", ["inventory.count.read"]],
  ["cc.reviews", ["inventory.count.read", "inventory.count.review"]],
  ["cc.esb-export", ["inventory.count.read", "inventory.count.export"]],
  ["cc.esb-compare", ["inventory.count.read", "inventory.count.export"]],
  ["cc.lists", ["inventory.count.settings", "master.item.read"]],
  ["cc.groups", ["inventory.count.settings", "master.item.read"]],
  ["cc.types", ["inventory.count.settings"]],
  ["cc.premix", ["recipe.wip.read", "recipe.wip.manage", "master.item.read"]],
];

function permissionsOf(user: AuthUser): string[] {
  if (user.role === "superadmin") return ["*"];
  const out = new Set<string>(hasPage(user, "stock-opname") ? CREW : []);
  for (const [page, perms] of BY_PAGE) if (hasPage(user, page)) perms.forEach((x) => out.add(x));
  return [...out];
}

export type Me = { id: string; username: string; full_name: string; permissions: string[] };

export function useMe() {
  const { user, status } = useAuth();
  const me = useMemo<Me | null>(() => user ? {
    id: user.id, username: user.username, full_name: user.displayName,
    permissions: permissionsOf(user),
  } : null, [user]);
  const can = useCallback(
    (permission: string) => !!me && (me.permissions.includes("*") || me.permissions.includes(permission)),
    [me],
  );
  return { me, loading: status === "loading", can, reload: async () => {} };
}

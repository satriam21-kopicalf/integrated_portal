"use client";

// The notifications of the portal (2026-11-13): Cost Control is told about the goods receipts and ESB documents that
// need a look — a quantity far from usual, a GR far below its PO — and the daily summaries (GRs still New, corrected
// GRs not finished, the GRs of yesterday). Shown to the accounts that open Good Receipt or COGS & Usage, from the user
// menu (the profile at the foot of the sidebar; on phones the avatar of the app bar shows the unread count).

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Drawer from "@/so/ui/Drawer";
import { cx, Empty } from "@/so/ui";
import { hasPage, useAuth } from "@/lib/auth";
import { type Alert, markAlertsRead, useAlerts } from "@/lib/alerts";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

const DOT = { high: "bg-red-500", warn: "bg-amber-500", info: "bg-brand-500" } as const;

/** The notifications of the signed-in user: {enabled, unread, data}. */
export function useNotifications() {
  const { user } = useAuth();
  const enabled = (["cc.goods-receipt", "cc.cogs", "cc.info", "cc.purchase-plan", "cc.ratio", "cc.sales-calc", "cc.reviews", "cc.waste-review"] as const).some((p) => hasPage(user, p));
  return { enabled, ...useAlerts(enabled) };
}

/** The unread count as a small red badge (99+). */
export function UnreadBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span className={cx("flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function NotificationsDrawer({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate?: () => void }) {
  const { unread, data } = useNotifications();
  const router = useRouter();
  const go = (a: Alert) => {
    if (!a.read) void markAlertsRead([a.id]);
    onClose();
    if (a.link) { onNavigate?.(); router.push(a.link); }
  };
  return (
    <Drawer open={open} onClose={onClose} size="sm" icon={<Bell size={18} />} title={tr("Notifications")}
      description={tr("Goods receipts and ESB documents that need a look, and the daily summaries")}
      footer={unread > 0 ? (
        <button type="button" onClick={() => void markAlertsRead("all")} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          <CheckCheck size={15} />{tr("Mark all as read")}
        </button>
      ) : undefined}>
      {data.length === 0 ? <Empty icon={<Bell size={24} />} title={tr("No notification yet")} /> : (
        <ul className="-mx-1 space-y-1">
          {data.map((a) => (
            <li key={a.id}>
              <button type="button" onClick={() => go(a)}
                className={cx("flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-neutral-100", !a.read && "bg-brand-50/50")}>
                <span className={cx("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", a.read ? "bg-neutral-300" : DOT[a.severity])} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-sm", a.read ? "text-neutral-700" : "font-semibold text-neutral-900")}>{a.title}</span>
                  {a.body && <span className="mt-0.5 block text-xs text-neutral-500">{a.body}</span>}
                  <span className="mt-1 block text-[11px] text-neutral-400">{wibDateTime(a.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

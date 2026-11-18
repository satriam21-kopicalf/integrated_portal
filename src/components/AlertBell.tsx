"use client";

// The notifications of the portal (2026-11-13): Cost Control is told about the goods receipts and ESB documents that
// need a look — a quantity far from usual, a GR far below its PO — and the daily summaries (GRs still New, corrected
// GRs not finished, the GRs of yesterday). Shown to the accounts that open Good Receipt or COGS & Usage, from the user
// menu (the profile at the foot of the sidebar; on phones the avatar of the app bar shows the unread count).

import { AlertOctagon, AlertTriangle, Bell, CheckCheck, Info } from "lucide-react";
import { useState } from "react";
import { Tabs } from "@/components/kc";
import { useRouter } from "next/navigation";
import Drawer from "@/so/ui/Drawer";
import { cx, Empty } from "@/so/ui";
import { hasPage, useAuth } from "@/lib/auth";
import { type Alert, markAlertsRead, useAlerts } from "@/lib/alerts";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";


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

const SEVERITY = {
  high: { icon: AlertOctagon, chip: "bg-red-50 text-red-700" },
  warn: { icon: AlertTriangle, chip: "bg-amber-50 text-amber-700" },
  info: { icon: Info, chip: "bg-brand-50 text-brand-700" },
} as const;

/** "5 min ago", "3 h ago", else the WIB date and time. */
function when(at: string): string {
  const min = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  if (min < 1) return tr("just now");
  if (min < 60) return tr("{0} min ago", min);
  if (min < 24 * 60) return tr("{0} h ago", Math.floor(min / 60));
  return wibDateTime(at);
}

/** Today / Yesterday / Earlier, by the WIB day of the notification. */
function dayGroup(at: string): "today" | "yesterday" | "earlier" {
  const wib = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const day = wib(new Date(at));
  const today = wib(new Date());
  if (day === today) return "today";
  return day === wib(new Date(Date.now() - 864e5)) ? "yesterday" : "earlier";
}
const GROUP_LABEL = { get today() { return tr("Today"); }, get yesterday() { return tr("Yesterday"); }, get earlier() { return tr("Earlier"); } };

/** 2026-11-16, the kopicalf-hrms look: All / Unread tabs with counts, grouped by day, a severity icon chip per item,
 *  the time as "5 min ago". Opening an item marks it read and goes to its page. */
export function NotificationsDrawer({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate?: () => void }) {
  const { unread, data } = useNotifications();
  const router = useRouter();
  const [view, setView] = useState<"all" | "unread">("all");
  const go = (a: Alert) => {
    if (!a.read) void markAlertsRead([a.id]);
    onClose();
    if (a.link) { onNavigate?.(); router.push(a.link); }
  };
  const shown = view === "unread" ? data.filter((a) => !a.read) : data;
  const groups = (["today", "yesterday", "earlier"] as const).map((g) => ({ g, items: shown.filter((a) => dayGroup(a.at) === g) })).filter((x) => x.items.length);
  return (
    <Drawer open={open} onClose={onClose} size="sm" icon={<Bell size={18} />} title={tr("Notifications")}
      description={tr("Goods receipts and ESB documents that need a look, and the daily summaries")}
      footer={unread > 0 ? (
        <button type="button" onClick={() => void markAlertsRead("all")} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
          <CheckCheck size={15} />{tr("Mark all as read")}
        </button>
      ) : undefined}>
      <Tabs label={tr("Notifications")} value={view} onChange={(k) => setView(k as "all" | "unread")} className="mb-4"
        tabs={[{ key: "all", label: tr("All"), count: data.length }, { key: "unread", label: tr("Unread"), count: unread }]} />
      {shown.length === 0 ? (
        <Empty icon={<Bell size={24} />} title={view === "unread" && data.length ? tr("Everything is read") : tr("No notification yet")} />
      ) : (
        <div className="space-y-5">
          {groups.map(({ g, items }) => (
            <section key={g}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{GROUP_LABEL[g]}</p>
              <ul className="-mx-5 divide-y divide-neutral-100 border-y border-neutral-100 sm:-mx-6">
                {items.map((a) => {
                  const S = SEVERITY[a.severity] ?? SEVERITY.info;
                  return (
                    <li key={a.id}>
                      <button type="button" onClick={() => go(a)}
                        className={cx("group relative flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50 sm:px-6",
                          !a.read && "bg-brand-50/50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand-700")}>
                        <span className={cx("mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[4px]", a.read ? "bg-neutral-100 text-neutral-400" : S.chip)}>
                          <S.icon size={13} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={cx("min-w-0 text-sm leading-snug", a.read ? "font-medium text-neutral-700" : "font-semibold text-neutral-900")}>{a.title}</span>
                            {!a.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-600" aria-label={tr("Unread")} />}
                          </span>
                          {a.body && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{a.body}</span>}
                          <span className="mt-1.5 block text-[11px] text-neutral-400" title={wibDateTime(a.at)}>{when(a.at)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

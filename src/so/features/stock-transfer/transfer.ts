// Transfer Stock (TITO, integrated_portal_be app/stock_transfer.py, migration 075): the types of its endpoints and the
// labels of its steps. Shared by Form Transfer Stock (portal and Operations) and Monitoring Stock (portal).

import { tr } from "@/lib/i18n";

export type Status = "submitted" | "accepted" | "declined" | "approved" | "rejected" | "received" | "cancelled";
export type Step = { note: string | null; by: string | null; at: string | null };
export type Transfer = {
  id: string; number: string; status: Status; toBranch: string; toName: string; fromBranch: string; fromName: string;
  note: string | null; lines: number; requested: { by: string; at: string }; source: Step | null; costControl: Step | null;
  received: Step | null; value: number | null; estimate?: number;
  esbLabel: { value: "esb" | "portal"; note: string | null; by: string | null; at: string | null } | null;
  /** qty: approved by Cost Control (what moves); requested: what the outlet asked (migration 076) */
  items?: { code: string; name: string; unit: string; qty: number; requested: number; available: number | null; price: number | null; value: number | null }[];
  canDecide?: boolean;
  /** the ESB GR entered when receiving (migration 079), matched with the GR synced from ESB */
  grNumber?: string | null;
  gr?: { number: string; status: "waiting" | "matched" | "mismatch" | "otherBranch"; date?: string | null; branch?: string;
    diffs?: { code: string; name: string; transfer: number | null; gr: number | null }[] };
};
export type FormData = { branches: { code: string; name: string }[]; sources: { code: string; name: string }[];
  requests: Transfer[]; incoming: Transfer[]; todo: { answer: number; receive: number } };
export type Available = { so: { date: string; refs: string[] } | null; items: { code: string; name: string; category: string; unit: string; available: number }[] };

export const STATUS: Record<Status, { label: () => string; tone: "amber" | "blue" | "green" | "red" | "slate" | "violet" }> = {
  submitted: { label: () => tr("Waiting for the outlet"), tone: "amber" },
  accepted: { label: () => tr("Waiting for Cost Control"), tone: "blue" },
  declined: { label: () => tr("Declined by the outlet"), tone: "red" },
  approved: { label: () => tr("Approved · to receive"), tone: "violet" },
  rejected: { label: () => tr("Rejected by Cost Control"), tone: "red" },
  received: { label: () => tr("Received"), tone: "green" },
  cancelled: { label: () => tr("Cancelled"), tone: "slate" },
};
export const ESB_LABEL: Record<"esb" | "portal", () => string> = { esb: () => tr("To ESB"), portal: () => tr("Portal only") };

export const fileUrl = (id: string, kind: "photo" | "signature" | "receive") => `/api/stock-transfer/${id}/file/${kind}`;
export const qtyText = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: 3 }));
export const rpText = (n: number | null | undefined) => (n == null ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
export const shortBranch = (n: string) => n.replace(/^Kopi Calf (To Go )?/, "");

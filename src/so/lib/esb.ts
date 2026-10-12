// Status of an exported count against ESB (06.9 §7).

import { tr } from "@/lib/i18n";

export const COMPARE: Record<string, { tone: "green" | "red" | "amber" | "slate"; label: () => string }> = {
  MATCHED_ESB: { tone: "green", label: () => tr("Matches ESB") },
  ESB_MISMATCH: { tone: "red", label: () => tr("Differs from ESB") },
  WAITING_FOR_ESB: { tone: "amber", label: () => tr("Waiting for ESB") },
  NO_ESB_BRANCH: { tone: "slate", label: () => tr("No ESB branch") },
};

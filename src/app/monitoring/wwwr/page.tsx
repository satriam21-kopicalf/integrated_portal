"use client";

// Monitoring → Monitoring WW-WR (page mon.wwwr): the SWAT audits, their analysis, the comparison with the PIC and the
// schedule; see so/features/visit/VisitMonitor and WwwrMonitor.

import VisitMonitor from "@/so/features/visit/VisitMonitor";

export default function Page() {
  return <VisitMonitor form="wwwr" />;
}

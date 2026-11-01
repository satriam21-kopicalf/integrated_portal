"use client";

// Cost Control → Cost Control Check In (page mon.surveyor-check-in; moved from Monitoring 2026-11-01): the visits of
// the Cost Control surveyors (src/so/features/checkin/CheckInMonitor.tsx).

import CheckInMonitor from "@/so/features/checkin/CheckInMonitor";

export default function CostControlCheckInMonitorPage() {
  return <CheckInMonitor kind="surveyor" />;
}

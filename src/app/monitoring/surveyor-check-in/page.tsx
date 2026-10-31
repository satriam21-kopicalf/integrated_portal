"use client";

// Monitoring → Surveyor Check In (page mon.surveyor-check-in, 2026-10-31): the visits of the Cost Control surveyors
// (src/so/features/checkin/CheckInMonitor.tsx).

import CheckInMonitor from "@/so/features/checkin/CheckInMonitor";

export default function SurveyorCheckInMonitorPage() {
  return <CheckInMonitor kind="surveyor" />;
}

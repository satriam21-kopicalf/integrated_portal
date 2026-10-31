"use client";

// Monitoring → PIC Check In (page mon.pic-check-in): shared with Surveyor Check In (src/so/features/checkin/CheckInMonitor.tsx).

import CheckInMonitor from "@/so/features/checkin/CheckInMonitor";

export default function PicCheckInMonitorPage() {
  return <CheckInMonitor kind="pic" />;
}

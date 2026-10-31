"use client";

// Surveyor Check In (Form, page form.surveyor-check-in, 2026-10-31): the Cost Control surveyors check in at the outlet
// they visit, like the PICs (src/so/features/checkin/CheckInForm.tsx); every Kopi Calf branch is open to them.

import CheckInForm from "@/so/features/checkin/CheckInForm";

export default function SurveyorCheckInPage() {
  return <CheckInForm kind="surveyor" />;
}

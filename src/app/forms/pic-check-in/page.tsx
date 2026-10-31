"use client";

// PIC Check In (Form → Visit, page form.pic-check-in): the screen is shared with the Surveyor Check In
// (src/so/features/checkin/CheckInForm.tsx).

import CheckInForm from "@/so/features/checkin/CheckInForm";

export default function PicCheckInPage() {
  return <CheckInForm kind="pic" />;
}

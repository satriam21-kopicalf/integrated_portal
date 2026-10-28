"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import TodayView from "@/so/features/count/TodayView";
import { branchScoped, useAuth } from "@/lib/auth";

/** Staff (role user) land on today's counts of their branches; Cost Control and superadmins on the monitor. */
export default function StockOpnamePage() {
  const { user } = useAuth();
  const router = useRouter();
  const crew = !!user && branchScoped(user.role);
  useEffect(() => {
    if (user && !crew) router.replace("/cost-control/monitor");
  }, [user, crew, router]);
  return crew ? <TodayView /> : null;
}

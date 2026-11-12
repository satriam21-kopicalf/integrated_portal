import DashboardLayout from "@/components/layout/DashboardLayout";
import { CotrTheme } from "@/cotr/theme";

/** Monitoring COTR screens (Calf On The Road) inside the portal shell, in the colours of COTR (2026-11-13: src/cotr/theme). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout><CotrTheme>{children}</CotrTheme></DashboardLayout>;
}

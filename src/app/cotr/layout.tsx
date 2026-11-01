import DashboardLayout from "@/components/layout/DashboardLayout";

/** Monitoring COTR screens (Calf On The Road prototype) inside the portal shell. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

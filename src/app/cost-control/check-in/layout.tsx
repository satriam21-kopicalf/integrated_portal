import DashboardLayout from "@/components/layout/DashboardLayout";

/** Cost Control Check In monitoring inside the portal shell. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

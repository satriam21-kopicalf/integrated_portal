import DashboardLayout from "@/components/layout/DashboardLayout";

/** Monitoring screens inside the portal shell. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

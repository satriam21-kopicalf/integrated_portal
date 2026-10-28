import DashboardLayout from "@/components/layout/DashboardLayout";

/** Aggregator screens inside the portal shell. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

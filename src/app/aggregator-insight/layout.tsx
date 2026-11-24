import DashboardLayout from "@/components/layout/DashboardLayout";

/** Aggregator Insight screens inside the portal shell: the sidebar, the top bar and the phone tab bar (2026-11-25). */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

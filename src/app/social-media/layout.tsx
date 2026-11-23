import DashboardLayout from "@/components/layout/DashboardLayout";

/** Social Media screens (Overview, Social Media Analytics) inside the portal shell: the sidebar and the top bar. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

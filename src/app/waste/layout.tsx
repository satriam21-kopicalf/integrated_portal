import DashboardLayout from "@/components/layout/DashboardLayout";

/** Waste screens (outlet input) inside the portal shell, like Stock Opname. */
export default function WasteLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

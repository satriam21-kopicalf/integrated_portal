import DashboardLayout from "@/components/layout/DashboardLayout";

/** Stock opname screens (kopicalf stock-count API through /api/so, D-51) inside the portal shell. */
export default function StockOpnameLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

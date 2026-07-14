import Dashboard from "./Dashboard";
import dashboardData from "../data/dashboard-summary.json";
import type { DashboardResponse } from "./lib/types";

export default function PlatformPage() {
  return <Dashboard initialData={dashboardData as DashboardResponse} />;
}

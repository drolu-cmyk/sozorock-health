import { NextResponse } from "next/server";
import dashboardData from "../../../data/dashboard-summary.json";
import type { DashboardResponse } from "../../lib/types";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    dashboardData as DashboardResponse,
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}

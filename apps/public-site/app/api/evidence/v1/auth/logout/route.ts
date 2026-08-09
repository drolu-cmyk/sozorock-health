import { NextRequest, NextResponse } from "next/server";
import { EXPLORE_AUTH_COOKIE } from "../../../../../lib/explore-workspace-auth";

export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/explore/workspaces", request.url), 303);
  response.cookies.delete(EXPLORE_AUTH_COOKIE);
  return response;
}

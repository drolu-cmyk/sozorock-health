import {NextResponse, type NextRequest} from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const isSpanish = request.nextUrl.pathname === "/es" || request.nextUrl.pathname.startsWith("/es/");
  requestHeaders.set("x-sozorock-language", isSpanish ? "es" : "en");
  const response = NextResponse.next({request: {headers: requestHeaders}});
  if (request.nextUrl.hostname.endsWith(".amplifyapp.com")
    || process.env.RUNTIME_ENV === "staging"
    || process.env.PLACE_AGENT_RATE_LIMIT_NAMESPACE === "staging") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|media/|brand/|social/).*)"],
};

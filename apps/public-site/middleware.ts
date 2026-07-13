import {NextResponse, type NextRequest} from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const isSpanish = request.nextUrl.pathname === "/es" || request.nextUrl.pathname.startsWith("/es/");
  requestHeaders.set("x-sozorock-language", isSpanish ? "es" : "en");
  return NextResponse.next({request: {headers: requestHeaders}});
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|apple-icon.png|media/|brand/|social/).*)"],
};

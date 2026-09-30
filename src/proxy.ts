import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate for signed-in areas: without a session cookie there is no
 * point rendering the app, so redirect to sign-in straight away. This is a UX
 * shortcut only — every API request is authenticated and authorized server-side.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("sb_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
};

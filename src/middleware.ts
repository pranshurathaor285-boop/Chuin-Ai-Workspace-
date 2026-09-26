import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isProtectedRoute =
    pathname.startsWith("/chat") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/projects");

  if (!isAuthPage && !isProtectedRoute) return NextResponse.next();
  if (!token) {
    return isProtectedRoute
      ? NextResponse.redirect(new URL("/sign-in", req.url))
      : NextResponse.next();
  }

  let validation: Response;
  try {
    validation = await fetch(new URL("/api/auth/validate-session", req.url), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Session validation request failed:", error);
    return new NextResponse("Session validation is temporarily unavailable.", {
      status: 503,
    });
  }

  if (validation.status === 200) {
    return isAuthPage
      ? NextResponse.redirect(new URL("/chat/new", req.url))
      : NextResponse.next();
  }

  if (validation.status !== 401) {
    console.error("Session validation returned an unexpected status:", validation.status);
    return new NextResponse("Session validation is temporarily unavailable.", {
      status: 503,
    });
  }

  const response = isProtectedRoute
    ? NextResponse.redirect(new URL("/sign-in", req.url))
    : NextResponse.next();
  for (const cookieName of [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ]) {
    response.cookies.set(cookieName, "", {
      expires: new Date(0),
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/chat/:path*",
    "/settings/:path*",
    "/projects/:path*",
    "/sign-in",
    "/sign-up",
  ],
};

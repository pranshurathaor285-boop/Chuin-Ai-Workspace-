import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  const isAuthPage =
    pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const isProtectedRoute =
    pathname.startsWith("/chat") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/projects");

  // 1. Logged-in user visiting auth pages → redirect to chat
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/chat/new", req.url));
  }

  // 2. Not logged-in user visiting protected routes → redirect to sign-in
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  return NextResponse.next();
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

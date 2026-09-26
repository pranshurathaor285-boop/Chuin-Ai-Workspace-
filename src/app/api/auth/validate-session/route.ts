import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  const userId = token?.id ?? token?.sub;

  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user
      ? NextResponse.json({ valid: true })
      : NextResponse.json({ valid: false }, { status: 401 });
  } catch (error) {
    console.error("Failed to validate session user:", error);
    return NextResponse.json(
      { error: "Session validation failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { readProjectFile, listProjectFiles } from "@/lib/project/filesystem";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // If path is provided, return single file
    if (path) {
      const file = await readProjectFile(id, path);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    // Otherwise, list all files
    const files = await listProjectFiles(id);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Files API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

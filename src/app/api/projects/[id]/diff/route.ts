import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { getCheckpointDiff } from "@/lib/project/diff";

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
    const checkpointId = searchParams.get("checkpoint");

    if (!checkpointId) {
      return NextResponse.json(
        { error: "checkpoint query param required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify checkpoint belongs to project
    const checkpoint = await prisma.projectCheckpoint.findFirst({
      where: { id: checkpointId, projectId: id },
    });
    if (!checkpoint) {
      return NextResponse.json(
        { error: "Checkpoint not found" },
        { status: 404 }
      );
    }

    const diffs = await getCheckpointDiff(checkpointId);

    return NextResponse.json({
      checkpointId,
      checkpointName: checkpoint.name,
      diffs,
      totalFiles: diffs.length,
      totalAdditions: diffs.reduce((s, d) => s + d.additions, 0),
      totalDeletions: diffs.reduce((s, d) => s + d.deletions, 0),
    });
  } catch (error) {
    console.error("Diff error:", error);
    return NextResponse.json(
      { error: "Failed to compute diff" },
      { status: 500 }
    );
  }
}

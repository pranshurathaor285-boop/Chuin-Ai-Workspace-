import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/prisma";
import { listCheckpoints, createCheckpoint, restoreCheckpoint } from "@/lib/project/filesystem";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const checkpoints = await listCheckpoints(id);
    return NextResponse.json({ checkpoints });
  } catch (error) {
    console.error("List checkpoints error:", error);
    return NextResponse.json(
      { error: "Failed to list checkpoints" },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name required" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const checkpoint = await createCheckpoint(id, name, undefined);
    return NextResponse.json({ checkpoint });
  } catch (error) {
    console.error("Create checkpoint error:", error);
    return NextResponse.json(
      { error: "Failed to create checkpoint" },
      { status: 500 }
    );
  }
}

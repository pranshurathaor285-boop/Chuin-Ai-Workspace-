import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { runAgent } from "@/lib/agent/orchestrator";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { goal, conversationId, model } = body;

    if (!goal || typeof goal !== "string" || !goal.trim()) {
      return NextResponse.json(
        { error: "Goal is required" },
        { status: 400 }
      );
    }

    const result = await runAgent({
      userId,
      goal: goal.trim(),
      conversationId,
      model,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Agent run error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Agent failed",
      },
      { status: 500 }
    );
  }
}

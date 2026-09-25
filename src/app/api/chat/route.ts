import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, tool as aiTool } from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { toolRegistry } from "@/lib/agent/tools/registry";
import { executeTool } from "@/lib/agent/tools/executor";
import type { ToolContext } from "@/lib/agent/tools/types";
import { CHAT_SYSTEM_PROMPT } from "@/lib/agent/prompts";

export const maxDuration = 60;

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

// Fast + reliable default — tested to be ~1.5s response
const DEFAULT_MODEL = "openrouter/free";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages, model, projectId } = body;

    const modelId = model || DEFAULT_MODEL;

    // Clean messages
    const cleanMessages = (messages || [])
      .map((m: any) => ({
        role: m.role,
        content:
          typeof m.content === "string" && m.content.length > 0
            ? m.content
            : (m.parts || [])
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join(""),
      }))
      .filter((m: any) => m.content && m.content.length > 0);

    if (cleanMessages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build tool context
    const toolContext: ToolContext = {
      userId,
      workspaceRoot: `/tmp/chuin-workspace/${userId}`,
      projectId: projectId || undefined,
    };

    // Convert registry tools to AI SDK tools
    const aiTools: Record<string, any> = {};
    for (const toolDef of toolRegistry.getForAgent("general")) {
      const toolName = toolDef.name;
      const safeName = toolName.replace(/\./g, "_");

      aiTools[safeName] = aiTool({
        description: toolDef.description,
        parameters: toolDef.inputSchema,
        execute: async (toolInput: any) => {
          console.log(`[Chat Tool] ${toolName}`, toolInput);
          const result = await executeTool(toolName, toolInput, toolContext);
          console.log(`[Chat Tool Result]`, result);
          if (!result.success) {
            throw new Error(result.error || "Tool failed");
          }
          return result.output;
        },
      });
    }

    const result = streamText({
      model: openrouter(modelId),
      system: CHAT_SYSTEM_PROMPT,
      messages: cleanMessages,
      tools: aiTools,
      maxSteps: 5,
    });

    return result.toDataStreamResponse({
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("CHAT ERROR:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

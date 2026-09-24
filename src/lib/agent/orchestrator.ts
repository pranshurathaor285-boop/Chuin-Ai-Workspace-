import { streamText, tool as aiTool } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { prisma } from "@/lib/prisma";
import { toolRegistry } from "./tools/registry";
import { executeTool } from "./tools/executor";
import type { ToolContext } from "./tools/types";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

const DEFAULT_MODEL = "openrouter/free";

export interface RunAgentInput {
  userId: string;
  goal: string;
  conversationId?: string;
  model?: string;
}

export interface RunAgentResult {
  taskId: string;
  success: boolean;
  finalAnswer: string;
  toolCalls: Array<{
    toolName: string;
    input: any;
    success: boolean;
    error?: string;
  }>;
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { userId, goal, conversationId, model } = input;

  // 1. Create AgentTask in DB
  const task = await prisma.agentTask.create({
    data: {
      userId,
      conversationId: conversationId || null,
      goal,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  // 2. Create AgentRun
  const run = await prisma.agentRun.create({
    data: {
      taskId: task.id,
      agentType: "general",
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  // 3. Prepare tool context
  const context: ToolContext = {
    userId,
    taskId: task.id,
    runId: run.id,
    workspaceRoot: `/tmp/chuin-workspace/${userId}`,
  };

  // 4. Convert registry tools to AI SDK tools
  const aiTools: Record<string, any> = {};
  for (const toolDef of toolRegistry.getForAgent("general")) {
    const toolName = toolDef.name;
    const safeName = toolName.replace(/\./g, "_");

    aiTools[safeName] = aiTool({
      description: toolDef.description,
      parameters: toolDef.inputSchema,
      execute: async (toolInput: any) => {
        console.log(`[Agent] Tool call: ${toolName}`, toolInput);
        const result = await executeTool(toolName, toolInput, context);
        console.log(`[Agent] Tool result:`, result);
        if (!result.success) {
          throw new Error(result.error || "Tool failed");
        }
        return result.output;
      },
    });
  }

  // 5. Run the LLM with tools
  const toolCalls: RunAgentResult["toolCalls"] = [];
  let finalAnswer = "";
  const MAX_STEPS = 5;

  try {
    const result = streamText({
      model: openrouter(model || DEFAULT_MODEL),
      system: `You are Chuin AI, an AI software engineer.

You have access to tools:
- filesystem_read: Read file contents from the workspace
- filesystem_write: Write/create files in the workspace
- filesystem_list: List files and folders in the workspace

When the user asks you to create, read, or modify files, USE THE TOOLS.
Do not describe what you would do — actually do it by calling the tools.
After using tools, summarize what you did for the user.`,
      messages: [{ role: "user", content: goal }],
      tools: aiTools,
      maxSteps: MAX_STEPS,
      onStepFinish: async (step: any) => {
        try {
          const stepRecord = await prisma.agentStep.create({
            data: {
              runId: run.id,
              stepNumber: step.stepNumber || 0,
              type:
                step.toolCalls && step.toolCalls.length > 0
                  ? "TOOL_CALL"
                  : "FINAL_ANSWER",
              description: step.text || "Step executed",
              status: "COMPLETED",
              output: step as any,
              completedAt: new Date(),
            },
          });

          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              toolCalls.push({
                toolName: tc.toolName,
                input: tc.args,
                success: true,
              });

              await prisma.toolCall.create({
                data: {
                  stepId: stepRecord.id,
                  toolName: tc.toolName,
                  input: (tc.args || {}) as any,
                  status: "SUCCESS",
                  completedAt: new Date(),
                },
              });
            }
          }
        } catch (err) {
          console.error("Failed to record step:", err);
        }
      },
    });

    for await (const chunk of result.textStream) {
      finalAnswer += chunk;
    }
  } catch (error) {
    console.error("Agent run error:", error);

    await prisma.agentTask.update({
      where: { id: task.id },
      data: { status: "FAILED", completedAt: new Date() },
    });

    await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "FAILED", completedAt: new Date() },
    });

    return {
      taskId: task.id,
      success: false,
      finalAnswer: error instanceof Error ? error.message : "Unknown error",
      toolCalls,
    };
  }

  await prisma.agentTask.update({
    where: { id: task.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await prisma.agentRun.update({
    where: { id: run.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  return {
    taskId: task.id,
    success: true,
    finalAnswer,
    toolCalls,
  };
}

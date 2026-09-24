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
    output?: any;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Run an agent task — creates a task in DB, gives tools to LLM,
 * executes tool calls, and loops until the LLM produces a final answer.
 */
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
    aiTools[toolName.replace(/\./g, "_")] = aiTool({
      description: toolDef.description,
      parameters: toolDef.inputSchema,
      execute: async (input: any) => {
        console.log(`[Agent] Tool call: ${toolName}`, input);
        const result = await executeTool(toolName, input, context);
        console.log(`[Agent] Tool result:`, result);
        if (!result.success) {
          throw new Error(result.error || "Tool failed");
        }
        return result.output;
      },
    });
  }

  // 5. Run the LLM with tools (max 5 steps to prevent loops)
  const toolCalls: RunAgentResult["toolCalls"] = [];
  let finalAnswer = "";
  const MAX_STEPS = 5;

  try {
    const result = streamText({
      model: openrouter(model || DEFAULT_MODEL),
      system: `You are Chuin AI, an AI software engineer.

You have access to tools that let you:
- Read files (filesystem.read)
- Write files (filesystem.write)
- List files (filesystem.list)

When the user asks you to create, read, or modify files, USE THE TOOLS.
Do not just describe what you would do — actually do it by calling the tools.
After using tools, summarize what you did for the user.`,
      messages: [{ role: "user", content: goal }],
      tools: aiTools,
      maxSteps: MAX_STEPS,
      onStepFinish: async (step: any) => {
        // Record each step in DB
        try {
          const stepRecord = await prisma.agentStep.create({
            data: {
              runId: run.id,
              stepNumber: step.stepNumber || 0,
              type: step.toolCalls && step.toolCalls.length > 0 ? "TOOL_CALL" : "FINAL_ANSWER",
              description: step.text || "Step executed",
              status: "COMPLETED",
              output: step as any,
              completedAt: new Date(),
            },
          });

          // Record tool calls
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              toolCalls.push({
                toolName: tc.toolName,
                input: tc.args,
                output: undefined,
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

    // Collect the final text
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

  // 6. Mark task as completed
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

import { z } from "zod";
import {
  createCheckpoint,
  listCheckpoints,
  restoreCheckpoint,
} from "@/lib/project/filesystem";
import type { ToolDefinition, ToolContext } from "./types";

function requireProjectId(context: ToolContext): string {
  if (!context.projectId) {
    throw new Error("This tool requires an active project.");
  }
  return context.projectId;
}

const CreateCPInput = z.object({
  name: z.string().describe("Name of the checkpoint"),
  description: z
    .string()
    .optional()
    .describe("Optional description of what this checkpoint represents"),
});

export const projectCheckpointCreateTool: ToolDefinition = {
  name: "project.checkpoint.create",
  description:
    "Create a checkpoint of the current project state. Use this before making risky or multi-file changes so the user can restore if needed.",
  inputSchema: CreateCPInput,
  outputSchema: z.object({
    checkpointId: z.string(),
    name: z.string(),
    fileCount: z.number(),
  }),
  permissionLevel: "WRITE",
  timeout: 15000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const projectId = requireProjectId(context);
    const cp = await createCheckpoint(projectId, input.name, context.taskId);
    return {
      checkpointId: cp.id,
      name: cp.name,
      fileCount: cp.fileCount,
    };
  },
};

export const projectCheckpointListTool: ToolDefinition = {
  name: "project.checkpoint.list",
  description:
    "List all checkpoints for the current project, ordered by most recent first.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    checkpoints: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        fileCount: z.number(),
        createdAt: z.string(),
      })
    ),
    total: z.number(),
  }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(_input: any, context: ToolContext) {
    const projectId = requireProjectId(context);
    const checkpoints = await listCheckpoints(projectId);
    return {
      checkpoints: checkpoints.map((c) => ({
        id: c.id,
        name: c.name,
        fileCount: c.fileCount,
        createdAt: c.createdAt.toISOString(),
      })),
      total: checkpoints.length,
    };
  },
};

const RestoreCPInput = z.object({
  checkpointId: z.string().describe("ID of the checkpoint to restore"),
});

export const projectCheckpointRestoreTool: ToolDefinition = {
  name: "project.checkpoint.restore",
  description:
    "Restore the project to a checkpoint. This will OVERWRITE all files. Use only when the user explicitly asks to undo or restore.",
  inputSchema: RestoreCPInput,
  outputSchema: z.object({
    restored: z.number(),
    checkpointId: z.string(),
  }),
  permissionLevel: "DESTRUCTIVE",
  timeout: 20000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    requireProjectId(context);
    const result = await restoreCheckpoint(input.checkpointId);
    return {
      restored: result.restored,
      checkpointId: input.checkpointId,
    };
  },
};

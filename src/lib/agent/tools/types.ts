import { z } from "zod";

export type PermissionLevel = "READ" | "WRITE" | "EXTERNAL" | "DESTRUCTIVE" | "PRODUCTION";

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  permissionLevel: PermissionLevel;
  timeout: number; // milliseconds
  agentAccess: string[]; // which agents can use this tool
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

export interface ToolContext {
  userId: string;
  taskId?: string;
  runId?: string;
  stepId?: string;
  workspaceRoot?: string; // sandboxed directory for the task
  projectId?: string;     // real project ID (Phase 4)
}

export interface ToolResult<TOutput = any> {
  success: boolean;
  output?: TOutput;
  error?: string;
  durationMs: number;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: any;
  output?: any;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error?: string;
  durationMs?: number;
}

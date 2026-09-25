import { z } from "zod";
import {
  executeInSandbox,
  writeFileInSandbox,
  readFileInSandbox,
  listFilesInSandbox,
} from "@/lib/sandbox/docker-manager";
import type { ToolDefinition, ToolContext } from "./types";

// =====================
// sandbox.execute
// =====================

const ExecuteInput = z.object({
  command: z.string().describe("Shell command to run inside the sandbox"),
  timeoutMs: z
    .number()
    .min(1000)
    .max(60000)
    .default(30000)
    .describe("Timeout in milliseconds"),
});

export const sandboxExecuteTool: ToolDefinition = {
  name: "sandbox.execute",
  description:
    "Run a shell command inside a real isolated Docker sandbox. Node.js, npm, and Alpine Linux are available. The sandbox persists across commands for the user. Use for running code, testing scripts, or checking runtime behavior. Network is disabled by default.",
  inputSchema: ExecuteInput,
  outputSchema: z.object({
    stdout: z.string(),
    stderr: z.string(),
    exitCode: z.number(),
    durationMs: z.number(),
  }),
  permissionLevel: "WRITE",
  timeout: 65000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const result = await executeInSandbox(context.userId, input.command, {
      timeoutMs: input.timeoutMs,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    };
  },
};

// =====================
// sandbox.write
// =====================

const WriteInput = z.object({
  path: z.string().describe("File path inside the sandbox (e.g., 'index.js')"),
  content: z.string().describe("File content"),
});

export const sandboxWriteTool: ToolDefinition = {
  name: "sandbox.write",
  description:
    "Write a file inside the sandbox. Use this to create scripts before running them. Path is relative to /workspace.",
  inputSchema: WriteInput,
  outputSchema: z.object({
    path: z.string(),
    written: z.boolean(),
  }),
  permissionLevel: "WRITE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    await writeFileInSandbox(context.userId, input.path, input.content);
    return { path: input.path, written: true };
  },
};

// =====================
// sandbox.read
// =====================

const ReadInput = z.object({
  path: z.string().describe("File path inside the sandbox"),
});

export const sandboxReadTool: ToolDefinition = {
  name: "sandbox.read",
  description:
    "Read a file from inside the sandbox. Returns the full content as a string.",
  inputSchema: ReadInput,
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  permissionLevel: "READ",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const content = await readFileInSandbox(context.userId, input.path);
    return { path: input.path, content };
  },
};

// =====================
// sandbox.list
// =====================

const ListInput = z.object({
  path: z.string().default("/workspace").describe("Directory to list"),
});

export const sandboxListTool: ToolDefinition = {
  name: "sandbox.list",
  description:
    "List files in a directory inside the sandbox. Defaults to /workspace.",
  inputSchema: ListInput,
  outputSchema: z.object({
    path: z.string(),
    listing: z.string(),
  }),
  permissionLevel: "READ",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const listing = await listFilesInSandbox(context.userId, input.path);
    return { path: input.path, listing };
  },
};

import { z } from "zod";
import {
  executeInSandbox,
  getPortUrl,
} from "@/lib/sandbox/docker-manager";
import type { ToolDefinition, ToolContext } from "./types";

const StartInput = z.object({
  command: z
    .string()
    .describe("Command to start the dev server (e.g., 'npm run dev')"),
  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000)
    .describe("Port the app listens on inside the container"),
  waitMs: z
    .number()
    .min(0)
    .max(30000)
    .default(8000)
    .describe("How long to wait for the server to start"),
});

const StopInput = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
});

function commandPort(command: string): number | null {
  const patterns = [
    /(?:--port(?:=|\s+)|\s-p\s+)(\d+)/,
    /http\.server\s+(\d+)/,
    /(?:^|\s)(\d{2,5})(?:\s|$)/,
  ];

  for (const pattern of patterns) {
    const match = command.match(pattern);
    const port = match ? Number(match[1]) : NaN;
    if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
  }
  return null;
}

export const previewStartTool: ToolDefinition = {
  name: "preview.start",
  description:
    "Start a dev server inside the sandbox and get a public URL for live preview. Use this when the user wants to see their app running. Common commands: 'npm run dev', 'npm start', 'python -m http.server 3000'. Wait ~8 seconds for the server to boot.",
  inputSchema: StartInput,
  outputSchema: z.object({
    started: z.boolean(),
    url: z.string().nullable(),
    port: z.number(),
    healthCode: z.number().nullable(),
    logPreview: z.string(),
  }),
  permissionLevel: "WRITE",
  timeout: 60000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const port = commandPort(input.command) ?? input.port ?? 3000;
    const waitMs = input.waitMs ?? 8000;

    const startCmd = `nohup ${input.command} > /tmp/server.log 2>&1 &`;
    try {
      await executeInSandbox(context.userId, startCmd, {
        timeoutMs: 3000,
      });
    } catch { /* The background process can outlive the exec call. */ }

    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));

    let healthCode: number | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const health = await executeInSandbox(
          context.userId,
          `curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:${port}`,
          { timeoutMs: 5000 }
        );
        const code = Number(health.stdout.trim());
        if (Number.isInteger(code) && code >= 100 && code <= 599) {
          healthCode = code;
          break;
        }
      } catch {
        // Retry if the server has not bound its port yet.
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const url = await getPortUrl(context.userId, port);
    let logPreview = "";
    try {
      const logResult = await executeInSandbox(
        context.userId,
        "tail -30 /tmp/server.log 2>/dev/null || echo '(no log)'",
        { timeoutMs: 3000 }
      );
      logPreview = logResult.stdout;
    } catch {
      logPreview = "(could not read log)";
    }

    return {
      started: healthCode !== null,
      url,
      port,
      healthCode,
      logPreview,
    };
  },
};

export const previewStopTool: ToolDefinition = {
  name: "preview.stop",
  description: "Stop dev servers running inside the sandbox.",
  inputSchema: StopInput,
  outputSchema: z.object({
    stopped: z.boolean(),
    port: z.number(),
  }),
  permissionLevel: "WRITE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const result = await executeInSandbox(
      context.userId,
      'if pkill -f "http.server\\|serve\\|next dev\\|vite\\|npm run dev"; then echo stopped; else echo not_running; fi',
      { timeoutMs: 5000 }
    );
    return { stopped: result.stdout.trim() === "stopped", port: input.port ?? 3000 };
  },
};

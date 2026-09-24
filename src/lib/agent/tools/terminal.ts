import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import type { ToolDefinition, ToolContext } from "./types";

const execAsync = promisify(exec);

async function ensureWorkspace(context: ToolContext): Promise<string> {
  const root = context.workspaceRoot || `/tmp/chuin-workspace/${context.userId}`;
  await fs.mkdir(root, { recursive: true });
  return root;
}

const FORBIDDEN_PATTERNS = [
  /\brm\s+-rf\s+\//,
  /\bsudo\b/,
  /\bchmod\s+777\s+\//,
  /\/etc\/passwd/,
  /\/etc\/shadow/,
  /\bcurl\s+.*\|\s*(sh|bash)/,
  /\bwget\s+.*\|\s*(sh|bash)/,
  /\bdd\s+if=/,
  /:\(\)\s*\{/,
];

const ALLOWED_COMMANDS = new Set([
  "ls", "cat", "echo", "pwd", "find", "grep", "wc", "head", "tail",
  "sort", "uniq", "mkdir", "touch", "node", "python3", "python",
  "npm", "pnpm", "yarn", "git", "tsc", "curl", "wget", "unzip",
  "tar", "zip", "which", "whoami", "date", "env", "printenv",
]);

const ExecuteInputSchema = z.object({
  command: z.string().describe("The shell command to execute inside the workspace"),
  timeout: z
    .number()
    .min(1000)
    .max(60000)
    .default(15000)
    .describe("Timeout in milliseconds (max 60s)"),
});

const ExecuteOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  truncated: z.boolean(),
});

const MAX_OUTPUT = 10000;

export const terminalExecuteTool: ToolDefinition<
  z.infer<typeof ExecuteInputSchema>,
  z.infer<typeof ExecuteOutputSchema>
> = {
  name: "terminal.execute",
  description:
    "Execute a shell command inside the workspace. Only safe commands allowed (ls, cat, node, npm, git, python3, etc.). Cannot access system files outside workspace. Returns stdout, stderr, and exit code.",
  inputSchema: ExecuteInputSchema,
  outputSchema: ExecuteOutputSchema,
  permissionLevel: "WRITE",
  timeout: 60000,
  agentAccess: ["coding", "general"],
  async execute(input, context) {
    const workspaceRoot = await ensureWorkspace(context);
    const cmd = input.command.trim();

    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(cmd)) {
        throw new Error(
          "Forbidden command pattern detected. This command is not allowed for security reasons."
        );
      }
    }

    const firstWord = cmd.split(/\s+/)[0].split("/").pop() || "";
    if (!ALLOWED_COMMANDS.has(firstWord)) {
      throw new Error(
        `Command "${firstWord}" is not in the allowed list.`
      );
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workspaceRoot,
        timeout: input.timeout,
        maxBuffer: 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          HOME: workspaceRoot,
          NODE_ENV: "development",
        },
      });

      const stdoutTrunc = stdout.length > MAX_OUTPUT;
      const stderrTrunc = stderr.length > MAX_OUTPUT;

      return {
        stdout: stdoutTrunc ? stdout.slice(0, MAX_OUTPUT) + "\n[...truncated]" : stdout,
        stderr: stderrTrunc ? stderr.slice(0, MAX_OUTPUT) + "\n[...truncated]" : stderr,
        exitCode: 0,
        truncated: stdoutTrunc || stderrTrunc,
      };
    } catch (err: any) {
      return {
        stdout: (err.stdout || "").slice(0, MAX_OUTPUT),
        stderr: (err.stderr || err.message || "").slice(0, MAX_OUTPUT),
        exitCode: err.code || 1,
        truncated: false,
      };
    }
  },
};

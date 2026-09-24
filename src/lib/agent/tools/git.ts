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

// Safe git subcommands only
const ALLOWED_GIT_COMMANDS = new Set([
  "status",
  "diff",
  "log",
  "show",
  "branch",
  "init",
  "add",
  "commit",
  "config",
  "rev-parse",
  "ls-files",
]);

const GitInputSchema = z.object({
  command: z
    .string()
    .describe(
      "Git subcommand (e.g., 'status', 'diff', 'log --oneline -5', 'add .', 'commit -m \"msg\"')"
    ),
});

const GitOutputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  truncated: z.boolean(),
});

const MAX_OUTPUT = 20000;

export const gitTool: ToolDefinition = {
  name: "git.execute",
  description:
    "Run a git command inside the workspace. Only safe git subcommands allowed (status, diff, log, add, commit, etc.). No remote operations (push, pull, clone). Returns stdout, stderr, and exit code.",
  inputSchema: GitInputSchema,
  outputSchema: GitOutputSchema,
  permissionLevel: "WRITE",
  timeout: 30000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const cmd = input.command.trim();

    // Extract subcommand
    const parts = cmd.split(/\s+/);
    const subcommand = parts[0];

    if (!ALLOWED_GIT_COMMANDS.has(subcommand)) {
      throw new Error(
        `Git subcommand "${subcommand}" is not allowed. Allowed: ${Array.from(
          ALLOWED_GIT_COMMANDS
        ).join(", ")}`
      );
    }

    const fullCmd = `git ${cmd}`;

    try {
      const { stdout, stderr } = await execAsync(fullCmd, {
        cwd: workspaceRoot,
        timeout: 25000,
        maxBuffer: 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          HOME: workspaceRoot,
          GIT_TERMINAL_PROMPT: "0",
          NODE_ENV: "development", // Prevent interactive prompts
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

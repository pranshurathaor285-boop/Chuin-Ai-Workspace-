import { z } from "zod";
import {
  executeInSandbox,
  listFilesInSandbox,
  readFileInSandbox,
} from "@/lib/sandbox/docker-manager";
import type { ToolDefinition, ToolContext } from "./types";

const DetectOutput = z.object({
  framework: z.string().nullable(),
  command: z.string().nullable(),
  configFiles: z.array(z.string()),
});

export const testDetectTool: ToolDefinition = {
  name: "test.detect",
  description: "Detect the test framework and configuration in the sandbox project.",
  inputSchema: z.object({}),
  outputSchema: DetectOutput,
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(_input: unknown, context: ToolContext) {
    let packageJson: Record<string, any> = {};
    try {
      const parsed: unknown = JSON.parse(await readFileInSandbox(context.userId, "package.json"));
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        packageJson = parsed as Record<string, any>;
      }
    } catch {
      packageJson = {};
    }

    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    let framework: string | null = null;
    let command: string | null = null;
    if (dependencies.playwright) {
      framework = "playwright";
      command = "npx playwright test";
    } else if (dependencies.vitest) {
      framework = "vitest";
      command = "npx vitest run";
    } else if (dependencies.jest) {
      framework = "jest";
      command = "npx jest --ci";
    } else if (packageJson.scripts?.test) {
      framework = "package.json";
      command = "npm test";
    }

    const knownConfigs = /(?:jest|vitest|playwright|karma|mocha|ava|tap|pytest).*\.(?:[cm]?js|[cm]?ts|json|ya?ml|ini|toml)$/i;
    let configFiles: string[] = [];
    try {
      configFiles = (await listFilesInSandbox(context.userId))
        .split("\n")
        .map((line) => line.trim().split(/\s+/).pop() ?? "")
        .filter((name) => knownConfigs.test(name));
    } catch {
      configFiles = [];
    }

    return { framework, command, configFiles };
  },
};

export const testRunTool: ToolDefinition = {
  name: "test.run",
  description: "Run a test command in the sandbox and summarize its result.",
  inputSchema: z.object({
    command: z.string(),
    timeoutMs: z.number().min(1000).max(65000).default(60000),
  }),
  outputSchema: z.object({
    passed: z.boolean(),
    exitCode: z.number(),
    stdout: z.string(),
    stderr: z.string(),
    durationMs: z.number(),
    failureSummary: z.string().nullable(),
  }),
  permissionLevel: "WRITE",
  timeout: 65000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const result = await executeInSandbox(context.userId, input.command, {
      timeoutMs: input.timeoutMs ?? 60000,
    });
    const passed = result.exitCode === 0 && !/fail|error/i.test(result.stdout);
    const failureLine = `${result.stdout}\n${result.stderr}`
      .split("\n")
      .find((line) => /fail|error/i.test(line));
    return {
      passed,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      failureSummary: passed ? null : (failureLine ?? `${result.stdout}\n${result.stderr}`).slice(0, 500),
    };
  },
};

const ParsedFailure = z.object({
  type: z.string(),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().optional(),
});

export const testParseFailureTool: ToolDefinition = {
  name: "test.parse_failure",
  description: "Extract structured failure messages and source locations from test output.",
  inputSchema: z.object({ output: z.string() }),
  outputSchema: z.object({ failures: z.array(ParsedFailure) }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any) {
    const failures: Array<z.infer<typeof ParsedFailure>> = [];
    const seen = new Set<string>();
    let pending: (typeof failures)[number] | null = null;
    const addFailure = (failure: (typeof failures)[number]) => {
      const key = `${failure.message}\0${failure.file ?? ""}\0${failure.line ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        failures.push(failure);
      }
    };

    for (const line of input.output.split("\n")) {
      const errorMatch = line.match(/\b(AssertionError|TypeError|ReferenceError|SyntaxError|Error):\s*(.+)/);
      if (errorMatch) {
        pending = { type: errorMatch[1], message: errorMatch[2].trim() };
        addFailure(pending);
      }

      const location = line.match(/(?:\bat\s+)?(?:.*?\()?([^()\s]+?\.(?:ts|tsx|js|jsx|py)):(\d+)(?::\d+)?\)?/);
      if (location) {
        const file = location[1].trim();
        const lineNumber = Number(location[2]);
        if (pending) {
          const previous = failures.find((failure) => failure.message === pending?.message);
          if (previous && !previous.file) {
            previous.file = file;
            previous.line = lineNumber;
            seen.add(`${previous.message}\0${file}\0${lineNumber}`);
          } else {
            addFailure({ type: pending.type, message: pending.message, file, line: lineNumber });
          }
        } else {
          addFailure({ type: "Location", message: line.trim(), file, line: lineNumber });
        }
      }
    }
    return { failures };
  },
};
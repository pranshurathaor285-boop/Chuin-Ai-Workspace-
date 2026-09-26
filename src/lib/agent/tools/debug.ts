import path from "path";
import { z } from "zod";
import { readFileInSandbox } from "@/lib/sandbox/docker-manager";
import type { ToolDefinition, ToolContext } from "./types";

export const debugAnalyzeErrorTool: ToolDefinition = {
  name: "debug.analyze_error",
  description: "Analyze a runtime or build error and suggest likely fixes.",
  inputSchema: z.object({ error: z.string(), context: z.string().optional() }),
  outputSchema: z.object({
    diagnosis: z.string(),
    suggestedFixes: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low"]),
    category: z.string(),
  }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any) {
    const error = `${input.error}\n${input.context ?? ""}`;
    const rules: Array<{ pattern: RegExp; category: string; diagnosis: string; confidence: "high" | "medium"; fixes: string[] }> = [
      { pattern: /TypeError[\s\S]*(?:undefined|null)/i, category: "null_reference", diagnosis: "Code is accessing a property on a null or undefined value.", confidence: "high", fixes: ["Use optional chaining where the value may be absent.", "Add a guard check before accessing the value.", "Provide a sensible default value."] },
      { pattern: /ReferenceError/i, category: "undefined_variable", diagnosis: "A variable or global is referenced before it is defined.", confidence: "high", fixes: ["Declare the variable in the current scope.", "Import the symbol from the module that exports it."] },
      { pattern: /Cannot find module/i, category: "missing_import", diagnosis: "A required module cannot be resolved.", confidence: "high", fixes: ["Install the missing package if it is external.", "Correct the import path and filename casing."] },
      { pattern: /SyntaxError/i, category: "syntax", diagnosis: "The parser found invalid syntax.", confidence: "high", fixes: ["Check the reported line for unmatched brackets, braces, or quotes.", "Review nearby commas and language-specific syntax."] },
      { pattern: /EADDRINUSE/i, category: "port_conflict", diagnosis: "Another process is already listening on the requested port.", confidence: "high", fixes: ["Stop the existing server with pkill -f and the server command.", "Run this server on a different port."] },
      { pattern: /ENOENT/i, category: "file_not_found", diagnosis: "A requested file or directory does not exist.", confidence: "high", fixes: ["Verify the path and working directory.", "Create the expected file or update the reference."] },
      { pattern: /EACCES/i, category: "permission", diagnosis: "The process does not have permission to access a file or operation.", confidence: "medium", fixes: ["Check ownership and permissions for the affected path.", "Use a user-writable location or a sudo-less alternative."] },
      { pattern: /ERR_MODULE_NOT_FOUND/i, category: "esm_import", diagnosis: "Node.js could not resolve an ES module import.", confidence: "high", fixes: ["Add the required .js extension to relative ESM imports.", "Verify the package is installed and the import path is correct."] },
    ];
    const match = rules.find((rule) => rule.pattern.test(error));
    return match
      ? { diagnosis: match.diagnosis, suggestedFixes: match.fixes, confidence: match.confidence, category: match.category }
      : {
          diagnosis: "The error does not match a known pattern; inspect the stack trace and surrounding code.",
          suggestedFixes: ["Check the first relevant stack-trace location.", "Reproduce the issue with the smallest input and inspect nearby values."],
          confidence: "low" as const,
          category: "unknown",
        };
  },
};

export const debugSuggestFixTool: ToolDefinition = {
  name: "debug.suggest_fix",
  description: "Read the source location mentioned in an error and return a focused hint.",
  inputSchema: z.object({ file: z.string(), error: z.string() }),
  outputSchema: z.object({ file: z.string(), snippet: z.string(), hint: z.string() }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const file = path.posix.normalize(input.file.replaceAll("\\", "/")).replace(/^\/+/, "");
    if (file === ".." || file.startsWith("../")) {
      return { file: input.file, snippet: "", hint: "The requested path is outside the sandbox workspace." };
    }

    try {
      const content = await readFileInSandbox(context.userId, file);
      const lines = content.split("\n");
      const location = input.error.match(/(?:^|[\s(:])(?:[^\s():]+\.(?:ts|tsx|js|jsx|py)):(\d+)(?::\d+)?/m);
      const lineNumber = location ? Number(location[1]) : null;
      const snippet = lineNumber
        ? lines.slice(Math.max(0, lineNumber - 3), Math.min(lines.length, lineNumber + 2)).join("\n")
        : lines.slice(0, 5).join("\n");
      return {
        file: input.file,
        snippet,
        hint: lineNumber
          ? `Inspect line ${lineNumber} and its surrounding expressions for the reported error.`
          : "No source line was identified; inspect the first relevant stack frame in this file.",
      };
    } catch {
      return { file: input.file, snippet: "", hint: "Could not read this file from the sandbox; verify the path and workspace." };
    }
  },
};
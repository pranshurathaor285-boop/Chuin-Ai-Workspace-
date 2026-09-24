import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import type { ToolDefinition, ToolContext } from "./types";

async function ensureWorkspace(context: ToolContext): Promise<string> {
  const root = context.workspaceRoot || `/tmp/chuin-workspace/${context.userId}`;
  await fs.mkdir(root, { recursive: true });
  return root;
}

function safePath(workspaceRoot: string, requestedPath: string): string {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.resolve(workspaceRoot, normalized);
  const rootResolved = path.resolve(workspaceRoot);
  if (!fullPath.startsWith(rootResolved)) {
    throw new Error("Path escapes workspace root");
  }
  return fullPath;
}

const SearchInputSchema = z.object({
  query: z.string().describe("Text to search for (case-insensitive)"),
  path: z.string().default(".").describe("Directory to search in"),
  extension: z
    .string()
    .optional()
    .describe("Optional file extension filter (e.g., 'ts', 'py')"),
});

const SearchOutputSchema = z.object({
  matches: z.array(
    z.object({
      file: z.string(),
      line: z.number(),
      content: z.string(),
    })
  ),
  totalFiles: z.number(),
  totalMatches: z.number(),
});

const MAX_MATCHES = 50;

export const filesystemSearchTool: ToolDefinition = {
  name: "filesystem.search",
  description:
    "Search for text inside files within the workspace. Returns matching lines with file paths and line numbers. Case-insensitive. Max 50 results. Optionally filter by file extension.",
  inputSchema: SearchInputSchema,
  outputSchema: SearchOutputSchema,
  permissionLevel: "READ",
  timeout: 15000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const searchRoot = safePath(workspaceRoot, input.path || ".");
    const queryLower = input.query.toLowerCase();

    const matches: Array<{ file: string; line: number; content: string }> = [];
    let totalFiles = 0;

    const SKIP_DIRS = new Set([
      "node_modules", ".git", ".next", "dist", "build", "__pycache__",
    ]);

    async function walk(dir: string, rel: string) {
      if (matches.length >= MAX_MATCHES) return;

      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

      for (const entry of entries) {
        if (matches.length >= MAX_MATCHES) return;

        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(rel, entry.name);

        if (entry.isDirectory()) {
          if (SKIP_DIRS.has(entry.name)) continue;
          await walk(fullPath, relPath);
        } else if (entry.isFile()) {
          if (input.extension && !entry.name.endsWith(`.${input.extension}`)) {
            continue;
          }

          totalFiles++;

          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              if (matches.length >= MAX_MATCHES) break;
              if (lines[i].toLowerCase().includes(queryLower)) {
                matches.push({
                  file: relPath,
                  line: i + 1,
                  content: lines[i].trim().slice(0, 200),
                });
              }
            }
          } catch {
            // Skip binary or unreadable files
          }
        }
      }
    }

    await walk(searchRoot, input.path || ".");

    return {
      matches,
      totalFiles,
      totalMatches: matches.length,
    };
  },
};

import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import type { ToolDefinition, ToolContext } from "./types";

/**
 * Resolve a path safely inside the workspace root.
 * Blocks path traversal attempts.
 */
function safePath(workspaceRoot: string, requestedPath: string): string {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.resolve(workspaceRoot, normalized);

  // Ensure the resolved path is inside the workspace
  const rootResolved = path.resolve(workspaceRoot);
  if (!fullPath.startsWith(rootResolved)) {
    throw new Error("Path escapes workspace root");
  }

  return fullPath;
}

/**
 * Ensure workspace root exists, create if not.
 */
async function ensureWorkspace(context: ToolContext): Promise<string> {
  const root = context.workspaceRoot || `/tmp/chuin-workspace/${context.userId}`;
  await fs.mkdir(root, { recursive: true });
  return root;
}

// =====================
// TOOL: filesystem.read
// =====================

const ReadInputSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  startLine: z.number().optional().describe("Optional start line (1-indexed)"),
  endLine: z.number().optional().describe("Optional end line (1-indexed)"),
});

const ReadOutputSchema = z.object({
  content: z.string(),
  size: z.number(),
  lines: z.number(),
  truncated: z.boolean(),
});

export const filesystemReadTool: ToolDefinition = {
  name: "filesystem.read",
  description:
    "Read the contents of a file inside the project workspace. Returns the file content, size, and line count. For large files, use startLine and endLine to read a specific range.",
  inputSchema: ReadInputSchema,
  outputSchema: ReadOutputSchema,
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const fullPath = safePath(workspaceRoot, input.path);

    const content = await fs.readFile(fullPath, "utf-8");
    const allLines = content.split("\n");

    let finalContent = content;
    let truncated = false;

    if (input.startLine !== undefined || input.endLine !== undefined) {
      const start = Math.max(1, input.startLine || 1) - 1;
      const end = input.endLine !== undefined ? input.endLine : allLines.length;
      finalContent = allLines.slice(start, end).join("\n");
    } else if (content.length > 100000) {
      // Auto-truncate very large files
      finalContent = content.slice(0, 100000) + "\n\n[TRUNCATED — use startLine/endLine to read more]";
      truncated = true;
    }

    return {
      content: finalContent,
      size: Buffer.byteLength(content, "utf-8"),
      lines: allLines.length,
      truncated,
    };
  },
};

// =====================
// TOOL: filesystem.write
// =====================

const WriteInputSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  content: z.string().describe("Full content to write"),
});

const WriteOutputSchema = z.object({
  path: z.string(),
  bytesWritten: z.number(),
  created: z.boolean(),
});

export const filesystemWriteTool: ToolDefinition = {
  name: "filesystem.write",
  description:
    "Write or overwrite a file inside the project workspace. Creates parent directories automatically. Returns the bytes written.",
  inputSchema: WriteInputSchema,
  outputSchema: WriteOutputSchema,
  permissionLevel: "WRITE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const fullPath = safePath(workspaceRoot, input.path);

    // Check if file already exists
    let created = true;
    try {
      await fs.access(fullPath);
      created = false;
    } catch {
      // File doesn't exist — created = true
    }

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.content, "utf-8");

    return {
      path: input.path,
      bytesWritten: Buffer.byteLength(input.content, "utf-8"),
      created,
    };
  },
};

// =====================
// TOOL: filesystem.list
// =====================

const ListInputSchema = z.object({
  path: z.string().default(".").describe("Directory path relative to workspace root"),
  depth: z.number().min(1).max(5).default(2).describe("Max depth to recurse"),
});

const ListEntrySchema = z.object({
  path: z.string(),
  type: z.enum(["file", "directory"]),
  size: z.number().optional(),
});

const ListOutputSchema = z.object({
  entries: z.array(ListEntrySchema),
  total: z.number(),
});

export const filesystemListTool: ToolDefinition = {
  name: "filesystem.list",
  description:
    "List files and folders inside the project workspace. Returns a flat list of entries with paths, types, and sizes. Use depth to control recursion.",
  inputSchema: ListInputSchema,
  outputSchema: ListOutputSchema,
  permissionLevel: "READ",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const fullPath = safePath(workspaceRoot, input.path || ".");

    const entries: Array<{ path: string; type: "file" | "directory"; size?: number }> = [];

    async function walk(dir: string, relative: string, currentDepth: number) {
      if (currentDepth > (input.depth || 2)) return;

      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        // Skip node_modules, .git, and other heavy dirs
        if (
          item.name === "node_modules" ||
          item.name === ".git" ||
          item.name === ".next" ||
          item.name === "dist" ||
          item.name === "build"
        ) {
          continue;
        }

        const itemPath = path.join(dir, item.name);
        const relPath = path.join(relative, item.name);

        if (item.isDirectory()) {
          entries.push({ path: relPath, type: "directory" });
          await walk(itemPath, relPath, currentDepth + 1);
        } else if (item.isFile()) {
          try {
            const stats = await fs.stat(itemPath);
            entries.push({ path: relPath, type: "file", size: stats.size });
          } catch {
            entries.push({ path: relPath, type: "file" });
          }
        }

        // Safety limit
        if (entries.length > 500) return;
      }
    }

    try {
      await walk(fullPath, input.path || ".", 1);
    } catch (err) {
      // If path doesn't exist, return empty
      return { entries: [], total: 0 };
    }

    return { entries, total: entries.length };
  },
};

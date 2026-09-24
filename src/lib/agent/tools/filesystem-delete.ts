import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import type { ToolDefinition, ToolContext } from "./types";

function safePath(workspaceRoot: string, requestedPath: string): string {
  const normalized = path.normalize(requestedPath).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.resolve(workspaceRoot, normalized);
  const rootResolved = path.resolve(workspaceRoot);
  if (!fullPath.startsWith(rootResolved)) {
    throw new Error("Path escapes workspace root");
  }
  if (fullPath === rootResolved) {
    throw new Error("Cannot delete the workspace root itself");
  }
  return fullPath;
}

async function ensureWorkspace(context: ToolContext): Promise<string> {
  const root = context.workspaceRoot || `/tmp/chuin-workspace/${context.userId}`;
  await fs.mkdir(root, { recursive: true });
  return root;
}

const DeleteInputSchema = z.object({
  path: z.string().describe("File or folder path relative to workspace root"),
  recursive: z
    .boolean()
    .default(false)
    .describe("If true, delete folders recursively"),
});

const DeleteOutputSchema = z.object({
  path: z.string(),
  deleted: z.boolean(),
  type: z.enum(["file", "directory"]),
});

export const filesystemDeleteTool: ToolDefinition = {
  name: "filesystem.delete",
  description:
    "Delete a file or folder inside the workspace. For folders, set recursive=true. Cannot delete the workspace root.",
  inputSchema: DeleteInputSchema,
  outputSchema: DeleteOutputSchema,
  permissionLevel: "DESTRUCTIVE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const fullPath = safePath(workspaceRoot, input.path);

    const stats = await fs.stat(fullPath).catch(() => null);
    if (!stats) {
      throw new Error(`Path does not exist: ${input.path}`);
    }

    const type: "file" | "directory" = stats.isDirectory() ? "directory" : "file";

    if (type === "directory" && !input.recursive) {
      throw new Error(
        `Refusing to delete directory ${input.path} without recursive=true`
      );
    }

    if (type === "directory") {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }

    return {
      path: input.path,
      deleted: true,
      type,
    };
  },
};

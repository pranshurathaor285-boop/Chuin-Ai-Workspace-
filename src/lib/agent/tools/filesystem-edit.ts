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
  return fullPath;
}

async function ensureWorkspace(context: ToolContext): Promise<string> {
  const root = context.workspaceRoot || `/tmp/chuin-workspace/${context.userId}`;
  await fs.mkdir(root, { recursive: true });
  return root;
}

const EditInputSchema = z.object({
  path: z.string().describe("File path relative to workspace root"),
  oldContent: z
    .string()
    .describe("Exact existing content to find and replace (must match)"),
  newContent: z.string().describe("New content to replace it with"),
});

const EditOutputSchema = z.object({
  path: z.string(),
  replacements: z.number(),
  bytesChanged: z.number(),
});

export const filesystemEditTool: ToolDefinition = {
  name: "filesystem.edit",
  description:
    "Edit an existing file by replacing an exact string with new content. The oldContent must match EXACTLY what's in the file. Fails if oldContent is not found. Returns the number of replacements made.",
  inputSchema: EditInputSchema,
  outputSchema: EditOutputSchema,
  permissionLevel: "WRITE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const workspaceRoot = await ensureWorkspace(context);
    const fullPath = safePath(workspaceRoot, input.path);

    const content = await fs.readFile(fullPath, "utf-8");

    if (!content.includes(input.oldContent)) {
      throw new Error(
        `Content not found in ${input.path}. Make sure oldContent matches exactly.`
      );
    }

    const occurrences = content.split(input.oldContent).length - 1;
    const newFileContent = content.replace(input.oldContent, input.newContent);

    await fs.writeFile(fullPath, newFileContent, "utf-8");

    return {
      path: input.path,
      replacements: occurrences,
      bytesChanged: newFileContent.length - content.length,
    };
  },
};

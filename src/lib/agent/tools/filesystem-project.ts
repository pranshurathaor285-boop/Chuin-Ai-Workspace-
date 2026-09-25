import { z } from "zod";
import {
  writeProjectFile,
  readProjectFile,
  listProjectFiles,
  deleteProjectFile,
} from "@/lib/project/filesystem";
import type { ToolDefinition, ToolContext } from "./types";

/**
 * These tools operate on the project_files table (Phase 4),
 * NOT the sandbox filesystem. They require context.projectId.
 */

function requireProjectId(context: ToolContext): string {
  if (!context.projectId) {
    throw new Error(
      "This tool requires a projectId in context. This tool works on project files, not the sandbox."
    );
  }
  return context.projectId;
}

// =====================
// project.files.read
// =====================

const ProjectReadInput = z.object({
  path: z.string().describe("File path relative to project root"),
});

export const projectFilesReadTool: ToolDefinition = {
  name: "project.files.read",
  description:
    "Read a file from the current project. Returns content and metadata. Use this to inspect project source code.",
  inputSchema: ProjectReadInput,
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().nullable(),
    size: z.number(),
  }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const projectId = requireProjectId(context);
    const file = await readProjectFile(projectId, input.path);

    if (!file) {
      throw new Error(`File not found in project: ${input.path}`);
    }

    return {
      path: file.path,
      content: file.content,
      language: file.language,
      size: file.size,
    };
  },
};

// =====================
// project.files.write
// =====================

const ProjectWriteInput = z.object({
  path: z.string().describe("File path relative to project root"),
  content: z.string().describe("Full file content"),
  checkpointName: z
    .string()
    .optional()
    .describe("Optional checkpoint name before write"),
});

export const projectFilesWriteTool: ToolDefinition = {
  name: "project.files.write",
  description:
    "Create or update a file in the project. Optionally creates a checkpoint before writing (recommended). Returns path, size, and checkpoint info.",
  inputSchema: ProjectWriteInput,
  outputSchema: z.object({
    path: z.string(),
    size: z.number(),
    language: z.string().nullable(),
    checkpointId: z.string().nullable(),
    wasCreated: z.boolean(),
  }),
  permissionLevel: "WRITE",
  timeout: 10000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const projectId = requireProjectId(context);

    // Check if file already exists (for wasCreated detection)
    const existing = await readProjectFile(projectId, input.path);
    const wasCreated = !existing;

    const { file, checkpointId } = await writeProjectFile(
      projectId,
      input.path,
      input.content,
      {
        checkpointName: input.checkpointName || `Edit ${input.path}`,
        taskId: context.taskId,
      }
    );

    return {
      path: file.path,
      size: file.size,
      language: file.language,
      checkpointId,
      wasCreated,
    };
  },
};

// =====================
// project.files.list
// =====================

const ProjectListInput = z.object({
  prefix: z
    .string()
    .optional()
    .describe("Optional path prefix to filter files (e.g., 'src/')"),
});

export const projectFilesListTool: ToolDefinition = {
  name: "project.files.list",
  description:
    "List all files in the project. Optionally filter by path prefix. Returns paths, languages, and sizes.",
  inputSchema: ProjectListInput,
  outputSchema: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        language: z.string().nullable(),
        size: z.number(),
        updatedAt: z.string(),
      })
    ),
    total: z.number(),
  }),
  permissionLevel: "READ",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const projectId = requireProjectId(context);
    const files = await listProjectFiles(projectId, input.prefix);

    return {
      files: files.map((f) => ({
        path: f.path,
        language: f.language,
        size: f.size,
        updatedAt: f.updatedAt.toISOString(),
      })),
      total: files.length,
    };
  },
};

// =====================
// project.files.delete
// =====================

const ProjectDeleteInput = z.object({
  path: z.string().describe("File path to delete"),
});

export const projectFilesDeleteTool: ToolDefinition = {
  name: "project.files.delete",
  description:
    "Delete a file from the project. Use with caution — this is destructive.",
  inputSchema: ProjectDeleteInput,
  outputSchema: z.object({
    path: z.string(),
    deleted: z.boolean(),
  }),
  permissionLevel: "DESTRUCTIVE",
  timeout: 5000,
  agentAccess: ["coding", "general"],
  async execute(input: any, context: ToolContext) {
    const projectId = requireProjectId(context);
    await deleteProjectFile(projectId, input.path);

    return {
      path: input.path,
      deleted: true,
    };
  },
};

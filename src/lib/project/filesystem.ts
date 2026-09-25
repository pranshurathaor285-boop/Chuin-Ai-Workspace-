import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Hash content with SHA-256
 */
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Detect language from file extension
 */
export function detectLanguage(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    cs: "csharp",
    php: "php",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    toml: "toml",
    xml: "xml",
  };
  return ext ? langMap[ext] || null : null;
}

/**
 * Read a file from the project
 */
export async function readProjectFile(projectId: string, path: string) {
  const file = await prisma.projectFile.findUnique({
    where: {
      projectId_path: { projectId, path },
    },
  });
  return file;
}

/**
 * List all files in a project (with optional path prefix filter)
 */
export async function listProjectFiles(
  projectId: string,
  pathPrefix?: string
) {
  const files = await prisma.projectFile.findMany({
    where: {
      projectId,
      ...(pathPrefix && {
        path: { startsWith: pathPrefix },
      }),
    },
    select: {
      id: true,
      path: true,
      language: true,
      size: true,
      hash: true,
      updatedAt: true,
    },
    orderBy: { path: "asc" },
  });
  return files;
}

/**
 * Write (create or update) a file in a project.
 * Auto-creates a checkpoint before the write if requested.
 */
export async function writeProjectFile(
  projectId: string,
  path: string,
  content: string,
  options: {
    checkpointName?: string;
    taskId?: string;
  } = {}
) {
  const hash = hashContent(content);
  const language = detectLanguage(path);
  const size = Buffer.byteLength(content, "utf-8");

  // Create checkpoint if requested
  let checkpointId: string | null = null;
  if (options.checkpointName) {
    const checkpoint = await createCheckpoint(
      projectId,
      options.checkpointName,
      options.taskId
    );
    checkpointId = checkpoint.id;
  }

  // Upsert the file
  const file = await prisma.projectFile.upsert({
    where: {
      projectId_path: { projectId, path },
    },
    create: {
      projectId,
      path,
      content,
      hash,
      language,
      size,
    },
    update: {
      content,
      hash,
      language,
      size,
    },
  });

  return { file, checkpointId };
}

/**
 * Delete a file from a project
 */
export async function deleteProjectFile(projectId: string, path: string) {
  const file = await prisma.projectFile.findUnique({
    where: { projectId_path: { projectId, path } },
  });

  if (!file) {
    throw new Error(`File not found: ${path}`);
  }

  await prisma.projectFile.delete({
    where: { projectId_path: { projectId, path } },
  });

  return file;
}

/**
 * Create a checkpoint — snapshot of all files in the project
 */
export async function createCheckpoint(
  projectId: string,
  name: string,
  taskId?: string
) {
  const files = await prisma.projectFile.findMany({
    where: { projectId },
    select: { path: true, content: true, hash: true },
  });

  const checkpoint = await prisma.projectCheckpoint.create({
    data: {
      projectId,
      name,
      taskId: taskId || null,
      fileCount: files.length,
      files: {
        create: files.map((f) => ({
          path: f.path,
          content: f.content,
          hash: f.hash,
        })),
      },
    },
  });

  return checkpoint;
}

/**
 * Restore a project to a checkpoint
 */
export async function restoreCheckpoint(checkpointId: string) {
  const checkpoint = await prisma.projectCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { files: true },
  });

  if (!checkpoint) {
    throw new Error("Checkpoint not found");
  }

  // Delete all existing files
  await prisma.projectFile.deleteMany({
    where: { projectId: checkpoint.projectId },
  });

  // Restore files from checkpoint
  for (const f of checkpoint.files) {
    await prisma.projectFile.create({
      data: {
        projectId: checkpoint.projectId,
        path: f.path,
        content: f.content,
        hash: f.hash,
        size: Buffer.byteLength(f.content, "utf-8"),
        language: detectLanguage(f.path),
      },
    });
  }

  return { restored: checkpoint.files.length };
}

/**
 * Get all checkpoints for a project
 */
export async function listCheckpoints(projectId: string) {
  return prisma.projectCheckpoint.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      fileCount: true,
      createdAt: true,
    },
  });
}

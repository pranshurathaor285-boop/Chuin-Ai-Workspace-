import { prisma } from "@/lib/prisma";

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "unchanged";
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

/**
 * Simple line-based diff using longest common subsequence.
 * Returns a structured diff that can be rendered.
 */
export function diffLines(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  // LCS table
  const m = oldLines.length;
  const n = newLines.length;
  const lcs: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: "context",
        content: oldLines[i - 1],
        oldLine: i,
        newLine: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      result.unshift({
        type: "add",
        content: newLines[j - 1],
        newLine: j,
      });
      j--;
    } else if (i > 0) {
      result.unshift({
        type: "remove",
        content: oldLines[i - 1],
        oldLine: i,
      });
      i--;
    }
  }

  return result;
}

/**
 * Get diff between a checkpoint and current project state.
 */
export async function getCheckpointDiff(
  checkpointId: string
): Promise<FileDiff[]> {
  const checkpoint = await prisma.projectCheckpoint.findUnique({
    where: { id: checkpointId },
    include: { files: true },
  });

  if (!checkpoint) throw new Error("Checkpoint not found");

  const currentFiles = await prisma.projectFile.findMany({
    where: { projectId: checkpoint.projectId },
  });

  const checkpointMap = new Map(checkpoint.files.map((f) => [f.path, f]));
  const currentMap = new Map(currentFiles.map((f) => [f.path, f]));

  const allPaths = new Set([
    ...checkpointMap.keys(),
    ...currentMap.keys(),
  ]);

  const diffs: FileDiff[] = [];

  for (const path of allPaths) {
    const oldFile = checkpointMap.get(path);
    const newFile = currentMap.get(path);

    if (!oldFile && newFile) {
      // Added
      const lines = newFile.content.split("\n").map((content, idx) => ({
        type: "add" as const,
        content,
        newLine: idx + 1,
      }));
      diffs.push({
        path,
        status: "added",
        lines,
        additions: lines.length,
        deletions: 0,
      });
    } else if (oldFile && !newFile) {
      // Deleted
      const lines = oldFile.content.split("\n").map((content, idx) => ({
        type: "remove" as const,
        content,
        oldLine: idx + 1,
      }));
      diffs.push({
        path,
        status: "deleted",
        lines,
        additions: 0,
        deletions: lines.length,
      });
    } else if (oldFile && newFile) {
      // Compare content
      if (oldFile.content === newFile.content) {
        continue; // unchanged
      }

      const lines = diffLines(oldFile.content, newFile.content);
      const additions = lines.filter((l) => l.type === "add").length;
      const deletions = lines.filter((l) => l.type === "remove").length;

      diffs.push({
        path,
        status: "modified",
        lines,
        additions,
        deletions,
      });
    }
  }

  return diffs;
}

/**
 * Get diff between two checkpoints.
 */
export async function getCheckpointPairDiff(
  beforeCheckpointId: string,
  afterCheckpointId: string
): Promise<FileDiff[]> {
  const [before, after] = await Promise.all([
    prisma.projectCheckpoint.findUnique({
      where: { id: beforeCheckpointId },
      include: { files: true },
    }),
    prisma.projectCheckpoint.findUnique({
      where: { id: afterCheckpointId },
      include: { files: true },
    }),
  ]);

  if (!before || !after) throw new Error("Checkpoint not found");

  const beforeMap = new Map(before.files.map((f) => [f.path, f]));
  const afterMap = new Map(after.files.map((f) => [f.path, f]));

  const allPaths = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const diffs: FileDiff[] = [];

  for (const path of allPaths) {
    const oldFile = beforeMap.get(path);
    const newFile = afterMap.get(path);

    if (!oldFile && newFile) {
      const lines = newFile.content.split("\n").map((content, idx) => ({
        type: "add" as const,
        content,
        newLine: idx + 1,
      }));
      diffs.push({
        path,
        status: "added",
        lines,
        additions: lines.length,
        deletions: 0,
      });
    } else if (oldFile && !newFile) {
      const lines = oldFile.content.split("\n").map((content, idx) => ({
        type: "remove" as const,
        content,
        oldLine: idx + 1,
      }));
      diffs.push({
        path,
        status: "deleted",
        lines,
        additions: 0,
        deletions: lines.length,
      });
    } else if (oldFile && newFile && oldFile.content !== newFile.content) {
      const lines = diffLines(oldFile.content, newFile.content);
      diffs.push({
        path,
        status: "modified",
        lines,
        additions: lines.filter((l) => l.type === "add").length,
        deletions: lines.filter((l) => l.type === "remove").length,
      });
    }
  }

  return diffs;
}

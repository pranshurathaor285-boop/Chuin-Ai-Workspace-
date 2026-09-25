import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  writeProjectFile,
  createCheckpoint,
} from "../src/lib/project/filesystem";
import { getCheckpointDiff } from "../src/lib/project/diff";

async function main() {
  console.log("=== DIFF ENGINE TEST ===\n");

  const user = await prisma.user.upsert({
    where: { email: "diff@chuin.local" },
    update: {},
    create: { email: "diff@chuin.local", name: "Diff Test" },
  });

  const project = await prisma.project.create({
    data: { userId: user.id, name: "Diff Test Project" },
  });

  // 1. Initial files
  await writeProjectFile(project.id, "index.ts", 'const x = 1;\nconsole.log(x);');
  await writeProjectFile(project.id, "utils.ts", 'export const add = (a, b) => a + b;');

  // 2. Checkpoint before edits
  const cp = await createCheckpoint(project.id, "Before changes");
  console.log("Checkpoint created:", cp.id);
  console.log("");

  // 3. Modify files
  await writeProjectFile(project.id, "index.ts", 'const x = 42;\nconsole.log(x);\nconsole.log("New line");');
  await writeProjectFile(project.id, "new-file.ts", 'export const PI = 3.14;');
  await prisma.projectFile.delete({
    where: { projectId_path: { projectId: project.id, path: "utils.ts" } },
  });

  // 4. Get diff
  console.log("=== DIFF RESULT ===\n");
  const diffs = await getCheckpointDiff(cp.id);

  for (const d of diffs) {
    console.log(`📄 ${d.path} [${d.status}] +${d.additions} −${d.deletions}`);
    for (const line of d.lines) {
      const prefix = line.type === "add" ? "+" : line.type === "remove" ? "−" : " ";
      console.log(`  ${prefix} ${line.content}`);
    }
    console.log("");
  }

  console.log(`Total: ${diffs.length} files changed`);

  // Cleanup
  await prisma.project.delete({ where: { id: project.id } });
  console.log("\n=== CLEANUP DONE ===");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  writeProjectFile,
  readProjectFile,
  listProjectFiles,
  createCheckpoint,
  restoreCheckpoint,
  listCheckpoints,
  deleteProjectFile,
} from "../src/lib/project/filesystem";

async function main() {
  console.log("=== PROJECT FILESYSTEM TEST ===\n");

  // Create a test user + project
  const user = await prisma.user.upsert({
    where: { email: "fs-test@chuin.local" },
    update: {},
    create: {
      email: "fs-test@chuin.local",
      name: "FS Test User",
    },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "FS Test Project",
      description: "Testing filesystem",
    },
  });

  console.log("Test user:", user.id);
  console.log("Test project:", project.id);
  console.log("");

  // Test 1: Write files
  console.log("=== TEST 1: Write files ===");
  await writeProjectFile(project.id, "src/index.ts", 'console.log("Hello");');
  await writeProjectFile(project.id, "src/utils.ts", 'export const add = (a: number, b: number) => a + b;');
  await writeProjectFile(project.id, "README.md", "# Test Project\n\nThis is a test.");
  const files = await listProjectFiles(project.id);
  console.log(`Wrote 3 files, listed ${files.length}`);
  for (const f of files) {
    console.log(`  - ${f.path} (${f.language}, ${f.size}B)`);
  }
  console.log("");

  // Test 2: Read file
  console.log("=== TEST 2: Read file ===");
  const read = await readProjectFile(project.id, "src/index.ts");
  console.log("Content:", read?.content);
  console.log("");

  // Test 3: Create checkpoint
  console.log("=== TEST 3: Create checkpoint ===");
  const cp = await createCheckpoint(project.id, "Before edit");
  console.log("Checkpoint:", cp.id, "| Files:", cp.fileCount);
  console.log("");

  // Test 4: Modify file, then restore checkpoint
  console.log("=== TEST 4: Modify + restore ===");
  await writeProjectFile(project.id, "src/index.ts", 'console.log("MODIFIED");');
  const modified = await readProjectFile(project.id, "src/index.ts");
  console.log("After modify:", modified?.content);

  await restoreCheckpoint(cp.id);
  const restored = await readProjectFile(project.id, "src/index.ts");
  console.log("After restore:", restored?.content);
  console.log("");

  // Test 5: List checkpoints
  console.log("=== TEST 5: List checkpoints ===");
  const cps = await listCheckpoints(project.id);
  console.log(`${cps.length} checkpoints:`);
  for (const c of cps) {
    console.log(`  - ${c.name} (${c.fileCount} files)`);
  }
  console.log("");

  // Test 6: Delete file
  console.log("=== TEST 6: Delete file ===");
  await deleteProjectFile(project.id, "README.md");
  const after = await listProjectFiles(project.id);
  console.log(`After delete: ${after.length} files`);
  console.log("");

  // Cleanup
  console.log("=== CLEANUP ===");
  await prisma.project.delete({ where: { id: project.id } });
  console.log("Test project deleted");
  console.log("");

  console.log("=== ALL TESTS COMPLETE ===");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

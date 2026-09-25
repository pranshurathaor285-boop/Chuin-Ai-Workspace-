import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { executeTool } from "../src/lib/agent/tools/executor";
import { toolRegistry } from "../src/lib/agent/tools/registry";

async function main() {
  console.log("=== PROJECT TOOLS TEST ===\n");
  console.log("Total tools:", toolRegistry.size());
  console.log("");

  // Create test user + project
  const user = await prisma.user.upsert({
    where: { email: "ptest@chuin.local" },
    update: {},
    create: { email: "ptest@chuin.local", name: "PT Test" },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "PT Test Project",
    },
  });

  const context = {
    userId: user.id,
    projectId: project.id,
  };

  console.log("Test project:", project.id);
  console.log("");

  // Test 1: Write via tool
  console.log("=== TEST 1: project.files.write ===");
  const writeResult = await executeTool(
    "project.files.write",
    {
      path: "src/hello.ts",
      content: 'export const greet = () => "Hello from project!";',
      checkpointName: "Initial",
    },
    context
  );
  console.log("Success:", writeResult.success);
  console.log("Output:", JSON.stringify(writeResult.output, null, 2));
  console.log("");

  // Test 2: Read via tool
  console.log("=== TEST 2: project.files.read ===");
  const readResult = await executeTool(
    "project.files.read",
    { path: "src/hello.ts" },
    context
  );
  console.log("Success:", readResult.success);
  console.log("Content:", readResult.output?.content);
  console.log("");

  // Test 3: List via tool
  console.log("=== TEST 3: project.files.list ===");
  const listResult = await executeTool(
    "project.files.list",
    {},
    context
  );
  console.log("Success:", listResult.success);
  console.log("Total files:", listResult.output?.total);
  for (const f of listResult.output?.files || []) {
    console.log(`  - ${f.path} (${f.language}, ${f.size}B)`);
  }
  console.log("");

  // Test 4: Delete via tool
  console.log("=== TEST 4: project.files.delete ===");
  const delResult = await executeTool(
    "project.files.delete",
    { path: "src/hello.ts" },
    context
  );
  console.log("Success:", delResult.success);
  console.log("Output:", JSON.stringify(delResult.output));
  console.log("");

  // Cleanup
  await prisma.project.delete({ where: { id: project.id } });
  console.log("=== CLEANUP DONE ===");
  console.log("");
  console.log("=== ALL TESTS COMPLETE ===");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

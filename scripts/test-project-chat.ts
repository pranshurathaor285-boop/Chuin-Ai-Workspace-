import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runAgent } from "../src/lib/agent/orchestrator";

async function main() {
  console.log("=== PROJECT-AWARE AGENT TEST ===\n");

  // Create test user + project
  const user = await prisma.user.upsert({
    where: { email: "projchat@chuin.local" },
    update: {},
    create: { email: "projchat@chuin.local", name: "Project Chat Test" },
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      name: "Test Project",
      description: "Project-aware agent test",
    },
  });

  console.log("Test user:", user.id);
  console.log("Test project:", project.id);
  console.log("");

  // Test: Create a file in the project via orchestrator
  console.log("=== RUNNING AGENT ===");
  console.log('Goal: "Create a file called index.ts in the project with a hello function"\n');

  const result = await runAgent({
    userId: user.id,
    goal: "Create a file called index.ts in the project with a hello function that returns 'Hello from project'",
    projectId: project.id,
  });

  console.log("\n=== RESULT ===");
  console.log("Success:", result.success);
  console.log("Tool calls:", result.toolCalls.length);
  for (const tc of result.toolCalls) {
    console.log(`  - ${tc.toolName}`);
  }
  console.log("\nFinal answer:");
  console.log(result.finalAnswer);

  // Cleanup
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

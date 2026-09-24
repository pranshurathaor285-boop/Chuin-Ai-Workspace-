import "dotenv/config";
import { runAgent } from "../src/lib/agent/orchestrator";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("=== AGENT TEST ===\n");

  const testUser = await prisma.user.findFirst({
    where: { email: "agent-test@chuin.local" },
  });

  if (!testUser) {
    console.log("No test user. Run previous test first.");
    process.exit(1);
  }

  console.log("User:", testUser.id);
  console.log("Running agent...\n");

  const result = await runAgent({
    userId: testUser.id,
    goal: "Create a file called greeting.txt with the content 'Hello from Chuin AI'",
  });

  console.log("\n=== RESULT ===");
  console.log("Success:", result.success);
  console.log("Task ID:", result.taskId);
  console.log("Tool calls:", result.toolCalls.length);
  for (const tc of result.toolCalls) {
    console.log("  -", tc.toolName, "|", JSON.stringify(tc.input));
  }
  console.log("\nFinal answer:");
  console.log(result.finalAnswer);
  console.log("\n=== DONE ===");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});

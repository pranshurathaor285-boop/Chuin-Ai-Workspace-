import "dotenv/config";
import {
  executeInSandbox,
  writeFileInSandbox,
  readFileInSandbox,
  listFilesInSandbox,
  destroySandbox,
  getActiveSandboxCount,
} from "../src/lib/sandbox/docker-manager";

async function main() {
  console.log("=== DOCKER SANDBOX TEST ===\n");

  const testUserId = "test-docker-user";

  // Test 1: Execute simple command
  console.log("=== TEST 1: echo ===");
  const r1 = await executeInSandbox(testUserId, "echo 'Hello from Docker!'");
  console.log("stdout:", r1.stdout.trim());
  console.log("exitCode:", r1.exitCode);
  console.log("duration:", r1.durationMs + "ms");
  console.log("");

  // Test 2: Node.js version
  console.log("=== TEST 2: node version ===");
  const r2 = await executeInSandbox(testUserId, "node --version");
  console.log("Node version:", r2.stdout.trim());
  console.log("");

  // Test 3: Write + run a Node script
  console.log("=== TEST 3: Write + run Node script ===");
  await writeFileInSandbox(
    testUserId,
    "test.js",
    'console.log("Hello from Node in Docker!");\nconsole.log("2 + 2 =", 2 + 2);'
  );
  const r3 = await executeInSandbox(testUserId, "node test.js");
  console.log("stdout:", r3.stdout);
  console.log("");

  // Test 4: Read back
  console.log("=== TEST 4: Read file back ===");
  const content = await readFileInSandbox(testUserId, "test.js");
  console.log("Content:", content);
  console.log("");

  // Test 5: List files
  console.log("=== TEST 5: List files ===");
  const listing = await listFilesInSandbox(testUserId);
  console.log(listing);
  console.log("");

  // Test 6: Python check (may not exist in Node alpine)
  console.log("=== TEST 6: Check tools ===");
  const r6 = await executeInSandbox(
    testUserId,
    "which node npm sh ls && echo '---' && cat /etc/os-release | head -2"
  );
  console.log(r6.stdout);
  console.log("");

  // Test 7: Forbidden command
  console.log("=== TEST 7: Forbidden command ===");
  try {
    await executeInSandbox(testUserId, "sudo rm -rf /");
    console.log("ERROR: Should have blocked!");
  } catch (err) {
    console.log("Blocked:", err instanceof Error ? err.message : err);
  }
  console.log("");

  // Cleanup
  console.log("=== CLEANUP ===");
  console.log("Active sandboxes:", getActiveSandboxCount());
  await destroySandbox(testUserId);
  console.log("Destroyed. Remaining:", getActiveSandboxCount());
  console.log("");

  console.log("=== ALL TESTS COMPLETE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

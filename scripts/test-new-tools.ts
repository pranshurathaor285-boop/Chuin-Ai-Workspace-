import "dotenv/config";
import { toolRegistry } from "../src/lib/agent/tools/registry";
import { executeTool } from "../src/lib/agent/tools/executor";

async function main() {
  console.log("=== NEW TOOLS TEST ===\n");
  console.log("Total tools:", toolRegistry.size());
  for (const t of toolRegistry.getAll()) {
    console.log(`  - ${t.name} [${t.permissionLevel}]`);
  }
  console.log("");

  const context = {
    userId: "test-user-new-tools",
    workspaceRoot: "/tmp/chuin-test-2",
  };

  console.log("=== TEST 1: filesystem.write ===");
  const w = await executeTool(
    "filesystem.write",
    { path: "test.txt", content: "Original content here" },
    context
  );
  console.log("Success:", w.success, "| Output:", JSON.stringify(w.output));
  console.log("");

  console.log("=== TEST 2: filesystem.edit ===");
  const e = await executeTool(
    "filesystem.edit",
    { path: "test.txt", oldContent: "Original", newContent: "Modified" },
    context
  );
  console.log("Success:", e.success, "| Output:", JSON.stringify(e.output));
  console.log("");

  console.log("=== TEST 3: filesystem.read (verify edit) ===");
  const r = await executeTool("filesystem.read", { path: "test.txt" }, context);
  console.log("Content:", r.output?.content);
  console.log("");

  console.log("=== TEST 4: terminal.execute (ls) ===");
  const t = await executeTool(
    "terminal.execute",
    { command: "ls -la" },
    context
  );
  console.log("Success:", t.success);
  console.log("Stdout:", t.output?.stdout);
  console.log("");

  console.log("=== TEST 5: Forbidden command (should fail) ===");
  const bad = await executeTool(
    "terminal.execute",
    { command: "sudo rm -rf /" },
    context
  );
  console.log("Success (expected false):", bad.success);
  console.log("Error:", bad.error);
  console.log("");

  console.log("=== TEST 6: filesystem.delete ===");
  const d = await executeTool(
    "filesystem.delete",
    { path: "test.txt" },
    context
  );
  console.log("Success:", d.success, "| Output:", JSON.stringify(d.output));
  console.log("");

  console.log("=== ALL TESTS COMPLETE ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

import "dotenv/config";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

async function main() {
  console.log("=== TEST 1: Simple LLM call (no tools) ===\n");
  console.log("API Key present:", !!process.env.OPENROUTER_API_KEY);
  console.log("Key prefix:", process.env.OPENROUTER_API_KEY?.slice(0, 12) + "...");
  console.log("");

  const start = Date.now();

  try {
    const result = await generateText({
      model: openrouter("nvidia/nemotron-3.5-lightning:free"),
      prompt: "Say hello in 3 words.",
    });

    console.log("✅ Success in", Date.now() - start, "ms");
    console.log("Response:", result.text);
  } catch (err) {
    console.error("❌ Failed in", Date.now() - start, "ms");
    console.error("Error:", err instanceof Error ? err.message : err);
  }

  process.exit(0);
}

main();

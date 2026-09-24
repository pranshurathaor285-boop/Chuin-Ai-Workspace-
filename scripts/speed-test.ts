import "dotenv/config";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

const MODELS = [
  "nvidia/nemotron-3.5-lightning:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3.8-27b:free",
  "google/gemma-4-31b-it:free",
  "openrouter/free",
];

async function testModel(modelId: string) {
  const start = Date.now();
  try {
    const result = await generateText({
      model: openrouter(modelId),
      prompt: "Say hi in 3 words.",
    });
    const duration = Date.now() - start;
    console.log(`✅ ${modelId.padEnd(45)} | ${duration}ms | "${result.text.trim()}"`);
    return duration;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ ${modelId.padEnd(45)} | ${duration}ms | ${err instanceof Error ? err.message : 'failed'}`);
    return -1;
  }
}

async function main() {
  console.log("=== MODEL SPEED TEST ===\n");
  for (const model of MODELS) {
    await testModel(model);
  }
  console.log("\n=== TEST COMPLETE ===");
  process.exit(0);
}

main();

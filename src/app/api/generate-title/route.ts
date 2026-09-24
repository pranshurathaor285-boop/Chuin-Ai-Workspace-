import { NextRequest, NextResponse } from "next/server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export const runtime = "edge";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Truncate very long messages
    const truncated =
      message.length > 500 ? message.slice(0, 500) + "..." : message;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openrouter/free",
        messages: [
          {
            role: "system",
            content:
              "You generate short, descriptive titles for chat conversations. Given the user's first message, reply with ONLY a title — 2-5 words, no quotes, no punctuation at the end, no explanation. Use Title Case. Examples: 'React Hooks Explained', 'Python Debugging Help', 'Landing Page Design', 'SQL Query Optimization'.",
          },
          {
            role: "user",
            content: `User's first message: "${truncated}"\n\nGenerate a 2-5 word title:`,
          },
        ],
        temperature: 0.3,
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const data = await response.json();
    let title =
      data.choices?.[0]?.message?.content?.trim() || "";

    // Clean up the title
    title = title
      .replace(/^["']|["']$/g, "") // remove quotes
      .replace(/[.!?]+$/, "") // remove trailing punctuation
      .trim();

    // Fallback if empty or too long
    if (!title || title.length > 60) {
      title = message.slice(0, 40).trim() || "New Chat";
    }

    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation error:", error);
    // Fallback — use first 40 chars
    return NextResponse.json(
      { title: "New Chat" },
      { status: 200 }
    );
  }
}

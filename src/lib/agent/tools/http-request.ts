import { z } from "zod";
import type { ToolDefinition, ToolContext } from "./types";

const HttpInputSchema = z.object({
  url: z.string().url().describe("The URL to request"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .default("GET")
    .describe("HTTP method"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional headers as key-value pairs"),
  body: z.string().optional().describe("Optional request body (for POST/PUT/PATCH)"),
});

const HttpOutputSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  truncated: z.boolean(),
  durationMs: z.number(),
});

const MAX_BODY = 50000; // 50KB cap
const TIMEOUT = 20000;

// Blocked hosts (security)
const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.",
  "10.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "::1",
];

export const httpRequestTool: ToolDefinition<
  z.infer<typeof HttpInputSchema>,
  z.infer<typeof HttpOutputSchema>
> = {
  name: "http.request",
  description:
    "Make an HTTP request to an external URL. Supports GET, POST, PUT, DELETE, PATCH. Cannot access localhost or internal networks (SSRF protection). Returns status, headers, and body. Max 50KB response.",
  inputSchema: HttpInputSchema,
  outputSchema: HttpOutputSchema,
  permissionLevel: "EXTERNAL",
  timeout: TIMEOUT + 5000,
  agentAccess: ["coding", "general"],
  async execute(input, context) {
    // Parse URL and check for SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      throw new Error("Invalid URL");
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    for (const blocked of BLOCKED_HOSTS) {
      if (hostname === blocked || hostname.startsWith(blocked)) {
        throw new Error(
          `Cannot request internal/local URL: ${hostname}. SSRF protection active.`
        );
      }
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.text();
      const truncated = body.length > MAX_BODY;
      const finalBody = truncated
        ? body.slice(0, MAX_BODY) + "\n[...truncated]"
        : body;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: finalBody,
        truncated,
        durationMs: Date.now() - start,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timed out after ${TIMEOUT}ms`);
      }
      throw new Error(`Request failed: ${error.message}`);
    }
  },
};

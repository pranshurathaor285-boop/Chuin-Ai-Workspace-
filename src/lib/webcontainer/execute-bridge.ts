"use client";

/**
 * Client-side bridge that lets the chat UI execute commands
 * in the WebContainer when the AI calls terminal.execute.
 *
 * The AI runs server-side, but WebContainer runs client-side.
 * This bridge lets us:
 *   1. Send commands from server → client via SSE/streaming
 *   2. Execute in WebContainer
 *   3. Return results to server
 */

export interface ExecuteRequest {
  requestId: string;
  command: string;
  args?: string[];
  cwd?: string;
}

export interface ExecuteResponse {
  requestId: string;
  exit: number;
  stdout: string;
  stderr: string;
}

type Executor = (req: ExecuteRequest) => Promise<ExecuteResponse>;

let executor: Executor | null = null;

export function registerExecutor(fn: Executor) {
  executor = fn;
}

export function unregisterExecutor() {
  executor = null;
}

export async function executeInWebContainer(
  req: ExecuteRequest
): Promise<ExecuteResponse> {
  if (!executor) {
    throw new Error(
      "WebContainer executor not registered. Make sure WebContainerProvider is mounted."
    );
  }
  return executor(req);
}

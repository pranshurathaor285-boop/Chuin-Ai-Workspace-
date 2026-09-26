import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

/**
 * Docker-based sandbox manager for running AI-generated code.
 * Each user gets a persistent container that survives across commands.
 */

interface SandboxInfo {
  containerId: string;
  userId: string;
  createdAt: Date;
  status: "running" | "stopped";
}

// In-memory map: userId → containerId
// (In production, this should be in Redis or DB)
const activeContainers = new Map<string, SandboxInfo>();

const IMAGE = "node:20-slim";
const CONTAINER_PREFIX = "chuin-sandbox";
const MAX_OUTPUT_BYTES = 50000;
const DEFAULT_TIMEOUT_MS = 30000;
let legacyCleanupPromise: Promise<void> | null = null;

/** Remove containers left behind by the previous Alpine-based sandbox image. */
export function cleanupOldContainers(): Promise<void> {
  if (!legacyCleanupPromise) {
    legacyCleanupPromise = (async () => {
      try {
        const { stdout } = await execAsync(
          "docker ps -aq --filter ancestor=node:20-alpine"
        );
        const containerIds = stdout.trim().split(/\s+/).filter(Boolean);
        if (containerIds.length > 0) {
          await execAsync(`docker rm -f ${containerIds.join(" ")}`);
          console.info(`Removed ${containerIds.length} legacy sandbox container(s)`);
        }
      } catch (error) {
        console.error("Failed to clean up legacy sandbox containers:", error);
        legacyCleanupPromise = null;
        throw error;
      }
    })();
  }
  return legacyCleanupPromise;
}

/**
 * Get or create a sandbox container for a user.
 */
export async function getOrCreateSandbox(userId: string): Promise<string> {
  await cleanupOldContainers();

  // Check if we already have an active container
  const existing = activeContainers.get(userId);
  if (existing) {
    try {
      const { stdout } = await execAsync(
        `docker inspect -f '{{.State.Running}}' ${existing.containerId}`
      );
      if (stdout.trim() === "true") {
        return existing.containerId;
      }
    } catch (error) {
      console.warn("Cached sandbox container is unavailable:", error);
      // Container is gone, remove from map and create new
      activeContainers.delete(userId);
    }
  }

  // Create new container
  const containerName = `${CONTAINER_PREFIX}-${userId.slice(0, 12)}-${crypto.randomBytes(4).toString("hex")}`;

  const { stdout } = await execAsync(
    `docker run -d --name ${containerName} ` +
      `-p 0:3000 ` + // dynamic host port mapped to container 3000
      `-p 0:5173 ` + // Vite
      `-p 0:8080 ` + // Alt
      `--memory 1g ` +
      `--cpus 1 ` +
      `--workdir /workspace ` +
      `--entrypoint sh ` +
      `${IMAGE} ` +
      `-c "mkdir -p /workspace && sleep infinity"`,
    { timeout: 60000 }
  );

  const containerId = stdout.trim();

  activeContainers.set(userId, {
    containerId,
    userId,
    createdAt: new Date(),
    status: "running",
  });

  return containerId;
}

/**
 * Execute a command inside the user's sandbox.
 */
export async function executeInSandbox(
  userId: string,
  command: string,
  options: {
    timeoutMs?: number;
    workdir?: string;
  } = {}
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  truncated: boolean;
  durationMs: number;
}> {
  const startTime = Date.now();
  const timeout = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const workdir = options.workdir || "/workspace";

  // Validate command (basic safety)
  const FORBIDDEN = [
    /\brm\s+-rf\s+\/(?!workspace)/, // rm -rf / but not /workspace
    /\bsudo\b/,
    /\/etc\/shadow/,
    /\/etc\/passwd/,
    /\bdocker\b/, // no docker-in-docker escape
  ];

  for (const pattern of FORBIDDEN) {
    if (pattern.test(command)) {
      throw new Error(
        `Forbidden command pattern detected: ${command.slice(0, 50)}`
      );
    }
  }

  const containerId = await getOrCreateSandbox(userId);

  try {
    const { stdout, stderr } = await execAsync(
      `docker exec -w ${workdir} ${containerId} sh -c ${JSON.stringify(command)}`,
      {
        timeout,
        maxBuffer: MAX_OUTPUT_BYTES * 2,
      }
    );

    return {
      stdout: truncateOutput(stdout),
      stderr: truncateOutput(stderr),
      exitCode: 0,
      truncated: stdout.length > MAX_OUTPUT_BYTES,
      durationMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    // exec throws on non-zero exit
    if (!(error instanceof Error)) {
      console.error("Sandbox command failed with a non-Error value:", error);
      throw error;
    }
    const execError = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
    const stdout = execError.stdout || "";
    const stderr = execError.stderr || execError.message || "";

    return {
      stdout: truncateOutput(stdout),
      stderr: truncateOutput(stderr),
      exitCode: typeof execError.code === "number" ? execError.code : 1,
      truncated: stdout.length > MAX_OUTPUT_BYTES,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Write a file inside the sandbox.
 */
export async function writeFileInSandbox(
  userId: string,
  path: string,
  content: string
): Promise<void> {
  const containerId = await getOrCreateSandbox(userId);
  const fullPath = path.startsWith("/") ? path : `/workspace/${path}`;

  // Ensure parent dir exists
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  if (dir) {
    await execAsync(`docker exec ${containerId} mkdir -p ${dir}`);
  }

  // Write via stdin (base64 to avoid shell escaping issues)
  const encoded = Buffer.from(content, "utf-8").toString("base64");
  await execAsync(
    `docker exec ${containerId} sh -c "echo '${encoded}' | base64 -d > ${fullPath}"`
  );
}

/**
 * Read a file from the sandbox.
 */
export async function readFileInSandbox(
  userId: string,
  path: string
): Promise<string> {
  const containerId = await getOrCreateSandbox(userId);
  const fullPath = path.startsWith("/") ? path : `/workspace/${path}`;

  const { stdout } = await execAsync(`docker exec ${containerId} cat ${fullPath}`);
  return stdout;
}

/**
 * List files in the sandbox.
 */
export async function listFilesInSandbox(
  userId: string,
  path: string = "/workspace"
): Promise<string> {
  const containerId = await getOrCreateSandbox(userId);
  const { stdout } = await execAsync(
    `docker exec ${containerId} ls -la ${path}`
  );
  return stdout;
}

/**
 * Destroy the user's sandbox.
 */
export async function destroySandbox(userId: string): Promise<void> {
  const info = activeContainers.get(userId);
  if (!info) return;

  try {
    await execAsync(`docker rm -f ${info.containerId}`);
  } catch (error) {
    console.warn("Failed to remove sandbox container:", error);
  }

  activeContainers.delete(userId);
}

/**
 * Get the count of active sandboxes.
 */
export function getActiveSandboxCount(): number {
  return activeContainers.size;
}

function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_BYTES) {
    return output.slice(0, MAX_OUTPUT_BYTES) + "\n[...truncated]";
  }
  return output;
}


/**
 * Get the public URL for a container port.
 * Returns the mapped host URL or null if not exposed.
 */
export async function getPortUrl(
  userId: string,
  containerPort: number
): Promise<string | null> {
  const info = activeContainers.get(userId);
  if (!info) return null;

  try {
    const { stdout } = await execAsync(
      `docker port ${info.containerId} ${containerPort}`
    );
    // Output like: 0.0.0.0:49152
    const match = stdout.trim().match(/:(\d+)$/);
    if (!match) return null;

    const hostPort = match[1];
    // In Codespaces, use the Codespaces URL pattern
    const codespaceName = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

    if (codespaceName && domain) {
      return `https://${codespaceName}-${hostPort}.${domain}`;
    }

    return `http://localhost:${hostPort}`;
  } catch (error) {
    console.error("Failed to resolve sandbox port URL:", error);
    return null;
  }
}

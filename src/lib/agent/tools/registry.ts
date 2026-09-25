import type { ToolDefinition } from "./types";
import {
  filesystemReadTool,
  filesystemWriteTool,
  filesystemListTool,
} from "./filesystem";
import { filesystemEditTool } from "./filesystem-edit";
import { filesystemDeleteTool } from "./filesystem-delete";
import { filesystemSearchTool } from "./filesystem-search";
import { terminalExecuteTool } from "./terminal";
import { httpRequestTool } from "./http-request";
import { gitTool } from "./git";
import {
  projectFilesReadTool,
  projectFilesWriteTool,
  projectFilesListTool,
  projectFilesDeleteTool,
} from "./filesystem-project";
import {
  projectCheckpointCreateTool,
  projectCheckpointListTool,
  projectCheckpointRestoreTool,
} from "./checkpoint";
import {
  sandboxExecuteTool,
  sandboxWriteTool,
  sandboxReadTool,
  sandboxListTool,
} from "./docker-sandbox";

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByPermission(level: string): ToolDefinition[] {
    return this.getAll().filter((t) => t.permissionLevel === level);
  }

  getForAgent(agentType: string): ToolDefinition[] {
    return this.getAll().filter((t) => t.agentAccess.includes(agentType));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }
}

export const toolRegistry = new ToolRegistry();

// =====================
// REGISTER ALL TOOLS
// =====================

// Filesystem tools (6)
toolRegistry.register(filesystemReadTool);
toolRegistry.register(filesystemWriteTool);
toolRegistry.register(filesystemListTool);
toolRegistry.register(filesystemEditTool);
toolRegistry.register(filesystemDeleteTool);
toolRegistry.register(filesystemSearchTool);

// Terminal
toolRegistry.register(terminalExecuteTool);

// External
toolRegistry.register(httpRequestTool);

// Git
toolRegistry.register(gitTool);

// Project filesystem (Phase 4)
toolRegistry.register(projectFilesReadTool);
toolRegistry.register(projectFilesWriteTool);
toolRegistry.register(projectFilesListTool);
toolRegistry.register(projectFilesDeleteTool);

// Checkpoints (Phase 4)
toolRegistry.register(projectCheckpointCreateTool);
toolRegistry.register(projectCheckpointListTool);
toolRegistry.register(projectCheckpointRestoreTool);

// Docker sandbox (Phase 5)
toolRegistry.register(sandboxExecuteTool);
toolRegistry.register(sandboxWriteTool);
toolRegistry.register(sandboxReadTool);
toolRegistry.register(sandboxListTool);

if (process.env.NODE_ENV === "development") {
  console.log(
    `[ToolRegistry] Registered ${toolRegistry.size()} tools:`,
    toolRegistry.getAll().map((t) => t.name).join(", ")
  );
}

export default toolRegistry;

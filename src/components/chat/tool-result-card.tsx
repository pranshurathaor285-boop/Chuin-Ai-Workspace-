"use client";

import { memo } from "react";

export interface ToolResultData {
  toolName: string;
  input: any;
  output: any;
  success: boolean;
}

function CardShell({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <span>{icon}</span>
        <span className="truncate">{title}</span>
      </div>
      <div className="max-h-[400px] overflow-auto">{children}</div>
    </div>
  );
}

export const ToolResultCard = memo(function ToolResultCard({
  result,
}: {
  result: ToolResultData;
}) {
  const { toolName, input, output, success } = result;

  if (!success || !output) {
    return (
      <CardShell icon="⚠️" title={`${toolName} failed`}>
        <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {output?.error || "Tool execution failed"}
        </div>
      </CardShell>
    );
  }

  // filesystem.read
  if (toolName === "filesystem.read" || toolName === "filesystem_read") {
    const content = output.content || "";
    const truncated = output.truncated;
    return (
      <CardShell
        icon="📄"
        title={`${input?.path || "file"} (${output.size || content.length} bytes)`}
      >
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>{content}</code>
        </pre>
        {truncated && (
          <div className="border-t border-neutral-100 px-3 py-1 text-[10px] text-neutral-500 dark:border-neutral-800">
            [...truncated]
          </div>
        )}
      </CardShell>
    );
  }

  // filesystem.write
  if (toolName === "filesystem.write" || toolName === "filesystem_write") {
    return (
      <CardShell icon="✍️" title={`Wrote ${input?.path || "file"}`}>
        <div className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          <div>
            Bytes written:{" "}
            <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
              {output.bytesWritten}
            </span>
          </div>
          <div>
            Status:{" "}
            <span className="font-medium text-green-600 dark:text-green-400">
              {output.created ? "Created" : "Updated"}
            </span>
          </div>
        </div>
      </CardShell>
    );
  }

  // filesystem.edit
  if (toolName === "filesystem.edit" || toolName === "filesystem_edit") {
    return (
      <CardShell icon="✏️" title={`Edited ${input?.path || "file"}`}>
        <div className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          Replacements:{" "}
          <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
            {output.replacements}
          </span>
        </div>
      </CardShell>
    );
  }

  // filesystem.delete
  if (toolName === "filesystem.delete" || toolName === "filesystem_delete") {
    return (
      <CardShell icon="🗑️" title={`Deleted ${input?.path || "item"}`}>
        <div className="px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">
          Type: {output.type}
        </div>
      </CardShell>
    );
  }

  // filesystem.list
  if (toolName === "filesystem.list" || toolName === "filesystem_list") {
    const entries = output.entries || [];
    return (
      <CardShell icon="📁" title={`${output.total || entries.length} entries`}>
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {entries.slice(0, 30).map((entry: any, i: number) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              <span>{entry.type === "directory" ? "📁" : "📄"}</span>
              <span className="flex-1 truncate font-mono text-[11px]">
                {entry.path}
              </span>
              {entry.size !== undefined && (
                <span className="text-[10px] text-neutral-400">
                  {entry.size} B
                </span>
              )}
            </div>
          ))}
          {entries.length > 30 && (
            <div className="px-3 py-1.5 text-[10px] text-neutral-500">
              ...and {entries.length - 30} more
            </div>
          )}
        </div>
      </CardShell>
    );
  }

  // filesystem.search
  if (toolName === "filesystem.search" || toolName === "filesystem_search") {
    const matches = output.matches || [];
    return (
      <CardShell
        icon="🔍"
        title={`${output.totalMatches || matches.length} matches in ${output.totalFiles} files`}
      >
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {matches.slice(0, 20).map((m: any, i: number) => (
            <div key={i} className="px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <span className="font-mono">{m.file}</span>
                <span>:</span>
                <span>{m.line}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                {m.content}
              </div>
            </div>
          ))}
          {matches.length > 20 && (
            <div className="px-3 py-1.5 text-[10px] text-neutral-500">
              ...and {matches.length - 20} more
            </div>
          )}
        </div>
      </CardShell>
    );
  }

  // terminal.execute
  if (toolName === "terminal.execute" || toolName === "terminal_execute") {
    return (
      <CardShell icon="💻" title={`$ ${input?.command || "command"}`}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>
            {output.stdout || ""}
            {output.stderr && (
              <span className="text-red-600 dark:text-red-400">
                {"\n" + output.stderr}
              </span>
            )}
          </code>
        </pre>
        <div className="border-t border-neutral-100 px-3 py-1 text-[10px] text-neutral-500 dark:border-neutral-800">
          exit code: {output.exitCode}
        </div>
      </CardShell>
    );
  }

  // http.request
  if (toolName === "http.request" || toolName === "http_request") {
    return (
      <CardShell
        icon="🌐"
        title={`${output.status} ${output.statusText} · ${output.durationMs}ms`}
      >
        <div className="px-3 py-2">
          <div className="mb-2 font-mono text-[10px] text-neutral-500">
            {input?.method || "GET"} {input?.url}
          </div>
          <pre className="m-0 max-h-[200px] overflow-auto rounded bg-neutral-50 p-2 text-[10px] text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
            <code>{output.body?.slice(0, 2000) || ""}</code>
          </pre>
        </div>
      </CardShell>
    );
  }

  // git.execute
  if (toolName === "git.execute" || toolName === "git_execute") {
    return (
      <CardShell icon="🔀" title={`$ git ${input?.command || ""}`}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>
            {output.stdout || ""}
            {output.stderr && (
              <span className="text-red-600 dark:text-red-400">
                {"\n" + output.stderr}
              </span>
            )}
          </code>
        </pre>
      </CardShell>
    );
  }

  // Fallback
  return (
    <CardShell icon="🔧" title={toolName}>
      <pre className="m-0 overflow-x-auto px-3 py-2 text-[10px] text-neutral-700 dark:text-neutral-300">
        <code>{JSON.stringify(output, null, 2).slice(0, 1000)}</code>
      </pre>
    </CardShell>
  );
});

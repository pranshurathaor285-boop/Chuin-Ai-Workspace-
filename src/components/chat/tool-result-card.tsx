"use client";

import { memo } from "react";
import { PreviewCard } from "@/components/chat/preview-card";

type DataRecord = Record<string, unknown>;

export interface ToolResultData {
  toolName: string;
  input: unknown;
  output: unknown;
  success: boolean;
}

function asRecord(value: unknown): DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DataRecord)
    : {};
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatOutput(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch (error) {
    console.error("Failed to format tool output:", error);
    return String(value);
  }
}

function inputSummary(input: DataRecord): string {
  const method = asText(input.method);
  const url = asText(input.url);
  if (url) return `${method || "GET"} ${url}`;
  const command = asText(input.command);
  if (command) return command;
  const path = asText(input.path);
  if (path) return path;
  const query = asText(input.query ?? input.pattern);
  if (query) return query;
  const checkpoint = asText(input.checkpointId ?? input.projectId);
  if (checkpoint) return checkpoint;
  return "No input details";
}

function CardShell({
  icon,
  title,
  summary,
  success,
  children,
}: {
  icon: string;
  title: string;
  summary: string;
  success: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <span>{icon}</span>
        <span className="truncate">{title}</span>
        <span
          className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            success
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {success ? "Success" : "Failed"}
        </span>
      </div>
      <div className="max-h-[400px] overflow-auto">
        <div className="border-b border-neutral-100 bg-neutral-50/70 px-3 py-2 text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400">
          <span className="mr-2 font-medium text-neutral-500 dark:text-neutral-500">
            Input
          </span>
          <code className="break-all">{summary}</code>
        </div>
        {children}
      </div>
    </div>
  );
}

export const ToolResultCard = memo(function ToolResultCard({
  result,
}: {
  result: ToolResultData;
}) {
  const { toolName, input, output, success } = result;
  const args = asRecord(input);
  const data = asRecord(output);
  const normalizedName = toolName.replaceAll("_", ".");
  const exitCode = typeof data.exitCode === "number" ? data.exitCode : null;
  const succeeded =
    success && exitCode !== null ? exitCode === 0 : success && data.error === undefined;
  const summary = inputSummary(args);
  const outputError = asText(data.error, typeof output === "string" ? output : "Tool execution failed");

  if (normalizedName === "preview.start") {
    return (
      <PreviewCard
        url={typeof data.url === "string" ? data.url : null}
        port={typeof data.port === "number" ? data.port : 3000}
        logs={asText(data.logPreview)}
      />
    );
  }

  if (
    normalizedName === "sandbox.execute" ||
    normalizedName === "terminal.execute" ||
    normalizedName === "git.execute"
  ) {
    const stdout = asText(data.stdout);
    const stderr = asText(data.stderr);
    return (
      <CardShell
        icon="⌘"
        title={toolName}
        summary={summary}
        success={succeeded}
      >
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>
            {stdout}
            {stderr && <span className="text-red-600 dark:text-red-400">{`${stdout ? "\n" : ""}${stderr}`}</span>}
          </code>
        </pre>
        {exitCode !== null && (
          <div className="border-t border-neutral-100 px-3 py-1 text-[10px] text-neutral-500 dark:border-neutral-800">
            <span className={exitCode === 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              exit code: {exitCode}
            </span>
          </div>
        )}
        {!success && <div className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{outputError}</div>}
      </CardShell>
    );
  }

  if (
    normalizedName === "filesystem.read" ||
    normalizedName === "project.files.read" ||
    normalizedName === "sandbox.read"
  ) {
    const content = asText(data.content ?? output);
    const path = asText(data.path ?? args.path, "file");
    return (
      <CardShell icon="▤" title={`${toolName}: ${path}`} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>{content}</code>
        </pre>
      </CardShell>
    );
  }

  if (
    normalizedName === "filesystem.write" ||
    normalizedName === "project.files.write" ||
    normalizedName === "sandbox.write"
  ) {
    const path = asText(data.path ?? args.path, "file");
    const bytes = data.bytesWritten ?? data.size ?? (typeof args.content === "string" ? args.content.length : undefined);
    const status =
      data.created === true
        ? "Created"
        : data.created === false
          ? "Updated"
          : "Created/updated";
    return (
      <CardShell icon="✎" title={`${toolName}: ${path}`} summary={summary} success={succeeded}>
        <div className="space-y-1 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300">
          <div>{status}{bytes === undefined ? "" : ` · ${String(bytes)} bytes written`}</div>
        </div>
      </CardShell>
    );
  }

  if (
    normalizedName === "filesystem.list" ||
    normalizedName === "project.files.list" ||
    normalizedName === "sandbox.list"
  ) {
    const listing = data.listing;
    const entries = asList(data.entries);
    const body = typeof listing === "string" ? listing : entries.length > 0 ? formatOutput(entries) : formatOutput(output);
    return (
      <CardShell icon="▰" title={toolName} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>{body}</code>
        </pre>
      </CardShell>
    );
  }

  if (normalizedName === "filesystem.search") {
    return (
      <CardShell icon="⌕" title={toolName} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          <code>{formatOutput(data.matches ?? output)}</code>
        </pre>
      </CardShell>
    );
  }

  if (
    normalizedName === "filesystem.delete" ||
    normalizedName === "project.files.delete"
  ) {
    return (
      <CardShell icon="⌫" title={toolName} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300">
          <code>{formatOutput(output)}</code>
        </pre>
      </CardShell>
    );
  }

  if (normalizedName === "filesystem.edit") {
    return (
      <CardShell icon="✎" title={toolName} summary={summary} success={succeeded}>
        <div className="px-3 py-2 text-xs text-neutral-700 dark:text-neutral-300">
          Replacements: {asText(data.replacements, formatOutput(output))}
        </div>
      </CardShell>
    );
  }

  if (normalizedName === "http.request") {
    return (
      <CardShell icon="↗" title={toolName} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-auto px-3 py-2 text-[11px] text-neutral-700 dark:text-neutral-300">
          <code>{asText(data.body, formatOutput(output)).slice(0, 4000)}</code>
        </pre>
      </CardShell>
    );
  }

  if (normalizedName.startsWith("project.checkpoint.")) {
    return (
      <CardShell icon="◷" title={toolName} summary={summary} success={succeeded}>
        <pre className="m-0 overflow-x-auto px-3 py-2 text-[11px] text-neutral-700 dark:text-neutral-300">
          <code>{formatOutput(output)}</code>
        </pre>
      </CardShell>
    );
  }

  return (
    <CardShell icon="⚙" title={toolName} summary={summary} success={succeeded}>
      <pre className="m-0 overflow-x-auto px-3 py-2 text-[10px] text-neutral-700 dark:text-neutral-300">
        <code>{formatOutput(output).slice(0, 4000)}</code>
      </pre>
    </CardShell>
  );
});

"use client";

import { memo, useState } from "react";

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "unchanged";
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

function StatusBadge({ status }: { status: FileDiff["status"] }) {
  const colors = {
    added: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    modified: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    deleted: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    unchanged: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };
  const labels = {
    added: "Added",
    modified: "Modified",
    deleted: "Deleted",
    unchanged: "Unchanged",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export const DiffViewer = memo(function DiffViewer({
  diffs,
  defaultCollapsed = false,
}: {
  diffs: FileDiff[];
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of diffs) {
      init[d.path] = !defaultCollapsed;
    }
    return init;
  });

  const totalAdditions = diffs.reduce((sum, d) => sum + d.additions, 0);
  const totalDeletions = diffs.reduce((sum, d) => sum + d.deletions, 0);

  if (diffs.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        No changes
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300">
          <span>📊</span>
          <span>
            {diffs.length} file{diffs.length !== 1 ? "s" : ""} changed
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-green-600 dark:text-green-400">
            +{totalAdditions}
          </span>
          <span className="font-mono text-red-600 dark:text-red-400">
            −{totalDeletions}
          </span>
        </div>
      </div>

      {/* File list */}
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {diffs.map((diff) => {
          const isExpanded = expanded[diff.path];
          const visibleLines = isExpanded ? diff.lines : diff.lines.slice(0, 6);
          const hasMore = diff.lines.length > 6;

          return (
            <div key={diff.path}>
              {/* File header */}
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [diff.path]: !prev[diff.path],
                  }))
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  <span className="truncate font-mono text-xs text-neutral-800 dark:text-neutral-200">
                    {diff.path}
                  </span>
                  <StatusBadge status={diff.status} />
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[10px] font-mono">
                  {diff.additions > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      +{diff.additions}
                    </span>
                  )}
                  {diff.deletions > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      −{diff.deletions}
                    </span>
                  )}
                </div>
              </button>

              {/* Diff lines */}
              {isExpanded && (
                <div className="overflow-x-auto bg-neutral-50 dark:bg-neutral-950">
                  <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
                    <tbody>
                      {visibleLines.map((line, i) => {
                        const bgColor =
                          line.type === "add"
                            ? "bg-green-50 dark:bg-green-950/40"
                            : line.type === "remove"
                            ? "bg-red-50 dark:bg-red-950/40"
                            : "";
                        const textColor =
                          line.type === "add"
                            ? "text-green-800 dark:text-green-200"
                            : line.type === "remove"
                            ? "text-red-800 dark:text-red-200"
                            : "text-neutral-700 dark:text-neutral-300";
                        const prefix =
                          line.type === "add"
                            ? "+"
                            : line.type === "remove"
                            ? "−"
                            : " ";

                        return (
                          <tr key={i} className={bgColor}>
                            <td className="w-10 select-none border-r border-neutral-200 px-2 text-right text-[10px] text-neutral-400 dark:border-neutral-800">
                              {line.oldLine || ""}
                            </td>
                            <td className="w-10 select-none border-r border-neutral-200 px-2 text-right text-[10px] text-neutral-400 dark:border-neutral-800">
                              {line.newLine || ""}
                            </td>
                            <td
                              className={`whitespace-pre px-3 py-0.5 ${textColor}`}
                            >
                              <span className="mr-2 select-none opacity-60">
                                {prefix}
                              </span>
                              {line.content}
                            </td>
                          </tr>
                        );
                      })}
                      {hasMore && !isExpanded && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-1.5 text-center text-[10px] text-neutral-500 dark:text-neutral-400"
                          >
                            ...{diff.lines.length - 6} more lines — click to expand
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

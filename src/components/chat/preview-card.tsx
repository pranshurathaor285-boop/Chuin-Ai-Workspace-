"use client";

import { useEffect, useRef, useState } from "react";

export function PreviewCard({
  url,
  port,
  logs,
}: {
  url: string | null;
  port: number;
  logs?: string;
}) {
  const [frameKey, setFrameKey] = useState(0);
  const [loadState, setLoadState] = useState<{ key: string; failed: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameContainer = useRef<HTMLDivElement>(null);
  const loadTimeout = useRef<number | null>(null);
  const loadKey = `${url ?? ""}:${frameKey}`;
  const loadFailed = loadState?.key === loadKey && loadState.failed;

  useEffect(() => {
    if (!url) return;
    loadTimeout.current = window.setTimeout(() => {
      setLoadState({ key: loadKey, failed: true });
    }, 8000);
    return () => {
      if (loadTimeout.current) window.clearTimeout(loadTimeout.current);
    };
  }, [url, loadKey]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === frameContainer.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!frameContainer.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await frameContainer.current.requestFullscreen();
    }
  }

  return (
    <section ref={frameContainer} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <header className="flex min-h-11 flex-wrap items-center gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-100">Live Preview</span>
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          Port {port}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 hover:underline dark:text-blue-300">
              Open ↗
            </a>
          )}
          <button
            type="button"
            disabled={!url}
            onClick={() => setFrameKey((key) => key + 1)}
            title="Refresh preview"
            aria-label="Refresh preview"
            className="text-xs text-neutral-700 disabled:opacity-40 dark:text-neutral-300"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={!url}
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="text-xs text-neutral-700 disabled:opacity-40 dark:text-neutral-300"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </header>
      {url ? (
        <div className="bg-white dark:bg-neutral-900">
          {loadFailed && (
            <p role="status" className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Preview didn&apos;t load — try opening in a new tab.
            </p>
          )}
          <iframe
            key={frameKey}
            src={url}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
            className={`w-full ${isFullscreen ? "h-[calc(100vh-44px)]" : "h-[420px]"} border-0 bg-white dark:bg-neutral-900`}
            title="Live Preview"
            onLoad={() => {
              if (loadTimeout.current) window.clearTimeout(loadTimeout.current);
              setLoadState({ key: loadKey, failed: false });
            }}
          />
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-neutral-600 dark:text-neutral-400">
          Preview URL is unavailable.
        </p>
      )}
      {logs && (
        <details className="border-t border-neutral-200 dark:border-neutral-800">
          <summary className="cursor-pointer px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400">Server Logs</summary>
          <pre className="m-0 max-h-48 overflow-auto bg-neutral-50 px-3 py-2 text-[11px] text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            {logs}
          </pre>
        </details>
      )}
    </section>
  );
}
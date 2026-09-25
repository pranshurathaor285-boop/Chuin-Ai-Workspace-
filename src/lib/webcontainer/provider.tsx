"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import type { WebContainer, FileSystemTree } from "@webcontainer/api";

interface WebContainerContextValue {
  container: WebContainer | null;
  status: "idle" | "booting" | "ready" | "error";
  error: string | null;
  serverUrl: string | null;
  mountFiles: (tree: FileSystemTree) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  runCommand: (
    cmd: string,
    args?: string[],
    onOutput?: (data: string) => void
  ) => Promise<{ exit: number; output: string }>;
  spawnServer: (
    cmd: string,
    args?: string[]
  ) => Promise<{ port: number; url: string } | null>;
}

const WebContainerContext = createContext<WebContainerContextValue | null>(null);

let bootPromise: Promise<WebContainer> | null = null;

async function getWebContainer(): Promise<WebContainer> {
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    const { WebContainer } = await import("@webcontainer/api");
    return WebContainer.boot({
      coep: "credentialless",
      workdirName: "chuin-workspace",
    });
  })();

  return bootPromise;
}

export function WebContainerProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<"idle" | "booting" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    setStatus("booting");

    getWebContainer()
      .then((wc) => {
        setContainer(wc);
        setStatus("ready");

        // Listen for server-ready events
        wc.on("server-ready", (port, url) => {
          console.log("[WebContainer] Server ready on", port, url);
          setServerUrl(url);
        });
      })
      .catch((err) => {
        console.error("[WebContainer] Boot failed:", err);
        setError(err instanceof Error ? err.message : "Boot failed");
        setStatus("error");
      });
  }, []);

  const mountFiles = async (tree: FileSystemTree) => {
    if (!container) throw new Error("WebContainer not ready");
    await container.mount(tree);
  };

  const writeFile = async (path: string, content: string) => {
    if (!container) throw new Error("WebContainer not ready");

    // Ensure parent directories exist
    const parts = path.split("/").filter(Boolean);
    let currentPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath += "/" + parts[i];
      try {
        await container.fs.mkdir(currentPath, { recursive: true });
      } catch {
        // Directory may already exist
      }
    }

    await container.fs.writeFile(path.startsWith("/") ? path : `/${path}`, content);
  };

  const readFile = async (path: string) => {
    if (!container) throw new Error("WebContainer not ready");
    return container.fs.readFile(
      path.startsWith("/") ? path : `/${path}`,
      "utf-8"
    );
  };

  const runCommand = async (
    cmd: string,
    args: string[] = [],
    onOutput?: (data: string) => void
  ): Promise<{ exit: number; output: string }> => {
    if (!container) throw new Error("WebContainer not ready");

    const process = await container.spawn(cmd, args);
    let output = "";

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          output += data;
          onOutput?.(data);
        },
      })
    );

    const exitCode = await process.exit;
    return { exit: exitCode, output };
  };

  const spawnServer = async (
    cmd: string,
    args: string[] = []
  ): Promise<{ port: number; url: string } | null> => {
    if (!container) throw new Error("WebContainer not ready");

    const process = await container.spawn(cmd, args);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log("[WebContainer Server]", data);
        },
      })
    );

    // server-ready event will fire and set serverUrl
    // We need to wait for it
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 30000);

      const handler = (port: number, url: string) => {
        clearTimeout(timeout);
        container.off("server-ready", handler);
        resolve({ port, url });
      };

      container.on("server-ready", handler);
    });
  };

  return (
    <WebContainerContext.Provider
      value={{
        container,
        status,
        error,
        serverUrl,
        mountFiles,
        writeFile,
        readFile,
        runCommand,
        spawnServer,
      }}
    >
      {children}
    </WebContainerContext.Provider>
  );
}

export function useWebContainer() {
  const ctx = useContext(WebContainerContext);
  if (!ctx) {
    throw new Error("useWebContainer must be used inside WebContainerProvider");
  }
  return ctx;
}

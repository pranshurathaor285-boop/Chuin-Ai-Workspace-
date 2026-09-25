"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ProjectFile {
  id: string;
  path: string;
  language: string | null;
  size: number;
  updatedAt: string;
}

interface Checkpoint {
  id: string;
  name: string;
  fileCount: number;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);

  useEffect(() => {
    loadProject();
    loadFiles();
    loadCheckpoints();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.project) setProject(data.project);
    } catch (e) {
      console.error("Failed to load project:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      const data = await res.json();
      if (data.files) setFiles(data.files);
    } catch (e) {
      console.error("Failed to load files:", e);
    }
  };

  const loadCheckpoints = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/checkpoints`);
      const data = await res.json();
      if (data.checkpoints) setCheckpoints(data.checkpoints);
    } catch (e) {
      console.error("Failed to load checkpoints:", e);
    }
  };

  const handleSelectFile = async (path: string) => {
    setSelectedFile(path);
    setLoadingFile(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (data.file) setFileContent(data.file.content);
    } catch (e) {
      console.error("Failed to load file:", e);
      setFileContent("// Failed to load file");
    } finally {
      setLoadingFile(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <p className="text-sm text-neutral-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                ← Projects
              </Link>
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">
                {project.description}
              </p>
            )}
          </div>
          <Link
            href={`/chat/new?project=${projectId}`}
            className="shrink-0 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Chat with Chuin →
          </Link>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Files + Checkpoints */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          {/* Files section */}
          <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Files ({files.length})
              </span>
            </div>
            {files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center dark:border-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  No files yet
                </p>
                <p className="mt-1 text-[10px] text-neutral-400">
                  Start a chat to add files
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {files.map((file) => (
                  <button
                    key={file.id}
                    onClick={() => handleSelectFile(file.path)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      selectedFile === file.path
                        ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-400">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate font-mono">
                      {file.path}
                    </span>
                    <span className="shrink-0 text-[9px] text-neutral-400">
                      {formatSize(file.size)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Checkpoints section */}
          <div className="p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              Checkpoints ({checkpoints.length})
            </div>
            {checkpoints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center dark:border-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  No checkpoints yet
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-400">
                      <path d="M12 3v18" />
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{cp.name}</span>
                    <span className="shrink-0 text-[9px] text-neutral-400">
                      {formatDate(cp.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: File viewer */}
        <div className="flex flex-1 flex-col min-w-0">
          {selectedFile ? (
            <>
              <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-neutral-700 dark:text-neutral-300">
                    {selectedFile}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fileContent);
                  }}
                  className="rounded-lg px-2 py-1 text-[10px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  Copy
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-50 dark:bg-neutral-950">
                {loadingFile ? (
                  <div className="p-6 text-sm text-neutral-500">Loading...</div>
                ) : (
                  <pre className="m-0 p-4 text-[12px] leading-relaxed text-neutral-800 dark:text-neutral-200">
                    <code>{fileContent}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center">
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Select a file to view
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {files.length} file{files.length !== 1 ? "s" : ""} in this project
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

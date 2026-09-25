"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChatSearch } from "./chat-search";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string; _count?: { files: number } }>>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        if (data.conversations) setConversations(data.conversations);
      })
      .catch((e) => console.error("Failed to load conversations:", e));
  };

  const loadProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch((e) => console.error("Failed to load projects:", e));
  };

  useEffect(() => {
    onClose();
    setMenuOpenId(null);
  }, [pathname]);

  useEffect(() => {
    loadConversations();
    loadProjects();
  }, [pathname]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleOpenProject = (projectId: string) => {
    onClose();
    window.location.href = `/chat/new?project=${projectId}`;
  };

  const handleNewChat = () => {
    onClose();
    window.location.href = "/chat/new";
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/chat/${id}`) {
        window.location.href = "/chat/new";
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete chat.");
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  };

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
    setMenuOpenId(null);
  };

  const submitRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    setSavingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
      );
    } catch (err) {
      console.error("Rename failed:", err);
      alert("Failed to rename chat.");
    } finally {
      setSavingId(null);
      setRenamingId(null);
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    return date.toLocaleDateString();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-neutral-200 bg-white transition-transform duration-200 ease-out dark:border-neutral-800 dark:bg-neutral-950 md:static md:z-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
              C
            </div>
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              Chuin AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 md:hidden"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            New Chat
          </button>
        </div>

        <ChatSearch />

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {/* Projects Section */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Projects
              </span>
              <button
                onClick={() => {
                  onClose();
                  window.location.href = "/projects/new";
                }}
                className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                title="New project"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              </button>
            </div>

            {projects.length === 0 ? (
              <button
                onClick={() => {
                  onClose();
                  window.location.href = "/projects/new";
                }}
                className="w-full rounded-lg border border-dashed border-neutral-200 px-3 py-2 text-left text-[11px] text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200"
              >
                + Create your first project
              </button>
            ) : (
              <div className="space-y-0.5">
                {projects.slice(0, 5).map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <span className="shrink-0">📁</span>
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    {project._count && (
                      <span className="shrink-0 text-[9px] text-neutral-400">
                        {project._count.files}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Chats Section */}
          <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Recent Chats
          </div>

          {conversations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center dark:border-neutral-800">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                No chats yet
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map((conv) => (
                <div key={conv.id} className="relative">
                  {renamingId === conv.id ? (
                    <div className="rounded-lg border border-neutral-300 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
                      <input
                        ref={renameInputRef}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitRename(conv.id);
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                        placeholder="Chat name"
                      />
                      <div className="mt-2 flex items-center gap-1">
                        <button
                          onClick={() => submitRename(conv.id)}
                          disabled={savingId === conv.id || !renameValue.trim()}
                          className="flex-1 rounded-md bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-800 disabled:bg-neutral-300 dark:bg-neutral-100 dark:text-neutral-900"
                        >
                          {savingId === conv.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={cancelRename}
                          disabled={savingId === conv.id}
                          className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/chat/${conv.id}`}
                        className={`group flex items-center justify-between rounded-lg px-3 py-2 pr-9 text-sm transition-colors ${
                          isActive(`/chat/${conv.id}`)
                            ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                            : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{conv.title}</span>
                        <span className="ml-2 shrink-0 text-[10px] text-neutral-400 group-hover:hidden">
                          {formatDate(conv.updatedAt)}
                        </span>
                      </Link>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900 dark:hover:bg-neutral-700 dark:hover:text-neutral-100"
                        aria-label="Chat options"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {menuOpenId === conv.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                            <button
                              onClick={(e) => startRename(conv.id, conv.title, e)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                              Rename
                            </button>
                            <button
                              onClick={(e) => handleDelete(conv.id, e)}
                              disabled={deletingId === conv.id}
                              className="flex w-full items-center gap-2 border-t border-neutral-100 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-red-950"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                              {deletingId === conv.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <Link
            href="/settings"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive("/settings")
                ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Link>
        </div>
      </aside>
    </>
  );
}

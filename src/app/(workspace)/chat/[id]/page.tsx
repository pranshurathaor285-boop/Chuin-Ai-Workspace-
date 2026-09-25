"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect, memo, useMemo } from "react";
import { useParams } from "next/navigation";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ModelPicker } from "@/components/chat/model-picker";
import { ToolResultCard } from "@/components/chat/tool-result-card";
import { MessageActions } from "@/components/chat/message-actions";
import { DEFAULT_MODEL } from "@/lib/models";

const MemoizedUserMessage = memo(function MemoizedUserMessage({
  content,
}: {
  content: string;
}) {
  return (
    <div className="flex justify-end w-full">
      <div className="max-w-[85%] min-w-0 whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-neutral-900 px-4 py-3 text-sm text-white">
        {content}
      </div>
    </div>
  );
});


function ActivityIndicator({ activity }: { activity: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
      <div className="flex gap-1">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        <div
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span>{activity}</span>
    </div>
  );
}

interface PendingFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export default function ChatPage() {
  const params = useParams();
  const urlId = params.id as string;
  const isNew = urlId === "new";

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL);
  const [conversationId, setConversationId] = useState<string | null>(
    isNew ? null : urlId
  );
  const conversationIdRef = useRef<string | null>(isNew ? null : urlId);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef<boolean>(false);

  const { messages, append, isLoading, error, stop, setMessages } = useChat({
    api: "/api/chat",
    onFinish: async (message) => {
      setToolActivity(null);
      const convId = conversationIdRef.current;
      if (!convId || !message.content) return;
      try {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convId,
            role: "assistant",
            content: message.content,
          }),
        });
      } catch (e) {
        console.error("Failed to save assistant message:", e);
      }
    },
  });

  useEffect(() => {
    if (isNew || historyLoaded) return;
    fetch(`/api/conversations/${urlId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.messages && Array.isArray(data.messages) && setMessages) {
          setMessages(
            data.messages.map((m: any) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      })
      .catch((e) => console.error("Failed to load history:", e))
      .finally(() => setHistoryLoaded(true));
  }, [urlId, isNew, historyLoaded, setMessages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (userScrolledRef.current) return;
    const id = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let timeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const d = el.scrollHeight - el.scrollTop - el.clientHeight;
        userScrolledRef.current = d > 150;
      }, 50);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    });
    return () => cancelAnimationFrame(id);
  }, [input]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: PendingFile[] = [];
    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/attachments", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        uploaded.push(data.attachment);
      } catch (err) {
        console.error("Upload failed:", err);
        alert(`Failed to upload ${file.name}`);
      }
    }
    setPendingFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || isLoading || uploading)
      return;
    const userMessage = input.trim();
    setInput("");
    let finalContent = userMessage;
    if (pendingFiles.length > 0) {
      const fileList = pendingFiles.map((f) => `📎 ${f.name}`).join("\n");
      finalContent = userMessage
        ? `${userMessage}\n\n[Attached files:]\n${fileList}`
        : `[Attached files:]\n${fileList}`;
    }
    const currentPendingFiles = [...pendingFiles];
    setPendingFiles([]);
    let currentConvId = conversationId;
    if (!currentConvId) {
      try {
        // Generate a meaningful title in parallel (non-blocking)
        let title = (userMessage || currentPendingFiles[0]?.name || "New Chat")
          .trim()
          .slice(0, 40);

        try {
          const titleRes = await fetch("/api/generate-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userMessage || currentPendingFiles[0]?.name || "New Chat",
            }),
          });
          if (titleRes.ok) {
            const titleData = await titleRes.json();
            if (titleData.title) {
              title = titleData.title;
            }
          }
        } catch (titleErr) {
          console.error("Title generation failed (using fallback):", titleErr);
        }

        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        const data = await res.json();
        if (data.conversation?.id) {
          currentConvId = data.conversation.id;
          setConversationId(currentConvId);
          window.history.replaceState(null, "", `/chat/${currentConvId}`);
        }
      } catch (e) {
        console.error("Failed to create conversation:", e);
      }
    }
    if (currentConvId) {
      try {
        await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: currentConvId,
            role: "user",
            content: finalContent,
          }),
        });
      } catch (e) {
        console.error("Failed to save user message:", e);
      }
    }
    append({ role: "user", content: finalContent });
  };

  const renderedMessages = useMemo(() => {
    return messages.map((m, idx) => {
      const toolInvocations = (m as any).toolInvocations || [];

      return (
        <div key={m.id} className="space-y-3">
          {m.role === "user" ? (
            <div>
              <MemoizedUserMessage content={m.content} />
              <div className="mt-1 flex justify-end pr-1">
                <MessageActions content={m.content} isUser={true} />
              </div>
            </div>
          ) : (
            <>
              {toolInvocations.length > 0 && (
                <div className="space-y-2">
                  {toolInvocations.map((inv: any, i: number) => (
                    <ToolResultCard
                      key={`${m.id}-tool-${i}`}
                      result={{
                        toolName: inv.toolName,
                        input: inv.args,
                        output: inv.result,
                        success: inv.state === "result",
                      }}
                    />
                  ))}
                </div>
              )}

              {m.content && (
                <div className="flex flex-col">
                  <div className="flex justify-start w-full">
                    <div className="max-w-[85%] min-w-0 text-neutral-900 dark:text-neutral-100">
                      <MarkdownRenderer
                        content={m.content}
                        isStreaming={
                          isLoading && idx === messages.length - 1
                        }
                      />
                    </div>
                  </div>
                  {!(isLoading && idx === messages.length - 1) && (
                    <div className="mt-1 pl-1">
                      <MessageActions
                        content={m.content}
                        isUser={false}
                        onRegenerate={() => {
                          // Find last user message before this assistant
                          const before = messages.slice(0, idx).reverse();
                          const lastUser = before.find((x) => x.role === "user");
                          if (lastUser) {
                            append({ role: "user", content: lastUser.content });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      );
    });
  }, [messages, isLoading]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-50">
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            Chuin AI
          </h1>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 overscroll-contain"
        >
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 w-full">
            {renderedMessages}

            
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Error: {error.message}
              </div>
            )}
            {toolActivity && <ActivityIndicator activity={toolActivity} />}

            {isLoading && !toolActivity && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400" />
                  <div
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-400"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-xs text-neutral-500">
                  Chuin is thinking
                </span>
                <button
                  onClick={stop}
                  className="ml-2 text-xs text-neutral-500 underline hover:text-neutral-900"
                >
                  Stop
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-neutral-200 bg-neutral-50 px-4 pb-4 pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className=""
        >
          <div className="glass mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/70 p-4 shadow-lg backdrop-blur-2xl transition-all focus-within:border-neutral-300 focus-within:bg-white/85 focus-within:shadow-xl">
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs"
                  >
                    <span className="max-w-[120px] truncate text-neutral-700">
                      {file.name}
                    </span>
                    <span className="text-neutral-400">
                      {formatSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(file.id)}
                      className="rounded p-0.5 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                      aria-label="Remove file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Chuin anything..."
              className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none placeholder:text-neutral-400"
              rows={1}
              disabled={isLoading}
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <ModelPicker
                  selectedModel={selectedModel}
                  onSelect={setSelectedModel}
                  disabled={isLoading}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || isLoading}
                  className="group flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-white to-neutral-100 text-neutral-600 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(0,0,0,0.05)] transition-all hover:from-white hover:to-neutral-50 hover:text-neutral-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,1),inset_0_-1px_2px_rgba(0,0,0,0.06)] active:scale-95 active:shadow-[0_1px_3px_rgba(0,0,0,0.1),inset_0_1px_2px_rgba(0,0,0,0.06)] disabled:opacity-40"
                  aria-label="Attach file"
                >
                  {uploading ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={
                  (!input.trim() && pendingFiles.length === 0) ||
                  isLoading ||
                  uploading
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500"
                aria-label={isLoading ? "Stop" : "Send message"}
              >
                {isLoading ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  matchType: "title" | "message";
  snippet: string;
}

export function ChatSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/conversations/search?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.conversations || []);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
    setQuery("");
  }, [pathname]);

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

  return (
    <div className="relative px-3 pb-3" ref={containerRef}>
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search chats..."
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-neutral-600"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100" />
          </div>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 max-h-[60vh] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          {results.length === 0 && !loading ? (
            <div className="px-3 py-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No results found
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/chat/${r.id}`}
                  className="block border-b border-neutral-100 px-3 py-2.5 transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {r.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-neutral-400">
                      {formatDate(r.updatedAt)}
                    </span>
                  </div>
                  {r.matchType === "message" && r.snippet && (
                    <div className="mt-1 text-xs text-neutral-500 line-clamp-2 dark:text-neutral-400">
                      {r.snippet}
                    </div>
                  )}
                  {r.matchType === "title" && (
                    <div className="mt-1 text-[10px] text-neutral-400">
                      {r.messageCount} messages
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

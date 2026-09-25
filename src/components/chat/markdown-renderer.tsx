"use client";

import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { memo } from "react";
import { StreamingCursor } from "./streaming-cursor";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

const plugins = { code, math };
const controls = { code: true, table: true, mermaid: false };

export const MarkdownRenderer = memo(
  function MarkdownRenderer({
    content,
    isStreaming = false,
  }: MarkdownRendererProps) {
    return (
      <div className="prose prose-neutral max-w-none text-sm leading-relaxed break-words">
        <Streamdown
          plugins={plugins}
          isAnimating={isStreaming}
          controls={controls}
        >
          {content}
        </Streamdown>
        {isStreaming && <StreamingCursor />}
      </div>
    );
  },
  (prev, next) =>
    prev.content === next.content && prev.isStreaming === next.isStreaming
);

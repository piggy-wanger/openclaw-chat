"use client";

import { memo, useMemo } from "react";
import { format } from "date-fns";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallList } from "./ToolCallList";
import { ContentBlockCard } from "./ContentBlockCard";
import type { Message, ToolCall } from "@/lib/types";
import {
  parseContentBlocks,
  parseToolBlocks,
  getCombinedText,
} from "@/lib/contentBlocks";

type MessageItemProps = {
  message: Message;
  toolCalls?: ToolCall[];
};

function MessageItemInner({ message, toolCalls }: MessageItemProps) {
  const { role, content, createdAt } = message;

  // 格式化时间（HH:mm）
  const timestamp = format(new Date(createdAt), "HH:mm");

  // Parse content blocks
  const { toolBlocks, textContent } = useMemo(() => {
    const blocks = parseContentBlocks(content);
    if (blocks) {
      return {
        toolBlocks: parseToolBlocks(blocks),
        textContent: getCombinedText(blocks),
      };
    }
    return {
      toolBlocks: [],
      textContent: typeof content === "string" ? content : "",
    };
  }, [content]);

  // Check if we're using block format with tools
  const hasContentToolBlocks = toolBlocks.length > 0;

  // 根据角色应用不同样式
  if (role === "system") {
    // 系统消息：居中，灰色小字
    return (
      <div className="flex justify-center my-4">
        <div className="text-muted-foreground text-xs text-center px-4 py-2 bg-muted/50 rounded-lg max-w-md">
          {textContent}
          <span className="block mt-1 text-muted-foreground">{timestamp}</span>
        </div>
      </div>
    );
  }

  if (role === "user") {
    // 用户消息：右对齐，蓝色背景
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] md:max-w-[70%]">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
            <p className="whitespace-pre-wrap break-words">{textContent}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {timestamp}
          </p>
        </div>
      </div>
    );
  }

  // assistant 消息：左对齐，深色背景
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const hasTextContent = textContent.trim().length > 0;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] md:max-w-[70%]">
        {/* Tool blocks from content - rendered inline before text */}
        {hasContentToolBlocks && (
          <div className="space-y-2 mb-2">
            {toolBlocks.map((toolBlock) => (
              <ContentBlockCard key={toolBlock.id} toolBlock={toolBlock} />
            ))}
          </div>
        )}

        {/* Text content in bubble */}
        {hasTextContent && (
          <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5">
            <MarkdownRenderer content={textContent} />
          </div>
        )}

        {/* Real-time tool calls (from agent stream) */}
        {hasToolCalls && (
          <div className="mt-2">
            <ToolCallList toolCalls={toolCalls} />
          </div>
        )}

        {/* 只在有可见内容（文本气泡或实时工具调用）时显示时间 */}
        {(hasTextContent || hasToolCalls) && (
          <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
        )}
      </div>
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);

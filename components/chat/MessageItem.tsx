"use client";

import { memo, useMemo, useState } from "react";
import { format } from "date-fns";
import { Wrench } from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallList } from "./ToolCallList";
import { ContentBlockCard } from "./ContentBlockCard";
import type { Message, ToolCall } from "@/lib/types";
import {
  parseContentBlocks,
  parseToolBlocks,
  getCombinedText,
} from "@/lib/contentBlocks";
import { cn } from "@/lib/utils";

type MessageItemProps = {
  message: Message;
  toolCalls?: ToolCall[];
};

function MessageItemInner({ message, toolCalls: realtimeToolCalls }: MessageItemProps) {
  const { role, content, createdAt } = message;
  // 合并实时 tool calls 和消息保存的 tool calls
  const allToolCalls = realtimeToolCalls || ("toolCalls" in message ? (message as Record<string, unknown>).toolCalls as ToolCall[] : undefined);

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
  const hasToolCalls = allToolCalls && allToolCalls.length > 0;
  const hasTextContent = textContent.trim().length > 0;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] md:max-w-[70%]">
        {/* Text content in bubble */}
        {hasTextContent && (
          <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5">
            <MarkdownRenderer content={textContent} />
          </div>
        )}

        {/* 只在有可见内容时显示时间和工具图标 */}
        {(hasTextContent || hasToolCalls) && (
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">{timestamp}</p>
            {(hasContentToolBlocks || hasToolCalls) && <ToolToggleButton toolBlocks={toolBlocks} toolCalls={allToolCalls} />}
          </div>
        )}
      </div>
    </div>
  );
}

// 扳手按钮组件 - 点击展开/收起 tool 卡片列表
function ToolToggleButton({ toolBlocks, toolCalls }: { toolBlocks: ReturnType<typeof parseToolBlocks>; toolCalls?: ToolCall[] }) {
  const [open, setOpen] = useState(false);
  const hasTools = (toolBlocks && toolBlocks.length > 0) || (toolCalls && toolCalls.length > 0);

  if (!hasTools) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
          open && "text-foreground bg-muted"
        )}
        aria-label="查看工具调用"
      >
        <Wrench className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          {/* 卡片弹出层 */}
          <div className="absolute right-0 bottom-full mb-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-xl p-2 space-y-2 z-40">
            <p className="text-xs font-medium text-muted-foreground px-1">工具调用</p>
            {toolBlocks.map((toolBlock) => (
              <ContentBlockCard key={toolBlock.id} toolBlock={toolBlock} />
            ))}
            {toolCalls && toolCalls.length > 0 && (
              <ToolCallList toolCalls={toolCalls} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);

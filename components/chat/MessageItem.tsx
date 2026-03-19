"use client";

import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallList } from "./ToolCallList";
import type { Message, ToolCall } from "@/lib/types";

type MessageItemProps = {
  message: Message;
  toolCalls?: ToolCall[];
};

function MessageItemInner({ message, toolCalls }: MessageItemProps) {
  const { role, content, createdAt } = message;

  // 格式化时间
  const timestamp = formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: zhCN,
  });

  // 根据角色应用不同样式
  if (role === "system") {
    // 系统消息：居中，灰色小字
    return (
      <div className="flex justify-center my-4">
        <div className="text-muted-foreground text-xs text-center px-4 py-2 bg-muted/50 rounded-lg max-w-md">
          {content}
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
            <p className="whitespace-pre-wrap break-words">{content}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">{timestamp}</p>
        </div>
      </div>
    );
  }

  // assistant 消息：左对齐，深色背景
  const hasToolCalls = toolCalls && toolCalls.length > 0;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] md:max-w-[70%]">
        <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5">
          <MarkdownRenderer content={content} />
        </div>
        {hasToolCalls && (
          <div className="mt-2">
            <ToolCallList toolCalls={toolCalls} />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timestamp}</p>
      </div>
    </div>
  );
}

export const MessageItem = memo(MessageItemInner);

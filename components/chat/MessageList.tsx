"use client";

import { useEffect, useRef, useCallback, memo } from "react";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallList } from "./ToolCallList";
import type { Message, ToolCall } from "@/lib/types";

type MessageListProps = {
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
  loading?: boolean;
  isInitialLoad?: boolean;
  toolCalls?: ToolCall[];
};

// 流式内容光标动画组件
function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5" />
  );
}

// 消息列表骨架屏
function MessageListSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`h-16 rounded-2xl animate-pulse ${
              i % 2 === 0 ? "bg-muted w-[60%]" : "bg-blue-900/30 w-[40%]"
            }`}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function MessageListInner({
  messages,
  isStreaming,
  streamContent,
  loading,
  isInitialLoad = true,
  toolCalls = [],
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  // 使用 ref 跟踪滚动状态，避免 effect 中的 setState
  const shouldAutoScrollRef = useRef(true);
  const prevIsStreamingRef = useRef(false);
  const prevMessageCountRef = useRef(0);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      return;
    }
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
    }
  }, []);

  // 使用 viewport ref 监听滚动事件
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;
      // 判断是否滚动到底部（允许 50px 误差）
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  // 消息变化或流式内容更新时自动滚动
  useEffect(() => {
    // 当 isStreaming 从 false 变为 true 时，强制启用自动滚动
    if (isStreaming && !prevIsStreamingRef.current) {
      shouldAutoScrollRef.current = true;
    }
    prevIsStreamingRef.current = isStreaming;

    // 消息从 0 变为非 0（异步加载完成），强制滚到底部
    if (messages.length > 0 && prevMessageCountRef.current === 0) {
      // 用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
      });
    }
    prevMessageCountRef.current = messages.length;

    if (shouldAutoScrollRef.current) {
      if (!hasMountedRef.current) {
        scrollToBottom(false);
        hasMountedRef.current = true;
      } else {
        scrollToBottom(true);
      }
    }
  }, [messages, streamContent, isStreaming, scrollToBottom]);

  // 显示加载骨架屏（仅在首次加载时，避免会话切换时闪烁）
  if (loading && isInitialLoad) {
    return <MessageListSkeleton />;
  }

  // 消息为空时返回 null（由父组件处理空状态）
  if (messages.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <ScrollArea
      className="flex-1 h-full"
      viewportRef={viewportRef}
    >
      <div className="px-4 py-6 md:px-8">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}

        {/* 流式内容显示 */}
        {isStreaming && streamContent && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[80%] md:max-w-[70%]">
              <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5">
                <MarkdownRenderer content={streamContent} />
                <StreamingCursor />
              </div>
              {/* 流式期间显示工具调用 */}
              {toolCalls.length > 0 && (
                <div className="mt-2">
                  <ToolCallList toolCalls={toolCalls} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 流式加载中（无内容） */}
        {isStreaming && !streamContent && (
          <div className="flex justify-start mb-4">
            <div className="max-w-[80%] md:max-w-[70%]">
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
              {/* 流式期间显示工具调用（即使没有文字内容） */}
              {toolCalls.length > 0 && (
                <div className="mt-2">
                  <ToolCallList toolCalls={toolCalls} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 滚动锚点 */}
        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}

export const MessageList = memo(MessageListInner);

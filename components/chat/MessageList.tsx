"use client";

import { useEffect, useRef, useCallback, memo } from "react";
import { MessageSquare, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageItem } from "./MessageItem";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Message } from "@/lib/types";

type MessageListProps = {
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
  loading?: boolean;
};

// 流式内容光标动画组件
function StreamingCursor() {
  return (
    <span className="inline-block w-2 h-4 bg-zinc-300 animate-pulse ml-0.5" />
  );
}

// 欢迎占位组件
function WelcomePlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-zinc-500">
      <div className="text-center">
        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-medium mb-2 text-zinc-400">开始新对话</h2>
        <p className="text-zinc-500 text-sm">
          在下方输入您的问题，开始与 AI 对话
        </p>
      </div>
    </div>
  );
}

// 加载状态组件
function LoadingIndicator() {
  return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
    </div>
  );
}

function MessageListInner({
  messages,
  isStreaming,
  streamContent,
  loading,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // 使用 ref 跟踪滚动状态，避免 effect 中的 setState
  const shouldAutoScrollRef = useRef(true);
  const prevIsStreamingRef = useRef(false);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
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

    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, streamContent, isStreaming, scrollToBottom]);

  // 显示加载状态
  if (loading) {
    return (
      <div className="flex-1 overflow-hidden">
        <LoadingIndicator />
      </div>
    );
  }

  // 消息为空时显示欢迎占位
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 overflow-hidden">
        <WelcomePlaceholder />
      </div>
    );
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
              <div className="bg-zinc-800 text-zinc-100 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <MarkdownRenderer content={streamContent} />
                <StreamingCursor />
              </div>
            </div>
          </div>
        )}

        {/* 流式加载中（无内容） */}
        {isStreaming && !streamContent && (
          <div className="flex justify-start mb-4">
            <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
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

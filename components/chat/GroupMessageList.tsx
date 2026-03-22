"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { Loader2, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { GroupMessageItem } from "./GroupMessageItem";
import { hashHue } from "@/lib/utils";
import type { GroupMember, GroupMessage } from "@/lib/types";

type StreamingState = {
  isStreaming: boolean;
  content: string;
  runId: string | null;
};

type GroupMessageListProps = {
  messages: GroupMessage[];
  streamingMap: Map<string, StreamingState>;
  members: GroupMember[];
  membersOnline: Map<string, boolean>;
  loading?: boolean;
};

function StreamingCursor() {
  return <span className="inline-block w-2 h-4 bg-foreground animate-pulse ml-0.5" />;
}

function GroupMessageListSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i === 0 ? "justify-end" : "justify-start"}`}>
          <div
            className={`h-16 rounded-2xl animate-pulse ${
              i === 0 ? "bg-blue-900/30 w-[44%]" : "bg-muted w-[62%]"
            }`}
            style={{ animationDelay: `${i * 120}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function GroupMessageListInner({
  messages,
  streamingMap,
  members,
  membersOnline,
  loading,
}: GroupMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevStreamingSignatureRef = useRef("");

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.agentId, member])),
    [members]
  );

  const streamingAgents = useMemo(() => {
    const rows: Array<{
      agentId: string;
      name: string;
      emoji?: string | null;
      content: string;
      isStreaming: boolean;
      runId: string | null;
      color: string;
    }> = [];

    for (const [agentId, state] of streamingMap.entries()) {
      if (!state.isStreaming) continue;
      const member = memberMap.get(agentId);
      rows.push({
        agentId,
        name: member?.name || agentId,
        emoji: member?.emoji,
        content: state.content,
        isStreaming: state.isStreaming,
        runId: state.runId,
        color: `hsl(${hashHue(agentId)} 70% 55%)`,
      });
    }

    return rows.sort((a, b) => {
      const am = memberMap.get(a.agentId)?.order ?? Number.MAX_SAFE_INTEGER;
      const bm = memberMap.get(b.agentId)?.order ?? Number.MAX_SAFE_INTEGER;
      return am - bm;
    });
  }, [memberMap, streamingMap]);

  const streamingSignature = useMemo(() => {
    return streamingAgents
      .map((row) => `${row.agentId}:${row.runId || "none"}:${row.content.length}`)
      .join("|");
  }, [streamingAgents]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      return;
    }
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "instant" });
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLDivElement;
      const { scrollTop, scrollHeight, clientHeight } = target;
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (messages.length > 0 && prevMessageCountRef.current === 0) {
      requestAnimationFrame(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
      });
    }

    const prevStreamingSignature = prevStreamingSignatureRef.current;
    const hasNewStreaming =
      streamingSignature.length > 0 && streamingSignature !== prevStreamingSignature;

    if (hasNewStreaming && prevStreamingSignature.length === 0) {
      shouldAutoScrollRef.current = true;
    }

    prevStreamingSignatureRef.current = streamingSignature;
    prevMessageCountRef.current = messages.length;

    if (shouldAutoScrollRef.current) {
      if (!hasMountedRef.current) {
        scrollToBottom(false);
        hasMountedRef.current = true;
      } else {
        scrollToBottom(true);
      }
    }
  }, [messages, streamingSignature, scrollToBottom]);

  if (loading) {
    return <GroupMessageListSkeleton />;
  }

  if (messages.length === 0 && streamingAgents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-sm">暂无消息，开始群组对话吧</div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full" viewportRef={viewportRef}>
      <div className="px-4 py-6 md:px-8">
        {messages.map((message) => (
          <GroupMessageItem
            key={message.id}
            message={message}
            isOnline={message.senderId ? (membersOnline.get(message.senderId) ?? true) : true}
          />
        ))}

        {streamingAgents.map((agent) => (
          <div key={agent.agentId} className="flex justify-start mb-4">
            <div className="max-w-[85%] md:max-w-[75%]">
              <div className="flex items-center gap-2 mb-1">
                <Avatar size="sm">
                  <AvatarFallback>
                    {agent.emoji ? <span>{agent.emoji}</span> : <Bot className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium" style={{ color: agent.color }}>
                  {agent.name}
                </span>
              </div>

              <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 min-h-11">
                {agent.content ? (
                  <>
                    <MarkdownRenderer content={agent.content} />
                    <StreamingCursor />
                  </>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={scrollRef} />
      </div>
    </ScrollArea>
  );
}

export const GroupMessageList = memo(GroupMessageListInner);

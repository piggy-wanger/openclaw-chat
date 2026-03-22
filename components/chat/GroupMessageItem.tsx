"use client";

import { memo, useMemo } from "react";
import { format } from "date-fns";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToolCallList } from "./ToolCallList";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { hashHue } from "@/lib/utils";
import type { GroupMessage, ToolCall, ToolCallStatus } from "@/lib/types";

type GroupMessageItemProps = {
  message: GroupMessage;
};

function parseToolCalls(raw: string | null | undefined): ToolCall[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    // Parse all raw items into intermediate form, then merge by id
    const entries = parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Record<string, unknown>;

      const id = typeof candidate.id === "string"
        ? candidate.id
        : typeof candidate.toolCallId === "string"
          ? candidate.toolCallId
          : null;
      if (!id) return [];

      const name = typeof candidate.name === "string" ? candidate.name : null;

      const rawArguments = candidate.arguments ?? candidate.args;
      const argumentsValue =
        rawArguments && typeof rawArguments === "object"
          ? (rawArguments as Record<string, unknown>)
          : {};

      const phase = typeof candidate.phase === "string" ? candidate.phase : undefined;
      const hasError = candidate.isError === true;
      const rawStatus = typeof candidate.status === "string" ? candidate.status : null;
      const status = rawStatus === "running" || rawStatus === "success" || rawStatus === "error"
        ? rawStatus
        : hasError
          ? "error"
          : phase === "result"
            ? "success"
            : phase === "start" || phase === "running"
              ? "running"
              : null;

      // Allow items without name (non-start phases) but require id + status
      if (!status) return [];

      const resultValue = candidate.result;
      const result =
        status === "success" && resultValue !== undefined && resultValue !== null
          ? typeof resultValue === "string"
            ? resultValue
            : JSON.stringify(resultValue)
          : undefined;
      const error =
        status === "error" && resultValue !== undefined && resultValue !== null
          ? String(resultValue)
          : undefined;

      return [{
        id,
        name: name || "unknown",
        arguments: argumentsValue,
        status: status as ToolCallStatus,
        result,
        error,
      }];
    });

    // Merge phases: later phases override earlier ones for same id
    const merged = new Map<string, ToolCall>();
    for (const entry of entries) {
      const existing = merged.get(entry.id);
      if (existing) {
        // Merge: keep name/arguments from first, update status/result/error from later
        merged.set(entry.id, {
          ...existing,
          name: existing.name || entry.name || "unknown",
          arguments: entry.status === "running" ? entry.arguments : existing.arguments,
          status: entry.status as ToolCallStatus,
          result: entry.result ?? existing.result,
          error: entry.error ?? existing.error,
        });
      } else {
        merged.set(entry.id, entry);
      }
    }
    return Array.from(merged.values());
  } catch {
    return [];
  }
}

function GroupMessageItemInner({ message }: GroupMessageItemProps) {
  const timestamp = format(new Date(message.createdAt), "HH:mm");

  const senderKey = message.senderId || message.senderName || "agent";
  const senderNameColor = useMemo(() => {
    const hue = hashHue(senderKey);
    return `hsl(${hue} 70% 55%)`;
  }, [senderKey]);

  const toolCalls = useMemo(() => parseToolCalls(message.toolCalls), [message.toolCalls]);

  if (message.senderType === "user" || message.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] md:max-w-[70%]">
          <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">{timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] md:max-w-[75%]">
        <div className="flex items-center gap-2 mb-1">
          <Avatar size="sm">
            <AvatarFallback>
              {message.senderEmoji ? (
                <span>{message.senderEmoji}</span>
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium" style={{ color: senderNameColor }}>
            {message.senderName || message.senderId || "Agent"}
          </span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>

        <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5">
          <MarkdownRenderer content={message.content} />
        </div>

        {toolCalls.length > 0 && (
          <div className="mt-2">
            <ToolCallList toolCalls={toolCalls} />
          </div>
        )}
      </div>
    </div>
  );
}

export const GroupMessageItem = memo(GroupMessageItemInner);

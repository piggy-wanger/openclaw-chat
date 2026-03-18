"use client";

import { memo } from "react";
import { ToolCallCard } from "./ToolCallCard";
import type { ToolCall } from "@/lib/types";

type ToolCallListProps = {
  toolCalls: ToolCall[];
};

function ToolCallListInner({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-2">
      {toolCalls.map((toolCall) => (
        <ToolCallCard key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}

export const ToolCallList = memo(ToolCallListInner);

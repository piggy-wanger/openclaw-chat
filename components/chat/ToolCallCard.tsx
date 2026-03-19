"use client";

import { memo } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Clock,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useCollapsible,
} from "@/components/ui/collapsible";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { ToolCall } from "@/lib/types";

type ToolCallCardProps = {
  toolCall: ToolCall;
};

// Status icon component with animation
function StatusIcon({ status }: { status: ToolCall["status"] }) {
  switch (status) {
    case "running":
      return (
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
      );
    case "success":
      return (
        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
      );
    case "error":
      return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
  }
}

// Chevron icon that rotates based on collapsible state
function CollapsibleChevron() {
  const { isOpen } = useCollapsible();
  return (
    <ChevronRight
      className={cn(
        "h-4 w-4 text-muted-foreground transition-transform duration-200",
        isOpen && "rotate-90"
      )}
    />
  );
}

// Format duration from timestamps
function formatDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt) return null;
  const duration = completedAt - startedAt;
  if (duration < 1000) {
    return `${duration}ms`;
  }
  return `${(duration / 1000).toFixed(2)}s`;
}

// Format JSON arguments for display
function formatArguments(args: Record<string, unknown>): string {
  return JSON.stringify(args, null, 2);
}

function ToolCallCardInner({ toolCall }: ToolCallCardProps) {
  const { name, arguments: args, status, result, error, startedAt, completedAt } = toolCall;
  const duration = formatDuration(startedAt, completedAt);
  const hasArgs = Object.keys(args).length > 0;

  return (
    <Collapsible className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header - Always visible */}
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-2 px-3 py-2 w-full",
          "hover:bg-muted/50 transition-colors",
          "text-left"
        )}
      >
        <CollapsibleChevron />
        <StatusIcon status={status} />
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {name}
        </span>
        {status === "running" && (
          <span className="text-xs text-muted-foreground">Running...</span>
        )}
        {duration && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
        )}
      </CollapsibleTrigger>

      {/* Expandable Content */}
      <CollapsibleContent>
        <div className="border-t border-border px-3 py-2 space-y-3">
          {/* Arguments */}
          {hasArgs && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Arguments
              </p>
              <pre className="text-xs font-mono text-foreground bg-card/50 rounded-md p-2 overflow-x-auto">
                <code>{formatArguments(args)}</code>
              </pre>
            </div>
          )}

          {/* Result - shown on success */}
          {status === "success" && result && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Result
              </p>
              <div className="text-sm text-foreground bg-card/50 rounded-md p-2 overflow-x-auto">
                <MarkdownRenderer content={result} />
              </div>
            </div>
          )}

          {/* Error - shown on error */}
          {status === "error" && error && (
            <div>
              <p className="text-xs font-medium text-red-500 mb-1.5">Error</p>
              <p className="text-sm text-red-400 bg-red-500/10 rounded-md p-2 font-mono break-all">
                {error}
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ToolCallCard = memo(ToolCallCardInner);

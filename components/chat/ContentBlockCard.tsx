"use client";

import { memo } from "react";
import {
  Wrench,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  useCollapsible,
} from "@/components/ui/collapsible";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { cn } from "@/lib/utils";
import type { ParsedToolBlock } from "@/lib/types";

type ContentBlockCardProps = {
  toolBlock: ParsedToolBlock;
};

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

// Format JSON arguments for display
function formatArguments(args: Record<string, unknown>): string {
  return JSON.stringify(args, null, 2);
}

// Truncate tool name for display
function truncateName(name: string, maxLength = 24): string {
  if (name.length <= maxLength) return name;
  return name.slice(0, maxLength) + "...";
}

function ContentBlockCardInner({ toolBlock }: ContentBlockCardProps) {
  const { name, input, result, isError } = toolBlock;
  const hasInput = Object.keys(input).length > 0;
  const hasResult = result !== undefined && result !== "";

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
        <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span
          className="text-sm font-medium text-foreground truncate flex-1"
          title={name}
        >
          {truncateName(name)}
        </span>
        {isError ? (
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
        )}
      </CollapsibleTrigger>

      {/* Expandable Content */}
      <CollapsibleContent>
        <div className="border-t border-border px-3 py-2 space-y-3">
          {/* Arguments */}
          {hasInput && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Input
              </p>
              <pre className="text-xs font-mono text-foreground bg-card/50 rounded-md p-2 overflow-x-auto">
                <code>{formatArguments(input)}</code>
              </pre>
            </div>
          )}

          {/* Result */}
          {hasResult && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Output
              </p>
              <div
                className={cn(
                  "text-sm text-foreground rounded-md p-2 overflow-x-auto",
                  isError ? "bg-red-500/10" : "bg-card/50"
                )}
              >
                {isError ? (
                  <p className="font-mono text-red-400 break-all">{result}</p>
                ) : (
                  <MarkdownRenderer content={result} />
                )}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ContentBlockCard = memo(ContentBlockCardInner);

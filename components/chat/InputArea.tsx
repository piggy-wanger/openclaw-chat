"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputAreaProps = {
  onSend: (content: string) => void;
  isStreaming: boolean;
  onAbort?: () => void;
  disabled?: boolean;
};

function InputAreaInner({ onSend, isStreaming, onAbort, disabled }: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 重置高度
      textarea.style.height = "auto";
      // 设置最小高度 44px，最大高度 200px
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 44), 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  // 输入变化时调整高度
  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送（非组合键）
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if (input.trim() && !isStreaming && !disabled) {
          onSend(input.trim());
          setInput("");
        }
      }
      // Shift+Enter 换行（默认行为）
    },
    [input, isStreaming, disabled, onSend]
  );

  // 发送消息
  const handleSend = useCallback(() => {
    if (input.trim() && !isStreaming && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  }, [input, isStreaming, disabled, onSend]);

  // 停止流式请求
  const handleAbort = useCallback(() => {
    if (onAbort) {
      onAbort();
    }
  }, [onAbort]);

  // 聚焦输入框
  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus();
    }
  }, [isStreaming, disabled]);

  const canSend = input.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="border-t border-border p-4 bg-card">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-end gap-2 bg-muted rounded-2xl p-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            disabled={disabled || isStreaming}
            className={cn(
              "flex-1 resize-none border-0 bg-transparent px-2 py-2",
              "min-h-[44px] max-h-[200px]",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            rows={1}
          />

          {/* 发送/停止按钮 */}
          {isStreaming ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={handleAbort}
              className="shrink-0 rounded-xl"
              aria-label="停止生成"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "shrink-0 rounded-xl",
                canSend
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-muted opacity-50"
              )}
              aria-label="发送消息"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}

export const InputArea = memo(InputAreaInner);

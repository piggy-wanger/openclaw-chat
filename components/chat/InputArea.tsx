"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Send, Square, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type InputAreaProps = {
  onSend: (content: string) => void;
  onUpload?: (files: FileList) => void;
  isStreaming: boolean;
  onAbort?: () => void;
  disabled?: boolean;
};

function InputAreaInner({ onSend, onUpload, isStreaming, onAbort, disabled }: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !disabled) {
          onSend(input.trim());
          setInput("");
          setAttachedFiles([]);
        }
      }
    },
    [input, isStreaming, disabled, onSend, attachedFiles]
  );

  const handleSend = useCallback(() => {
    if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !disabled) {
      onSend(input.trim());
      setInput("");
      setAttachedFiles([]);
    }
  }, [input, isStreaming, disabled, onSend, attachedFiles]);

  const handleAbort = useCallback(() => {
    if (onAbort) onAbort();
  }, [onAbort]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
      e.target.value = "";
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus();
    }
  }, [isStreaming, disabled]);

  const canSend = (input.trim().length > 0 || attachedFiles.length > 0) && !isStreaming && !disabled;

  return (
    <div className="sticky bottom-0 z-20 px-4 pb-4 pt-2">
      {/* 渐变遮罩，让输入框融入背景 */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative max-w-4xl mx-auto">
        {/* 附件预览 */}
        {attachedFiles.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachedFiles.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-1.5 text-xs"
              >
                <Paperclip className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground max-w-[120px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-foreground ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入框主体 */}
        <div className="flex items-end gap-2 bg-card rounded-2xl border border-border shadow-lg p-2">
          {/* 上传文件按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="上传文件"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled || isStreaming}
            className={cn(
              "flex-1 resize-none border-0 bg-transparent px-1 py-1.5",
              "min-h-[24px] max-h-[200px] text-sm",
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
              className="shrink-0 rounded-xl h-8 w-8"
              aria-label="停止生成"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "shrink-0 rounded-xl h-8 w-8 transition-all",
                canSend
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-muted text-muted-foreground opacity-50"
              )}
              aria-label="发送消息"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export const InputArea = memo(InputAreaInner);

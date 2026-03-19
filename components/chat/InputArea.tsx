"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Send, Square, Paperclip, X, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type GroupAgent = {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string;
};

type InputAreaProps = {
  onSend: (content: string) => void;
  onUpload?: (files: FileList) => void;
  isStreaming: boolean;
  onAbort?: () => void;
  disabled?: boolean;
  // 群聊相关 props
  groupAgents?: GroupAgent[];
  isGroup?: boolean;
};

function InputAreaInner({
  onSend,
  onUpload,
  isStreaming,
  onAbort,
  disabled,
  groupAgents = [],
  isGroup = false,
}: InputAreaProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // @ mention 相关状态
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const mentionPopupRef = useRef<HTMLDivElement>(null);

  // 过滤匹配的 agents
  const filteredAgents = useCallback(() => {
    if (!mentionQuery) return groupAgents;
    const query = mentionQuery.toLowerCase();
    return groupAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query)
    );
  }, [groupAgents, mentionQuery]);

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

  // 处理输入变化，检测 @ 符号
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const cursorPos = e.target.selectionStart;

      setInput(value);

      // 检测 @ 符号
      if (isGroup && groupAgents.length > 0) {
        // 查找光标前最近的 @ 符号
        const textBeforeCursor = value.substring(0, cursorPos);
        const lastAtIndex = textBeforeCursor.lastIndexOf("@");

        if (lastAtIndex !== -1) {
          // 检查 @ 后面是否有空格（如果有空格，说明 @ mention 已结束）
          const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
          const hasSpace = /\s/.test(textAfterAt);

          if (!hasSpace) {
            // @ mention 正在进行
            setMentionStartPos(lastAtIndex);
            setMentionQuery(textAfterAt);
            setShowMentionPopup(true);
            setSelectedIndex(0);
          } else {
            // @ mention 已结束
            setShowMentionPopup(false);
            setMentionStartPos(null);
            setMentionQuery("");
          }
        } else {
          // 没有 @ 符号
          setShowMentionPopup(false);
          setMentionStartPos(null);
          setMentionQuery("");
        }
      }
    },
    [isGroup, groupAgents]
  );

  // 选择 agent
  const selectAgent = useCallback(
    (agent: GroupAgent) => {
      if (mentionStartPos === null) return;

      const beforeMention = input.substring(0, mentionStartPos);
      const afterCursor = input.substring(textareaRef.current?.selectionStart || 0);
      const mentionText = `@${agent.name} `;

      const newInput = beforeMention + mentionText + afterCursor;
      setInput(newInput);
      setShowMentionPopup(false);
      setMentionStartPos(null);
      setMentionQuery("");

      // 将光标移动到插入文本后
      setTimeout(() => {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current?.focus();
      }, 0);
    },
    [input, mentionStartPos]
  );

  // 处理键盘事件
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // 如果 popup 打开，处理导航
      if (showMentionPopup) {
        const agents = filteredAgents();

        // Prevent division by zero when agents array is empty
        if (agents.length === 0) {
          return;
        }

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % agents.length);
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + agents.length) % agents.length);
          return;
        }

        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (agents[selectedIndex]) {
            selectAgent(agents[selectedIndex]);
          }
          return;
        }

        if (e.key === "Escape") {
          e.preventDefault();
          setShowMentionPopup(false);
          setMentionStartPos(null);
          setMentionQuery("");
          return;
        }
      }

      // 发送消息
      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !disabled) {
          onSend(input.trim());
          setInput("");
          setAttachedFiles([]);
        }
      }
    },
    [
      showMentionPopup,
      filteredAgents,
      selectedIndex,
      selectAgent,
      input,
      isStreaming,
      disabled,
      onSend,
      attachedFiles,
    ]
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

  // 点击外部关闭 popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mentionPopupRef.current &&
        !mentionPopupRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        setShowMentionPopup(false);
        setMentionStartPos(null);
        setMentionQuery("");
      }
    };

    if (showMentionPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMentionPopup]);

  useEffect(() => {
    if (!isStreaming && !disabled) {
      textareaRef.current?.focus();
    }
  }, [isStreaming, disabled]);

  const canSend = (input.trim().length > 0 || attachedFiles.length > 0) && !isStreaming && !disabled;
  const agents = filteredAgents();

  return (
    <div className="sticky bottom-0 z-20 px-4 pb-[30px] pt-2">
      {/* 渐变遮罩，让输入框融入背景 */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent pointer-events-none" />

      <div className="relative w-[95%] mx-auto">
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

        {/* @ Mention Popup */}
        {showMentionPopup && agents.length > 0 && (
          <div
            ref={mentionPopupRef}
            className="absolute bottom-full left-0 mb-2 w-full max-w-[280px] bg-card border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="p-1.5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AtSign className="h-3.5 w-3.5" />
                <span>提及智能体</span>
              </div>
            </div>
            <div className="max-h-[180px] overflow-y-auto">
              {agents.map((agent, index) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => selectAgent(agent)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                    index === selectedIndex
                      ? "bg-primary/10 text-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm overflow-hidden">
                    {agent.avatar ? (
                      <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                    ) : (
                      agent.emoji || agent.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{agent.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{agent.id}</div>
                  </div>
                </button>
              ))}
            </div>
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

          {/* @ 按钮 - 仅在群聊中显示 */}
          {isGroup && groupAgents.length > 0 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                const cursorPos = textareaRef.current?.selectionStart || input.length;
                const newInput = input.substring(0, cursorPos) + "@" + input.substring(cursorPos);
                setInput(newInput);
                setMentionStartPos(cursorPos);
                setMentionQuery("");
                setShowMentionPopup(true);
                setTimeout(() => {
                  textareaRef.current?.setSelectionRange(cursorPos + 1, cursorPos + 1);
                  textareaRef.current?.focus();
                }, 0);
              }}
              disabled={isStreaming}
              className="shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="提及智能体"
            >
              <AtSign className="h-4 w-4" />
            </Button>
          )}

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isGroup ? "输入消息，@ 提及智能体..." : "输入消息..."}
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

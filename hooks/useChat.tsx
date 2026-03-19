"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useGateway } from "./useGateway";
import type { ChatEvent, AgentEvent } from "@/lib/gateway-types";
import type { Message, ToolCall, ToolCallStatus } from "@/lib/types";
import { nanoid } from "nanoid";

// Extract text from content (handles both string and array formats)
function extractContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block) => block?.type === "text" && typeof block?.text === "string")
      .map((block) => block.text)
      .join("\n");
  }
  return JSON.stringify(content);
}

// Context 类型
type ChatContextType = {
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
  loading: boolean;
  isSessionSwitching: boolean;
  isInitialLoad: boolean;
  error: string | null;
  toolCalls: ToolCall[];
  fetchMessages: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortStream: () => void;
};

// Context
const ChatContext = createContext<ChatContextType | null>(null);

// Provider - 需要 sessionId 作为参数
export function ChatProvider({
  children,
  sessionId,
  onSessionKeyUpdate,
}: {
  children: ReactNode;
  sessionId: string | null;
  onSessionKeyUpdate?: (tempId: string, realSessionKey: string) => void;
}) {
  const { client, isConnected } = useGateway();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  // 当前运行的 runId
  const currentRunIdRef = useRef<string | null>(null);
  const streamContentRef = useRef("");

  // Session epoch 用于防止竞态条件
  const sessionEpochRef = useRef(0);

  // Track if this is the first fetch (for skeleton vs loading indicator)
  const hasLoadedOnceRef = useRef(false);

  // 获取会话消息
  const fetchMessages = useCallback(async (opts?: { preserveEmpty?: boolean }) => {
    if (!sessionId || !isConnected) {
      return;
    }

    // 捕获当前 epoch
    const currentEpoch = sessionEpochRef.current;

    // Determine if this is initial load (never loaded before) or session switch
    const isCurrentlyInitialLoad = !hasLoadedOnceRef.current;

    // 设置加载状态
    setLoading(true);
    // Only show skeleton on initial load, otherwise show switching indicator
    if (!isCurrentlyInitialLoad) {
      setIsSessionSwitching(true);
    }
    setError(null);

    console.log("[fetchMessages] Fetching history for sessionKey:", sessionId);

    try {
      const history = await client.chatHistory({
        sessionKey: sessionId,
        limit: 100,
      });

      console.log("[fetchMessages] History result:", history?.length ?? 0, "messages");

      // 检查 epoch 是否匹配，不匹配则丢弃结果（session 已切换）
      if (currentEpoch !== sessionEpochRef.current) {
        console.log("[fetchMessages] Epoch mismatch, discarding result");
        return;
      }

      // 转换历史记录为 Message 格式
      // history 是 unknown[]，需要根据实际格式解析
      const formattedMessages: Message[] = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          // 假设 history 项格式为 { role, content } 或 { role, message: { content } }
          if (typeof item === "object" && item !== null) {
            const msg = item as Record<string, unknown>;
            // Handle both direct content and nested message.content
            const rawContent = msg.content ?? (msg.message as Record<string, unknown>)?.content;
            formattedMessages.push({
              id: (msg.id as string) || `msg-${nanoid()}`,
              sessionId: sessionId,
              role: (msg.role as string) || "user",
              content: extractContent(rawContent),
              createdAt: (msg.createdAt as number) || Date.now(),
            });
          }
        }
      }

      // 如果历史为空，不清空现有消息（避免覆盖本地状态）
      if (formattedMessages.length > 0) {
        setMessages(formattedMessages);
      }
      // After first successful load, mark that we've loaded once
      hasLoadedOnceRef.current = true;
      setIsInitialLoad(false);
    } catch (err) {
      // 检查 epoch 是否匹配
      if (currentEpoch !== sessionEpochRef.current) {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Failed to fetch messages";
      setError(message);
      console.error("[fetchMessages] Error:", err);
    } finally {
      // 检查 epoch 是否匹配
      if (currentEpoch === sessionEpochRef.current) {
        setLoading(false);
        setIsSessionSwitching(false);
      }
    }
  }, [sessionId, client, isConnected]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim() || isStreaming || !isConnected) {
        return;
      }

      setError(null);

      // 1. 乐观更新：立即添加用户消息
      const tempUserMessage: Message = {
        id: `temp-user-${nanoid()}`,
        sessionId,
        role: "user",
        content: content.trim(),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, tempUserMessage]);
      setStreamContent("");
      setToolCalls([]);
      setIsStreaming(true);

      try {
        // 2. 调用 Gateway chat.send
        const result = await client.chatSend({
          sessionKey: sessionId,
          message: content.trim(),
          idempotencyKey: nanoid(),
        });

        currentRunIdRef.current = result.runId;

        // 注意：流式响应通过事件监听处理
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        console.error("Error sending message:", err);
        // 移除乐观添加的用户消息
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, isConnected, client]
  );

  // 中断流式请求
  const abortStream = useCallback(async () => {
    if (!sessionId || !currentRunIdRef.current || !isConnected) {
      setIsStreaming(false);
      setStreamContent("");
      return;
    }

    try {
      await client.chatAbort({
        sessionKey: sessionId,
        runId: currentRunIdRef.current || undefined,
      });
    } catch (err) {
      console.error("Error aborting stream:", err);
    }

    setIsStreaming(false);
    setStreamContent("");
    currentRunIdRef.current = null;
  }, [sessionId, client, isConnected]);

  // 处理 chat 事件
  useEffect(() => {
    const handleChat = (event: ChatEvent) => {
      console.log("[chat event]", event.state, "sessionKey:", event.sessionKey, "current:", sessionId, "match:", event.sessionKey === sessionId);

      // 检查是否是临时会话
      const isTempSession = sessionId?.startsWith("temp-");

      // 对于临时会话，接收第一个带有真实 sessionKey 的事件
      if (isTempSession && sessionId && !event.sessionKey.startsWith("temp-")) {
        // 更新临时会话 ID 为真实 sessionKey
        onSessionKeyUpdate?.(sessionId, event.sessionKey);
      }

      // 只处理当前 session 的事件（包括临时会话的情况）
      const isCurrentSession = isTempSession
        ? !event.sessionKey.startsWith("temp-") || event.sessionKey === sessionId
        : event.sessionKey === sessionId;

      if (!isCurrentSession) return;

      switch (event.state) {
        case "delta":
          // 追加内容到流
          if (event.message) {
            const content =
              typeof event.message === "string"
                ? event.message
                : JSON.stringify(event.message);
            setStreamContent((prev) => {
              streamContentRef.current = prev + content;
              return prev + content;
            });
          }
          break;

        case "final":
          // 流完成 - 保存流式内容为正式消息
          if (streamContentRef.current?.trim()) {
            const assistantMsg: Message = {
              id: `msg-final-${nanoid()}`,
              sessionId: sessionId || "",
              role: "assistant",
              content: streamContentRef.current,
              createdAt: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          } else {
            // 没有流式内容，从 final message 提取
            const rawMessage = event.message;
            const finalContent = rawMessage
              ? extractContent(typeof rawMessage === "object" && rawMessage !== null && "content" in (rawMessage as Record<string, unknown>) ? (rawMessage as Record<string, unknown>).content : rawMessage)
              : "";
            if (finalContent) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg-final-${nanoid()}`,
                  sessionId: sessionId || "",
                  role: "assistant",
                  content: finalContent,
                  createdAt: Date.now(),
                },
              ]);
            }
          }
          streamContentRef.current = "";
          setStreamContent("");
          setIsStreaming(false);
          currentRunIdRef.current = null;
          // 不再调用 fetchMessages，因为 Gateway 的 chat.history 返回 0
          break;

        case "aborted":
          // 流中止
          setIsStreaming(false);
          setStreamContent("");
          currentRunIdRef.current = null;
          break;

        case "error":
          // 错误
          setError(event.errorMessage || "Unknown error");
          setIsStreaming(false);
          setStreamContent("");
          currentRunIdRef.current = null;
          break;
      }
    };

    const unsubscribe = client.on("chat", handleChat);
    return () => unsubscribe();
  }, [sessionId, client, fetchMessages, onSessionKeyUpdate]);

  // 处理 agent 事件（工具调用 + 流式助手回复）
  useEffect(() => {
    const handleAgent = (event: AgentEvent) => {
      // 只处理当前 session 的事件
      if (event.sessionKey && event.sessionKey !== sessionId) return;

      // 只处理当前 run 的事件
      if (currentRunIdRef.current && event.runId !== currentRunIdRef.current)
        return;

      // 处理流式助手回复
      if (event.stream === "assistant" && event.data) {
        const delta = (event.data as Record<string, unknown>).delta;
        if (typeof delta === "string" && delta) {
          setIsStreaming(true);
          setStreamContent((prev) => {
            streamContentRef.current = prev + delta;
            return prev + delta;
          });
        }
        return;
      }

      if (event.stream === "tool" && event.data) {
        const { toolCallId, name, args, phase, result, isError } = event.data;

        if (!toolCallId) return;

        setToolCalls((prev) => {
          const existing = prev.find((tc) => tc.id === toolCallId);

          if (existing) {
            // 更新现有工具调用
            return prev.map((tc) => {
              if (tc.id !== toolCallId) return tc;

              const status: ToolCallStatus = isError
                ? "error"
                : phase === "result"
                  ? "success"
                  : "running";

              return {
                ...tc,
                status,
                result:
                  result !== undefined
                    ? typeof result === "string"
                      ? result
                      : JSON.stringify(result)
                    : tc.result,
                error: isError ? String(result) : tc.error,
                completedAt:
                  phase === "result" ? Date.now() : tc.completedAt,
              };
            });
          } else {
            // 创建新的工具调用
            const status: ToolCallStatus = isError
              ? "error"
              : phase === "result"
                ? "success"
                : "running";

            const newToolCall: ToolCall = {
              id: toolCallId,
              name: name || "unknown",
              arguments: args || {},
              status,
              result:
                result !== undefined
                  ? typeof result === "string"
                    ? result
                    : JSON.stringify(result)
                  : undefined,
              error: isError ? String(result) : undefined,
              startedAt: Date.now(),
              completedAt: phase === "result" ? Date.now() : undefined,
            };

            return [...prev, newToolCall];
          }
        });
      }

      // lifecycle 事件可以用于更新全局运行状态
      if (event.stream === "lifecycle" && event.data) {
        // 可以在这里处理 lifecycle start/end
      }
    };

    const unsubscribe = client.on("agent", handleAgent);
    return () => unsubscribe();
  }, [sessionId, client]);

  // sessionId 变化时：中断旧请求，清理事件监听，获取新消息
  useEffect(() => {
    // 递增 epoch 以使旧的 fetchMessages 结果失效
    sessionEpochRef.current++;

    // 中断旧的流式请求
    if (currentRunIdRef.current) {
      abortStream();
    }

    // 重置流式状态，但保留消息（避免闪烁）
    setIsStreaming(false);
    setStreamContent("");
    setToolCalls([]);
    setError(null);
    currentRunIdRef.current = null;

    // 不清空消息，让旧消息保持可见直到新消息加载完成，避免闪烁

    // 获取新会话的消息
    fetchMessages();
  }, [sessionId, fetchMessages, abortStream]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isStreaming,
        streamContent,
        loading,
        isSessionSwitching,
        isInitialLoad,
        error,
        toolCalls,
        fetchMessages,
        sendMessage,
        abortStream,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

// Hook
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

// Export types for external use
export type { ChatContextType };

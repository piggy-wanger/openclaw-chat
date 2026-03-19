"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect, useLayoutEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useGateway } from "./useGateway";
import type { ChatEvent, AgentEvent } from "@/lib/gateway-types";
import type { Message, ToolCall, ToolCallStatus, ContentBlock } from "@/lib/types";
import { extractTextContent, parseContentBlocks } from "@/lib/contentBlocks";
import { nanoid } from "nanoid";

// Re-export extractTextContent as extractContent for backward compatibility
const extractContent = extractTextContent;

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

  // 包装 setMessages，同步到缓存
  const setMessagesWithCache = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (sessionId) {
        messagesCacheRef.current.set(sessionId, next);
      }
      return next;
    });
  }, [sessionId]);

  // 当前运行的 runId
  const currentRunIdRef = useRef<string | null>(null);
  const streamContentRef = useRef("");

  // Session epoch 用于防止竞态条件
  const sessionEpochRef = useRef(0);

  // Track if this is the first fetch (for skeleton vs loading indicator)
  const hasLoadedOnceRef = useRef(false);

  // 本地消息缓存：sessionId → Message[]
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());

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


    try {
      const history = await client.chatHistory({
        sessionKey: sessionId,
        limit: 100,
      });

      console.log("[fetchMessages] raw history:", JSON.stringify(history).slice(0, 1000));

      // history 返回 { messages: [...] }，需要取 .messages
      const historyData = history as unknown as Record<string, unknown>;
      const messagesArr = Array.isArray(historyData?.messages) ? historyData.messages : Array.isArray(history) ? history : [];


      // 检查 epoch 是否匹配，不匹配则丢弃结果（session 已切换）
      if (currentEpoch !== sessionEpochRef.current) {
        return;
      }

      // 转换历史记录为 Message 格式
      const formattedMessages: Message[] = [];
      for (const item of messagesArr) {
          // 假设 history 项格式为 { role, content } 或 { role, message: { content } }
          if (typeof item === "object" && item !== null) {
            const msg = item as Record<string, unknown>;
            // Handle both direct content and nested message.content
            const rawContent = msg.content ?? (msg.message as Record<string, unknown>)?.content;

            // Check if content is in block array format
            const blocks = parseContentBlocks(rawContent);
            const messageContent: string | ContentBlock[] = blocks ?? extractContent(rawContent);

            formattedMessages.push({
              id: (msg.id as string) || `msg-${nanoid()}`,
              sessionId: sessionId,
              role: (msg.role as string) || "user",
              content: messageContent,
              createdAt: (msg.createdAt as number) || Date.now(),
            });
          }
        }

      // 如果历史为空，不清空现有消息（避免覆盖本地状态）
      if (formattedMessages.length > 0) {
        setMessagesWithCache(formattedMessages);
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

      setMessagesWithCache((prev) => [...prev, tempUserMessage]);
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
        setMessagesWithCache((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
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
          // 忽略 chat.delta，Gateway 的增量文本通过 agent.assistant 事件发送
          // chat.delta 的 message 是累积对象，但 extractContent 后用 SET 会覆盖追加的内容
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
            setMessagesWithCache((prev) => [...prev, assistantMsg]);
          } else {
            // 没有流式内容，从 final message 提取
            const rawMessage = event.message;
            if (rawMessage) {
              console.log("[chat.final] raw message:", JSON.stringify(rawMessage).slice(0, 500));
              // Extract raw content from message
              const rawContent = typeof rawMessage === "object" && rawMessage !== null && "content" in (rawMessage as Record<string, unknown>)
                ? (rawMessage as Record<string, unknown>).content
                : rawMessage;

              // Check if content is in block array format
              const blocks = parseContentBlocks(rawContent);
              const finalContent: string | ContentBlock[] = blocks ?? extractContent(rawContent);

              if (finalContent) {
                setMessagesWithCache((prev) => [
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

      // agent.assistant 事件携带增量 delta（Gateway 不发 chat.delta）
      if (event.stream === "assistant" && event.data) {
        const delta = (event.data as Record<string, unknown>).delta;
        console.log("[agent.assistant] raw event.data:", JSON.stringify(event.data).slice(0, 500));
        if (typeof delta === "string" && delta.trim() && !delta.startsWith("NO_REPLY")) {
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
  // 使用 useLayoutEffect 避免中间帧闪烁（在浏览器绘制前同步更新状态）
  useLayoutEffect(() => {
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
    // 立即标记为切换中，防止 messages 为空时闪 NoMessagesState
    setIsSessionSwitching(true);

    // 从缓存恢复消息，或清空（新会话）
    const cached = sessionId ? messagesCacheRef.current.get(sessionId) : null;
    setMessagesWithCache(cached ?? []);

    // 获取新会话的消息（Gateway 历史作为补充，不清空缓存）
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

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

// Context 类型
type ChatContextType = {
  messages: Message[];
  isStreaming: boolean;
  streamContent: string;
  loading: boolean;
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
}: {
  children: ReactNode;
  sessionId: string | null;
}) {
  const { client, isConnected } = useGateway();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  // 当前运行的 runId
  const currentRunIdRef = useRef<string | null>(null);

  // 获取会话消息
  const fetchMessages = useCallback(async () => {
    if (!sessionId || !isConnected) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const history = await client.chatHistory({
        sessionKey: sessionId,
        limit: 100,
      });

      // 转换历史记录为 Message 格式
      // history 是 unknown[]，需要根据实际格式解析
      const formattedMessages: Message[] = [];
      if (Array.isArray(history)) {
        for (const item of history) {
          // 假设 history 项格式为 { role, content }
          if (typeof item === "object" && item !== null) {
            const msg = item as Record<string, unknown>;
            formattedMessages.push({
              id: (msg.id as string) || `msg-${nanoid()}`,
              sessionId: sessionId,
              role: (msg.role as string) || "user",
              content:
                typeof msg.content === "string"
                  ? msg.content
                  : JSON.stringify(msg.content),
              createdAt: (msg.createdAt as number) || Date.now(),
            });
          }
        }
      }

      setMessages(formattedMessages);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch messages";
      setError(message);
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
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
      // 只处理当前 session 的事件
      if (event.sessionKey !== sessionId) return;

      switch (event.state) {
        case "delta":
          // 追加内容到流
          if (event.message) {
            const content =
              typeof event.message === "string"
                ? event.message
                : JSON.stringify(event.message);
            setStreamContent((prev) => prev + content);
          }
          break;

        case "final":
          // 流完成
          setIsStreaming(false);
          setStreamContent("");
          currentRunIdRef.current = null;
          // 重新获取消息列表
          fetchMessages();
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
  }, [sessionId, client, fetchMessages]);

  // 处理 agent 事件（工具调用）
  useEffect(() => {
    const handleAgent = (event: AgentEvent) => {
      // 只处理当前 session 的事件
      if (event.sessionKey && event.sessionKey !== sessionId) return;

      // 只处理当前 run 的事件
      if (currentRunIdRef.current && event.runId !== currentRunIdRef.current)
        return;

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
    // 中断旧的流式请求
    if (currentRunIdRef.current) {
      abortStream();
    }

    // 重置状态
    setIsStreaming(false);
    setStreamContent("");
    setToolCalls([]);
    setError(null);
    currentRunIdRef.current = null;

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

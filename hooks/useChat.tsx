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
import { useSession } from "./useSession";
import type { ChatEvent, AgentEvent } from "@/lib/gateway-types";
import type { Message, ToolCall, ToolCallStatus, ContentBlock } from "@/lib/types";
import { extractTextContent, parseContentBlocks } from "@/lib/contentBlocks";
import { nanoid } from "nanoid";

const extractContent = extractTextContent;

// ========== Context 类型 ==========

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

const ChatContext = createContext<ChatContextType | null>(null);

// ========== Helper: Save message to SQLite ==========

async function saveMessageToSQLite(message: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolCalls?: string;
  runId?: string;
  createdAt: number;
}): Promise<void> {
  try {
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("[saveMessageToSQLite] Error:", err);
  }
}

// ========== Helper: Load messages from SQLite ==========

async function loadMessagesFromSQLite(sessionId: string): Promise<Message[]> {
  try {
    const res = await fetch(`/api/messages?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.messages)) return [];

    const parsedMessages = data.messages.map((row: {
      id: string;
      sessionId: string;
      role: string;
      content: string;
      toolCalls: string | null;
      runId: string | null;
      createdAt: number;
    }) => {
      let content: string | ContentBlock[] = row.content;
      if (typeof row.content === "string" && row.content.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(row.content);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.type) {
            if (row.role === "user") {
              const texts = parsed
                .filter((b: { type?: string }) => b.type === "text")
                .map((b: { text?: string }) => b.text)
                .filter(Boolean)
                .join("");
              if (texts) {
                content = texts;
              }
            } else {
              content = parsed as ContentBlock[];
            }
          }
        } catch {
          // keep as-is
        }
      }

      const msg: Message = {
        id: row.id,
        sessionId: row.sessionId,
        role: row.role,
        content,
        createdAt: row.createdAt,
      };

      if (row.toolCalls) {
        try {
          msg.toolCalls = JSON.parse(row.toolCalls);
        } catch { /* ignore */ }
      }

      return msg;
    });

    return parsedMessages.sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) {
    console.error("[loadMessagesFromSQLite] Error:", err);
    return [];
  }
}

// ========== Provider ==========

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
  const { touchSession } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const currentRunIdRef = useRef<string | null>(null);
  const streamContentRef = useRef("");
  const toolCallsRef = useRef<ToolCall[]>([]);
  const sessionEpochRef = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  // 内存缓存：sessionId → Message[]
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());

  const setMessagesWithCache = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (sessionId) {
        messagesCacheRef.current.set(sessionId, next);
      }
      return next;
    });
  }, [sessionId]);

  // 获取会话消息：先从 SQLite 加载
  const fetchMessages = useCallback(async () => {
    if (!sessionId || !isConnected) return;

    const currentEpoch = sessionEpochRef.current;
    const isCurrentlyInitialLoad = !hasLoadedOnceRef.current;

    setLoading(true);
    if (!isCurrentlyInitialLoad) {
      setIsSessionSwitching(true);
    }
    setError(null);

    try {
      // 从 SQLite 加载历史消息
      const sqliteMessages = await loadMessagesFromSQLite(sessionId);

      if (currentEpoch !== sessionEpochRef.current) return;

      // 内存缓存优先（保留 streaming 时组装的完整 toolCalls）
      const cached = sessionId ? messagesCacheRef.current.get(sessionId) : null;

      if (cached && cached.length > 0) {
        setMessagesWithCache(cached);
      } else if (sqliteMessages.length > 0) {
        setMessagesWithCache(sqliteMessages);
      }

      hasLoadedOnceRef.current = true;
      setIsInitialLoad(false);
    } catch (err) {
      if (currentEpoch !== sessionEpochRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to fetch messages";
      setError(message);
      console.error("[fetchMessages] Error:", err);
    } finally {
      if (currentEpoch === sessionEpochRef.current) {
        setLoading(false);
        setIsSessionSwitching(false);
      }
    }
  }, [sessionId, client, isConnected, setMessagesWithCache]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim() || isStreaming || !isConnected) return;

      setError(null);

      const createdAt = Date.now();
      const tempUserMessage: Message = {
        id: `temp-user-${nanoid()}`,
        sessionId,
        role: "user",
        content: content.trim(),
        createdAt,
      };

      setMessagesWithCache((prev) => [...prev, tempUserMessage]);
      setStreamContent("");
      setToolCalls([]);
      setIsStreaming(true);

      try {
        const result = await client.chatSend({
          sessionKey: sessionId,
          message: content.trim(),
          idempotencyKey: nanoid(),
        });
        currentRunIdRef.current = result.runId;

        // 发送成功后，持久化 user 消息到 SQLite（用 runId 做唯一标识）
        const userMsgId = `msg-user-${result.runId}`;
        // 更新内存中的消息 ID
        setMessagesWithCache((prev) =>
          prev.map((m) => (m.id === tempUserMessage.id ? { ...m, id: userMsgId } : m))
        );
        await saveMessageToSQLite({
          id: userMsgId,
          sessionId,
          role: "user",
          content: content.trim(),
          runId: result.runId,
          createdAt,
        });
        touchSession(sessionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        setMessagesWithCache((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, isConnected, client, setMessagesWithCache, touchSession]
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
    const handleChat = async (event: ChatEvent) => {
      const isTempSession = sessionId?.startsWith("temp-");

      if (isTempSession && sessionId && !event.sessionKey.startsWith("temp-")) {
        onSessionKeyUpdate?.(sessionId, event.sessionKey);
      }

      const isCurrentSession = isTempSession
        ? !event.sessionKey.startsWith("temp-") || event.sessionKey === sessionId
        : event.sessionKey === sessionId;

      if (!isCurrentSession) return;

      switch (event.state) {
        case "delta":
          break;

        case "final": {
          const rawMessage = event.message;
          let finalUsed = false;
          let assistantMsgId = `msg-assistant-${event.runId || nanoid()}`;
          let assistantContent: string | ContentBlock[] = "";
          let assistantToolCalls: ToolCall[] | undefined;

          if (rawMessage) {
            const rawContent = typeof rawMessage === "object" && rawMessage !== null && "content" in (rawMessage as Record<string, unknown>)
              ? (rawMessage as Record<string, unknown>).content
              : rawMessage;

            let parsedFinalContent: unknown = rawContent;
            if (typeof rawContent === "string" && rawContent.trim().startsWith("[")) {
              try { parsedFinalContent = JSON.parse(rawContent); } catch { /* keep as string */ }
            }

            const blocks = parseContentBlocks(parsedFinalContent);

            // 优先从 content blocks 提取完整 toolCalls（含 arguments）
            const agentToolCalls = toolCallsRef.current;
            let finalToolCalls: ToolCall[] = [];

            if (blocks) {
              for (const block of blocks) {
                if (block.type === "toolCall") {
                  const agentTC = agentToolCalls.find((tc) => tc.id === block.id);
                  finalToolCalls.push({
                    id: block.id,
                    name: block.name,
                    arguments: (block as import("@/lib/types").ToolCallOCBlock).arguments ?? {},
                    status: agentTC?.status ?? "success",
                    result: agentTC?.result,
                    error: agentTC?.error,
                    startedAt: agentTC?.startedAt,
                    completedAt: agentTC?.completedAt,
                  });
                } else if (block.type === "tool_use") {
                  const agentTC = agentToolCalls.find((tc) => tc.id === block.id);
                  finalToolCalls.push({
                    id: block.id,
                    name: block.name,
                    arguments: block.input ?? {},
                    status: agentTC?.status ?? "success",
                    result: agentTC?.result,
                    error: agentTC?.error,
                    startedAt: agentTC?.startedAt,
                    completedAt: agentTC?.completedAt,
                  });
                } else if (block.type === "tool_call") {
                  const agentTC = agentToolCalls.find((tc) => tc.id === block.id);
                  let args: Record<string, unknown> = {};
                  try { args = JSON.parse(block.function.arguments); } catch { /* ignore */ }
                  finalToolCalls.push({
                    id: block.id,
                    name: block.function.name,
                    arguments: args,
                    status: agentTC?.status ?? "success",
                    result: agentTC?.result,
                    error: agentTC?.error,
                    startedAt: agentTC?.startedAt,
                    completedAt: agentTC?.completedAt,
                  });
                }
              }
            }

            if (finalToolCalls.length === 0 && agentToolCalls.length > 0) {
              finalToolCalls = agentToolCalls;
            }

            if (blocks) {
              assistantContent = blocks;
              assistantToolCalls = finalToolCalls.length > 0 ? finalToolCalls : undefined;
              setMessagesWithCache((prev) => [...prev, {
                id: assistantMsgId,
                sessionId: sessionId || "",
                role: "assistant",
                content: assistantContent,
                createdAt: Date.now(),
                toolCalls: assistantToolCalls,
              }]);
              finalUsed = true;
            } else {
              const textContent = extractContent(parsedFinalContent);
              if (textContent) {
                assistantContent = textContent;
                assistantToolCalls = finalToolCalls.length > 0 ? finalToolCalls : undefined;
                setMessagesWithCache((prev) => [...prev, {
                  id: assistantMsgId,
                  sessionId: sessionId || "",
                  role: "assistant",
                  content: assistantContent,
                  createdAt: Date.now(),
                  toolCalls: assistantToolCalls,
                }]);
                finalUsed = true;
              }
            }
          }

          if (!finalUsed && streamContentRef.current?.trim()) {
            assistantContent = streamContentRef.current;
            assistantToolCalls = toolCallsRef.current.length > 0 ? toolCallsRef.current : undefined;
            setMessagesWithCache((prev) => [...prev, {
              id: assistantMsgId,
              sessionId: sessionId || "",
              role: "assistant",
              content: assistantContent,
              createdAt: Date.now(),
              toolCalls: assistantToolCalls,
            }]);
          }

          // 持久化 assistant 消息到 SQLite
          const createdAt = Date.now();
          const contentStr = typeof assistantContent === "string"
            ? assistantContent
            : JSON.stringify(assistantContent);

          await saveMessageToSQLite({
            id: assistantMsgId,
            sessionId: sessionId || "",
            role: "assistant",
            content: contentStr,
            toolCalls: assistantToolCalls ? JSON.stringify(assistantToolCalls) : undefined,
            runId: currentRunIdRef.current || undefined,
            createdAt,
          });
          if (sessionId) touchSession(sessionId);

          streamContentRef.current = "";
          setStreamContent("");
          setIsStreaming(false);
          currentRunIdRef.current = null;
          break;
        }

        case "aborted":
          setIsStreaming(false);
          setStreamContent("");
          currentRunIdRef.current = null;
          break;

        case "error":
          setError(event.errorMessage || "Unknown error");
          setIsStreaming(false);
          setStreamContent("");
          currentRunIdRef.current = null;
          break;
      }
    };

    const unsubscribe = client.on("chat", handleChat);
    return () => unsubscribe();
  }, [sessionId, client, onSessionKeyUpdate, setMessagesWithCache]);

  // 处理 agent 事件（工具调用 + 流式助手回复）
  useEffect(() => {
    const handleAgent = (event: AgentEvent) => {
      if (event.sessionKey && event.sessionKey !== sessionId) return;
      if (currentRunIdRef.current && event.runId !== currentRunIdRef.current) return;

      if (event.stream === "assistant" && event.data) {
        const delta = (event.data as Record<string, unknown>).delta;
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
            const updated = prev.map((tc) => {
              if (tc.id !== toolCallId) return tc;
              const status: ToolCallStatus = isError ? "error" : phase === "result" ? "success" : "running";
              return {
                ...tc,
                status,
                result: result !== undefined ? (typeof result === "string" ? result : JSON.stringify(result)) : tc.result,
                error: isError ? String(result) : tc.error,
                completedAt: phase === "result" ? Date.now() : tc.completedAt,
              };
            });
            toolCallsRef.current = updated;
            return updated;
          } else {
            const status: ToolCallStatus = isError ? "error" : phase === "result" ? "success" : "running";
            const newTC: ToolCall = {
              id: toolCallId,
              name: name || "unknown",
              arguments: args || {},
              status,
              result: result !== undefined ? (typeof result === "string" ? result : JSON.stringify(result)) : undefined,
              error: isError ? String(result) : undefined,
              startedAt: Date.now(),
              completedAt: phase === "result" ? Date.now() : undefined,
            };
            const next = [...prev, newTC];
            toolCallsRef.current = next;
            return next;
          }
        });
      }
    };

    const unsubscribe = client.on("agent", handleAgent);
    return () => unsubscribe();
  }, [sessionId, client]);

  // sessionId 变化时：中断旧请求，恢复缓存，获取新消息
  useLayoutEffect(() => {
    sessionEpochRef.current++;

    if (currentRunIdRef.current) {
      abortStream();
    }

    setIsStreaming(false);
    setStreamContent("");
    setToolCalls([]);
    setError(null);
    currentRunIdRef.current = null;
    setIsSessionSwitching(true);

    const cached = sessionId ? messagesCacheRef.current.get(sessionId) : null;
    setMessages(cached ?? []);

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

export type { ChatContextType };

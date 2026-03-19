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

  // 获取会话消息
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
      const history = await client.chatHistory({
        sessionKey: sessionId,
        limit: 100,
      });

      if (currentEpoch !== sessionEpochRef.current) return;

      const historyData = history as unknown as Record<string, unknown>;
      const messagesArr = Array.isArray(historyData?.messages) ? historyData.messages : Array.isArray(history) ? history : [];

      if (currentEpoch !== sessionEpochRef.current) return;

      const formatted = parseGatewayMessages(messagesArr, sessionId);

      // 内存缓存优先（保留 streaming 时组装的完整 toolCalls）
      const cached = sessionId ? messagesCacheRef.current.get(sessionId) : null;
      if (cached && cached.length > 0) {
        setMessagesWithCache(cached);
      } else if (formatted.length > 0) {
        setMessagesWithCache(formatted);
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
  }, [sessionId, client, isConnected]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim() || isStreaming || !isConnected) return;

      setError(null);

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
        const result = await client.chatSend({
          sessionKey: sessionId,
          message: content.trim(),
          idempotencyKey: nanoid(),
        });
        currentRunIdRef.current = result.runId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send message";
        setError(message);
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
              setMessagesWithCache((prev) => [...prev, {
                id: `msg-final-${nanoid()}`,
                sessionId: sessionId || "",
                role: "assistant",
                content: blocks,
                createdAt: Date.now(),
                toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
              }]);
              finalUsed = true;
            } else {
              const textContent = extractContent(parsedFinalContent);
              if (textContent) {
                setMessagesWithCache((prev) => [...prev, {
                  id: `msg-final-${nanoid()}`,
                  sessionId: sessionId || "",
                  role: "assistant",
                  content: textContent,
                  createdAt: Date.now(),
                  toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
                }]);
                finalUsed = true;
              }
            }
          }

          if (!finalUsed && streamContentRef.current?.trim()) {
            setMessagesWithCache((prev) => [...prev, {
              id: `msg-final-${nanoid()}`,
              sessionId: sessionId || "",
              role: "assistant",
              content: streamContentRef.current,
              createdAt: Date.now(),
              toolCalls: toolCallsRef.current.length > 0 ? toolCallsRef.current : undefined,
            }]);
          }

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
  }, [sessionId, client, onSessionKeyUpdate]);

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

// ========== 辅助函数 ==========

/** 解析 Gateway chat.history 返回的原始消息数组 */
function parseGatewayMessages(messagesArr: unknown[], sessionId: string): Message[] {
  const toolInfoMap = new Map<string, { name: string; input: Record<string, unknown> }>();
  const toolResultMap = new Map<string, { result: string; isError: boolean }>();

  // 第一遍：收集所有 assistant content blocks 里的 toolCall/tool_use（name + arguments）
  for (const item of messagesArr) {
    if (typeof item !== "object" || item === null) continue;
    const msg = item as Record<string, unknown>;
    const role = (msg.role as string)?.toLowerCase();
    if (role !== "assistant") continue;

    const rawContent = msg.content ?? (msg.message as Record<string, unknown>)?.content;
    let parsedContent: unknown = rawContent;
    if (typeof rawContent === "string" && rawContent.trim().startsWith("[")) {
      try { parsedContent = JSON.parse(rawContent); } catch { /* keep as string */ }
    }
    const blocks = parseContentBlocks(parsedContent);
    if (!blocks) continue;

    for (const block of blocks) {
      if (block.type === "toolCall") {
        toolInfoMap.set(block.id, {
          name: block.name,
          input: (block as import("@/lib/types").ToolCallOCBlock).arguments ?? {},
        });
      } else if (block.type === "tool_use") {
        toolInfoMap.set(block.id, { name: block.name, input: block.input ?? {} });
      } else if (block.type === "tool_call") {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(block.function.arguments); } catch { args = { raw: block.function.arguments }; }
        toolInfoMap.set(block.id, { name: block.function.name, input: args });
      }
    }
  }

  // 第一遍补充：收集 tool_result 消息的 result
  for (const item of messagesArr) {
    if (typeof item !== "object" || item === null) continue;
    const msg = item as Record<string, unknown>;
    const role = (msg.role as string)?.toLowerCase();
    if (role !== "tool" && role !== "tool_result" && role !== "toolresult") continue;

    const toolId = msg.toolCallId ?? msg.tool_call_id ?? msg.tool_use_id ?? msg.id;
    if (toolId) {
      const rawResult = msg.content ?? msg.result;
      const result = typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult ?? "");
      const isError = msg.is_error === true || msg.isError === true;
      toolResultMap.set(toolId as string, { result, isError });
    }
  }

  // 第二遍：组装消息
  const formatted: Message[] = [];
  let pendingToolCalls: ToolCall[] = [];

  for (const item of messagesArr) {
    if (typeof item !== "object" || item === null) continue;
    const msg = item as Record<string, unknown>;
    const role = (msg.role as string)?.toLowerCase();

    // 跳过 tool_result 消息（信息已合并到 assistant 消息）
    if (role === "tool" || role === "tool_result" || role === "toolresult" || role === "function") {
      // 从 assistant content blocks 和 tool_result 消息合并 toolCalls
      const toolId = msg.toolCallId ?? msg.tool_call_id ?? msg.tool_use_id ?? msg.id ?? `tool-${nanoid()}`;
      const info = toolInfoMap.get(toolId as string);
      const resultInfo = toolResultMap.get(toolId as string);
      const toolName = msg.toolName ?? msg.name
        ?? (msg.function as Record<string, unknown>)?.name
        ?? info?.name
        ?? "tool";
      pendingToolCalls.push({
        id: toolId as string,
        name: toolName as string,
        arguments: info?.input ?? {},
        status: resultInfo?.isError ? "error" : "success",
        result: resultInfo?.result,
        startedAt: (msg.createdAt as number) || Date.now(),
        completedAt: Date.now(),
      });
      continue;
    }

    const rawContent = msg.content ?? (msg.message as Record<string, unknown>)?.content;
    let parsedContent: unknown = rawContent;
    if (typeof rawContent === "string" && rawContent.trim().startsWith("[")) {
      try { parsedContent = JSON.parse(rawContent); } catch { /* keep as string */ }
    }
    const blocks = parseContentBlocks(parsedContent);
    const messageContent: string | ContentBlock[] = blocks ?? extractContent(parsedContent);

    const message: Message = {
      id: (msg.id as string) || `msg-${nanoid()}`,
      sessionId,
      role: (msg.role as string) || "user",
      content: messageContent,
      createdAt: (msg.createdAt as number) || Date.now(),
    };

    if (role === "assistant" && pendingToolCalls.length > 0) {
      (message as Record<string, unknown>).toolCalls = [...pendingToolCalls];
      pendingToolCalls = [];
    }

    formatted.push(message);
  }

  return formatted;
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

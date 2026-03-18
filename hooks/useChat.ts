"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiStream, ApiError } from "@/lib/api";
import type { Message, SessionWithMessagesResponse, ChatRequest } from "@/lib/types";
import { nanoid } from "nanoid";

export function useChat(sessionId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 用于取消流式请求
  const abortControllerRef = useRef<(() => void) | null>(null);

  // 获取会话消息
  const fetchMessages = useCallback(async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new ApiError(errorData.error || `HTTP ${response.status}`, response.status);
      }
      const data = (await response.json()) as SessionWithMessagesResponse;
      setMessages(data.messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch messages";
      setError(message);
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // 发送消息
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || !content.trim() || isStreaming) {
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
      setIsStreaming(true);

      try {
        // 2. 发起流式请求
        const { stream, abort } = await apiStream("/chat/stream", {
          sessionId,
          content: content.trim(),
        } as ChatRequest);

        abortControllerRef.current = abort;

        const reader = stream.getReader();
        let fullContent = "";

        // 3. 读取 SSE 流
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 解析 SSE 格式: data: {"content": "..."}\n\n
          const lines = value.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6).trim();
                if (jsonStr) {
                  const data = JSON.parse(jsonStr) as { content: string };
                  fullContent += data.content;
                  setStreamContent(fullContent);
                }
              } catch (parseErr) {
                console.error("Error parsing SSE data:", parseErr, line);
              }
            }
          }
        }

        // 4. 流结束后，添加 AI 消息到 messages
        // 注意：服务端已经保存了消息，这里需要重新获取完整消息列表
        // 或者创建一个临时的 AI 消息（乐观更新）
        const tempAssistantMessage: Message = {
          id: `temp-assistant-${nanoid()}`,
          sessionId,
          role: "assistant",
          content: fullContent,
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, tempAssistantMessage]);
        setStreamContent("");
      } catch (err) {
        // 如果是用户主动取消，不显示错误
        if (err instanceof Error && err.name === "AbortError") {
          console.log("Stream aborted by user");
        } else {
          const message = err instanceof Error ? err.message : "Failed to send message";
          setError(message);
          console.error("Error sending message:", err);
          // 移除乐观添加的用户消息
          setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId, isStreaming]
  );

  // 中断流式请求
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamContent("");
  }, []);

  // sessionId 变化时自动获取消息
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current();
      }
    };
  }, []);

  return {
    messages,
    isStreaming,
    streamContent,
    loading,
    error,
    fetchMessages,
    sendMessage,
    abortStream,
  };
}

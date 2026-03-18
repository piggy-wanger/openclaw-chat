"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type {
  Session,
  SessionsListResponse,
  SessionResponse,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "@/lib/types";

export function useSession() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计算当前选中的会话对象
  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((s) => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  // 获取所有会话
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<SessionsListResponse>("/sessions");
      // API 已按 updatedAt 降序排列
      setSessions(response.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch sessions";
      setError(message);
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 创建新会话
  const createSession = useCallback(
    async (title?: string, type?: "direct" | "group", model?: string) => {
      setLoading(true);
      setError(null);
      try {
        const request: CreateSessionRequest = {
          title,
          type,
          model,
        };
        const response = await apiPost<SessionResponse>("/sessions", request);
        const newSession = response.session;

        // 添加到列表并设为当前会话
        setSessions((prev) => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);

        return newSession;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create session";
        setError(message);
        console.error("Error creating session:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 更新会话
  const updateSession = useCallback(
    async (id: string, updates: { title?: string; model?: string }) => {
      setError(null);
      try {
        const request: UpdateSessionRequest = updates;
        const response = await apiPatch<SessionResponse>(`/sessions/${id}`, request);

        // 更新列表中的会话
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? response.session : s))
        );

        return response.session;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update session";
        setError(message);
        console.error("Error updating session:", err);
        return null;
      }
    },
    []
  );

  // 删除会话
  const deleteSession = useCallback(async (id: string) => {
    setError(null);
    try {
      await apiDelete<{ success: boolean }>(`/sessions/${id}`);

      // 从列表中移除
      setSessions((prev) => prev.filter((s) => s.id !== id));

      // 如果删除的是当前会话，清空当前会话 ID
      setCurrentSessionId((prevId) => (prevId === id ? null : prevId));

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete session";
      setError(message);
      console.error("Error deleting session:", err);
      return false;
    }
  }, []);

  // 切换当前会话
  const selectSession = useCallback((id: string | null) => {
    setCurrentSessionId(id);
  }, []);

  // 组件挂载时自动获取会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return {
    sessions,
    currentSessionId,
    currentSession,
    loading,
    error,
    fetchSessions,
    createSession,
    updateSession,
    deleteSession,
    selectSession,
  };
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useGateway } from "./useGateway";
import type { SessionEntry } from "@/lib/gateway-types";
import type { Session } from "@/lib/types";

// Context 类型
type SessionContextType = {
  sessions: Session[];
  currentSessionId: string | null;
  currentSession: Session | null;
  loading: boolean;
  error: string | null;
  fetchSessions: () => Promise<void>;
  createSession: () => Promise<Session | null>;
  updateSession: (
    id: string,
    updates: { title?: string; model?: string }
  ) => Promise<Session | null>;
  deleteSession: (id: string) => Promise<boolean>;
  selectSession: (id: string | null) => void;
};

// Context
const SessionContext = createContext<SessionContextType | null>(null);

// 将 SessionEntry 转换为 Session
function sessionEntryToSession(entry: SessionEntry): Session {
  return {
    id: entry.key,
    title: entry.title || "New Chat",
    type: entry.origin || "direct",
    model: entry.model || "unknown",
    createdAt: entry.updatedAt || Date.now(),
    updatedAt: entry.updatedAt || Date.now(),
  };
}

// Provider
export function SessionProvider({ children }: { children: ReactNode }) {
  const { client, isConnected } = useGateway();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算当前选中的会话对象
  const currentSession = useMemo(() => {
    if (!currentSessionId) return null;
    return sessions.find((s) => s.id === currentSessionId) || null;
  }, [sessions, currentSessionId]);

  // 获取所有会话
  const fetchSessions = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const entries = await client.sessionsList({
        limit: 100,
        includeDerivedTitles: true,
      });
      // 转换为 Session 类型并按 updatedAt 降序排列
      const sessionList = entries
        .map(sessionEntryToSession)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setSessions(sessionList);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch sessions";
      setError(message);
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [client, isConnected]);

  // 创建新会话 - Gateway 模式下不预先创建，返回一个临时 session
  const createSession = useCallback(async () => {
    // 在 Gateway 模式下，会话在首条消息发送时自动创建
    // 这里创建一个临时的 session 占位符
    const tempSession: Session = {
      id: `temp-${Date.now()}`,
      title: "New Chat",
      type: "direct",
      model: "unknown",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 添加到列表并设为当前会话
    setSessions((prev) => [tempSession, ...prev]);
    setCurrentSessionId(tempSession.id);

    return tempSession;
  }, []);

  // 更新会话
  const updateSession = useCallback(
    async (id: string, updates: { title?: string; model?: string }) => {
      if (!isConnected) {
        setError("Not connected to Gateway");
        return null;
      }

      setError(null);
      try {
        // 调用 Gateway sessions.patch
        await client.sessionsPatch({
          key: id,
          title: updates.title,
        });

        // 更新本地状态
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...(updates.title && { title: updates.title }),
                  ...(updates.model && { model: updates.model }),
                  updatedAt: Date.now(),
                }
              : s
          )
        );

        // 返回更新后的 session
        const updatedSession = sessions.find((s) => s.id === id);
        return updatedSession || null;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update session";
        setError(message);
        console.error("Error updating session:", err);
        return null;
      }
    },
    [client, isConnected, sessions]
  );

  // 删除会话
  const deleteSession = useCallback(
    async (id: string) => {
      if (!isConnected) {
        setError("Not connected to Gateway");
        return false;
      }

      setError(null);
      try {
        // 调用 Gateway sessions.reset
        await client.sessionsReset(id);

        // 从列表中移除
        setSessions((prev) => prev.filter((s) => s.id !== id));

        // 如果删除的是当前会话，清空当前会话 ID
        setCurrentSessionId((prevId) => (prevId === id ? null : prevId));

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete session";
        setError(message);
        console.error("Error deleting session:", err);
        return false;
      }
    },
    [client, isConnected]
  );

  // 切换当前会话
  const selectSession = useCallback((id: string | null) => {
    setCurrentSessionId(id);
  }, []);

  // 当连接状态变化时获取会话列表
  useEffect(() => {
    if (isConnected) {
      fetchSessions();
    } else {
      // 断开连接时清空会话列表
      setSessions([]);
    }
  }, [isConnected, fetchSessions]);

  return (
    <SessionContext.Provider
      value={{
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
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

// Hook
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

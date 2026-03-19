"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { nanoid } from "nanoid";
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
  createSessionWithOptions: (options: {
    sessionName: string;
    agentId: string;
    model: string;
  }) => Promise<Session | null>;
  createGroupSession: (options: {
    groupName: string;
    agentIds: string[];
    model?: string;
  }) => Promise<Session | null>;
  updateSession: (
    id: string,
    updates: { title?: string; model?: string }
  ) => Promise<Session | null>;
  updateTempSessionId: (tempId: string, realSessionKey: string) => void;
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

// 从 sessionKey 中提取显示名称（最后一段）
export function extractSessionDisplayName(sessionKey: string): string {
  const parts = sessionKey.split(":");
  return parts.length > 1 ? parts[parts.length - 1] : sessionKey;
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
    // 这里创建一个临时的 session 占位符，使用 nanoid 避免 ID 冲突
    const tempSession: Session = {
      id: `temp-${Date.now()}-${nanoid(6)}`,
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

  // 创建带有自定义选项的新会话
  const createSessionWithOptions = useCallback(
    async (options: {
      sessionName: string;
      agentId: string;
      model: string;
    }) => {
      const { sessionName, agentId, model } = options;

      // 构建唯一的 session ID: agent:<agentId>:<sessionName>:<nanoid>
      // sessionKey for Gateway is agent:<agentId>:<sessionName>, but local ID is unique
      const uniqueId = `agent:${agentId}:${sessionName}:${nanoid(6)}`;

      // 创建一个临时 session（真实的 sessionKey 在首条消息发送后生效）
      const tempSession: Session = {
        id: uniqueId,
        title: sessionName,
        type: "direct",
        model: model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 添加到列表并设为当前会话
      setSessions((prev) => [tempSession, ...prev]);
      setCurrentSessionId(tempSession.id);

      return tempSession;
    },
    []
  );

  // 创建群组会话 - 需要先在 Gateway 创建真实会话
  const createGroupSession = useCallback(
    async (options: {
      groupName: string;
      agentIds: string[];
      model?: string;
    }) => {
      const { groupName, agentIds, model } = options;

      if (!isConnected || agentIds.length === 0) {
        return null;
      }

      try {
        // 使用第一个 agent 作为主 agent，并添加 nanoid 避免冲突
        const primaryAgentId = agentIds[0];
        const sessionKey = `agent:${primaryAgentId}:${groupName}:${nanoid(6)}`;

        // 创建群组 session（真实会话在用户发送首条消息时由 Gateway 创建）
        const groupSession: Session = {
          id: sessionKey,
          title: groupName,
          type: "group",
          model: model || "unknown",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // 添加到列表并设为当前会话
        setSessions((prev) => [groupSession, ...prev]);
        setCurrentSessionId(groupSession.id);

        return groupSession;
      } catch (err) {
        console.error("Error creating group session:", err);
        return null;
      }
    },
    [client, isConnected]
  );

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

  // 更新临时会话 ID 为真实的 sessionKey
  const updateTempSessionId = useCallback(
    (tempId: string, realSessionKey: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === tempId
            ? {
                ...s,
                id: realSessionKey,
                updatedAt: Date.now(),
              }
            : s
        )
      );

      // 如果当前选中的是临时会话，更新当前会话 ID
      setCurrentSessionId((prevId) => (prevId === tempId ? realSessionKey : prevId));
    },
    []
  );

  // 使用 ref 追踪是否已经 fetch 过，避免重复 fetch
  const hasFetchedRef = useRef(false);

  // 当连接状态变化时获取会话列表
  useEffect(() => {
    if (isConnected && !hasFetchedRef.current) {
      fetchSessions();
      hasFetchedRef.current = true;
    }

    if (!isConnected) {
      // 断开连接时重置 ref 并清空会话列表，下次连接时可重新 fetch
      hasFetchedRef.current = false;
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
        createSessionWithOptions,
        createGroupSession,
        updateSession,
        updateTempSessionId,
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

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
const GROUP_SESSIONS_STORAGE_KEY = "openclaw.groupSessions.v1";

function buildGroupInitPrompt(opts: {
  groupId: string;
  groupName: string;
  members: Array<{ agentId: string; name: string; emoji?: string }>;
  selfAgentId: string;
}): string {
  const memberLine = opts.members
    .map((member) => `${member.emoji?.trim() || "🤖"} ${member.name}(${member.agentId})`)
    .join("、");
  const selfMember = opts.members.find((member) => member.agentId === opts.selfAgentId);
  const selfLine = `${selfMember?.emoji?.trim() || "🤖"} ${selfMember?.name || opts.selfAgentId}(${opts.selfAgentId})`;

  return [
    "系统初始化：你现在在一个群组会话中。",
    `群组名称：${opts.groupName}`,
    `群组成员：${memberLine}`,
    `你的身份：${selfLine}`,
    "",
    "你可以在需要时查询群组历史，接口如下：",
    `GET /api/groups/${opts.groupId}/history`,
    `GET http://127.0.0.1:3000/api/groups/${opts.groupId}/history`,
    "",
    "可用查询参数：",
    "- format=text（默认）或 format=json",
    "- senderId=agentId",
    "- keyword=关键词",
    "- before=时间戳",
    "- maxChars=30000",
    "",
    "使用规则：",
    "1. 当问题依赖历史上下文时，先查询再回答。",
    "2. 只引用必要信息，不要粘贴完整历史。",
    "3. 若返回 truncated=true，缩小范围再查。",
    "",
    "上下文过长时可用 /compact 压缩上下文。",
    "这是一条系统初始化消息，不需要回复用户。",
  ].join("\n");
}

function isGroupSession(session: Session): boolean {
  return session.type === "group" && typeof session.groupId === "string" && session.groupId.trim().length > 0;
}

function loadStoredGroupSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GROUP_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is Session => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Session;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.title === "string" &&
          candidate.type === "group" &&
          typeof candidate.groupId === "string" &&
          typeof candidate.model === "string" &&
          typeof candidate.createdAt === "number" &&
          typeof candidate.updatedAt === "number"
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persistGroupSessions(sessions: Session[]): void {
  if (typeof window === "undefined") return;
  try {
    const groupsOnly = sessions.filter(isGroupSession);
    window.localStorage.setItem(GROUP_SESSIONS_STORAGE_KEY, JSON.stringify(groupsOnly));
  } catch (err) {
    console.warn("[Session] Failed to persist group sessions:", err);
  }
}

// 将 SessionEntry 转换为 Session
function sessionEntryToSession(entry: SessionEntry): Session {
  // 解析 origin 字段
  // origin 可能是字符串（如 "direct"）或对象（群组场景）
  let type: Session["type"] = "direct";
  let title = entry.title || extractSessionDisplayName(entry.key);
  let groupId: string | undefined;

  if (typeof entry.origin === "string") {
    type = entry.origin as Session["type"];
  } else if (entry.origin && typeof entry.origin === "object") {
    // 群组场景：origin 是对象，包含 type 或 agentIds 字段
    const originObj = entry.origin as Record<string, unknown>;
    if (originObj.type === "group" || Array.isArray(originObj.agentIds)) {
      type = "group";
      if (typeof originObj.groupId === "string" && originObj.groupId.trim()) {
        groupId = originObj.groupId;
      }
      // 使用 origin 中的 label 或 name 作为群组名称
      if (originObj.label && typeof originObj.label === "string") {
        title = entry.title || originObj.label;
      } else if (originObj.name && typeof originObj.name === "string") {
        title = entry.title || originObj.name;
      }
    }
  }

  return {
    id: entry.key,
    title,
    type,
    groupId,
    model: entry.model || "unknown",
    createdAt: entry.updatedAt || Date.now(),
    updatedAt: entry.updatedAt || Date.now(),
  };
}

// 从 sessionKey 中提取显示名称（最后一段）
export function extractSessionDisplayName(sessionKey: string): string {
  const parts = sessionKey.split(":");
  // agent:<agentId>:<sessionName>[:<nanoid>] → agentId:sessionName
  if (parts.length > 2 && parts[0] === "agent") {
    // 去掉 "agent" 前缀和可能的 nanoid 后缀
    let nameParts = parts.slice(1);
    const last = nameParts[nameParts.length - 1];
    if (/^[a-z0-9]{6,8}$/.test(last)) {
      nameParts = nameParts.slice(0, -1);
    }
    return nameParts.join(":") || sessionKey;
  }
  return parts.length > 1 ? parts[parts.length - 1] : sessionKey;
}

// Provider
export function SessionProvider({ children }: { children: ReactNode }) {
  const { client, isConnected } = useGateway();
  const [sessions, setSessions] = useState<Session[]>(() => loadStoredGroupSessions());
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
        .filter(e => e.origin != null)
        .map(sessionEntryToSession)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const localGroupSessions = loadStoredGroupSessions();
      const mergedMap = new Map<string, Session>(sessionList.map((session) => [session.id, session]));

      for (const localSession of localGroupSessions) {
        const existing = mergedMap.get(localSession.id);
        if (!existing) {
          mergedMap.set(localSession.id, localSession);
          continue;
        }

        if (existing.type === "group") {
          mergedMap.set(localSession.id, {
            ...localSession,
            ...existing,
            groupId: existing.groupId ?? localSession.groupId,
            title: existing.title || localSession.title,
          });
        }
      }

      setSessions(Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt));
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
        type AgentConfig = {
          id: string;
          identity?: {
            name?: string;
            emoji?: string;
          };
        };

        const configResult = await client.configGet();
        const config = configResult.config as {
          agents?: {
            list?: AgentConfig[];
          };
        };
        const agentMap = new Map((config.agents?.list ?? []).map((agent) => [agent.id, agent]));

        const normalizedMembers = agentIds.map((agentId) => {
          const agent = agentMap.get(agentId);
          return {
            agentId,
            name: agent?.identity?.name || agentId,
            emoji: agent?.identity?.emoji,
          };
        });

        const createGroupRes = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName,
            members: normalizedMembers,
          }),
        });

        if (!createGroupRes.ok) {
          throw new Error(`Failed to create group: ${createGroupRes.status}`);
        }

        const createGroupData = (await createGroupRes.json()) as {
          group?: { id?: string };
        };
        const groupId = createGroupData.group?.id;
        if (!groupId) {
          throw new Error("Group ID missing from createGroup response");
        }

        const initTasks = normalizedMembers.map(async (member) => {
          const sessionKey = `agent:${member.agentId}:${groupId}`;
          const initPrompt = buildGroupInitPrompt({
            groupId,
            groupName,
            members: normalizedMembers,
            selfAgentId: member.agentId,
          });

          await client.chatSend({
            sessionKey,
            message: initPrompt,
            idempotencyKey: nanoid(),
          });
        });

        const initResults = await Promise.allSettled(initTasks);
        for (let i = 0; i < initResults.length; i += 1) {
          const result = initResults[i];
          if (result.status === "rejected") {
            const member = normalizedMembers[i];
            console.warn(`[Session] Failed to initialize group context for ${member.agentId}:`, result.reason);
          }
        }

        // 使用第一个 agent 作为主 agent 的会话 key，确保可与后续聊天会话 key 对齐
        const primaryAgentId = agentIds[0];
        const sessionKey = `agent:${primaryAgentId}:${groupId}`;

        // 创建群组 session（groupId 用于关联本地 group 数据）
        const groupSession: Session = {
          id: sessionKey,
          title: groupName,
          type: "group",
          groupId,
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
          model: updates.model,
        });

        // 更新本地状态
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...updates,
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
        const targetSession = sessions.find((session) => session.id === id);

        if (targetSession?.type === "group" && targetSession.groupId) {
          try {
            const membersRes = await fetch(`/api/groups/${targetSession.groupId}/members`, {
              cache: "no-store",
            });
            const membersData = membersRes.ok
              ? ((await membersRes.json()) as { members?: Array<{ agentId: string; sessionKey?: string | null }> })
              : { members: [] };
            const members = Array.isArray(membersData.members) ? membersData.members : [];

            const sessionKeys = new Set<string>([id]);
            for (const member of members) {
              if (member.sessionKey?.trim()) {
                sessionKeys.add(member.sessionKey.trim());
              } else if (member.agentId?.trim()) {
                sessionKeys.add(`agent:${member.agentId.trim()}:${targetSession.groupId}`);
              }
            }

            await Promise.allSettled(
              Array.from(sessionKeys).map(async (sessionKey) => {
                await client.sessionsDelete(sessionKey);
              })
            );
          } catch (cleanupErr) {
            console.warn("[Session] Failed to cleanup group sessions:", cleanupErr);
          }

          try {
            await fetch(`/api/groups/${targetSession.groupId}`, { method: "DELETE" });
          } catch (deleteGroupErr) {
            console.warn("[Session] Failed to delete group record:", deleteGroupErr);
          }
        } else {
          await client.sessionsDelete(id);
        }

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
      setSessions(loadStoredGroupSessions());
    }
  }, [isConnected, fetchSessions]);

  useEffect(() => {
    persistGroupSessions(sessions);
  }, [sessions]);

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

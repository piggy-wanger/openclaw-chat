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
    sessionId: string;
    sessionName?: string;
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
    "你现在是一个群组成员。",
    "",
    `群组名称：「${opts.groupName}」`,
    `群组成员：${memberLine}`,
    `你的身份：${selfLine}`,
    "",
    "## 群组历史消息查询",
    "",
    "群组的所有聊天记录存储在本地 SQLite 数据库中。你可以通过以下 API 查询完整历史消息：",
    "",
    `GET /api/groups/${opts.groupId}/history`,
    "",
    "查询参数：",
    "- format=text（默认）或 format=json",
    "- senderId=agentId（按成员筛选）",
    "- keyword=关键词（全文搜索）",
    "- before=时间戳（查询此时间之前的消息）",
    "- limit=最大返回条数",
    "- maxChars=30000（返回内容字符上限，防止超出上下文）",
    "",
    "使用规则：",
    "1. 当用户的问题可能依赖之前的讨论时，你应该先查询历史再回答",
    "2. 不要在回复中粘贴全部查询结果，只引用与当前问题相关的部分",
    "3. 如果返回了 truncated=true，说明内容被截断，你可以缩小范围重新查询（比如用 senderId 或 keyword 筛选）",
    "",
    "## 上下文管理",
    "",
    "- 你的会话有上下文窗口限制。当你觉得上下文信息过多时，使用 /compact 命令进行压缩",
    "- 查询历史后，只提取关键信息回答，不要将查询到的内容原样复制到回复中",
    "",
    "## 群组协作",
    "",
    "- 在群聊中你可以使用 @其他成员名 或 @agentId 提及其他成员，触发对方继续回复",
    "- 只有当前群组成员会被触发，请优先提及最相关的成员，避免无意义级联",
    "",
    "这是一条系统初始化消息，不需要回复用户。",
  ].join("\n");
}

function isGroupSession(session: Session): boolean {
  return session.type === "group" && typeof session.groupId === "string" && session.groupId.trim().length > 0;
}

function isGroupMemberSessionKey(
  sessionKey: string,
  groupIds: Set<string>,
  groupMemberSessionKeys: Set<string>
): boolean {
  if (!sessionKey) return false;

  const normalizedKey = sessionKey.trim().toLowerCase();
  if (!normalizedKey) return false;

  // 精确命中或命中已知 sessionKey 的派生后缀（如 :<nanoid>）
  for (const memberSessionKey of groupMemberSessionKeys) {
    if (normalizedKey === memberSessionKey || normalizedKey.startsWith(`${memberSessionKey}:`)) {
      return true;
    }
  }

  if (groupIds.size === 0) return false;
  const parts = normalizedKey.split(":").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;

  if (parts[0] === "agent") {
    if (parts.length < 3) return false;

    // 兼容 agent:<agentId>:<groupId>[:suffix...]，并放宽到第 3 段之后任一段命中 groupId
    for (let i = 2; i < parts.length; i += 1) {
      if (groupIds.has(parts[i])) {
        return true;
      }
    }
    return false;
  }

  // 兼容 <agentId>:<groupId>[:suffix...]（Gateway 可能返回无 "agent:" 前缀的 key）
  for (let i = 1; i < parts.length; i += 1) {
    if (groupIds.has(parts[i])) {
      return true;
    }
  }

  return false;
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
function sessionEntryToSession(
  entry: SessionEntry,
  groupNameById?: ReadonlyMap<string, string>
): Session {
  // 解析 origin 字段
  // origin 可能是字符串（如 "direct"）或对象（群组场景）
  let type: Session["type"] = "direct";
  const keyInfo = parseSessionKey(entry.key);
  const entryTitle = entry.title?.trim();
  const hasCustomDisplayName =
    Boolean(entryTitle) &&
    entryTitle !== keyInfo.sessionName &&
    entryTitle !== keyInfo.readableKey;
  let displayName = hasCustomDisplayName ? entryTitle : undefined;
  let title = displayName || keyInfo.sessionName || keyInfo.readableKey;
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
      displayName = undefined;
    }
  }

  if (type === "group" && groupId) {
    const mappedGroupName = groupNameById?.get(groupId);
    if (mappedGroupName?.trim()) {
      title = mappedGroupName;
    }
  }

  return {
    id: entry.key,
    title,
    displayName,
    type,
    groupId,
    model: entry.model || "unknown",
    createdAt: entry.updatedAt || Date.now(),
    updatedAt: entry.updatedAt || Date.now(),
  };
}

function parseSessionKey(sessionKey: string): {
  sessionName: string;
  readableKey: string;
  agentId?: string;
} {
  const parts = sessionKey.split(":");
  if (parts.length > 2 && parts[0] === "agent") {
    const agentId = parts[1] || "unknown";
    let nameParts = parts.slice(2);
    const last = nameParts[nameParts.length - 1] || "";
    if (/^[a-z0-9]{6}$/.test(last)) {
      nameParts = nameParts.slice(0, -1);
    }
    const sessionName = nameParts.join(":") || sessionKey;
    return {
      sessionName,
      readableKey: `${agentId}:${sessionName}`,
      agentId,
    };
  }

  let normalizedParts = [...parts];
  const last = normalizedParts[normalizedParts.length - 1] || "";
  if (normalizedParts.length > 2 && /^[a-z0-9]{6,8}$/.test(last)) {
    normalizedParts = normalizedParts.slice(0, -1);
  }

  const sessionName =
    normalizedParts.length > 1
      ? normalizedParts[normalizedParts.length - 1]
      : sessionKey;
  return {
    sessionName,
    readableKey:
      normalizedParts.length > 1 ? normalizedParts.join(":") : sessionName,
  };
}

type SqliteSessionRow = {
  id: string;
  displayName: string | null;
  readableKey: string | null;
  sessionName: string | null;
  agentId: string | null;
  type: "direct" | "group";
  model: string | null;
  createdAt: number;
  updatedAt: number;
};

type SessionSyncPayload = {
  id: string;
  readableKey: string;
  sessionName: string;
  agentId?: string;
  type: "direct" | "group";
  model?: string;
  createdAt: number;
  updatedAt: number;
};

function sqliteSessionRowToSession(row: SqliteSessionRow): Session {
  const keyInfo = parseSessionKey(row.id);
  const normalizedDisplayName = row.displayName?.trim() || "";
  const normalizedSessionName = row.sessionName?.trim() || keyInfo.sessionName || row.id;
  const title = normalizedDisplayName || normalizedSessionName || keyInfo.readableKey || row.id;

  return {
    id: row.id,
    title,
    displayName: row.type === "direct" ? normalizedDisplayName || undefined : undefined,
    type: row.type,
    groupId: row.type === "group" ? normalizedSessionName || undefined : undefined,
    model: row.model || "unknown",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// 从 sessionKey 中提取主标题候选（sessionName）
export function extractSessionDisplayName(sessionKey: string): string {
  return parseSessionKey(sessionKey).sessionName;
}

// 将 sessionKey 转换为可读格式（agentId:sessionName）
export function formatReadableSessionKey(sessionKey: string): string {
  return parseSessionKey(sessionKey).readableKey;
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
      const localGroupSessions = loadStoredGroupSessions();
      const knownGroupIds = new Set<string>(
        localGroupSessions
          .map((session) => session.groupId?.trim().toLowerCase())
          .filter((id): id is string => Boolean(id))
      );
      const knownGroupMemberSessionKeys = new Set<string>();
      const groupNameById = new Map<string, string>();

      try {
        const groupsRes = await fetch("/api/groups", { cache: "no-store" });
        if (groupsRes.ok) {
          const groupsData = (await groupsRes.json()) as {
            groups?: Array<{ id?: string; name?: string }>;
          };
          const groups = Array.isArray(groupsData.groups) ? groupsData.groups : [];
          for (const group of groups) {
            const groupId = group.id?.trim();
            if (groupId) {
              knownGroupIds.add(groupId.toLowerCase());
              if (group.name?.trim()) {
                groupNameById.set(groupId, group.name.trim());
              }
            }
          }

          const memberResults = await Promise.allSettled(
            groups
              .map((group) => group.id?.trim())
              .filter((groupId): groupId is string => Boolean(groupId))
              .map(async (groupId) => {
                const membersRes = await fetch(`/api/groups/${groupId}/members`, {
                  cache: "no-store",
                });
                if (!membersRes.ok) return;

                const membersData = (await membersRes.json()) as {
                  members?: Array<{ agentId?: string; sessionKey?: string | null }>;
                };
                const members = Array.isArray(membersData.members) ? membersData.members : [];
                for (const member of members) {
                  const agentId = member.agentId?.trim();
                  if (!agentId) continue;

                  const explicitSessionKey = member.sessionKey?.trim();
                  const canonicalSessionKey = `agent:${agentId}:${groupId}`.toLowerCase();
                  const compactSessionKey = `${agentId}:${groupId}`.toLowerCase();
                  if (explicitSessionKey) {
                    knownGroupMemberSessionKeys.add(explicitSessionKey.toLowerCase());
                  }
                  knownGroupMemberSessionKeys.add(canonicalSessionKey);
                  knownGroupMemberSessionKeys.add(compactSessionKey);
                }
              })
          );

          for (const result of memberResults) {
            if (result.status === "rejected") {
              console.warn("[Session] Failed to fetch group members for session filtering:", result.reason);
            }
          }
        }
      } catch (groupErr) {
        console.warn("[Session] Failed to fetch group IDs for session filtering:", groupErr);
      }

      const entries = await client.sessionsList({
        limit: 100,
        includeDerivedTitles: true,
      });

      // 转换为 Session 类型并按 updatedAt 降序排列
      const gatewaySessions = entries
        .filter(e => e.origin != null)
        .filter((entry) => !isGroupMemberSessionKey(entry.key, knownGroupIds, knownGroupMemberSessionKeys))
        .map((entry) => sessionEntryToSession(entry, groupNameById))
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const payload: SessionSyncPayload[] = gatewaySessions.map((session) => {
        const keyInfo = parseSessionKey(session.id);
        const sessionName =
          session.type === "group"
            ? session.groupId?.trim() || keyInfo.sessionName
            : keyInfo.sessionName;

        return {
          id: session.id,
          readableKey: keyInfo.readableKey,
          sessionName,
          agentId: keyInfo.agentId,
          type: session.type,
          model: session.model || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        };
      });

      const syncRes = await fetch("/api/sessions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: payload }),
      });
      if (!syncRes.ok) {
        throw new Error(`Failed to sync sessions: ${syncRes.status}`);
      }

      const sqliteRes = await fetch("/api/sessions", { cache: "no-store" });
      if (!sqliteRes.ok) {
        throw new Error(`Failed to read sessions from SQLite: ${sqliteRes.status}`);
      }
      const sqliteData = (await sqliteRes.json()) as { sessions?: SqliteSessionRow[] };
      const sqliteSessions = (Array.isArray(sqliteData.sessions) ? sqliteData.sessions : [])
        .map(sqliteSessionRowToSession)
        .sort((a, b) => b.updatedAt - a.updatedAt);

      const mergedMap = new Map<string, Session>(sqliteSessions.map((session) => [session.id, session]));
      const mergedByGroupId = new Map<string, Session>();
      for (const session of sqliteSessions) {
        const gid = session.groupId?.trim();
        if (session.type === "group" && gid) {
          mergedByGroupId.set(gid, session);
        }
      }

      for (const localSession of localGroupSessions) {
        const existing = mergedMap.get(localSession.id);
        const existingByGroupId =
          existing ||
          (localSession.groupId?.trim() ? mergedByGroupId.get(localSession.groupId.trim()) : undefined);

        if (!existingByGroupId) {
          mergedMap.set(localSession.id, localSession);
          continue;
        }

        if (existingByGroupId.id !== localSession.id) {
          mergedMap.delete(existingByGroupId.id);
        }

        mergedMap.set(localSession.id, {
          ...existingByGroupId,
          ...localSession,
          type: "group",
          groupId: localSession.groupId ?? existingByGroupId.groupId,
          title: localSession.title || existingByGroupId.title,
        });
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
      displayName: "New Chat",
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
      sessionId: string;
      sessionName?: string;
      agentId: string;
      model: string;
    }) => {
      const normalizedSessionId = options.sessionId.trim();
      const normalizedSessionName = options.sessionName?.trim() || undefined;
      const { agentId, model } = options;

      // Gateway 兼容的 sessionKey 需要带 agent: 前缀；
      // 为避免同名会话冲突，沿用随机后缀。
      const sessionKey = `agent:${agentId}:${normalizedSessionId}:${nanoid(6)}`;

      const tempSession: Session = {
        id: sessionKey,
        title: normalizedSessionName || normalizedSessionId,
        displayName: normalizedSessionName,
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

        const createSessionRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: groupSession.id,
            displayName: groupName,
            readableKey: formatReadableSessionKey(groupSession.id),
            sessionName: groupId,
            agentId: primaryAgentId,
            type: "group",
            model: groupSession.model,
          }),
        });
        if (!createSessionRes.ok) {
          throw new Error(`Failed to write group session into SQLite: ${createSessionRes.status}`);
        }

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
          model: updates.model,
        });

        const sqliteRes = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: updates.title,
            title: updates.title,
            model: updates.model,
          }),
        });
        if (!sqliteRes.ok) {
          throw new Error(`Failed to update session in SQLite: ${sqliteRes.status}`);
        }

        // 更新本地状态
        setSessions((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...updates,
                  ...(s.type === "direct" && updates.title !== undefined
                    ? {
                        displayName: updates.title.trim() || undefined,
                        title: updates.title.trim() || extractSessionDisplayName(s.id),
                      }
                    : {}),
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
        const sqliteDeleteKeys = new Set<string>([id]);

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
            for (const sessionKey of sessionKeys) {
              sqliteDeleteKeys.add(sessionKey);
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

        const sqliteDeleteResults = await Promise.allSettled(
          Array.from(sqliteDeleteKeys).map(async (sessionKey) => {
            const sqliteRes = await fetch(`/api/sessions/${encodeURIComponent(sessionKey)}`, {
              method: "DELETE",
            });
            if (!sqliteRes.ok) {
              throw new Error(`Failed to delete SQLite session ${sessionKey}: ${sqliteRes.status}`);
            }
          })
        );
        for (const result of sqliteDeleteResults) {
          if (result.status === "rejected") {
            console.warn("[Session] Failed to delete SQLite session:", result.reason);
          }
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
    [client, isConnected, sessions]
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

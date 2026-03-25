"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useGateway } from "./useGateway";
import { extractTextContent } from "@/lib/contentBlocks";
import { extractMentionedAgentIds } from "@/lib/mentions";
import type { AgentEvent, ChatEvent } from "@/lib/gateway-types";
import type { Group, GroupMember, GroupMessage } from "@/lib/types";

type StreamingState = {
  isStreaming: boolean;
  content: string;
  runId: string | null;
};

type GroupChatContextType = {
  group: Group | null;
  members: GroupMember[];
  membersOnline: Map<string, boolean>;
  messages: GroupMessage[];
  loading: boolean;
  isSessionSwitching: boolean;
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  streamingMap: Map<string, StreamingState>;
  sendMessage: (content: string, mentionedAgentIds?: string[]) => Promise<void>;
  abortStream: (agentId?: string) => Promise<void>;
  fetchMessages: (opts?: { loadMore?: boolean }) => Promise<void>;
  fetchGroupData: () => Promise<void>;
};

type GroupDetailResponse = {
  group: Group;
};

type GroupMembersResponse = {
  members: GroupMember[];
};

type GroupMessagesResponse = {
  messages: GroupMessage[];
  pagination?: {
    limit: number;
    hasMore: boolean;
    nextBefore: string | null;
  };
};

const GroupChatContext = createContext<GroupChatContextType | null>(null);
const MAX_MENTION_HOPS = 3;
const MENTION_TRIGGER_COOLDOWN_MS = 15_000;

type MentionChainState = {
  depth: number;
  visitedAgentIds: Set<string>;
};

function toSortedJoinedAgentIds(visitedAgentIds: Set<string>): string {
  return Array.from(visitedAgentIds)
    .map((agentId) => agentId.trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

function buildChainIdempotencyKey(opts: {
  groupId: string;
  targetAgentId: string;
  sourceRunId?: string;
  sourceAgentId?: string;
  depth: number;
  visitedAgentIds: Set<string>;
}): string {
  const visited = toSortedJoinedAgentIds(opts.visitedAgentIds);
  const sourceRun = opts.sourceRunId?.trim() || "user";
  const sourceAgent = opts.sourceAgentId?.trim() || "user";
  const raw = `group:${opts.groupId}|fromRun:${sourceRun}|fromAgent:${sourceAgent}|to:${opts.targetAgentId}|hop:${opts.depth}|visited:${visited}`;
  return raw.slice(0, 240);
}

function normalizeStateValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isTerminalSuccess(event: ChatEvent): boolean {
  const state = normalizeStateValue(event.state);
  if (
    state === "final" ||
    state === "completed" ||
    state === "success" ||
    state === "done" ||
    state === "finished" ||
    state === "succeeded"
  ) {
    return true;
  }

  const status = normalizeStateValue((event as unknown as { status?: string }).status);
  return (
    status === "completed" ||
    status === "success" ||
    status === "done" ||
    status === "final" ||
    status === "finished" ||
    status === "succeeded"
  );
}

function isTerminalFailure(event: ChatEvent): boolean {
  const state = normalizeStateValue(event.state);
  if (
    state === "aborted" ||
    state === "error" ||
    state === "failed" ||
    state === "cancelled" ||
    state === "canceled" ||
    state === "stopped"
  ) {
    return true;
  }

  const status = normalizeStateValue((event as unknown as { status?: string }).status);
  return (
      status === "aborted" ||
      status === "error" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "canceled" ||
      status === "stopped"
    );
}

function safeParseMessageContent(message: ChatEvent["message"]): string {
  if (!message) return "";

  const messageObj =
    typeof message === "object" && message !== null
      ? (message as Record<string, unknown>)
      : null;

  const rawContent = messageObj && "content" in messageObj ? messageObj.content : message;

  let parsed: unknown = rawContent;
  if (typeof rawContent === "string" && rawContent.trim().startsWith("[")) {
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = rawContent;
    }
  }

  return extractTextContent(parsed);
}

function buildMemberSessionKey(member: GroupMember, groupId: string): string {
  const explicit = member.sessionKey?.trim();
  if (explicit) return explicit;
  return `agent:${member.agentId}:${groupId}`;
}

export function GroupChatProvider({
  children,
  groupId,
}: {
  children: ReactNode;
  groupId: string | null;
}) {
  const { client, isConnected } = useGateway();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSessionSwitching, setIsSessionSwitching] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [streamingMap, setStreamingMap] = useState<Map<string, StreamingState>>(new Map());
  const membersOnline = useMemo(
    () => new Map(members.map((member) => [member.agentId, true])),
    [members]
  );

  const membersRef = useRef<GroupMember[]>([]);
  const messagesRef = useRef<GroupMessage[]>([]);
  const streamingMapRef = useRef<Map<string, StreamingState>>(new Map());
  const agentToSessionKeyRef = useRef<Map<string, string>>(new Map());
  const sessionKeyToAgentRef = useRef<Map<string, string>>(new Map());
  const runIdToAgentRef = useRef<Map<string, string>>(new Map());
  const runMentionChainRef = useRef<Map<string, MentionChainState>>(new Map());
  const mentionCooldownRef = useRef<Map<string, number>>(new Map());
  const toolCallsRef = useRef<Map<string, unknown[]>>(new Map());
  const completedRunsRef = useRef<Set<string>>(new Set());
  const groupFetchEpochRef = useRef(0);
  const groupFetchAbortRef = useRef<AbortController | null>(null);

  const setStreamingMapState = useCallback(
    (updater: Map<string, StreamingState> | ((prev: Map<string, StreamingState>) => Map<string, StreamingState>)) => {
      setStreamingMap((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        streamingMapRef.current = next;
        return next;
      });
    },
    []
  );

  const fetchMessages = useCallback(async (opts?: { loadMore?: boolean }) => {
    if (!groupId) return;
    const loadMore = Boolean(opts?.loadMore);
    if (loadMore && isLoadingMore) return;

    const params = new URLSearchParams();
    params.set("limit", "50");

    if (loadMore) {
      const oldest = messagesRef.current[0];
      if (!oldest) return;
      params.set("before", `${oldest.createdAt}:${oldest.id}`);
      setIsLoadingMore(true);
    }

    try {
      const res = await fetch(`/api/groups/${groupId}/messages?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = (await res.json()) as GroupMessagesResponse;
      const pageMessages = Array.isArray(data.messages) ? data.messages : [];

      if (loadMore) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((message) => message.id));
          const olderMessages = pageMessages.filter((message) => !existingIds.has(message.id));
          return [...olderMessages, ...prev];
        });
      } else {
        setMessages(pageMessages);
      }

      setHasMoreMessages(Boolean(data.pagination?.hasMore));
    } catch (err) {
      console.error("[GroupChat] Failed to fetch messages:", err);
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        console.log("[GroupChat] setIsSessionSwitching(false) after fetchMessages", { groupId });
        setIsSessionSwitching(false);
      }
    }
  }, [groupId, isLoadingMore]);

  const fetchGroupData = useCallback(async () => {
    const currentEpoch = ++groupFetchEpochRef.current;
    groupFetchAbortRef.current?.abort();
    const abortController = new AbortController();
    groupFetchAbortRef.current = abortController;

    if (!groupId) {
      setGroup(null);
      setMembers([]);
      setMessages([]);
      setHasMoreMessages(false);
      setIsLoadingMore(false);
      setIsSessionSwitching(false);
      setLoading(false);
      console.log("[GroupChat] setIsSessionSwitching(false) because groupId is null");
      return;
    }

    setLoading(true);
    try {
      const [groupRes, membersRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, { cache: "no-store", signal: abortController.signal }),
        fetch(`/api/groups/${groupId}/members`, { cache: "no-store", signal: abortController.signal }),
      ]);

      if (!groupRes.ok || !membersRes.ok) {
        throw new Error("Failed to initialize group chat data");
      }

      const groupData = (await groupRes.json()) as GroupDetailResponse;
      const membersData = (await membersRes.json()) as GroupMembersResponse;

      if (currentEpoch !== groupFetchEpochRef.current) return;

      setGroup(groupData.group ?? null);
      const memberList = Array.isArray(membersData.members) ? membersData.members : [];
      setMembers(memberList);
      membersRef.current = memberList;
      await fetchMessages();
    } catch (err) {
      if (currentEpoch !== groupFetchEpochRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[GroupChat] Failed to initialize:", err);
      setGroup(null);
      setMembers([]);
      setMessages([]);
      setHasMoreMessages(false);
      console.log("[GroupChat] setIsSessionSwitching(false) due to fetchGroupData error", { groupId });
      setIsSessionSwitching(false);
    } finally {
      if (currentEpoch === groupFetchEpochRef.current) {
        setLoading(false);
      }
      if (groupFetchAbortRef.current === abortController) {
        groupFetchAbortRef.current = null;
      }
    }
  }, [groupId]);

  const abortStream = useCallback(
    async (agentId?: string) => {
      const tasks: Promise<void>[] = [];

      const abortOne = async (targetAgentId: string): Promise<void> => {
        const streamState = streamingMapRef.current.get(targetAgentId);
        const sessionKey = agentToSessionKeyRef.current.get(targetAgentId);
        if (!streamState?.runId || !sessionKey || !isConnected) return;

        try {
          await client.chatAbort({
            sessionKey,
            runId: streamState.runId,
          });
        } catch (err) {
          console.error(`[GroupChat] Failed to abort ${targetAgentId}:`, err);
        }
      };

      if (agentId) {
        tasks.push(abortOne(agentId));
      } else {
        for (const [targetAgentId, streamState] of streamingMapRef.current.entries()) {
          if (streamState.isStreaming) {
            tasks.push(abortOne(targetAgentId));
          }
        }
      }

      await Promise.all(tasks);

      if (agentId) {
        setStreamingMapState((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });
        const sessionKey = agentToSessionKeyRef.current.get(agentId);
        if (sessionKey) {
          sessionKeyToAgentRef.current.delete(sessionKey);
        }
        const activeRunId = streamingMapRef.current.get(agentId)?.runId;
        if (activeRunId) {
          runIdToAgentRef.current.delete(activeRunId);
          runMentionChainRef.current.delete(activeRunId);
        }
        agentToSessionKeyRef.current.delete(agentId);
        toolCallsRef.current.delete(agentId);
      } else {
        setStreamingMapState(new Map());
        agentToSessionKeyRef.current.clear();
        sessionKeyToAgentRef.current.clear();
        runIdToAgentRef.current.clear();
        runMentionChainRef.current.clear();
        mentionCooldownRef.current.clear();
        toolCallsRef.current.clear();
      }
    },
    [client, isConnected, setStreamingMapState]
  );

  const dispatchToAgents = useCallback(
    async (opts: {
      message: string;
      targetMembers: GroupMember[];
      mentionChain?: MentionChainState;
      sourceRunId?: string;
      sourceAgentId?: string;
      isMentionCascade?: boolean;
    }) => {
      if (!groupId || !isConnected) return;
      const message = opts.message.trim();
      if (!message || opts.targetMembers.length === 0) return;

      const now = Date.now();
      const chain = opts.mentionChain ?? { depth: 0, visitedAgentIds: new Set<string>() };
      const nextDepth = opts.isMentionCascade ? chain.depth + 1 : chain.depth;

      await Promise.all(
        opts.targetMembers.map(async (member) => {
          const targetAgentId = member.agentId;
          const visitedWithTarget = new Set(chain.visitedAgentIds);
          visitedWithTarget.add(targetAgentId);

          if (opts.isMentionCascade) {
            const lastTriggeredAt = mentionCooldownRef.current.get(targetAgentId) ?? 0;
            if (now - lastTriggeredAt < MENTION_TRIGGER_COOLDOWN_MS) {
              return;
            }
          }

          const sessionKey = buildMemberSessionKey(member, groupId);
          const idempotencyKey = buildChainIdempotencyKey({
            groupId,
            targetAgentId,
            sourceRunId: opts.sourceRunId,
            sourceAgentId: opts.sourceAgentId,
            depth: nextDepth,
            visitedAgentIds: visitedWithTarget,
          });

          try {
            agentToSessionKeyRef.current.set(targetAgentId, sessionKey);
            sessionKeyToAgentRef.current.set(sessionKey, targetAgentId);

            setStreamingMapState((prev) => {
              const next = new Map(prev);
              next.set(targetAgentId, {
                isStreaming: true,
                content: "",
                runId: null,
              });
              return next;
            });

            if (opts.isMentionCascade) {
              mentionCooldownRef.current.set(targetAgentId, now);
            }

            const result = await client.chatSend({
              sessionKey,
              message,
              idempotencyKey,
            });

            setStreamingMapState((prev) => {
              const next = new Map(prev);
              next.set(targetAgentId, {
                ...(next.get(targetAgentId) ?? {
                  isStreaming: true,
                  content: "",
                }),
                runId: result.runId,
              });
              return next;
            });

            runIdToAgentRef.current.set(result.runId, targetAgentId);
            runMentionChainRef.current.set(result.runId, {
              depth: nextDepth,
              visitedAgentIds: visitedWithTarget,
            });
          } catch (err) {
            console.error(`[GroupChat] Failed to dispatch message to ${targetAgentId}:`, err);
            if (opts.isMentionCascade) {
              mentionCooldownRef.current.delete(targetAgentId);
            }
            setStreamingMapState((prev) => {
              const next = new Map(prev);
              next.delete(targetAgentId);
              return next;
            });
            agentToSessionKeyRef.current.delete(targetAgentId);
            sessionKeyToAgentRef.current.delete(sessionKey);
            toolCallsRef.current.delete(targetAgentId);
          }
        })
      );
    },
    [client, groupId, isConnected, setStreamingMapState]
  );

  const persistAgentReply = useCallback(
    async (opts: {
      agentId: string;
      runId: string;
      content: string;
      mentionChain: MentionChainState;
    }) => {
      if (!groupId || !opts.content.trim()) return;

      const member = membersRef.current.find((m) => m.agentId === opts.agentId);
      if (!member) return;

      const toolCalls = toolCallsRef.current.get(opts.agentId);

      try {
        await fetch(`/api/groups/${groupId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderType: "agent",
            senderId: member.agentId,
            senderName: member.name,
            senderEmoji: member.emoji ?? undefined,
            role: "assistant",
            content: opts.content,
            runId: opts.runId,
            toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
          }),
        });
      } catch (err) {
        console.error("[GroupChat] Failed to persist assistant reply:", err);
      }

      const trimmedContent = opts.content.trim();
      if (trimmedContent && opts.mentionChain.depth < MAX_MENTION_HOPS) {
        const membersList = [...membersRef.current];
        const mentionedAgentIds = extractMentionedAgentIds(
          trimmedContent,
          membersList.map((currentMember) => ({
            id: currentMember.agentId,
            name: currentMember.name,
          }))
        );

        if (mentionedAgentIds.length > 0) {
          const memberByAgentId = new Map(
            membersList.map((currentMember) => [currentMember.agentId, currentMember])
          );
          const targetMembers = mentionedAgentIds
            .filter((agentId) => agentId !== opts.agentId)
            .filter((agentId) => !opts.mentionChain.visitedAgentIds.has(agentId))
            .map((agentId) => memberByAgentId.get(agentId))
            .filter((currentMember): currentMember is GroupMember => Boolean(currentMember));

          if (targetMembers.length > 0) {
            await dispatchToAgents({
              message: trimmedContent,
              targetMembers,
              mentionChain: opts.mentionChain,
              sourceRunId: opts.runId,
              sourceAgentId: opts.agentId,
              isMentionCascade: true,
            });
          }
        }
      }

      toolCallsRef.current.delete(opts.agentId);
      await fetchMessages();
    },
    [dispatchToAgents, fetchMessages, groupId]
  );

  const sendMessage = useCallback(
    async (content: string, mentionedAgentIds?: string[]) => {
      if (!groupId || !isConnected) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      try {
        await fetch(`/api/groups/${groupId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderType: "user",
            role: "user",
            content: trimmed,
          }),
        });
      } catch (err) {
        console.error("[GroupChat] Failed to persist user message:", err);
        return;
      }

      await fetchMessages();

      const memberList = [...membersRef.current];
      if (memberList.length === 0) return;

      const targetAgentIdSet = new Set(
        (mentionedAgentIds ?? [])
          .map((agentId) => agentId.trim())
          .filter(Boolean)
      );
      const targetMembers =
        targetAgentIdSet.size > 0
          ? memberList.filter((member) => targetAgentIdSet.has(member.agentId))
          : memberList;
      if (targetMembers.length === 0) return;

      // G3.2 预留：Agent 间上下文共享
      // 可选方案：发送消息时拼接前几条 Agent 回复作为上下文
      // const recentReplies = messages.filter(m => m.senderType === "agent").slice(-N);
      // const contextContent = recentReplies.map(r => `[${r.senderName}]: ${r.content}`).join("\n");
      // finalMessage = contextContent + "\n---\n" + content;
      const finalMessage = trimmed;
      await dispatchToAgents({
        message: finalMessage,
        targetMembers,
      });
    },
    [dispatchToAgents, fetchMessages, groupId, isConnected]
  );

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const handleChat = (event: ChatEvent) => {
      const eventSessionKey =
        typeof (event as unknown as { sessionKey?: unknown }).sessionKey === "string"
          ? (event as unknown as { sessionKey: string }).sessionKey
          : "";
      const agentId =
        (eventSessionKey ? sessionKeyToAgentRef.current.get(eventSessionKey) : undefined) ??
        runIdToAgentRef.current.get(event.runId);
      if (!agentId) return;
      if (eventSessionKey && !sessionKeyToAgentRef.current.has(eventSessionKey)) {
        sessionKeyToAgentRef.current.set(eventSessionKey, agentId);
      }

      const streamState = streamingMapRef.current.get(agentId);
      if (!streamState) return;

      const isCompleted = isTerminalSuccess(event);
      const isFailed = isTerminalFailure(event);
      const shouldValidateRunId = isCompleted || isFailed;
      if (shouldValidateRunId && streamState.runId && event.runId !== streamState.runId) {
        return;
      }

      if (isCompleted) {
        const runKey = `${eventSessionKey || "unknown"}:${event.runId}`;
        if (completedRunsRef.current.has(runKey)) return;
        completedRunsRef.current.add(runKey);

        const content = safeParseMessageContent(event.message) || streamState.content;
        const mentionChain = runMentionChainRef.current.get(event.runId) ?? {
          depth: 0,
          visitedAgentIds: new Set([agentId]),
        };

        void persistAgentReply({
          agentId,
          runId: event.runId,
          content,
          mentionChain: {
            depth: mentionChain.depth,
            visitedAgentIds: new Set(mentionChain.visitedAgentIds),
          },
        });

        setStreamingMapState((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });

        agentToSessionKeyRef.current.delete(agentId);
        if (eventSessionKey) {
          sessionKeyToAgentRef.current.delete(eventSessionKey);
        }
        if (streamState.runId) {
          runIdToAgentRef.current.delete(streamState.runId);
          runMentionChainRef.current.delete(streamState.runId);
        }
        runIdToAgentRef.current.delete(event.runId);
        runMentionChainRef.current.delete(event.runId);
        return;
      }

      if (isFailed) {
        setStreamingMapState((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });

        agentToSessionKeyRef.current.delete(agentId);
        if (eventSessionKey) {
          sessionKeyToAgentRef.current.delete(eventSessionKey);
        }
        if (streamState.runId) {
          runIdToAgentRef.current.delete(streamState.runId);
          runMentionChainRef.current.delete(streamState.runId);
        }
        runIdToAgentRef.current.delete(event.runId);
        runMentionChainRef.current.delete(event.runId);
      }
    };

    const unsubscribe = client.on("chat", handleChat);
    return () => unsubscribe();
  }, [client, persistAgentReply, setStreamingMapState]);

  useEffect(() => {
    const handleAgent = (event: AgentEvent) => {
      const agentId =
        (event.sessionKey ? sessionKeyToAgentRef.current.get(event.sessionKey) : undefined) ??
        runIdToAgentRef.current.get(event.runId);
      if (!agentId) return;

      const streamState = streamingMapRef.current.get(agentId);
      if (!streamState) return;

      if (event.stream === "assistant") {
        const delta = (event.data as { delta?: unknown } | undefined)?.delta;
        if (typeof delta === "string" && delta && !delta.startsWith("NO_REPLY")) {
          setStreamingMapState((prev) => {
            const next = new Map(prev);
            const current = next.get(agentId);
            if (!current) return prev;

            next.set(agentId, {
              ...current,
              isStreaming: true,
              content: current.content + delta,
            });
            return next;
          });
        }
        return;
      }

      if (event.stream === "tool") {
        const current = toolCallsRef.current.get(agentId) ?? [];
        toolCallsRef.current.set(agentId, [...current, event.data ?? {}]);
      }
    };

    const unsubscribe = client.on("agent", handleAgent);
    return () => unsubscribe();
  }, [client, setStreamingMapState]);

  useEffect(() => {
    if (groupId) {
      console.log("[GroupChat] setIsSessionSwitching(true) on groupId change", { groupId });
      setIsSessionSwitching(true);
    } else {
      setIsSessionSwitching(false);
    }

    setStreamingMapState(new Map());
    agentToSessionKeyRef.current.clear();
    sessionKeyToAgentRef.current.clear();
    runIdToAgentRef.current.clear();
    runMentionChainRef.current.clear();
    mentionCooldownRef.current.clear();
    toolCallsRef.current.clear();
    completedRunsRef.current.clear();
    setHasMoreMessages(false);
    setIsLoadingMore(false);
    groupFetchAbortRef.current?.abort();
    void fetchGroupData();

    return () => {
      void abortStream();
      setStreamingMapState(new Map());
      agentToSessionKeyRef.current.clear();
      sessionKeyToAgentRef.current.clear();
      runIdToAgentRef.current.clear();
      runMentionChainRef.current.clear();
      mentionCooldownRef.current.clear();
      toolCallsRef.current.clear();
      completedRunsRef.current.clear();
      setHasMoreMessages(false);
      setIsLoadingMore(false);
      groupFetchAbortRef.current?.abort();
      groupFetchAbortRef.current = null;
    };
  }, [groupId, abortStream, fetchGroupData, setStreamingMapState]);

  const value = useMemo<GroupChatContextType>(
    () => ({
      group,
      members,
      membersOnline,
      messages,
      loading,
      isSessionSwitching,
      hasMoreMessages,
      isLoadingMore,
      streamingMap,
      sendMessage,
      abortStream,
      fetchMessages,
      fetchGroupData,
    }),
    [
      abortStream,
      fetchGroupData,
      fetchMessages,
      group,
      hasMoreMessages,
      isLoadingMore,
      isSessionSwitching,
      loading,
      members,
      membersOnline,
      messages,
      sendMessage,
      streamingMap,
    ]
  );

  return <GroupChatContext.Provider value={value}>{children}</GroupChatContext.Provider>;
}

export function useGroupChat() {
  const context = useContext(GroupChatContext);
  if (!context) {
    throw new Error("useGroupChat must be used within a GroupChatProvider");
  }
  return context;
}

export type { GroupChatContextType };

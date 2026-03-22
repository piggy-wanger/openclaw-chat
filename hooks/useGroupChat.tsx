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
  streamingMap: Map<string, StreamingState>;
  sendMessage: (content: string) => Promise<void>;
  abortStream: (agentId?: string) => Promise<void>;
  fetchMessages: () => Promise<void>;
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
};

const GroupChatContext = createContext<GroupChatContextType | null>(null);

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
  const [streamingMap, setStreamingMap] = useState<Map<string, StreamingState>>(new Map());
  const membersOnline = useMemo(
    () => new Map(members.map((member) => [member.agentId, true])),
    [members]
  );

  const membersRef = useRef<GroupMember[]>([]);
  const streamingMapRef = useRef<Map<string, StreamingState>>(new Map());
  const agentToSessionKeyRef = useRef<Map<string, string>>(new Map());
  const sessionKeyToAgentRef = useRef<Map<string, string>>(new Map());
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

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;

    try {
      const res = await fetch(`/api/groups/${groupId}/messages`, { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as GroupMessagesResponse;
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err) {
      console.error("[GroupChat] Failed to fetch messages:", err);
    }
  }, [groupId]);

  const fetchGroupData = useCallback(async () => {
    const currentEpoch = ++groupFetchEpochRef.current;
    groupFetchAbortRef.current?.abort();
    const abortController = new AbortController();
    groupFetchAbortRef.current = abortController;

    if (!groupId) {
      setGroup(null);
      setMembers([]);
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [groupRes, membersRes, messagesRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, { cache: "no-store", signal: abortController.signal }),
        fetch(`/api/groups/${groupId}/members`, { cache: "no-store", signal: abortController.signal }),
        fetch(`/api/groups/${groupId}/messages`, { cache: "no-store", signal: abortController.signal }),
      ]);

      if (!groupRes.ok || !membersRes.ok || !messagesRes.ok) {
        throw new Error("Failed to initialize group chat data");
      }

      const groupData = (await groupRes.json()) as GroupDetailResponse;
      const membersData = (await membersRes.json()) as GroupMembersResponse;
      const messagesData = (await messagesRes.json()) as GroupMessagesResponse;

      if (currentEpoch !== groupFetchEpochRef.current) return;

      setGroup(groupData.group ?? null);
      const memberList = Array.isArray(membersData.members) ? membersData.members : [];
      setMembers(memberList);
      membersRef.current = memberList;
      setMessages(Array.isArray(messagesData.messages) ? messagesData.messages : []);
    } catch (err) {
      if (currentEpoch !== groupFetchEpochRef.current) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[GroupChat] Failed to initialize:", err);
      setGroup(null);
      setMembers([]);
      setMessages([]);
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
        agentToSessionKeyRef.current.delete(agentId);
        toolCallsRef.current.delete(agentId);
      } else {
        setStreamingMapState(new Map());
        agentToSessionKeyRef.current.clear();
        sessionKeyToAgentRef.current.clear();
        toolCallsRef.current.clear();
      }
    },
    [client, isConnected, setStreamingMapState]
  );

  const persistAgentReply = useCallback(
    async (opts: { agentId: string; runId: string; content: string }) => {
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

      toolCallsRef.current.delete(opts.agentId);
      await fetchMessages();
    },
    [fetchMessages, groupId]
  );

  const sendMessage = useCallback(
    async (content: string) => {
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

      await Promise.all(
        memberList.map(async (member) => {
          const sessionKey = buildMemberSessionKey(member, groupId);

          try {
            const result = await client.chatSend({
              sessionKey,
              message: trimmed,
            });

            agentToSessionKeyRef.current.set(member.agentId, sessionKey);
            sessionKeyToAgentRef.current.set(sessionKey, member.agentId);

            setStreamingMapState((prev) => {
              const next = new Map(prev);
              next.set(member.agentId, {
                isStreaming: true,
                content: "",
                runId: result.runId,
              });
              return next;
            });
          } catch (err) {
            console.error(`[GroupChat] Failed to send message to ${member.agentId}:`, err);
          }
        })
      );
    },
    [client, fetchMessages, groupId, isConnected, setStreamingMapState]
  );

  useEffect(() => {
    void fetchGroupData();
  }, [fetchGroupData]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    const handleChat = (event: ChatEvent) => {
      const agentId = sessionKeyToAgentRef.current.get(event.sessionKey);
      if (!agentId) return;

      const streamState = streamingMapRef.current.get(agentId);
      if (!streamState) return;

      const state = event.state;
      const isCompleted = state === "final" || (event as unknown as { status?: string }).status === "completed";
      const shouldValidateRunId = isCompleted || state === "aborted" || state === "error";
      if (shouldValidateRunId && streamState.runId && event.runId !== streamState.runId) {
        return;
      }

      if (isCompleted) {
        const runKey = `${event.sessionKey}:${event.runId}`;
        if (completedRunsRef.current.has(runKey)) return;
        completedRunsRef.current.add(runKey);

        const content = safeParseMessageContent(event.message) || streamState.content;

        void persistAgentReply({
          agentId,
          runId: event.runId,
          content,
        });

        setStreamingMapState((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });

        agentToSessionKeyRef.current.delete(agentId);
        sessionKeyToAgentRef.current.delete(event.sessionKey);
        return;
      }

      if (state === "aborted" || state === "error") {
        setStreamingMapState((prev) => {
          const next = new Map(prev);
          next.delete(agentId);
          return next;
        });

        agentToSessionKeyRef.current.delete(agentId);
        sessionKeyToAgentRef.current.delete(event.sessionKey);
      }
    };

    const unsubscribe = client.on("chat", handleChat);
    return () => unsubscribe();
  }, [client, persistAgentReply, setStreamingMapState]);

  useEffect(() => {
    const handleAgent = (event: AgentEvent) => {
      if (!event.sessionKey) return;
      const agentId = sessionKeyToAgentRef.current.get(event.sessionKey);
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
    setStreamingMapState(new Map());
    agentToSessionKeyRef.current.clear();
    sessionKeyToAgentRef.current.clear();
    toolCallsRef.current.clear();
    completedRunsRef.current.clear();
    groupFetchAbortRef.current?.abort();

    return () => {
      void abortStream();
      setStreamingMapState(new Map());
      agentToSessionKeyRef.current.clear();
      sessionKeyToAgentRef.current.clear();
      toolCallsRef.current.clear();
      completedRunsRef.current.clear();
      groupFetchAbortRef.current?.abort();
      groupFetchAbortRef.current = null;
    };
  }, [groupId, abortStream, setStreamingMapState]);

  const value = useMemo<GroupChatContextType>(
    () => ({
      group,
      members,
      membersOnline,
      messages,
      loading,
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

"use client";

import { useEffect, useMemo, useState, forwardRef } from "react";
import { Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { SessionItem } from "./SessionItem";
import type { GroupMember, Session } from "@/lib/types";
import { extractSessionDisplayName } from "@/hooks/useSession";

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  loading?: boolean;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
}

export const SessionList = forwardRef<HTMLInputElement, SessionListProps>(
  function SessionList(
    {
      sessions,
      currentSessionId,
      loading,
      onSelectSession,
      onRenameSession,
      onDeleteSession,
    },
    searchInputRef
  ) {
    const [searchQuery, setSearchQuery] = useState("");
    const [groupMembersMap, setGroupMembersMap] = useState<Record<string, GroupMember[]>>({});

    useEffect(() => {
      const groupIds = Array.from(
        new Set(
          sessions
            .filter((session) => session.type === "group" && !!session.groupId)
            .map((session) => session.groupId as string)
        )
      );

      if (groupIds.length === 0) {
        queueMicrotask(() => {
          setGroupMembersMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        });
        return;
      }

      let cancelled = false;

      const fetchGroupMembers = async () => {
        const entries = await Promise.all(
          groupIds.map(async (groupId) => {
            try {
              const res = await fetch(`/api/groups/${groupId}/members`, {
                cache: "no-store",
              });
              if (!res.ok) {
                return [groupId, []] as const;
              }
              const data = (await res.json()) as { members?: GroupMember[] };
              return [groupId, Array.isArray(data.members) ? data.members : []] as const;
            } catch {
              return [groupId, []] as const;
            }
          })
        );

        if (cancelled) return;
        setGroupMembersMap(Object.fromEntries(entries));
      };

      void fetchGroupMembers();

      return () => {
        cancelled = true;
      };
    }, [sessions]);

    // 根据搜索词过滤会话
    const filteredSessions = useMemo(() => {
      if (!searchQuery.trim()) {
        return sessions;
      }
      const query = searchQuery.toLowerCase();
      return sessions.filter((s) => {
        if (s.type === "group") {
          return s.title.toLowerCase().includes(query);
        }
        const mainTitle = s.displayName?.trim() || extractSessionDisplayName(s.id);
        return (
          mainTitle.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
        );
      });
    }, [sessions, searchQuery]);

    // 分组过滤后的会话
    const { directSessions, groupSessions } = useMemo(() => {
      const direct = filteredSessions.filter((s) => s.type === "direct");
      const group = filteredSessions.filter((s) => s.type === "group");
      return { directSessions: direct, groupSessions: group };
    }, [filteredSessions]);

    const hasNoResults =
      searchQuery.trim() && filteredSessions.length === 0;

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* 搜索输入框 */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="搜索会话... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-8 bg-muted border-border text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* 会话列表或无结果提示 */}
        <ScrollArea className="flex-1 h-0">
          <div className="space-y-4 p-2">
            {hasNoResults ? (
              <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                未找到会话
              </div>
            ) : (
              <>
                {/* 直接聊天分组 */}
                <div>
                  <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    直接聊天
                  </h3>
                  <div className="space-y-1">
                    {directSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        groupMembers={
                          session.type === "group" && session.groupId
                            ? groupMembersMap[session.groupId]
                            : undefined
                        }
                        isActive={currentSessionId === session.id}
                        onSelect={() => onSelectSession(session.id)}
                        onRename={(title) => onRenameSession(session.id, title)}
                        onDelete={() => onDeleteSession(session.id)}
                      />
                    ))}
                    {directSessions.length === 0 && !loading && (
                      <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                        暂无会话
                      </div>
                    )}
                  </div>
                </div>

                {/* 群聊分组 - 仅在有群聊时显示 */}
                {groupSessions.length > 0 && (
                  <div>
                    <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      群聊
                    </h3>
                    <div className="space-y-1">
                      {groupSessions.map((session) => (
                        <SessionItem
                          key={session.id}
                          session={session}
                          groupMembers={
                            session.groupId ? groupMembersMap[session.groupId] : undefined
                          }
                          isActive={currentSessionId === session.id}
                          onSelect={() => onSelectSession(session.id)}
                          onRename={(title) =>
                            onRenameSession(session.id, title)
                          }
                          onDelete={() => onDeleteSession(session.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  }
);

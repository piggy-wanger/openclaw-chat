"use client";

import { useMemo, useState, forwardRef } from "react";
import { Search, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { SessionItem } from "./SessionItem";
import type { Session } from "@/lib/types";

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

    // 根据搜索词过滤会话
    const filteredSessions = useMemo(() => {
      if (!searchQuery.trim()) {
        return sessions;
      }
      const query = searchQuery.toLowerCase();
      return sessions.filter((s) =>
        s.title.toLowerCase().includes(query)
      );
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
        <div className="px-3 py-2 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="搜索会话... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-8 bg-zinc-800 border-zinc-700 text-sm placeholder:text-zinc-500 focus-visible:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-zinc-300"
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
              <div className="px-3 py-8 text-sm text-zinc-500 text-center">
                未找到会话
              </div>
            ) : (
              <>
                {/* 直接聊天分组 */}
                <div>
                  <h3 className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    直接聊天
                  </h3>
                  <div className="space-y-1">
                    {directSessions.map((session) => (
                      <SessionItem
                        key={session.id}
                        session={session}
                        isActive={currentSessionId === session.id}
                        onSelect={() => onSelectSession(session.id)}
                        onRename={(title) => onRenameSession(session.id, title)}
                        onDelete={() => onDeleteSession(session.id)}
                      />
                    ))}
                    {directSessions.length === 0 && !loading && (
                      <div className="px-3 py-4 text-sm text-zinc-500 text-center">
                        暂无会话
                      </div>
                    )}
                  </div>
                </div>

                {/* 群聊分组 - 仅在有群聊时显示 */}
                {groupSessions.length > 0 && (
                  <div>
                    <h3 className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      群聊
                    </h3>
                    <div className="space-y-1">
                      {groupSessions.map((session) => (
                        <SessionItem
                          key={session.id}
                          session={session}
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

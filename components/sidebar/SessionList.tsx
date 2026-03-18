"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SessionItem } from "./SessionItem";
import type { Session } from "@/lib/types";

interface SessionListProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
}

export function SessionList({
  sessions,
  currentSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
}: SessionListProps) {
  // 分组会话
  const { directSessions, groupSessions } = useMemo(() => {
    const direct = sessions.filter((s) => s.type === "direct");
    const group = sessions.filter((s) => s.type === "group");
    return { directSessions: direct, groupSessions: group };
  }, [sessions]);

  return (
    <ScrollArea className="flex-1 h-0">
      <div className="space-y-4 p-2">
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
            {directSessions.length === 0 && (
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
                  onRename={(title) => onRenameSession(session.id, title)}
                  onDelete={() => onDeleteSession(session.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

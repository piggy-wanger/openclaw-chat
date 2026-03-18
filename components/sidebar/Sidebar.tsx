"use client";

import { Plus, Settings, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SessionList } from "./SessionList";
import type { Session } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onCreateSession: () => void;
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onCreateSession,
}: SidebarProps) {
  return (
    <aside className="w-[280px] h-full flex flex-col bg-zinc-900 border-r border-zinc-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-zinc-800">
        <MessageSquare className="h-6 w-6 text-blue-500" />
        <h1 className="text-lg font-semibold text-white">OpenClaw Chat</h1>
      </div>

      {/* New Session Button */}
      <div className="px-3 py-3">
        <Button
          onClick={onCreateSession}
          className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      {/* Session List */}
      <SessionList
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={onSelectSession}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
      />

      {/* Footer - Settings Button */}
      <div className="border-t border-zinc-800 p-3">
        <Link href="/settings" aria-label="设置">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <Settings className="h-4 w-4" />
            设置
          </Button>
        </Link>
      </div>
    </aside>
  );
}

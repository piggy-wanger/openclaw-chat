"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Plus, Settings, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SessionList } from "./SessionList";
import type { Session } from "@/lib/types";

export type SidebarRef = {
  focusSearch: () => void;
};

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  loading?: boolean;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onCreateSession: () => void;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(
  function Sidebar(
    {
      sessions,
      currentSessionId,
      loading,
      onSelectSession,
      onRenameSession,
      onDeleteSession,
      onCreateSession,
    },
    ref
  ) {
    const searchInputRef = useRef<HTMLInputElement>(null);

    const focusSearch = useCallback(() => {
      searchInputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({
      focusSearch,
    }));

    // Placeholder for group creation
    const handleCreateGroup = useCallback(() => {
      toast.info("群组创建功能即将推出", {
        description: "敬请期待！",
      });
    }, []);

    return (
      <aside className="w-[280px] h-full flex flex-col bg-card border-r border-border">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">OpenClaw Chat</h1>
        </div>

        {/* New Session Button */}
        <div className="px-3 py-3 space-y-2">
          <Button
            onClick={onCreateSession}
            className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建会话
          </Button>
          <Button
            variant="outline"
            onClick={handleCreateGroup}
            className="w-full justify-start gap-2 bg-muted/50 text-foreground hover:bg-muted border-border"
          >
            <Users className="h-4 w-4" />
            新建群组
          </Button>
        </div>

        {/* Session List */}
        <SessionList
          ref={searchInputRef}
          sessions={sessions}
          currentSessionId={currentSessionId}
          loading={loading}
          onSelectSession={onSelectSession}
          onRenameSession={onRenameSession}
          onDeleteSession={onDeleteSession}
        />

        {/* Footer - Settings Button */}
        <div className="border-t border-border p-3">
          <Link href="/settings" aria-label="设置">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              设置
            </Button>
          </Link>
        </div>
      </aside>
    );
  }
);

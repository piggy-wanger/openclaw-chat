"use client";

import { useRef, useCallback, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { Plus, Settings, MessageSquare, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SessionList } from "./SessionList";
import { NewSessionDialog } from "@/components/dialogs/NewSessionDialog";
import { CreateGroupDialog } from "@/components/dialogs/CreateGroupDialog";
import type { Session } from "@/lib/types";
import type { GatewayClient } from "@/lib/gateway-client";

const SIDEBAR_STORAGE_KEY = "openclaw.sidebar.width";
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;

export type SidebarRef = {
  focusSearch: () => void;
};

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  loading?: boolean;
  client: GatewayClient | null;
  isConnected: boolean;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onCreateSessionWithOptions: (options: {
    sessionId: string;
    sessionName: string;
    agentId: string;
    model: string;
  }) => void;
  onCreateGroup: (options: {
    groupName: string;
    agentIds: string[];
    model?: string;
  }) => void;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(
  function Sidebar(
    {
      sessions,
      currentSessionId,
      loading,
      client,
      isConnected,
      onSelectSession,
      onRenameSession,
      onDeleteSession,
      onCreateSessionWithOptions,
      onCreateGroup,
    },
    ref
  ) {
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
    const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);

    const [width, setWidth] = useState(DEFAULT_WIDTH);
    const isDragging = useRef(false);

    useEffect(() => {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (n >= MIN_WIDTH && n <= MAX_WIDTH) setWidth(n);
      }
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + ev.clientX - startX));
        setWidth(newWidth);
      };
      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidth((w) => {
          localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w));
          return w;
        });
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }, [width]);

    const focusSearch = useCallback(() => {
      searchInputRef.current?.focus();
    }, []);

    useImperativeHandle(ref, () => ({
      focusSearch,
    }));

    // Handle new session creation from dialog
    const handleCreateSessionWithOptions = useCallback(
      (options: { sessionId: string; sessionName: string; agentId: string; model: string }) => {
        onCreateSessionWithOptions(options);
        setShowNewSessionDialog(false);
      },
      [onCreateSessionWithOptions]
    );

    // Handle group creation from dialog
    const handleCreateGroup = useCallback(
      (options: { groupName: string; agentIds: string[]; model?: string }) => {
        onCreateGroup(options);
        setShowCreateGroupDialog(false);
      },
      [onCreateGroup]
    );

    return (
      <aside className="h-full flex flex-col bg-card border-r border-border relative shrink-0" style={{ width }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">OpenClaw Chat</h1>
        </div>

        {/* New Session Button */}
        <div className="px-3 py-3 space-y-2">
          <Button
            onClick={() => setShowNewSessionDialog(true)}
            className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建会话
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowCreateGroupDialog(true)}
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

        {/* New Session Dialog */}
        <NewSessionDialog
          open={showNewSessionDialog}
          onOpenChange={setShowNewSessionDialog}
          client={client}
          isConnected={isConnected}
          onCreateSession={handleCreateSessionWithOptions}
        />

        {/* Create Group Dialog */}
        <CreateGroupDialog
          open={showCreateGroupDialog}
          onOpenChange={setShowCreateGroupDialog}
          onCreateGroup={handleCreateGroup}
        />

        {/* Resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        />
      </aside>
    );
  }
);

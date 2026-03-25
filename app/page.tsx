"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGateway } from "@/hooks/useGateway";
import { SessionProvider, useSession } from "@/hooks/useSession";
import { ChatProvider, useChat } from "@/hooks/useChat";
import { GroupChatProvider, useGroupChat } from "@/hooks/useGroupChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Sidebar, type SidebarRef } from "@/components/sidebar/Sidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { GroupMessageList } from "@/components/chat/GroupMessageList";
import { InputArea } from "@/components/chat/InputArea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  MessageCircle,
  RefreshCw,
  AlertCircle,
  WifiOff,
  Loader2,
  Settings,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Session } from "@/lib/types";

function MessageListSkeleton() {
  return (
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`h-16 rounded-2xl animate-pulse ${
              i % 2 === 0 ? "bg-muted w-[60%]" : "bg-blue-900/30 w-[40%]"
            }`}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

function NotConnectedState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <WifiOff className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-medium mb-2 text-muted-foreground">未连接到 Gateway</h2>
        <p className="text-muted-foreground mb-4">请先配置 Gateway 连接</p>
        <Link href="/settings">
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            前往设置
          </Button>
        </Link>
      </div>
    </div>
  );
}

function NoSessionState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-medium mb-2 text-muted-foreground">欢迎使用 OpenClaw Chat</h2>
        <p className="text-muted-foreground mb-4">点击左侧 &quot;新建会话&quot; 按钮开始对话</p>
        <p className="text-xs text-muted-foreground">快捷键: Ctrl+N 新建会话</p>
      </div>
    </div>
  );
}

function NoMessagesState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <div className="text-center">
        <Send className="h-16 w-16 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-medium mb-2 text-muted-foreground">开始新对话</h2>
        <p className="text-muted-foreground mb-4">在下方输入您的问题，开始与 AI 对话</p>
        <p className="text-xs text-muted-foreground">发送第一条消息开始</p>
      </div>
    </div>
  );
}

function ConnectionStatus() {
  const { status, error } = useGateway();

  if (status === "connected") {
    return null;
  }

  return (
    <div
      className={`flex items-center justify-center gap-2 p-2 text-sm ${
        status === "connecting"
          ? "bg-blue-900/20 border-b border-blue-800/50 text-blue-300"
          : status === "error"
            ? "bg-red-900/20 border-b border-red-800/50 text-red-300"
            : "bg-yellow-900/20 border-b border-yellow-800/50 text-yellow-300"
      }`}
    >
      {status === "connecting" && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在连接 Gateway...</span>
        </>
      )}
      {status === "disconnected" && (
        <>
          <WifiOff className="h-4 w-4" />
          <span>
            Gateway 连接已断开，请前往{" "}
            <Link href="/settings" className="underline hover:text-foreground">
              设置
            </Link>
            {" "}检查配置
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>
            连接错误: {error}，请前往{" "}
            <Link href="/settings" className="underline hover:text-foreground">
              设置
            </Link>
            {" "}检查配置
          </span>
        </>
      )}
    </div>
  );
}

function ChatArea({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { client, isConnected } = useGateway();
  const {
    sessions,
    currentSessionId,
    currentSession,
    loading: sessionLoading,
    createSession,
    createSessionWithOptions,
    createGroupSession,
    updateSession,
    deleteSession,
    selectSession,
  } = useSession();

  const {
    messages,
    isStreaming,
    streamContent,
    loading: messageLoading,
    isSessionSwitching,
    isInitialLoad,
    error,
    sendMessage,
    abortStream,
    fetchMessages,
    toolCalls,
    syncFromGateway,
  } = useChat();

  const sidebarRef = useRef<SidebarRef>(null);
  const prevErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast.error(error);
    }
    prevErrorRef.current = error;
  }, [error]);

  useKeyboardShortcuts({
    onFocusSearch: useCallback(() => {
      sidebarRef.current?.focusSearch();
    }, []),
    onNewSession: useCallback(async () => {
      await createSession();
      if (isMobile) {
        setSidebarOpen(false);
      }
    }, [createSession, isMobile, setSidebarOpen]),
    onCloseModal: useCallback(() => {
      if (isMobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    }, [isMobile, sidebarOpen, setSidebarOpen]),
  });

  const handleSelectSession = (id: string) => {
    selectSession(id);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleRenameSession = async (id: string, title: string) => {
    await updateSession(id, { title });
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
  };

  const handleCreateSessionWithOptions = async (options: {
    sessionId: string;
    sessionName: string;
    agentId: string;
    model: string;
  }) => {
    await createSessionWithOptions(options);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleCreateGroup = async (options: {
    groupName: string;
    agentIds: string[];
    model?: string;
  }) => {
    const groupSession = await createGroupSession(options);

    if (!groupSession) {
      toast.error("创建群组失败");
      return;
    }

    if (isMobile) {
      setSidebarOpen(false);
    }

    toast.success(`群组 "${options.groupName}" 创建成功`, {
      description: `包含 ${options.agentIds.length} 个智能体`,
    });
  };

  const handleModelChange = async (model: string | null) => {
    if (currentSessionId && model) {
      await updateSession(currentSessionId, { model });
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };

  const handleAbortStream = () => {
    abortStream();
  };

  const handleRetry = () => {
    fetchMessages();
  };

  const sidebarContent = (
    <Sidebar
      ref={sidebarRef}
      sessions={sessions}
      currentSessionId={currentSessionId}
      loading={sessionLoading}
      client={client}
      isConnected={isConnected}
      onSelectSession={handleSelectSession}
      onRenameSession={handleRenameSession}
      onDeleteSession={handleDeleteSession}
      onCreateSessionWithOptions={handleCreateSessionWithOptions}
      onCreateGroup={handleCreateGroup}
    />
  );

  return (
    <>
      {!isMobile && sidebarContent}

      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[280px] bg-card border-r border-border"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>会话列表</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatHeader
          currentSession={currentSession}
          onModelChange={handleModelChange}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={sidebarOpen}
          isMobile={isMobile}
          onSync={syncFromGateway}
        />

        <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
          {currentSession ? (
            <>
              {error && (
                <div className="flex items-center justify-center gap-3 p-4 bg-red-900/20 border-b border-red-800/50">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <span className="text-red-300 text-sm">{error}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="ml-2"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    重试
                  </Button>
                </div>
              )}

              {messages.length === 0 && !isStreaming && !messageLoading && !isSessionSwitching ? (
                <NoMessagesState />
              ) : (
                <div className="flex-1 overflow-hidden">
                  <MessageList
                    messages={messages}
                    isStreaming={isStreaming}
                    streamContent={streamContent}
                    loading={messageLoading}
                    isInitialLoad={isInitialLoad}
                    toolCalls={toolCalls}
                  />
                </div>
              )}

              {(isSessionSwitching || (messageLoading && isInitialLoad)) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {isSessionSwitching ? "切换会话..." : "加载消息..."}
                    </span>
                  </div>
                </div>
              )}

              <InputArea
                onSend={handleSendMessage}
                isStreaming={isStreaming}
                onAbort={handleAbortStream}
                disabled={messageLoading}
              />
            </>
          ) : sessionLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">加载会话...</span>
              </div>
            </div>
          ) : (
            <NoSessionState />
          )}
        </div>
      </div>
    </>
  );
}

function resolveGroupIdFromSession(session: Session | null): string | null {
  if (!session) return null;
  return session.groupId ?? null;
}

function GroupChatArea({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { client, isConnected } = useGateway();
  const {
    sessions,
    currentSessionId,
    currentSession,
    loading: sessionLoading,
    fetchSessions,
    createSession,
    createSessionWithOptions,
    createGroupSession,
    updateSession,
    deleteSession,
    selectSession,
  } = useSession();
  const {
    group,
    messages,
    loading: messageLoading,
    isSessionSwitching,
    sendMessage,
    abortStream,
    members,
    membersOnline,
    streamingMap,
    hasMoreMessages,
    isLoadingMore,
    fetchMessages,
    fetchGroupData,
  } = useGroupChat();

  const sidebarRef = useRef<SidebarRef>(null);

  useKeyboardShortcuts({
    onFocusSearch: useCallback(() => {
      sidebarRef.current?.focusSearch();
    }, []),
    onNewSession: useCallback(async () => {
      await createSession();
      if (isMobile) {
        setSidebarOpen(false);
      }
    }, [createSession, isMobile, setSidebarOpen]),
    onCloseModal: useCallback(() => {
      if (isMobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    }, [isMobile, sidebarOpen, setSidebarOpen]),
  });

  const handleSelectSession = (id: string) => {
    selectSession(id);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleRenameSession = async (id: string, title: string) => {
    await updateSession(id, { title });
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSession(id);
  };

  const handleCreateSessionWithOptions = async (options: {
    sessionId: string;
    sessionName: string;
    agentId: string;
    model: string;
  }) => {
    await createSessionWithOptions(options);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleCreateGroup = async (options: {
    groupName: string;
    agentIds: string[];
    model?: string;
  }) => {
    const groupSession = await createGroupSession(options);
    if (!groupSession) {
      toast.error("创建群组失败");
      return;
    }

    if (isMobile) {
      setSidebarOpen(false);
    }

    toast.success(`群组 "${options.groupName}" 创建成功`, {
      description: `包含 ${options.agentIds.length} 个智能体`,
    });
  };

  const handleModelChange = async (model: string | null) => {
    if (currentSessionId && model) {
      await updateSession(currentSessionId, { model });
    }
  };

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleGroupUpdated = useCallback(() => {
    void fetchGroupData();
    void fetchSessions();
  }, [fetchGroupData, fetchSessions]);

  const groupAgents = useMemo(
    () =>
      members.map((member) => ({
        id: member.agentId,
        name: member.name,
        emoji: member.emoji ?? undefined,
      })),
    [members]
  );

  const isStreaming = useMemo(
    () => Array.from(streamingMap.values()).some((stream) => stream.isStreaming),
    [streamingMap]
  );

  const sidebarContent = (
    <Sidebar
      ref={sidebarRef}
      sessions={sessions}
      currentSessionId={currentSessionId}
      loading={sessionLoading}
      client={client}
      isConnected={isConnected}
      onSelectSession={handleSelectSession}
      onRenameSession={handleRenameSession}
      onDeleteSession={handleDeleteSession}
      onCreateSessionWithOptions={handleCreateSessionWithOptions}
      onCreateGroup={handleCreateGroup}
    />
  );

  return (
    <>
      {!isMobile && sidebarContent}

      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[280px] bg-card border-r border-border"
            showCloseButton={false}
          >
            <SheetHeader className="sr-only">
              <SheetTitle>会话列表</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatHeader
          currentSession={currentSession}
          onModelChange={handleModelChange}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={sidebarOpen}
          isMobile={isMobile}
          isGroup
          groupName={group?.name || currentSession?.title}
          groupMembers={members}
          onGroupUpdated={handleGroupUpdated}
          onGroupDeleted={() => selectSession(null)}
        />

        <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
          {currentSession ? (
            <>
              {messageLoading && messages.length === 0 ? (
                <MessageListSkeleton />
              ) : messages.length === 0 && !isStreaming ? (
                <NoMessagesState />
              ) : (
                <div className="flex-1 overflow-hidden">
                  <GroupMessageList
                    messages={messages}
                    members={members}
                    membersOnline={membersOnline}
                    streamingMap={streamingMap}
                    loading={messageLoading && messages.length === 0}
                    hasMoreMessages={hasMoreMessages}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={() => {
                      void fetchMessages({ loadMore: true });
                    }}
                  />
                </div>
              )}

              <InputArea
                onSend={(content) => {
                  void sendMessage(content);
                }}
                onSendWithMentions={(content, mentionedAgentIds) => {
                  void sendMessage(content, mentionedAgentIds);
                }}
                isStreaming={isStreaming}
                onAbort={() => {
                  void abortStream();
                }}
                disabled={messageLoading}
                isGroup
                groupAgents={groupAgents}
              />

              {isSessionSwitching && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">切换会话...</span>
                  </div>
                </div>
              )}
            </>
          ) : sessionLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">加载会话...</span>
              </div>
            </div>
          ) : (
            <NoSessionState />
          )}
        </div>
      </div>
    </>
  );
}

function SessionAndChat({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { currentSessionId, currentSession, updateTempSessionId } = useSession();

  if (currentSession?.type === "group") {
    const groupId = resolveGroupIdFromSession(currentSession);
    return (
      <GroupChatProvider groupId={groupId}>
        <GroupChatArea
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
      </GroupChatProvider>
    );
  }

  return (
    <ChatProvider
      sessionId={currentSessionId}
      onSessionKeyUpdate={updateTempSessionId}
    >
      <ChatArea
        isMobile={isMobile}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
    </ChatProvider>
  );
}

function MainContent() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasEverConnected = useRef(false);
  const { status } = useGateway();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (status !== "connected") {
    if (!hasEverConnected.current) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-sm font-medium text-foreground">OpenClaw Chat</h2>
              <p className="text-xs text-muted-foreground">正在连接 Gateway...</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-screen bg-background">
        <ConnectionStatus />
        <div className="flex flex-1 overflow-hidden">
          <NotConnectedState />
        </div>
      </div>
    );
  }
  hasEverConnected.current = true;

  return (
    <div className="flex h-screen bg-background">
      <ConnectionStatus />

      <div className="flex flex-1 overflow-hidden">
        <SessionProvider>
          <SessionAndChat
            isMobile={isMobile}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        </SessionProvider>
      </div>
    </div>
  );
}

export default function Home() {
  return <MainContent />;
}

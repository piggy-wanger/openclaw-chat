"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useGateway } from "@/hooks/useGateway";
import { SessionProvider, useSession } from "@/hooks/useSession";
import { ChatProvider, useChat } from "@/hooks/useChat";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Sidebar, type SidebarRef } from "@/components/sidebar/Sidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  RefreshCw,
  AlertCircle,
  WifiOff,
  Loader2,
  Settings,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

// 消息列表骨架屏
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

// 空状态组件
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

// 连接状态指示器
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

// 主聊天区域（需要在 ChatProvider 内部）
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
  } = useChat();

  const sidebarRef = useRef<SidebarRef>(null);
  const prevErrorRef = useRef<string | null>(null);

  // Error toast when error changes
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      toast.error(error);
    }
    prevErrorRef.current = error;
  }, [error]);

  // Keyboard shortcuts
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
      // Close sidebar on mobile when pressing Escape
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

  // Handle creating session with custom options (from dialog)
  const handleCreateSessionWithOptions = async (options: {
    sessionName: string;
    agentId: string;
    model: string;
  }) => {
    await createSessionWithOptions(options);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Handle creating group (basic implementation for now)
  const handleCreateGroup = async (options: {
    groupName: string;
    agentIds: string[];
    model?: string;
  }) => {
    // Create group session using the hook
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

  // Sidebar 内容
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
      {/* 桌面端 Sidebar */}
      {!isMobile && sidebarContent}

      {/* 移动端 Sidebar (Sheet) */}
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

      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <ChatHeader
          currentSession={currentSession}
          onModelChange={handleModelChange}
          onToggleSidebar={handleToggleSidebar}
          isSidebarOpen={sidebarOpen}
          isMobile={isMobile}
        />

        {/* Message List Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
          {currentSession ? (
            <>
              {/* 错误状态 */}
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

              {/* 消息列表 */}
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

              {/* 加载遮罩 - 初始加载 + 会话切换时覆盖在消息区上方 */}
              {(isSessionSwitching || (messageLoading && isInitialLoad)) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {isSessionSwitching ? "加载中..." : "连接中..."}
                    </span>
                  </div>
                </div>
              )}

              {/* 输入区域 */}
              <InputArea
                onSend={handleSendMessage}
                isStreaming={isStreaming}
                onAbort={handleAbortStream}
                disabled={messageLoading}
              />
            </>
          ) : sessionLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">加载会话...</span>
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

// 会话和聊天组合组件（需要在 SessionProvider 内部，包裹 ChatProvider）
function SessionAndChat({
  isMobile,
  sidebarOpen,
  setSidebarOpen,
}: {
  isMobile: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { currentSessionId, updateTempSessionId } = useSession();

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

// 主页面内容（需要在 GatewayProvider 内部）
function MainContent() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasEverConnected = useRef(false);
  const { status } = useGateway();

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 未连接时显示加载页（首次）或断连状态
  if (status !== "connected") {
    if (!hasEverConnected.current) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">连接中...</span>
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
      {/* 连接状态 */}
      <ConnectionStatus />

      {/* 主体内容区域 */}
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

// 根组件
// GatewayProvider 已在 layout.tsx 的 Providers 中提供
export default function Home() {
  return <MainContent />;
}

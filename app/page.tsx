"use client";

import { useState, useEffect } from "react";
import { GatewayProvider, useGateway } from "@/hooks/useGateway";
import { SessionProvider, useSession } from "@/hooks/useSession";
import { ChatProvider, useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/sidebar/Sidebar";
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
} from "lucide-react";

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
          <span>已断开连接</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4" />
          <span>连接错误: {error}</span>
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
  const {
    sessions,
    currentSessionId,
    currentSession,
    createSession,
    updateSession,
    deleteSession,
    selectSession,
  } = useSession();

  const {
    messages,
    isStreaming,
    streamContent,
    loading,
    error,
    sendMessage,
    abortStream,
    fetchMessages,
  } = useChat();

  const handleCreateSession = async () => {
    await createSession();
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

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
      sessions={sessions}
      currentSessionId={currentSessionId}
      onSelectSession={handleSelectSession}
      onRenameSession={handleRenameSession}
      onDeleteSession={handleDeleteSession}
      onCreateSession={handleCreateSession}
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
            className="p-0 w-[280px] bg-zinc-900 border-r border-zinc-800"
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
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
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
              <MessageList
                messages={messages}
                isStreaming={isStreaming}
                streamContent={streamContent}
                loading={loading}
              />

              {/* 输入区域 */}
              <InputArea
                onSend={handleSendMessage}
                isStreaming={isStreaming}
                onAbort={handleAbortStream}
                disabled={loading}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h2 className="text-xl font-medium mb-2">
                  欢迎使用 OpenClaw Chat
                </h2>
                <p className="text-zinc-400">
                  点击左侧 &quot;新建会话&quot; 按钮开始对话
                </p>
              </div>
            </div>
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
  const { currentSessionId } = useSession();

  return (
    <ChatProvider sessionId={currentSessionId}>
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

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950">
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
export default function Home() {
  return (
    <GatewayProvider>
      <MainContent />
    </GatewayProvider>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/hooks/useSession";
import { useChat } from "@/hooks/useChat";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { InputArea } from "@/components/chat/InputArea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare, RefreshCw, AlertCircle } from "lucide-react";

export default function Home() {
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
  } = useChat(currentSessionId);

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
    <div className="flex h-screen bg-zinc-950">
      {/* 桌面端 Sidebar */}
      {!isMobile && sidebarContent}

      {/* 移动端 Sidebar (Sheet) */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[280px] bg-zinc-900 border-r border-zinc-800" showCloseButton={false}>
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
                <h2 className="text-xl font-medium mb-2">欢迎使用 OpenClaw Chat</h2>
                <p className="text-zinc-400">
                  点击左侧 &quot;新建会话&quot; 按钮开始对话
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

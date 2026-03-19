"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Trash2,
  Download,
  Info,
  Search,
  X,
  RotateCcw,
  MessageSquare,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const APP_VERSION = "0.2.0";
const PAGE_SIZE = 10;

type SessionSettingsProps = {
  sessions: Array<{
    id: string;
    title: string;
    type?: string;
    model: string;
    createdAt: string | number;
    updatedAt: string | number;
  }>;
  fetchSessions: () => Promise<void>;
};

// 格式化日期
function formatDate(date: string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 格式化模型名称（简化显示）
function formatModel(model: string): string {
  if (!model || model === "unknown") return "未知模型";
  // 如果是 provider/model 格式，保持原样
  if (model.includes("/")) return model;
  // 否则只显示模型名
  return model;
}

export function SessionSettings({
  sessions,
  fetchSessions,
}: SessionSettingsProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 过滤会话
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.model.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }, [sessions, searchQuery]);

  // 分页
  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, currentPage]);

  // 当搜索改变时重置页码
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // 重置单个会话
  const handleResetSession = useCallback(
    async (sessionId: string) => {
      if (sessionId.startsWith("temp-")) {
        toast.error("临时会话无法重置");
        return;
      }

      setActionLoading(sessionId);
      try {
        const { gateway } = await import("@/lib/gateway");
        await gateway.sessionsReset(sessionId);
        await fetchSessions();
        toast.success("会话已重置");
      } catch (err) {
        console.error("Failed to reset session:", err);
        toast.error("重置会话失败");
      } finally {
        setActionLoading(null);
      }
    },
    [fetchSessions]
  );

  // 删除单个会话
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (sessionId.startsWith("temp-")) {
        toast.error("临时会话无法删除");
        setShowDeleteConfirm(false);
        setDeletingSession(null);
        return;
      }

      setActionLoading(sessionId);
      try {
        const { gateway } = await import("@/lib/gateway");
        // Gateway 使用 sessionsReset 来清除会话
        await gateway.sessionsReset(sessionId);
        await fetchSessions();
        toast.success("会话已删除");
      } catch (err) {
        console.error("Failed to delete session:", err);
        toast.error("删除会话失败");
      } finally {
        setActionLoading(null);
        setShowDeleteConfirm(false);
        setDeletingSession(null);
      }
    },
    [fetchSessions]
  );

  // 打开删除确认框
  const openDeleteConfirm = (sessionId: string) => {
    setDeletingSession(sessionId);
    setShowDeleteConfirm(true);
  };

  // 清除所有会话
  const handleClearAllSessions = useCallback(async () => {
    setShowClearConfirm(false);
    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
      // 跳过临时会话
      if (session.id.startsWith("temp-")) {
        continue;
      }
      try {
        const { gateway } = await import("@/lib/gateway");
        await gateway.sessionsReset(session.id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    await fetchSessions();

    if (failCount === 0) {
      toast.success(`已清除 ${successCount} 个会话`);
    } else {
      toast.warning(`已清除 ${successCount} 个会话，${failCount} 个失败`);
    }
  }, [sessions, fetchSessions]);

  // 导出会话
  const handleExportSessions = useCallback(() => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        model: s.model,
        createdAt: new Date(s.createdAt).toISOString(),
        updatedAt: new Date(s.updatedAt).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-chat-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("会话已导出");
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">会话管理</h2>
        <p className="text-sm text-muted-foreground">管理您的聊天会话</p>
      </div>

      {/* 会话数量 */}
      <div className="flex items-center gap-2 text-muted-foreground p-4 bg-muted/50 rounded-lg border border-border">
        <Info className="h-4 w-4" />
        <span className="text-sm">当前会话数量: {sessions.length}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setShowClearConfirm(true)}
          disabled={sessions.length === 0}
          variant="outline"
          className="border-border text-foreground hover:bg-muted hover:text-red-400"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          清除所有会话
        </Button>

        <Button
          onClick={handleExportSessions}
          disabled={sessions.length === 0}
          variant="outline"
          className="border-border text-foreground hover:bg-muted"
        >
          <Download className="h-4 w-4 mr-2" />
          导出会话
        </Button>
      </div>

      {/* 会话列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">会话列表</h3>
          {searchQuery && (
            <span className="text-xs text-muted-foreground">
              找到 {filteredSessions.length} 个会话
            </span>
          )}
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索会话标题、模型或 ID..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 bg-muted border-border text-sm placeholder:text-muted-foreground focus-visible:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* 会话列表 */}
        <ScrollArea className="h-[400px] rounded-md border border-border bg-muted/30">
          {paginatedSessions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {searchQuery ? "未找到匹配的会话" : "暂无会话"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginatedSessions.map((session) => {
                const isLoading = actionLoading === session.id;
                const isGroup = session.type === "group";
                return (
                  <div
                    key={session.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 transition-colors",
                      isLoading && "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* 类型图标 */}
                      <div className="flex-shrink-0 mt-0.5">
                        {isGroup ? (
                          <Users className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      {/* 会话信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {session.title}
                          </span>
                          {isGroup && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary">
                              群组
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono truncate max-w-[150px]" title={session.id}>
                            {session.id.length > 25 ? `${session.id.slice(0, 25)}...` : session.id}
                          </span>
                          <span>·</span>
                          <span>{formatModel(session.model)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          创建于 {formatDate(session.createdAt)}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleResetSession(session.id)}
                          disabled={isLoading || session.id.startsWith("temp-")}
                          className="text-muted-foreground hover:text-foreground"
                          title="重置会话"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openDeleteConfirm(session.id)}
                          disabled={isLoading || session.id.startsWith("temp-")}
                          className="text-muted-foreground hover:text-destructive"
                          title="删除会话"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* 分页控制 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              第 {currentPage} / {totalPages} 页，共 {filteredSessions.length} 个会话
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 清除会话确认对话框 */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认清除所有会话</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              此操作将删除所有 {sessions.length} 个会话及其聊天记录。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
              className="border-border text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAllSessions}
              className="bg-red-600 hover:bg-red-700"
            >
              确认清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除单个会话确认对话框 */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setDeletingSession(null);
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认删除会话</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              确定要删除此会话吗？此操作将清除该会话的所有消息记录，且无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteConfirm(false);
                setDeletingSession(null);
              }}
              className="border-border text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingSession && handleDeleteSession(deletingSession)}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

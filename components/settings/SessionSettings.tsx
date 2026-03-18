"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Download, Info } from "lucide-react";

const APP_VERSION = "0.2.0";

type SessionSettingsProps = {
  sessions: Array<{
    id: string;
    title: string;
    model: string;
    createdAt: string | number;
    updatedAt: string | number;
  }>;
  fetchSessions: () => Promise<void>;
};

export function SessionSettings({
  sessions,
  fetchSessions,
}: SessionSettingsProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
        <h2 className="text-lg font-semibold text-white mb-1">会话管理</h2>
        <p className="text-sm text-zinc-500">管理您的聊天会话</p>
      </div>

      {/* 会话数量 */}
      <div className="flex items-center gap-2 text-zinc-400 p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
        <Info className="h-4 w-4" />
        <span className="text-sm">当前会话数量: {sessions.length}</span>
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setShowClearConfirm(true)}
          disabled={sessions.length === 0}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          清除所有会话
        </Button>

        <Button
          onClick={handleExportSessions}
          disabled={sessions.length === 0}
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <Download className="h-4 w-4 mr-2" />
          导出会话
        </Button>
      </div>

      {/* 清除会话确认对话框 */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">确认清除所有会话</DialogTitle>
            <DialogDescription className="text-zinc-400">
              此操作将删除所有 {sessions.length} 个会话及其聊天记录。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
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
    </div>
  );
}

"use client";

import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Github,
} from "lucide-react";
import type { GatewayStatus } from "@/hooks/useGateway";

const APP_VERSION = "0.2.0";

// 连接状态指示器组件
function ConnectionStatusIndicator({ status }: { status: GatewayStatus }) {
  if (status === "connected") {
    return (
      <div className="flex items-center gap-2 text-green-500">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm">已连接</span>
      </div>
    );
  }
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-2 text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">连接中...</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-red-500">
        <XCircle className="h-4 w-4" />
        <span className="text-sm">连接失败</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-zinc-500">
      <Circle className="h-4 w-4" />
      <span className="text-sm">未连接</span>
    </div>
  );
}

type AboutSettingsProps = {
  status: GatewayStatus;
};

export function AboutSettings({ status }: AboutSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">关于</h2>
        <p className="text-sm text-zinc-500">OpenClaw Chat 应用信息</p>
      </div>

      <div className="space-y-4">
        {/* 版本 */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <span className="text-sm text-zinc-400">版本</span>
          <span className="text-sm text-zinc-300">{APP_VERSION}</span>
        </div>

        {/* Gateway 状态 */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <span className="text-sm text-zinc-400">Gateway 状态</span>
          <ConnectionStatusIndicator status={status} />
        </div>

        {/* GitHub */}
        <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
          <span className="text-sm text-zinc-400">GitHub</span>
          <a
            href="https://github.com/piggy-wanger/openclaw-chat"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Github className="h-4 w-4" />
            <span className="text-sm">openclaw-chat</span>
          </a>
        </div>
      </div>
    </div>
  );
}

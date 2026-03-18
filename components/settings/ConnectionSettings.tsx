"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import type { GatewayStatus } from "@/hooks/useGateway";

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

type ConnectionSettingsProps = {
  gatewayUrl: string;
  gatewayToken: string;
  status: GatewayStatus;
  setSettings: (settings: { gatewayUrl?: string; gatewayToken?: string }) => void;
  connect: (url: string, token: string) => Promise<void>;
};

export function ConnectionSettings({
  gatewayUrl,
  gatewayToken,
  status,
  setSettings,
  connect,
}: ConnectionSettingsProps) {
  const [url, setUrl] = useState(gatewayUrl);
  const [token, setToken] = useState(gatewayToken);
  const [testing, setTesting] = useState(false);

  // 保存 Gateway URL
  const handleUrlBlur = useCallback(() => {
    if (url !== gatewayUrl) {
      setSettings({ gatewayUrl: url });
      toast.success("Gateway URL 已保存");
    }
  }, [url, gatewayUrl, setSettings]);

  // 保存 Token
  const handleTokenBlur = useCallback(() => {
    if (token !== gatewayToken) {
      setSettings({ gatewayToken: token });
      toast.success("Token 已保存");
    }
  }, [token, gatewayToken, setSettings]);

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    // 先保存设置
    setSettings({
      gatewayUrl: url,
      gatewayToken: token,
    });

    setTesting(true);
    try {
      await connect(url, token);
      toast.success("连接成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      toast.error(`连接失败: ${message}`);
    } finally {
      setTesting(false);
    }
  }, [url, token, setSettings, connect]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">连接设置</h2>
        <p className="text-sm text-zinc-500">配置 OpenClaw Gateway 连接</p>
      </div>

      {/* 连接状态 */}
      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg border border-zinc-800">
        <span className="text-sm text-zinc-400">连接状态</span>
        <ConnectionStatusIndicator status={status} />
      </div>

      {/* Gateway URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Gateway URL</label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="ws://127.0.0.1:18789"
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          OpenClaw Gateway 的 WebSocket 地址
        </p>
      </div>

      {/* Token */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">Token</label>
        <Input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onBlur={handleTokenBlur}
          placeholder="可选的认证 Token"
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          如果 Gateway 配置了认证，请输入 Token
        </p>
      </div>

      {/* 测试连接按钮 */}
      <Button
        onClick={handleTestConnection}
        disabled={testing}
        variant="outline"
        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
      >
        {testing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            连接中...
          </>
        ) : (
          "测试连接"
        )}
      </Button>
    </div>
  );
}

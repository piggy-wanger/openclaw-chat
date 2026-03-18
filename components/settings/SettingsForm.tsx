"use client";

import { useState, useCallback } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useGateway, type GatewayStatus } from "@/hooks/useGateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

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

type SettingsFormInnerProps = {
  initialGatewayUrl: string;
  initialGatewayToken: string;
  initialDefaultModel: string | null;
  initialApiUrl: string;
  initialApiKey: string;
  setSettings: (settings: Partial<{
    gatewayUrl: string;
    gatewayToken: string;
    default_model: string;
    api_url: string;
    api_key: string;
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
  }>) => void;
  updateSettings: (settings: Record<string, string>) => Promise<boolean>;
};

// 内部表单组件：使用 props 作为 useState 初始值，避免 useEffect 初始化
function SettingsFormInner({
  initialGatewayUrl,
  initialGatewayToken,
  initialDefaultModel,
  initialApiUrl,
  initialApiKey,
  setSettings,
  updateSettings,
}: SettingsFormInnerProps) {
  const [gatewayUrl, setGatewayUrl] = useState(() => initialGatewayUrl);
  const [gatewayToken, setGatewayToken] = useState(() => initialGatewayToken);
  const [defaultModel, setDefaultModel] = useState<string | null>(() => initialDefaultModel);
  const [apiUrl, setApiUrl] = useState(() => initialApiUrl);
  const [apiKey, setApiKey] = useState(() => initialApiKey);
  const [saving, setSaving] = useState(false);

  const { status, connect } = useGateway();

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    // 更新 Gateway 设置
    setSettings({
      gatewayUrl,
      gatewayToken,
    });

    // 立即尝试连接
    try {
      await connect();
      toast.success("连接成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      toast.error(`连接失败: ${message}`);
    }
  }, [gatewayUrl, gatewayToken, setSettings, connect]);

  // 保存设置
  const handleSave = useCallback(async () => {
    setSaving(true);
    // 先更新 Gateway 设置
    setSettings({
      gatewayUrl,
      gatewayToken,
    });
    // 再更新其他设置（通过 legacy API）
    const success = await updateSettings({
      default_model: defaultModel || "",
      api_url: apiUrl,
      api_key: apiKey,
    });
    setSaving(false);

    if (success) {
      toast.success("设置已保存");
    } else {
      toast.error("保存失败，请重试");
    }
  }, [gatewayUrl, gatewayToken, defaultModel, apiUrl, apiKey, setSettings, updateSettings]);

  return (
    <div className="space-y-8">
      {/* Gateway 连接区域 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Gateway 连接</h2>
          <ConnectionStatusIndicator status={status} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Gateway URL</label>
          <Input
            value={gatewayUrl}
            onChange={(e) => setGatewayUrl(e.target.value)}
            placeholder="ws://127.0.0.1:18789"
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            OpenClaw Gateway 的 WebSocket 地址
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Token</label>
          <Input
            type="password"
            value={gatewayToken}
            onChange={(e) => setGatewayToken(e.target.value)}
            placeholder="可选的认证 Token"
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            如果 Gateway 配置了认证，请输入 Token
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleTestConnection}
            disabled={status === "connecting"}
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                连接中...
              </>
            ) : (
              "测试连接"
            )}
          </Button>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* API 设置区域 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">API 设置</h2>

        {/* Default Model */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">默认模型</label>
          <Select value={defaultModel || undefined} onValueChange={setDefaultModel}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue placeholder="选择默认模型" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* API URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">API URL</label>
          <Input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.anthropic.com"
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            Anthropic API 的基础 URL（可选，用于自定义代理）
          </p>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">API Key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="bg-zinc-800 border-zinc-700 text-zinc-300"
          />
          <p className="text-xs text-zinc-500">
            您的 Anthropic API 密钥（本地存储，不会上传到服务器）
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}

export function SettingsForm() {
  const { settings, setSettings, updateSettings, loading } = useSettings();

  // 加载中显示占位内容
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
      </div>
    );
  }

  // settings 加载完成后渲染表单，使用 settings 值作为初始值
  return (
    <SettingsFormInner
      initialGatewayUrl={settings.gatewayUrl || ""}
      initialGatewayToken={settings.gatewayToken || ""}
      initialDefaultModel={settings.default_model || AVAILABLE_MODELS[0].value}
      initialApiUrl={settings.api_url || ""}
      initialApiKey={settings.api_key || ""}
      setSettings={setSettings}
      updateSettings={updateSettings}
    />
  );
}

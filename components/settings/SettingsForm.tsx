"use client";

import { useState, useCallback, useMemo } from "react";
import { useSettings, type FontSize } from "@/hooks/useSettings";
import { useGateway, type GatewayStatus } from "@/hooks/useGateway";
import { useSession } from "@/hooks/useSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Circle,
  Trash2,
  Download,
  Github,
  Info,
} from "lucide-react";

const APP_VERSION = "0.1.0";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "small", label: "小" },
  { value: "medium", label: "中" },
  { value: "large", label: "大" },
];

// Valid FontSize values for type guard
const VALID_FONT_SIZES = FONT_SIZE_OPTIONS.map((opt) => opt.value);

// Type guard for FontSize - validates value is a valid FontSize option
function isValidFontSize(value: string | null): value is FontSize {
  return value !== null && VALID_FONT_SIZES.includes(value as FontSize);
}

// Safe FontSize setter wrapper - handles null and invalid values
function createFontSizeSetter(
  setter: (value: FontSize) => void
): (value: string | null) => void {
  return (value: string | null) => {
    if (isValidFontSize(value)) {
      setter(value);
    }
  };
}

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
  initialMessageFontSize: FontSize;
  initialCodeFontSize: FontSize;
  setSettings: (settings: Partial<{
    gatewayUrl: string;
    gatewayToken: string;
    default_model: string;
    api_url: string;
    api_key: string;
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
    messageFontSize: FontSize;
    codeFontSize: FontSize;
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
  initialMessageFontSize,
  initialCodeFontSize,
  setSettings,
  updateSettings,
}: SettingsFormInnerProps) {
  const [gatewayUrl, setGatewayUrl] = useState(() => initialGatewayUrl);
  const [gatewayToken, setGatewayToken] = useState(() => initialGatewayToken);
  const [defaultModel, setDefaultModel] = useState<string | null>(() => initialDefaultModel);
  const [apiUrl, setApiUrl] = useState(() => initialApiUrl);
  const [apiKey, setApiKey] = useState(() => initialApiKey);
  const [messageFontSize, setMessageFontSize] = useState<FontSize>(() => initialMessageFontSize);
  const [codeFontSize, setCodeFontSize] = useState<FontSize>(() => initialCodeFontSize);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const { status, connect } = useGateway();
  const { sessions, fetchSessions } = useSession();

  // 从 sessions 中提取可用模型列表
  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    sessions.forEach((s) => {
      if (s.model && s.model !== "unknown") {
        modelSet.add(s.model);
      }
    });
    // 合并预设模型和从 sessions 提取的模型
    const presetModels = new Map(AVAILABLE_MODELS.map((m) => [m.value, m.label]));
    const allModels = [...AVAILABLE_MODELS];

    modelSet.forEach((model) => {
      if (!presetModels.has(model)) {
        allModels.push({ value: model, label: model });
      }
    });

    return allModels;
  }, [sessions]);

  // 测试连接
  const handleTestConnection = useCallback(async () => {
    // 更新 Gateway 设置
    setSettings({
      gatewayUrl,
      gatewayToken,
    });

    // 直接传入参数连接，避免 React state 异步更新问题
    setTesting(true);
    try {
      await connect(gatewayUrl, gatewayToken);
      toast.success("连接成功");
    } catch (err) {
      const message = err instanceof Error ? err.message : "连接失败";
      toast.error(`连接失败: ${message}`);
    } finally {
      setTesting(false);
    }
  }, [gatewayUrl, gatewayToken, setSettings, connect]);

  // 保存设置
  const handleSave = useCallback(async () => {
    setSaving(true);
    // 先更新 Gateway 设置
    setSettings({
      gatewayUrl,
      gatewayToken,
      messageFontSize,
      codeFontSize,
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
  }, [gatewayUrl, gatewayToken, defaultModel, apiUrl, apiKey, messageFontSize, codeFontSize, setSettings, updateSettings]);

  // 清除所有会话
  const handleClearAllSessions = useCallback(async () => {
    setShowClearConfirm(false);
    // 逐个删除会话
    let successCount = 0;
    let failCount = 0;

    for (const session of sessions) {
      // 跳过临时会话
      if (session.id.startsWith("temp-")) {
        continue;
      }
      try {
        // 使用 Gateway 的 sessions.reset
        const { gateway } = await import("@/lib/gateway");
        await gateway.sessionsReset(session.id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    // 刷新会话列表
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
      </div>

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* 默认模型选择 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">默认模型</h2>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">选择默认模型</label>
          <Select value={defaultModel || undefined} onValueChange={setDefaultModel}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue placeholder="选择默认模型" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-zinc-500">
            新建会话时使用的默认模型
          </p>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* UI 偏好设置 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">界面偏好</h2>

        {/* 主题选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">主题</label>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-sm px-3 py-2 bg-zinc-800 rounded-md border border-zinc-700">
              深色模式
            </span>
            <span className="text-xs text-zinc-500">(当前仅支持深色模式)</span>
          </div>
        </div>

        {/* 消息字体大小 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">消息字体大小</label>
          <Select
            value={messageFontSize}
            onValueChange={createFontSizeSetter(setMessageFontSize)}
          >
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 代码块字体大小 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">代码块字体大小</label>
          <Select
            value={codeFontSize}
            onValueChange={createFontSizeSetter(setCodeFontSize)}
          >
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* 会话管理 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">会话管理</h2>

        <div className="flex items-center gap-2 text-zinc-400">
          <Info className="h-4 w-4" />
          <span className="text-sm">当前会话数量: {sessions.length}</span>
        </div>

        <div className="flex gap-3">
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
      </div>

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* API 设置区域 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">API 设置</h2>

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

      {/* 分隔线 */}
      <div className="border-t border-zinc-800" />

      {/* 关于区域 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">关于</h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">版本</span>
            <span className="text-zinc-300">{APP_VERSION}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Gateway 状态</span>
            <ConnectionStatusIndicator status={status} />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">GitHub</span>
            <a
              href="https://github.com/piggy-wanger/openclaw-chat"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>openclaw-chat</span>
            </a>
          </div>
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
      initialMessageFontSize={settings.messageFontSize}
      initialCodeFontSize={settings.codeFontSize}
      setSettings={setSettings}
      updateSettings={updateSettings}
    />
  );
}

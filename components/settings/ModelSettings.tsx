"use client";

import { useState, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

type ModelSettingsProps = {
  defaultModel: string | null;
  availableModels: { value: string; label: string }[];
  initialApiUrl: string;
  initialApiKey: string;
  updateSettings: (settings: Record<string, string>) => Promise<boolean>;
};

export function ModelSettings({
  defaultModel,
  availableModels,
  initialApiUrl,
  initialApiKey,
  updateSettings,
}: ModelSettingsProps) {
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [apiKey, setApiKey] = useState(initialApiKey);

  // 合并预设模型和从 sessions 提取的模型
  const presetModels = new Map(AVAILABLE_MODELS.map((m) => [m.value, m.label]));
  const allModels = [...AVAILABLE_MODELS];

  availableModels.forEach((model) => {
    if (!presetModels.has(model.value)) {
      allModels.push(model);
    }
  });

  const handleModelChange = async (value: string | null) => {
    const success = await updateSettings({ default_model: value || "" });
    if (success) {
      toast.success("默认模型已保存");
    } else {
      toast.error("保存失败，请重试");
    }
  };

  const handleUrlBlur = useCallback(async () => {
    if (apiUrl !== initialApiUrl) {
      const success = await updateSettings({ api_url: apiUrl });
      if (success) {
        toast.success("API URL 已保存");
      } else {
        toast.error("保存失败，请重试");
      }
    }
  }, [apiUrl, initialApiUrl, updateSettings]);

  const handleKeyBlur = useCallback(async () => {
    if (apiKey !== initialApiKey) {
      const success = await updateSettings({ api_key: apiKey });
      if (success) {
        toast.success("API Key 已保存");
      } else {
        toast.error("保存失败，请重试");
      }
    }
  }, [apiKey, initialApiKey, updateSettings]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">模型与 API</h2>
        <p className="text-sm text-zinc-500">配置默认模型和 API 连接</p>
      </div>

      {/* 默认模型 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">默认模型</label>
        <Select
          value={defaultModel || undefined}
          onValueChange={handleModelChange}
        >
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="选择默认模型" />
          </SelectTrigger>
          <SelectContent>
            {allModels.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-zinc-500">新建会话时使用的默认模型</p>
      </div>

      <div className="border-t border-zinc-800" />

      {/* API URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">API URL</label>
        <Input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          onBlur={handleUrlBlur}
          placeholder="https://api.anthropic.com"
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          API 基础 URL（可选，用于自定义代理）
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">API Key</label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={handleKeyBlur}
          placeholder="sk-ant-..."
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          API 密钥（本地存储，不会上传到服务器）
        </p>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type ApiSettingsProps = {
  apiUrl: string;
  apiKey: string;
  updateSettings: (settings: Record<string, string>) => Promise<boolean>;
};

export function ApiSettings({
  apiUrl,
  apiKey,
  updateSettings,
}: ApiSettingsProps) {
  const [url, setUrl] = useState(apiUrl);
  const [key, setKey] = useState(apiKey);

  // 保存 API URL
  const handleUrlBlur = useCallback(async () => {
    if (url !== apiUrl) {
      const success = await updateSettings({ api_url: url });
      if (success) {
        toast.success("API URL 已保存");
      } else {
        toast.error("保存失败，请重试");
      }
    }
  }, [url, apiUrl, updateSettings]);

  // 保存 API Key
  const handleKeyBlur = useCallback(async () => {
    if (key !== apiKey) {
      const success = await updateSettings({ api_key: key });
      if (success) {
        toast.success("API Key 已保存");
      } else {
        toast.error("保存失败，请重试");
      }
    }
  }, [key, apiKey, updateSettings]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">API 设置</h2>
        <p className="text-sm text-zinc-500">配置 Anthropic API 连接</p>
      </div>

      {/* API URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">API URL</label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={handleUrlBlur}
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
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={handleKeyBlur}
          placeholder="sk-ant-..."
          className="bg-zinc-800 border-zinc-700 text-zinc-300"
        />
        <p className="text-xs text-zinc-500">
          您的 Anthropic API 密钥（本地存储，不会上传到服务器）
        </p>
      </div>
    </div>
  );
}

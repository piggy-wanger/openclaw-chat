"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/hooks/useSettings";
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

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

export function SettingsForm() {
  const { settings, updateSettings, loading } = useSettings();
  const [defaultModel, setDefaultModel] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // 初始化表单值（只在 settings 首次加载时执行一次）
  useEffect(() => {
    if (settings && !initialized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDefaultModel(settings.default_model || AVAILABLE_MODELS[0].value);
      setApiUrl(settings.api_url || "");
      setApiKey(settings.api_key || "");
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = async () => {
    setSaving(true);
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
  };

  return (
    <div className="space-y-6">
      {/* Default Model */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">默认模型</label>
        <Select value={defaultModel} onValueChange={setDefaultModel}>
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

      {/* Save Button */}
      <div className="pt-4">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? "保存中..." : "保存设置"}
        </Button>
      </div>
    </div>
  );
}

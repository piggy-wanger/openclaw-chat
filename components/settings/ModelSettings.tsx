"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import type { GatewayModel } from "@/lib/gateway-types";
import type { GatewayStatus } from "@/hooks/useGateway";
import type { GatewayClient } from "@/lib/gateway-client";

type ModelSettingsProps = {
  client: GatewayClient | null;
  gatewayStatus: GatewayStatus;
};

// 内置 Provider 定义
type BuiltInModel = {
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  input?: string[];
};

type BuiltInProvider = {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  models: BuiltInModel[];
};

const BUILT_IN_PROVIDERS: BuiltInProvider[] = [
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000, reasoning: false },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", contextWindow: 200000, reasoning: false },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", contextWindow: 200000, reasoning: false },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000, reasoning: false },
    ],
  },
  {
    id: "openai-codex",
    name: "OpenAI Codex",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-completions",
    models: [
      { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 272000, reasoning: true, input: ["text", "image"] },
      { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", contextWindow: 200000, reasoning: true },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-completions",
    models: [
      { id: "gpt-5.4", name: "GPT-5.4", contextWindow: 272000, reasoning: true, input: ["text", "image"] },
      { id: "o3", name: "o3", contextWindow: 200000, reasoning: true },
    ],
  },
  {
    id: "google-gemini-cli",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google-genai",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", contextWindow: 1048576, reasoning: true, input: ["text", "image"] },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", contextWindow: 1048576, reasoning: true, input: ["text", "image"] },
    ],
  },
  {
    id: "zai",
    name: "z.ai (智谱)",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    api: "openai-completions",
    models: [
      { id: "glm-5", name: "GLM-5", contextWindow: 204800, reasoning: true, input: ["text"] },
      { id: "glm-5-turbo", name: "GLM-5-Turbo", contextWindow: 204800, reasoning: true, input: ["text"] },
      { id: "glm-4.7", name: "GLM-4.7", contextWindow: 204800, reasoning: true, input: ["text"] },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://127.0.0.1:11434",
    api: "openai-completions",
    models: [], // 动态发现，不预设
  },
];

// 格式化 context window 大小
function formatContextWindow(size?: number): string {
  if (!size) return "";
  if (size >= 1000000) return `${(size / 1000000).toFixed(0)}M`;
  if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
  return String(size);
}

// 从模型 key 提取 provider
function getProvider(modelKey: string): string {
  const parts = modelKey.split("/");
  return parts.length > 1 ? parts[0] : "other";
}

// 按 provider 分组模型
function groupByProvider(models: GatewayModel[]): Map<string, GatewayModel[]> {
  const groups = new Map<string, GatewayModel[]>();
  for (const model of models) {
    const provider = model.provider || getProvider(model.key || model.id || "");
    if (!provider) continue;
    if (!groups.has(provider)) {
      groups.set(provider, []);
    }
    groups.get(provider)!.push(model);
  }
  return groups;
}

// 获取 Provider 显示名称
function getProviderDisplayName(providerId: string): string {
  const builtIn = BUILT_IN_PROVIDERS.find((p) => p.id === providerId);
  return builtIn?.name || providerId;
}

export function ModelSettings({ client, gatewayStatus }: ModelSettingsProps) {
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    providerId: "",
    selectedModels: [] as string[],
    apiKey: "",
    baseUrl: "",
  });
  const [saving, setSaving] = useState(false);

  const isConnected = gatewayStatus === "connected";

  // 加载模型列表
  useEffect(() => {
    if (!isConnected || !client) {
      return;
    }

    setLoading(true);
    client
      .modelsList()
      .then((result) => {
        setModels(result);
        // 默认展开所有 provider
        const providers = new Set<string>();
        for (const model of result) {
          const provider = model.provider || getProvider(model.key || model.id || "");
          if (provider) providers.add(provider);
        }
        setExpandedProviders(providers);
      })
      .catch((error) => {
        console.error("Failed to load models:", error);
        toast.error("加载模型列表失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isConnected, client]);

  // 断开连接时清空模型列表
  useEffect(() => {
    if (!isConnected) {
      setModels([]);
    }
  }, [isConnected]);

  // 按 provider 分组
  const providerGroups = useMemo(() => groupByProvider(models), [models]);

  // 切换 provider 展开/收起
  const toggleProvider = useCallback((provider: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) {
        next.delete(provider);
      } else {
        next.add(provider);
      }
      return next;
    });
  }, []);

  // 选择 Provider 时自动填充 baseUrl 和模型列表
  const handleProviderSelect = useCallback((providerId: string) => {
    const provider = BUILT_IN_PROVIDERS.find((p) => p.id === providerId);
    setAddForm((prev) => ({
      ...prev,
      providerId,
      baseUrl: provider?.baseUrl || "",
      selectedModels: provider?.models.map((m) => m.id) || [],
    }));
  }, []);

  // 切换模型选择
  const toggleModel = useCallback((modelId: string) => {
    setAddForm((prev) => {
      const selected = prev.selectedModels.includes(modelId)
        ? prev.selectedModels.filter((id) => id !== modelId)
        : [...prev.selectedModels, modelId];
      return { ...prev, selectedModels: selected };
    });
  }, []);

  // 提交添加 Provider
  const handleAddProvider = useCallback(async () => {
    if (!client) return;

    const { providerId, selectedModels, apiKey, baseUrl } = addForm;
    if (!providerId) {
      toast.error("请选择 Provider");
      return;
    }
    if (selectedModels.length === 0) {
      toast.error("请选择至少一个模型");
      return;
    }
    if (!apiKey) {
      toast.error("请输入 API Key");
      return;
    }

    const provider = BUILT_IN_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) {
      toast.error("无效的 Provider");
      return;
    }

    setSaving(true);
    try {
      // 获取当前配置和 baseHash
      const { baseHash } = await client.configGet();

      // 构建模型配置
      const modelsConfig = selectedModels.map((modelId) => {
        const modelDef = provider.models.find((m) => m.id === modelId);
        return {
          id: modelId,
          name: modelDef?.name || modelId,
          contextWindow: modelDef?.contextWindow,
          reasoning: modelDef?.reasoning || false,
          input: modelDef?.input,
        };
      });

      // 构建配置 patch
      const patch = {
        models: {
          mode: "merge",
          providers: {
            [providerId]: {
              baseUrl,
              api: provider.api,
              apiKey,
              models: modelsConfig,
            },
          },
        },
      };

      await client.configSet(baseHash, patch);
      toast.success("Provider 添加成功");
      setShowAddDialog(false);
      setAddForm({
        providerId: "",
        selectedModels: [],
        apiKey: "",
        baseUrl: "",
      });

      // 重新加载模型列表
      const updatedModels = await client.modelsList();
      setModels(updatedModels);
      const providers = new Set<string>();
      for (const model of updatedModels) {
        const p = model.provider || getProvider(model.key || model.id || "");
        if (p) providers.add(p);
      }
      setExpandedProviders(providers);
    } catch (error) {
      console.error("Failed to add provider:", error);
      toast.error("添加 Provider 失败");
    } finally {
      setSaving(false);
    }
  }, [client, addForm]);

  // 关闭对话框
  const closeDialog = useCallback(() => {
    setShowAddDialog(false);
    setAddForm({
      providerId: "",
      selectedModels: [],
      apiKey: "",
      baseUrl: "",
    });
  }, []);

  // 获取当前选中的 Provider 的模型列表
  const selectedProviderModels = useMemo(() => {
    const provider = BUILT_IN_PROVIDERS.find((p) => p.id === addForm.providerId);
    return provider?.models || [];
  }, [addForm.providerId]);

  // 未连接时显示提示
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">模型与 API</h2>
          <p className="text-sm text-zinc-500">管理 Provider 和模型配置</p>
        </div>
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <p>请先连接 Gateway</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">模型与 API</h2>
          <p className="text-sm text-zinc-500">管理 Provider 和模型配置</p>
        </div>
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <p>加载模型列表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和添加按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">模型与 API</h2>
          <p className="text-sm text-zinc-500">管理 Provider 和模型配置</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加 Provider
        </button>
      </div>

      {/* Provider 列表 */}
      {providerGroups.size === 0 ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <p>暂无配置的 Provider，点击上方按钮添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from(providerGroups.entries()).map(([provider, providerModels]) => {
            const isExpanded = expandedProviders.has(provider);
            return (
              <div
                key={provider}
                className="rounded-lg border border-zinc-800 overflow-hidden"
              >
                {/* Provider 标题（可点击展开/收起） */}
                <button
                  onClick={() => toggleProvider(provider)}
                  className="w-full px-4 py-3 bg-zinc-800/50 border-b border-zinc-800 flex items-center gap-3 hover:bg-zinc-800/70 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  )}
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-medium text-zinc-200">
                      {getProviderDisplayName(provider)}
                    </h3>
                    <p className="text-xs text-zinc-500">{providerModels.length} 个模型</p>
                  </div>
                </button>

                {/* 模型列表（展开时显示） */}
                {isExpanded && (
                  <div className="divide-y divide-zinc-800/50">
                    {providerModels.map((model) => {
                      const modelId = model.key || model.id || "";
                      const displayName = model.name || modelId.split("/").pop() || modelId;
                      const hasImageInput = model.input
                        ? Array.isArray(model.input)
                          ? model.input.includes("image")
                          : model.input === "image"
                        : false;

                      return (
                        <div
                          key={modelId}
                          className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-zinc-200 truncate">
                                {displayName}
                              </span>
                              {/* Reasoning 标签 */}
                              {model.reasoning && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-400">
                                  reasoning
                                </span>
                              )}
                              {/* 图片输入标签 */}
                              {hasImageInput && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-green-500/20 text-green-400">
                                  image
                                </span>
                              )}
                            </div>
                            {/* Context window */}
                            {model.contextWindow && (
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {formatContextWindow(model.contextWindow)} context
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 添加 Provider 对话框 */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            {/* 对话框标题 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-lg font-semibold text-white">添加 Provider</h3>
              <button
                onClick={closeDialog}
                className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 对话框内容 */}
            <div className="p-4 space-y-4">
              {/* Provider 选择 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Provider
                </label>
                <select
                  value={addForm.providerId}
                  onChange={(e) => handleProviderSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">选择 Provider...</option>
                  {BUILT_IN_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 模型选择 */}
              {addForm.providerId && selectedProviderModels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    模型
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-zinc-800 border border-zinc-700 rounded-md">
                    {selectedProviderModels.map((model) => (
                      <label
                        key={model.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700/50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={addForm.selectedModels.includes(model.id)}
                          onChange={() => toggleModel(model.id)}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-zinc-200">{model.name}</span>
                        {model.reasoning && (
                          <span className="px-1 py-0.5 text-[10px] rounded bg-purple-500/20 text-purple-400">
                            reasoning
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={addForm.apiKey}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Base URL
                </label>
                <input
                  type="text"
                  value={addForm.baseUrl}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* 对话框按钮 */}
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
              <button
                onClick={closeDialog}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleAddProvider}
                disabled={saving || !addForm.providerId || !addForm.apiKey}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "保存中..." : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

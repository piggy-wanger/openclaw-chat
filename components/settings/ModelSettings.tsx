"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { GatewayModel } from "@/lib/gateway-types";
import type { GatewayStatus } from "@/hooks/useGateway";
import type { GatewayClient } from "@/lib/gateway-client";

type ModelSettingsProps = {
  defaultModel: string | null;
  updateSettings: (settings: Record<string, string>) => Promise<boolean>;
  client: GatewayClient | null;
  gatewayStatus: GatewayStatus;
};

// 从模型 key 提取 provider
function getProvider(modelKey: string): string {
  const parts = modelKey.split("/");
  return parts.length > 1 ? parts[0] : "other";
}

// 格式化 context window 大小
function formatContextWindow(size?: number): string {
  if (!size) return "";
  if (size >= 1000000) return `${(size / 1000000).toFixed(0)}M`;
  if (size >= 1000) return `${(size / 1000).toFixed(0)}K`;
  return String(size);
}

// 按 provider 分组模型
function groupByProvider(models: GatewayModel[]): Map<string, GatewayModel[]> {
  const groups = new Map<string, GatewayModel[]>();
  for (const model of models) {
    const modelId = String((model as Record<string, unknown>).key || model.id || "");
    const provider = getProvider(modelId);
    if (!groups.has(provider)) {
      groups.set(provider, []);
    }
    groups.get(provider)!.push(model);
  }
  return groups;
}

export function ModelSettings({
  defaultModel,
  updateSettings,
  client,
  gatewayStatus,
}: ModelSettingsProps) {
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [loading, setLoading] = useState(false);

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

  // 选择模型
  const handleSelectModel = async (modelId: string) => {
    const success = await updateSettings({ default_model: modelId });
    if (success) {
      toast.success("默认模型已更新");
    } else {
      toast.error("保存失败，请重试");
    }
  };

  // 未连接时显示提示
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">模型设置</h2>
          <p className="text-sm text-zinc-500">配置默认模型</p>
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
          <h2 className="text-lg font-semibold text-white mb-1">模型设置</h2>
          <p className="text-sm text-zinc-500">配置默认模型</p>
        </div>
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <p>加载模型列表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">模型设置</h2>
        <p className="text-sm text-zinc-500">点击模型设为默认模型</p>
      </div>

      {providerGroups.size === 0 ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <p>暂无可用模型</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(providerGroups.entries()).map(([provider, providerModels]) => (
            <div
              key={provider}
              className="rounded-lg border border-zinc-800 overflow-hidden"
            >
              {/* Provider 标题 */}
              <div className="px-4 py-2 bg-zinc-800/50 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300">{provider}</h3>
                <p className="text-xs text-zinc-500">{providerModels.length} 个模型</p>
              </div>

              {/* 模型列表 */}
              <div className="divide-y divide-zinc-800/50">
                {providerModels.map((model) => {
                  const modelId = model.key || model.id || "";
                  const isSelected = defaultModel === modelId;
                  const displayName = model.name || modelId.split("/").pop() || modelId;

                  return (
                    <button
                      key={modelId}
                      onClick={() => handleSelectModel(modelId)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors
                        ${isSelected
                          ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                          : "hover:bg-zinc-800/30 border-l-2 border-l-transparent"
                        }`}
                    >
                      {/* 选中指示器 */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0
                          ${isSelected ? "bg-blue-500" : "bg-transparent"}`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
                          {(model.input?.includes("image")) && (
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
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

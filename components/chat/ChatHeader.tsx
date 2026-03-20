"use client";

import { useEffect, useState, useMemo } from "react";
import { PanelLeft, PanelLeftClose, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGateway, type GatewayStatus } from "@/hooks/useGateway";
import { useSettings } from "@/hooks/useSettings";
import type { Session } from "@/lib/types";
import type { GatewayModel } from "@/lib/gateway-types";

// 连接状态小圆点
function ConnectionDot({ status }: { status: GatewayStatus }) {
  if (status === "connected") {
    return (
      <span
        className="w-2 h-2 rounded-full bg-chart-2"
        title="已连接"
      />
    );
  }
  if (status === "connecting") {
    return (
      <span
        className="w-2 h-2 rounded-full bg-chart-1 animate-pulse"
        title="连接中..."
      />
    );
  }
  if (status === "error") {
    return (
      <span
        className="w-2 h-2 rounded-full bg-destructive"
        title="连接错误"
      />
    );
  }
  return (
    <span
      className="w-2 h-2 rounded-full bg-muted-foreground"
      title="未连接"
    />
  );
}

interface ChatHeaderProps {
  currentSession: Session | null;
  onModelChange: (model: string | null) => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  isMobile: boolean;
}

export function ChatHeader({
  currentSession,
  onModelChange,
  onToggleSidebar,
  isSidebarOpen,
  isMobile,
}: ChatHeaderProps) {
  const { status, client, isConnected } = useGateway();
  const { settings } = useSettings();
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // 从 Gateway 获取可用模型列表
  useEffect(() => {
    if (!isConnected) {
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const gatewayModels = await client.modelsList();
        setModels(gatewayModels);
      } catch (err) {
        console.error("Failed to fetch models:", err);
        setModels([]);
      } finally {
        setModelsLoading(false);
      }
    };

    fetchModels();
  }, [client, isConnected]);

  // 合并和去重模型列表
  const availableModels = useMemo(() => {
    const modelMap = new Map<string, GatewayModel>();

    // 添加 Gateway 返回的模型
    for (const model of models) {
      const id = model.id || model.key || "";
      if (id) {
        modelMap.set(id, model);
      }
    }

    return Array.from(modelMap.values());
  }, [models]);

  // 确定当前选中的模型
  const currentModel = useMemo(() => {
    // 优先使用会话的模型
    if (currentSession?.model && currentSession.model !== "unknown") {
      return currentSession.model;
    }
    // 其次使用设置的默认模型
    if (settings.default_model) {
      return settings.default_model;
    }
    // 最后使用第一个可用模型
    return availableModels[0]?.id || availableModels[0]?.key || "";
  }, [currentSession?.model, settings.default_model, availableModels]);

  // 获取模型的显示名称 - 格式: provider/id
  const getModelDisplayName = (model: GatewayModel): string => {
    // 优先使用 provider/id 格式
    if (model.provider && model.id) {
      return `${model.provider}/${model.id}`;
    }
    // 如果有 key 字段（已经包含 provider/id 格式）
    if (model.key) {
      return model.key;
    }
    // 回退到 name 或 id
    return model.name || model.id || "Unknown Model";
  };

  // 获取模型的值（用于 select）
  const getModelValue = (model: GatewayModel): string => {
    return model.id || model.key || "";
  };

  const title = currentSession?.title || "OpenClaw Chat";

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
      <div className="flex items-center gap-3">
        {/* Toggle Sidebar Button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "关闭侧边栏" : "打开侧边栏"}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        )}
        <h2 className="text-lg font-medium text-foreground truncate max-w-[300px]">
          {title}
        </h2>
        {/* 连接状态指示器 */}
        <ConnectionDot status={status} />
      </div>

      {/* Model Selector */}
      {currentSession && (
        <Select value={currentModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-[180px] bg-muted border-border text-foreground">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {modelsLoading ? (
              <div className="flex items-center justify-center gap-2 px-2 py-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>加载中...</span>
              </div>
            ) : availableModels.length === 0 ? (
              <div className="px-2 py-4 text-muted-foreground text-center">
                {isConnected ? "暂无可用模型" : "未连接到 Gateway"}
              </div>
            ) : (
              availableModels.map((model) => (
                <SelectItem
                  key={getModelValue(model)}
                  value={getModelValue(model)}
                >
                  {getModelDisplayName(model)}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      )}
    </header>
  );
}

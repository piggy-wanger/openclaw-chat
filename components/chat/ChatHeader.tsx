"use client";

import { useEffect, useState, useMemo } from "react";
import { PanelLeft, PanelLeftClose, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGateway, type GatewayStatus } from "@/hooks/useGateway";
import { useSettings } from "@/hooks/useSettings";
import type { GroupMember, Session } from "@/lib/types";
import type { GatewayModel } from "@/lib/gateway-types";

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
  isGroup?: boolean;
  groupName?: string;
  groupMembers?: GroupMember[];
}

export function ChatHeader({
  currentSession,
  onModelChange,
  onToggleSidebar,
  isSidebarOpen,
  isMobile,
  isGroup = false,
  groupName,
  groupMembers = [],
}: ChatHeaderProps) {
  const { status, client, isConnected } = useGateway();
  const { settings } = useSettings();
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

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

  const availableModels = useMemo(() => {
    const modelMap = new Map<string, GatewayModel>();

    for (const model of models) {
      const id = model.id || model.key || "";
      if (id) {
        modelMap.set(id, model);
      }
    }

    return Array.from(modelMap.values());
  }, [models]);

  const currentModel = useMemo(() => {
    if (currentSession?.model && currentSession.model !== "unknown") {
      return currentSession.model;
    }
    if (settings.default_model) {
      return settings.default_model;
    }
    return availableModels[0]?.id || availableModels[0]?.key || "";
  }, [currentSession?.model, settings.default_model, availableModels]);

  const getModelDisplayName = (model: GatewayModel): string => {
    if (model.provider && model.id) {
      return `${model.provider}/${model.id}`;
    }
    if (model.key) {
      return model.key;
    }
    return model.name || model.id || "Unknown Model";
  };

  const getModelValue = (model: GatewayModel): string => {
    return model.id || model.key || "";
  };

  const displayTitle = isGroup
    ? (groupName || currentSession?.title || "群组聊天")
    : (currentSession?.title || "OpenClaw Chat");

  const subtitle = isGroup ? `${groupMembers.length} 个智能体` : null;
  const shownMembers = groupMembers.slice(0, 5);
  const hiddenCount = Math.max(groupMembers.length - shownMembers.length, 0);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
      <div className="flex items-center gap-3 min-w-0">
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

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-lg font-medium text-foreground truncate max-w-[280px] md:max-w-[360px]">
              {displayTitle}
            </h2>

            {isGroup && shownMembers.length > 0 && (
              <AvatarGroup className="shrink-0">
                {shownMembers.map((member) => (
                  <Avatar key={member.id} size="sm">
                    <AvatarFallback>{member.emoji || member.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ))}
                {hiddenCount > 0 && (
                  <AvatarGroupCount className="size-6 text-xs">+{hiddenCount}</AvatarGroupCount>
                )}
              </AvatarGroup>
            )}

            <ConnectionDot status={status} />
          </div>

          {subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {currentSession && (
        <div className="flex items-center gap-2">
          {isGroup && (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              群聊
            </Badge>
          )}
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
        </div>
      )}
    </header>
  );
}

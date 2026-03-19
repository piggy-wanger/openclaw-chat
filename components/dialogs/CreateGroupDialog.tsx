"use client";

import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GatewayClient } from "@/lib/gateway-client";

// Agent 类型定义
type AgentIdentity = {
  name: string;
  emoji?: string;
  avatar?: string;
};

type Agent = {
  id: string;
  identity: AgentIdentity;
  model: string;
  workspace?: string;
  bindings?: Record<string, unknown>;
};

type CreateGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: GatewayClient | null;
  isConnected: boolean;
  onCreateGroup: (options: {
    groupName: string;
    agentIds: string[];
  }) => void;
};

export function CreateGroupDialog({
  open,
  onOpenChange,
  client,
  isConnected,
  onCreateGroup,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Load agents from config
  useEffect(() => {
    if (!open || !isConnected || !client) return;

    let cancelled = false;
    const loadAgents = async () => {
      if (cancelled) return;
      try {
        const result = await client.configGet();
        if (cancelled) return;
        const config = result.config as {
          agents?: {
            list?: Agent[];
            default?: string;
          };
        };
        setAgents(config?.agents?.list || []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load agents:", err);
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    };
    setLoadingAgents(true);
    loadAgents();
    return () => {
      cancelled = true;
    };
  }, [open, isConnected, client]);

  // Toggle agent selection
  const toggleAgent = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!groupName.trim() || selectedAgentIds.length === 0) {
      return;
    }

    onCreateGroup({
      groupName: groupName.trim(),
      agentIds: selectedAgentIds,
    });

    // Reset form
    setGroupName("");
    setSelectedAgentIds([]);
    onOpenChange(false);
  };

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setGroupName("");
      setSelectedAgentIds([]);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">新建群组</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            创建一个包含多个智能体的群组会话
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Group Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              群组名称 <span className="text-destructive">*</span>
            </label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="输入群组名称..."
              className="bg-muted border-border text-foreground"
            />
          </div>

          {/* Agent Multi-Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              智能体 <span className="text-destructive">*</span>
            </label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <ScrollArea className="h-[150px] rounded-md border border-border bg-muted">
                <div className="p-2 space-y-1">
                  {agents.length === 0 ? (
                    <div className="px-2 py-4 text-muted-foreground text-center text-sm">
                      暂无可用智能体
                    </div>
                  ) : (
                    agents.map((agent) => {
                      const isSelected = selectedAgentIds.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => toggleAgent(agent.id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors text-left ${
                            isSelected
                              ? "bg-primary/20 text-foreground"
                              : "hover:bg-muted/70 text-foreground"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground"
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                          </div>
                          <span className="flex items-center gap-2">
                            {agent.identity?.emoji && (
                              <span>{agent.identity.emoji}</span>
                            )}
                            <span className="text-sm">
                              {agent.identity?.name || agent.id}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            )}
            {/* Selected agents display */}
            {selectedAgentIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedAgentIds.map((agentId) => {
                  const agent = agents.find((a) => a.id === agentId);
                  return (
                    <Badge
                      key={agentId}
                      variant="secondary"
                      className="text-xs"
                    >
                      {agent?.identity?.emoji} {agent?.identity?.name || agentId}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-border text-foreground hover:bg-muted"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!groupName.trim() || selectedAgentIds.length === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

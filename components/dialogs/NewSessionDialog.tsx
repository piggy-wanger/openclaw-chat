"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GatewayClient } from "@/lib/gateway-client";
import type { GatewayModel } from "@/lib/gateway-types";

type AgentRow = {
  id: string;
  name: string | null;
  model: string | null;
  emoji: string | null;
  avatar: string | null;
  workspace: string | null;
};

type NewSessionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: GatewayClient | null;
  isConnected: boolean;
  onCreateSession: (options: {
    sessionId: string;
    sessionName: string;
    agentId: string;
    model: string;
  }) => void;
};

export function NewSessionDialog({
  open,
  onOpenChange,
  client,
  isConnected,
  onCreateSession,
}: NewSessionDialogProps) {
  const [sessionId, setSessionId] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [models, setModels] = useState<GatewayModel[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load agents from SQLite
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const loadAgents = async () => {
      try {
        const res = await fetch("/api/agents");
        if (cancelled) return;
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json() as { agents: AgentRow[] };
        const agentList = data.agents || [];
        setAgents(agentList);
        if (agentList.length > 0 && !agentList.some((a) => a.id === selectedAgentId)) {
          setSelectedAgentId(agentList[0].id);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load models from Gateway
  useEffect(() => {
    if (!open || !isConnected || !client) return;

    let cancelled = false;
    const loadModels = async () => {
      if (cancelled) return;
      try {
        const result = await client.modelsList();
        if (cancelled) return;
        setModels(result);
        // Set default model if no model selected
        if (!selectedModel && result.length > 0) {
          setSelectedModel(result[0].id || result[0].key || "");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load models:", err);
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    };
    setLoadingModels(true);
    loadModels();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isConnected, client]);

  useEffect(() => {
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find((a) => a.id === selectedAgentId);
      if (agent?.model && agent.model !== selectedModel) {
        queueMicrotask(() => {
          setSelectedModel(agent.model!);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId, agents]);

  // Filter models by provider if agent has a specific model preference
  const availableModels = useMemo(() => {
    return models;
  }, [models]);

  // Get model display name
  const getModelDisplayName = (model: GatewayModel): string => {
    return model.name || model.id || model.key || "Unknown Model";
  };

  // Get model value
  const getModelValue = (model: GatewayModel): string => {
    return model.id || model.key || "";
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!sessionId.trim() || !selectedAgentId || !selectedModel) {
      return;
    }

    onCreateSession({
      sessionId: sessionId.trim(),
      sessionName: sessionName.trim(),
      agentId: selectedAgentId,
      model: selectedModel,
    });

    // Reset form
    setSessionId("");
    setSessionName("");
    onOpenChange(false);
  };

  // Check if form is valid for submission
  const isFormValid = sessionId.trim() && selectedAgentId && selectedModel;

  // Handle dialog close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSessionId("");
      setSessionName("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">新建会话</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            创建一个新的对话会话
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Session ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              会话ID <span className="text-destructive">*</span>
            </label>
            <Input
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="输入会话ID（如 xxx）..."
              className="bg-muted border-border text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isFormValid) {
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Session Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              会话名称 <span className="text-muted-foreground font-normal">(可选)</span>
            </label>
            <Input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="输入会话名称（不填则显示会话ID）..."
              className="bg-muted border-border text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && isFormValid) {
                  handleSubmit();
                }
              }}
            />
          </div>

          {/* Agent Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">智能体</label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <Select
                value={selectedAgentId}
                onValueChange={(value) => setSelectedAgentId(value || "")}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="选择智能体..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="px-2 py-4 text-muted-foreground text-center text-sm">
                      暂无可用智能体
                    </div>
                  ) : (
                    agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <span className="flex items-center gap-2">
                          {agent.emoji && <span>{agent.emoji}</span>}
                          <span>{agent.name || agent.id}</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">模型</label>
            {loadingModels ? (
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中...
              </div>
            ) : (
              <Select
                value={selectedModel}
                onValueChange={(value) => setSelectedModel(value || "")}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue placeholder="选择模型..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.length === 0 ? (
                    <div className="px-2 py-4 text-muted-foreground text-center text-sm">
                      暂无可用模型
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
            disabled={!isFormValid}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

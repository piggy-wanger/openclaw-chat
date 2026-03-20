"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Star, FolderOpen, Upload, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GatewayStatus } from "@/hooks/useGateway";
import type { GatewayClient } from "@/lib/gateway-client";
import type { GatewayModel } from "@/lib/gateway-types";

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

type AgentSettingsProps = {
  client: GatewayClient | null;
  gatewayStatus: GatewayStatus;
};

// ID 验证正则：小写字母、数字、连字符，不能以连字符开头/结尾
const VALID_ID_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// normalizeAgentId 逻辑（与 openclaw 核心一致）
function normalizeAgentId(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "main";
  if (VALID_ID_RE.test(trimmed)) return trimmed.toLowerCase();
  return (
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .slice(0, 64) || "main"
  );
}

// 验证 ID 是否有效（不包含 "main" 保留字检查）
function isValidIdFormat(id: string): boolean {
  const trimmed = id.trim();
  if (!trimmed) return false;
  return VALID_ID_RE.test(trimmed.toLowerCase());
}

export function AgentSettings({ client, gatewayStatus }: AgentSettingsProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<GatewayModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    id: "",           // Agent ID (只用于创建时输入，编辑时只读)
    displayName: "",  // 显示名称 (identity.name)
    emoji: "",
    avatar: "",
    model: "",
    workspace: "",
  });

  // ID 输入预览状态
  const [idPreview, setIdPreview] = useState<string>("");
  const [idValidation, setIdValidation] = useState<{
    isValid: boolean;
    isReserved: boolean;
    willChange: boolean;
  }>({ isValid: false, isReserved: false, willChange: false });

  // File input ref for avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isConnected = gatewayStatus === "connected";

  // Validate avatar URL to prevent XSS - only allow https:// and data:image/ URIs
  const validateAvatarUrl = useCallback((url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Allow data:image/ URIs (base64 encoded images)
    if (trimmed.startsWith("data:image/")) {
      return trimmed;
    }

    // Allow https:// URLs only
    if (trimmed.startsWith("https://")) {
      try {
        new URL(trimmed);
        return trimmed;
      } catch {
        return null;
      }
    }

    // Reject javascript: and other protocols
    return null;
  }, []);

  // 加载 Agent 列表
  const loadAgents = useCallback(async () => {
    if (!isConnected || !client) return;

    setLoading(true);
    try {
      const result = await client.configGet();
      const config = result.config as {
        agents?: {
          list?: Agent[];
          default?: string;
        };
      };
      const agentList = config?.agents?.list || [];
      setAgents(agentList);
      setDefaultAgentId(config?.agents?.default || null);
    } catch (error) {
      console.error("Failed to load agents:", error);
      toast.error("加载智能体列表失败");
    } finally {
      setLoading(false);
    }
  }, [isConnected, client]);

  // 加载可用模型列表
  const loadModels = useCallback(async () => {
    if (!isConnected || !client) return;

    setModelsLoading(true);
    try {
      const models = await client.modelsList();
      setAvailableModels(models);
    } catch (error) {
      console.error("Failed to load models:", error);
    } finally {
      setModelsLoading(false);
    }
  }, [isConnected, client]);

  useEffect(() => {
    loadAgents();
    loadModels();
  }, [loadAgents, loadModels]);

  // 获取模型的显示名称 - 格式: provider/id
  const getModelDisplayName = (model: GatewayModel): string => {
    if (model.provider && model.id) {
      return `${model.provider}/${model.id}`;
    }
    if (model.key) {
      return model.key;
    }
    return model.name || model.id || "Unknown Model";
  };

  // 获取模型的值（用于 select）- 保留完整的 provider/model 格式
  const getModelValue = (model: GatewayModel): string => {
    // 优先使用完整的 provider/id 格式
    if (model.provider && model.id) {
      return `${model.provider}/${model.id}`;
    }
    return model.key || model.id || "";
  };

  // 处理头像上传
  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("只支持 PNG、JPG、WebP 格式的图片");
      return;
    }

    // 验证文件大小 (100KB)
    if (file.size > 100 * 1024) {
      toast.error("图片大小不能超过 100KB");
      return;
    }

    // 读取文件并验证尺寸
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width > 128 || img.height > 128) {
          toast.error("图片尺寸不能超过 128×128 像素");
          return;
        }
        // 存储 base64 数据
        setFormData((prev) => ({
          ...prev,
          avatar: event.target?.result as string,
          emoji: "", // 清空 emoji，因为已经有头像了
        }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // 清空 input 以允许重新选择相同文件
    e.target.value = "";
  }, []);

  // 清除头像
  const clearAvatar = useCallback(() => {
    setFormData((prev) => ({ ...prev, avatar: "" }));
  }, []);

  // 重置表单
  const resetForm = useCallback(() => {
    setFormData({
      id: "",
      displayName: "",
      emoji: "",
      avatar: "",
      model: "",
      workspace: "",
    });
    setIdPreview("");
    setIdValidation({ isValid: false, isReserved: false, willChange: false });
  }, []);

  // 处理 ID 输入变化
  const handleIdChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, id: value }));
    const normalized = normalizeAgentId(value);
    const trimmed = value.trim();
    const isValid = isValidIdFormat(trimmed);
    const isReserved = normalized === "main";
    const willChange = Boolean(trimmed && normalized !== trimmed.toLowerCase());

    setIdPreview(normalized);
    setIdValidation({ isValid, isReserved, willChange });
  }, []);

  // 打开添加对话框
  const openAddDialog = useCallback(() => {
    resetForm();
    setShowAddDialog(true);
  }, [resetForm]);

  // 打开编辑对话框
  const openEditDialog = useCallback((agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      id: agent.id,
      displayName: agent.identity?.name || "",
      emoji: agent.identity?.emoji || "",
      avatar: agent.identity?.avatar || "",
      model: agent.model,
      workspace: agent.workspace || "",
    });
    setShowEditDialog(true);
  }, []);

  // 打开删除对话框
  const openDeleteDialog = useCallback((agent: Agent) => {
    setDeletingAgent(agent);
    setShowDeleteDialog(true);
  }, []);

  // 添加智能体
  const handleAddAgent = useCallback(async () => {
    if (!client) return;

    const { id, displayName, emoji, model, workspace } = formData;

    // 验证 ID
    const trimmedId = id.trim();
    if (!trimmedId) {
      toast.error("请输入智能体 ID");
      return;
    }
    if (!isValidIdFormat(trimmedId)) {
      toast.error("ID 格式无效：仅支持小写字母、数字、连字符，且不能以连字符开头/结尾");
      return;
    }
    const normalizedId = normalizeAgentId(trimmedId);
    if (normalizedId === "main") {
      toast.error("不能使用保留字 'main' 作为 ID");
      return;
    }
    if (!model.trim()) {
      toast.error("请选择模型");
      return;
    }
    // Validate avatar URL if provided
    if (formData.avatar && !validateAvatarUrl(formData.avatar)) {
      toast.error("头像 URL 仅支持 https:// 或 data:image/ 格式");
      return;
    }

    setSaving(true);
    try {
      // 使用 agents.create RPC - name 参数会成为智能体的 ID
      // 注意：gateway 的 agents.create 不接受 model 参数，需要先创建再更新
      const result = await client.agentsCreate({
        name: normalizedId,
        workspace: workspace.trim() || `~/.openclaw/workspace-${normalizedId}`,
        emoji: emoji.trim() || undefined,
        avatar: formData.avatar || undefined,
      });

      // 创建成功后，统一用 agentsUpdate 设置 name + model + emoji + avatar
      const trimmedDisplayName = displayName.trim();
      await client.agentsUpdate({
        agentId: result.agentId,
        name: trimmedDisplayName || normalizedId,
        model: model.trim(),
        emoji: emoji.trim() || undefined,
        avatar: formData.avatar || undefined,
      });

      toast.success("智能体添加成功");
      setShowAddDialog(false);
      resetForm();
      await loadAgents();
    } catch (error) {
      console.error("Failed to add agent:", error);
      toast.error("添加智能体失败");
    } finally {
      setSaving(false);
    }
  }, [client, formData, loadAgents, resetForm, validateAvatarUrl]);

  // 编辑智能体
  const handleEditAgent = useCallback(async () => {
    if (!client || !editingAgent) return;

    const { displayName, emoji, model } = formData;

    // 显示名称可以为空（此时会使用 ID 作为显示名称）
    if (!model.trim()) {
      toast.error("请选择模型");
      return;
    }
    // Validate avatar URL if provided
    if (formData.avatar && !validateAvatarUrl(formData.avatar)) {
      toast.error("头像 URL 仅支持 https:// 或 data:image/ 格式");
      return;
    }

    setSaving(true);
    try {
      // 使用 agents.update RPC - 不传递 workspace
      await client.agentsUpdate({
        agentId: editingAgent.id,
        name: displayName.trim() || undefined,
        model: model.trim(),
        emoji: emoji.trim() || undefined,
        avatar: formData.avatar || undefined,
      });

      toast.success("智能体更新成功");
      setShowEditDialog(false);
      setEditingAgent(null);
      resetForm();
      await loadAgents();
    } catch (error) {
      console.error("Failed to edit agent:", error);
      toast.error("更新智能体失败");
    } finally {
      setSaving(false);
    }
  }, [client, editingAgent, formData, loadAgents, resetForm, validateAvatarUrl]);

  // 删除智能体
  const handleDeleteAgent = useCallback(async () => {
    if (!client || !deletingAgent) return;

    setSaving(true);
    try {
      // 使用 agents.delete RPC
      await client.agentsDelete(deletingAgent.id);

      toast.success("智能体删除成功");
      setShowDeleteDialog(false);
      setDeletingAgent(null);
      await loadAgents();
    } catch (error) {
      console.error("Failed to delete agent:", error);
      toast.error("删除智能体失败");
    } finally {
      setSaving(false);
    }
  }, [client, deletingAgent, loadAgents]);

  // 未连接时显示提示
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">智能体管理</h2>
          <p className="text-sm text-muted-foreground">管理 OpenClaw 智能体配置</p>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
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
          <h2 className="text-lg font-semibold text-foreground mb-1">智能体管理</h2>
          <p className="text-sm text-muted-foreground">管理 OpenClaw 智能体配置</p>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>加载智能体列表中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题和添加按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">智能体管理</h2>
          <p className="text-sm text-muted-foreground">管理 OpenClaw 智能体配置</p>
        </div>
        <button
          onClick={openAddDialog}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加智能体
        </button>
      </div>

      {/* 智能体列表 */}
      {agents.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>暂无智能体，点击上方按钮添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const isDefault = agent.id === defaultAgentId;
            return (
              <div
                key={agent.id}
                className={`rounded-lg border overflow-hidden ${
                  isDefault
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Emoji/Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl overflow-hidden">
                    {agent.identity?.avatar ? (
                      <img
                        src={client?.resolveAvatarUrl(agent.id, agent.identity.avatar) || agent.identity.avatar}
                        alt={agent.identity?.name || "Avatar"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      agent.identity?.emoji || agent.identity?.name?.charAt(0)?.toUpperCase() || "?"
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {agent.identity?.name || agent.id}
                      </span>
                      {isDefault && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-primary/20 text-primary">
                          <Star className="w-3 h-3" />
                          默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{agent.id}</span>
                      {agent.model && (
                        <>
                          <span>·</span>
                          <span>{agent.model}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEditDialog(agent)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openDeleteDialog(agent)}
                      disabled={isDefault}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 添加智能体对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">添加智能体</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              创建新的 OpenClaw 智能体
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 智能体 ID */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                智能体 ID <span className="text-destructive">*</span>
              </label>
              <Input
                value={formData.id}
                onChange={(e) => handleIdChange(e.target.value)}
                placeholder="my-agent"
                className={`bg-muted border-border text-foreground font-mono ${
                  formData.id && !idValidation.isValid
                    ? "border-destructive focus-visible:ring-destructive"
                    : ""
                }`}
              />
              {/* ID 验证反馈 */}
              {formData.id && (
                <div className="space-y-1">
                  {/* 预览 normalize 结果 */}
                  <div className="flex items-center gap-1.5 text-xs">
                    {idValidation.isValid && !idValidation.isReserved ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                    <span className="text-muted-foreground">
                      ID: <span className="font-mono text-foreground">{idPreview}</span>
                    </span>
                  </div>
                  {/* 错误信息 */}
                  {!idValidation.isValid && formData.id.trim() && (
                    <p className="text-xs text-destructive">
                      格式无效：仅支持小写字母、数字、连字符，且不能以连字符开头/结尾
                    </p>
                  )}
                  {idValidation.isReserved && (
                    <p className="text-xs text-destructive">
                      不能使用保留字 &quot;main&quot;
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                小写字母、数字、连字符，最长64字符
              </p>
            </div>

            {/* 显示名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                显示名称
              </label>
              <Input
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="可选，用于界面显示的友好名称"
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                留空则使用 ID 作为显示名称
              </p>
            </div>

            {/* 头像上传 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">头像</label>
              <div className="flex items-center gap-3">
                {/* 预览区域 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  ) : formData.emoji ? (
                    <span className="text-xl">{formData.emoji}</span>
                  ) : (
                    <span className="text-muted-foreground text-lg">?</span>
                  )}
                </div>
                {/* 上传按钮和文本输入 */}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      className="border-border text-foreground hover:bg-muted"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      上传图片
                    </Button>
                    {formData.avatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAvatar}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG/JPG/WebP，最大 128×128px，100KB
                  </p>
                </div>
              </div>
              {/* Fallback: 文本输入 (emoji 或 URL) */}
              <Input
                value={formData.emoji}
                onChange={(e) => {
                  const value = e.target.value;
                  // Check if input looks like a URL
                  if (value.startsWith("https://") || value.startsWith("data:")) {
                    const validatedUrl = validateAvatarUrl(value);
                    if (validatedUrl) {
                      setFormData((prev) => ({
                        ...prev,
                        emoji: "",
                        avatar: validatedUrl,
                      }));
                    } else {
                      // Invalid URL - keep as emoji text (will be rejected on submit or show error)
                      setFormData((prev) => ({
                        ...prev,
                        emoji: value,
                        avatar: "",
                      }));
                    }
                  } else {
                    // Regular emoji or text
                    setFormData((prev) => ({
                      ...prev,
                      emoji: value,
                      avatar: "",
                    }));
                  }
                }}
                placeholder="或直接输入 emoji / 头像 URL"
                className="bg-muted border-border text-foreground text-sm"
              />
            </div>

            {/* 模型选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                模型 <span className="text-destructive">*</span>
              </label>
              {modelsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载模型列表...
                </div>
              ) : availableModels.length === 0 ? (
                <Input
                  value={formData.model}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, model: e.target.value }))
                  }
                  placeholder="anthropic/claude-sonnet-4-20250514"
                  className="bg-muted border-border text-foreground font-mono text-sm"
                />
              ) : (
                <Select
                  value={formData.model}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, model: value || "" }))
                  }
                >
                  <SelectTrigger className="bg-muted border-border text-foreground font-mono text-sm">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem
                        key={getModelValue(model)}
                        value={getModelValue(model)}
                      >
                        {getModelDisplayName(model)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 工作目录 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">工作目录</label>
              <Input
                value={formData.workspace}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, workspace: e.target.value }))
                }
                placeholder="~/.openclaw/workspace-{agentId}"
                className="bg-muted border-border text-foreground font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                留空则默认为 ~/.openclaw/workspace-{`{agentId}`}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={saving}
              className="border-border text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button
              onClick={handleAddAgent}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? "保存中..." : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑智能体对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">编辑智能体</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              修改智能体配置
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 只读 ID 显示 */}
            <div className="px-3 py-2 bg-muted/50 rounded-md border border-border">
              <span className="text-xs text-muted-foreground">ID: </span>
              <span className="text-xs font-mono text-muted-foreground">{formData.id}</span>
            </div>

            {/* 显示名称 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                显示名称
              </label>
              <Input
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="可选，用于界面显示的友好名称"
                className="bg-muted border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                留空则使用 ID 作为显示名称
              </p>
            </div>

            {/* 头像上传 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">头像</label>
              <div className="flex items-center gap-3">
                {/* 预览区域 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center overflow-hidden">
                  {formData.avatar ? (
                    <img
                      src={formData.avatar}
                      alt="预览"
                      className="w-full h-full object-cover"
                    />
                  ) : formData.emoji ? (
                    <span className="text-xl">{formData.emoji}</span>
                  ) : (
                    <span className="text-muted-foreground text-lg">?</span>
                  )}
                </div>
                {/* 上传按钮和文本输入 */}
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      className="border-border text-foreground hover:bg-muted"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      上传图片
                    </Button>
                    {formData.avatar && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAvatar}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG/JPG/WebP，最大 128×128px，100KB
                  </p>
                </div>
              </div>
              {/* Fallback: 文本输入 (emoji 或 URL) */}
              <Input
                value={formData.emoji}
                onChange={(e) => {
                  const value = e.target.value;
                  // Check if input looks like a URL
                  if (value.startsWith("https://") || value.startsWith("data:")) {
                    const validatedUrl = validateAvatarUrl(value);
                    if (validatedUrl) {
                      setFormData((prev) => ({
                        ...prev,
                        emoji: "",
                        avatar: validatedUrl,
                      }));
                    } else {
                      // Invalid URL - keep as emoji text (will be rejected on submit or show error)
                      setFormData((prev) => ({
                        ...prev,
                        emoji: value,
                        avatar: "",
                      }));
                    }
                  } else {
                    // Regular emoji or text
                    setFormData((prev) => ({
                      ...prev,
                      emoji: value,
                      avatar: "",
                    }));
                  }
                }}
                placeholder="或直接输入 emoji / 头像 URL"
                className="bg-muted border-border text-foreground text-sm"
              />
            </div>

            {/* 模型选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                模型 <span className="text-destructive">*</span>
              </label>
              {modelsLoading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载模型列表...
                </div>
              ) : availableModels.length === 0 ? (
                <Input
                  value={formData.model}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, model: e.target.value }))
                  }
                  placeholder="anthropic/claude-sonnet-4-20250514"
                  className="bg-muted border-border text-foreground font-mono text-sm"
                />
              ) : (
                <Select
                  value={formData.model}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, model: value || "" }))
                  }
                >
                  <SelectTrigger className="bg-muted border-border text-foreground font-mono text-sm">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem
                        key={getModelValue(model)}
                        value={getModelValue(model)}
                      >
                        {getModelDisplayName(model)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* 只读工作目录显示 */}
            <div className="px-3 py-2 bg-muted/50 rounded-md border border-border">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-muted-foreground">工作目录: </span>
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {formData.workspace || "（默认）"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
              className="border-border text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button
              onClick={handleEditAgent}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">确认删除智能体</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              确定要删除智能体 &ldquo;{deletingAgent?.identity?.name || deletingAgent?.id}&rdquo; ({deletingAgent?.id})
              吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={saving}
              className="border-border text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAgent}
              disabled={saving}
              className="bg-destructive hover:bg-destructive text-white"
            >
              {saving ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

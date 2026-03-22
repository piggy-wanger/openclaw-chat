"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { useGateway } from "@/hooks/useGateway";
import type { Group, GroupMember } from "@/lib/types";

type GroupSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
  onGroupUpdated?: () => void;
};

type GroupDetailResponse = {
  group: Group;
};

type GroupMembersResponse = {
  members: GroupMember[];
};

type AgentIdentity = {
  name?: string;
  emoji?: string;
};

type Agent = {
  id: string;
  identity?: AgentIdentity;
};

export function GroupSettingsDialog({
  open,
  onOpenChange,
  groupId,
  onGroupUpdated,
}: GroupSettingsDialogProps) {
  const { client, isConnected } = useGateway();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  const [groupName, setGroupName] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const [loading, setLoading] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  const availableAgents = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.agentId));
    return agents.filter((agent) => !memberIds.has(agent.id));
  }, [agents, members]);

  const loadData = async () => {
    if (!open || !groupId) return;

    setLoading(true);
    try {
      const [groupRes, membersRes, configRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`, { cache: "no-store" }),
        fetch(`/api/groups/${groupId}/members`, { cache: "no-store" }),
        isConnected ? client.configGet() : Promise.resolve(null),
      ]);

      if (!groupRes.ok || !membersRes.ok) {
        throw new Error("Failed to load group settings");
      }

      const groupData = (await groupRes.json()) as GroupDetailResponse;
      const membersData = (await membersRes.json()) as GroupMembersResponse;

      setGroup(groupData.group ?? null);
      setGroupName(groupData.group?.name ?? "");
      setMembers(Array.isArray(membersData.members) ? membersData.members : []);

      const config = (configRes?.config as { agents?: { list?: Agent[] } } | undefined) ?? undefined;
      setAgents(config?.agents?.list ?? []);
    } catch (err) {
      console.error("[GroupSettingsDialog] Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadData();
  }, [open, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      setGroup(null);
      setMembers([]);
      setAgents([]);
      setGroupName("");
      setSelectedAgentId("");
      setLoading(false);
      setUpdatingName(false);
      setAddingMember(false);
      setRemovingAgentId(null);
      setDeletingGroup(false);
    }
  }, [open]);

  const handleSaveGroupName = async () => {
    if (!groupId || !group) return;

    const trimmed = groupName.trim();
    if (!trimmed || trimmed === group.name) {
      return;
    }

    setUpdatingName(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update group name: ${res.status}`);
      }

      setGroup((prev) => (prev ? { ...prev, name: trimmed, updatedAt: Date.now() } : prev));
      onGroupUpdated?.();
    } catch (err) {
      console.error("[GroupSettingsDialog] Failed to update group name:", err);
    } finally {
      setUpdatingName(false);
    }
  };

  const handleAddMember = async () => {
    if (!groupId || !selectedAgentId) return;

    const agent = availableAgents.find((item) => item.id === selectedAgentId);
    if (!agent) return;

    setAddingMember(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          name: agent.identity?.name || agent.id,
          emoji: agent.identity?.emoji,
          role: "member",
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to add member: ${res.status}`);
      }

      setSelectedAgentId("");
      await loadData();
      onGroupUpdated?.();
    } catch (err) {
      console.error("[GroupSettingsDialog] Failed to add member:", err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (agentId: string) => {
    if (!groupId) return;

    setRemovingAgentId(agentId);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/members?agentId=${encodeURIComponent(agentId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error(`Failed to remove member: ${res.status}`);
      }

      await loadData();
      onGroupUpdated?.();
    } catch (err) {
      console.error("[GroupSettingsDialog] Failed to remove member:", err);
    } finally {
      setRemovingAgentId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !group) return;

    const confirmed = window.confirm(`确认删除群组「${group.name}」吗？此操作不可撤销。`);
    if (!confirmed) return;

    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete group: ${res.status}`);
      }

      onOpenChange(false);
      onGroupUpdated?.();
    } catch (err) {
      console.error("[GroupSettingsDialog] Failed to delete group:", err);
    } finally {
      setDeletingGroup(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">群组设置</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            编辑群组名称并管理成员
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">群组名称</label>
              <div className="flex items-center gap-2">
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="输入群组名称..."
                  className="bg-muted border-border text-foreground"
                />
                <Button
                  onClick={() => {
                    void handleSaveGroupName();
                  }}
                  disabled={
                    updatingName || !group || !groupName.trim() || groupName.trim() === group.name
                  }
                >
                  {updatingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">成员列表</label>
              <ScrollArea className="h-[180px] rounded-md border border-border bg-muted">
                <div className="p-2 space-y-1">
                  {members.length === 0 ? (
                    <div className="px-2 py-4 text-muted-foreground text-center text-sm">
                      暂无成员
                    </div>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 px-2 py-2 rounded-md"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{member.emoji || "🤖"}</span>
                          <span className="text-sm text-foreground truncate">{member.name}</span>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {member.role}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            void handleRemoveMember(member.agentId);
                          }}
                          disabled={removingAgentId === member.agentId}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          {removingAgentId === member.agentId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">添加成员</label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="flex-1 h-8 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground"
                >
                  <option value="">选择智能体...</option>
                  {availableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.identity?.emoji ? `${agent.identity.emoji} ` : ""}
                      {agent.identity?.name || agent.id}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => {
                    void handleAddMember();
                  }}
                  disabled={!selectedAgentId || addingMember}
                >
                  {addingMember ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  添加
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              void handleDeleteGroup();
            }}
            disabled={loading || deletingGroup || !groupId}
            className="mr-auto"
          >
            {deletingGroup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            删除群组
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

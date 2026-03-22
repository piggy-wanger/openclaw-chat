"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GroupMember, Session } from "@/lib/types";
import { extractSessionDisplayName } from "@/hooks/useSession";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export function SessionItem({
  session,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: SessionItemProps) {
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newTitle, setNewTitle] = useState(session.title);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  const relativeTime = formatDistanceToNow(session.updatedAt, {
    addSuffix: true,
    locale: zhCN,
  });

  useEffect(() => {
    let cancelled = false;

    if (session.type !== "group" || !session.groupId) {
      return;
    }

    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/groups/${session.groupId}/members`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { members?: GroupMember[] };
        if (!cancelled) {
          setGroupMembers(Array.isArray(data.members) ? data.members : []);
        }
      } catch {
        if (!cancelled) {
          setGroupMembers([]);
        }
      }
    };

    void fetchMembers();

    return () => {
      cancelled = true;
    };
  }, [session.groupId, session.type]);

  const handleRename = () => {
    if (newTitle.trim() && newTitle !== session.title) {
      onRename(newTitle.trim());
    }
    setShowRenameDialog(false);
    setDropdownOpen(false);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteDialog(false);
    setDropdownOpen(false);
  };

  const handleOpenRename = () => {
    setNewTitle(session.title);
    setShowRenameDialog(true);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors w-full text-left",
          isActive
            ? "bg-muted text-foreground"
            : "hover:bg-muted/50 text-foreground"
        )}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {session.type === "group" && (
          <div className="shrink-0">
            {groupMembers.length > 0 ? (
              <AvatarGroup className="*:data-[slot=avatar]:size-5 *:data-[slot=avatar]:text-[10px]">
                {groupMembers.slice(0, 3).map((member) => (
                  <Avatar key={member.id} size="sm" className="size-5">
                    <AvatarFallback>{member.emoji || member.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {session.id.startsWith("temp-") ? session.title : extractSessionDisplayName(session.id)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>{relativeTime}</span>
            {session.type === "group" && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px] leading-none">
                {groupMembers.length}
              </Badge>
            )}
          </div>
        </div>
        <div
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isActive && "opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger aria-label="会话操作" className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted transition-colors">
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenRename}>
                <Pencil className="h-4 w-4 mr-2" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名会话</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="输入新标题"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button onClick={handleRename}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            确定要删除会话 &quot;{session.title}&quot; 吗？此操作无法撤销。
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              取消
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

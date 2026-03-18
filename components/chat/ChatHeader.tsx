"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Session } from "@/lib/types";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

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
  const title = currentSession?.title || "OpenClaw Chat";
  const currentModel = currentSession?.model || AVAILABLE_MODELS[0].value;

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-3">
        {/* Toggle Sidebar Button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label="打开侧边栏"
            className="text-zinc-400 hover:text-white"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        )}
        <h2 className="text-lg font-medium text-white truncate max-w-[300px]">
          {title}
        </h2>
      </div>

      {/* Model Selector */}
      {currentSession && (
        <Select value={currentModel} onValueChange={onModelChange}>
          <SelectTrigger className="w-[180px] bg-zinc-800 border-zinc-700 text-zinc-300">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </header>
  );
}

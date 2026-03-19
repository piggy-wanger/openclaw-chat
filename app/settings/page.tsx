"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Wifi,
  Brain,
  Bot,
  Palette,
  MessageSquare,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsForm, type SettingsCategory } from "@/components/settings/SettingsForm";
import { SessionProvider } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { key: SettingsCategory; label: string; icon: typeof Wifi }[] = [
  { key: "connection", label: "连接", icon: Wifi },
  { key: "model", label: "模型与 API", icon: Brain },
  { key: "agent", label: "智能体", icon: Bot },
  { key: "appearance", label: "外观", icon: Palette },
  { key: "session", label: "会话", icon: MessageSquare },
  { key: "about", label: "关于", icon: Info },
];

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("connection");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" aria-label="返回主页">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">设置</h1>
        </div>

        {/* Body */}
        <SessionProvider>
          {/* Mobile Nav: horizontal tabs */}
          <div className="flex md:hidden border-b border-border overflow-x-auto mb-6 -mx-4 px-4">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeCategory === key
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Main Card */}
          <div className="bg-card rounded-xl border border-border overflow-hidden flex" style={{ height: "calc(100vh - 12rem)" }}>
            {/* Sidebar Navigation (desktop) */}
            <nav className="hidden md:flex flex-col w-[180px] min-w-[180px] border-r border-border py-2">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left",
                    activeCategory === key
                      ? "text-foreground bg-muted/80 border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <SettingsForm activeCategory={activeCategory} />
            </div>
          </div>
        </SessionProvider>
      </div>
    </div>
  );
}

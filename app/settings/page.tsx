"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Wifi,
  Brain,
  Palette,
  MessageSquare,
  Key,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsForm, type SettingsCategory } from "@/components/settings/SettingsForm";
import { SessionProvider } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { key: SettingsCategory; label: string; icon: typeof Wifi }[] = [
  { key: "connection", label: "连接", icon: Wifi },
  { key: "model", label: "模型", icon: Brain },
  { key: "appearance", label: "外观", icon: Palette },
  { key: "session", label: "会话", icon: MessageSquare },
  { key: "api", label: "API", icon: Key },
  { key: "about", label: "关于", icon: Info },
];

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("connection");

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" aria-label="返回主页">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-white">设置</h1>
        </div>

        {/* Body */}
        <SessionProvider>
          {/* Mobile Nav: horizontal tabs */}
          <div className="flex md:hidden border-b border-zinc-800 overflow-x-auto mb-6 -mx-4 px-4">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                  activeCategory === key
                    ? "text-white border-blue-500"
                    : "text-zinc-400 border-transparent hover:text-zinc-200"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Main Card */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex">
            {/* Sidebar Navigation (desktop) */}
            <nav className="hidden md:flex flex-col w-[180px] min-w-[180px] border-r border-zinc-800 py-2">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left",
                    activeCategory === key
                      ? "text-white bg-zinc-800/80 border-r-2 border-blue-500"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              <SettingsForm activeCategory={activeCategory} />
            </div>
          </div>
        </SessionProvider>
      </div>
    </div>
  );
}

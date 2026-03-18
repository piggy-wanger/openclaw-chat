"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { SessionProvider } from "@/hooks/useSession";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
        <Link href="/" aria-label="返回主页">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
          <h1 className="text-2xl font-bold text-white">设置</h1>
        </div>

        {/* Settings Form */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
          <SessionProvider>
            <SettingsForm />
          </SessionProvider>
        </div>
      </div>
    </div>
  );
}

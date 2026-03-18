"use client";

import { useSettings, type FontSize } from "@/hooks/useSettings";
import { useGateway, type GatewayStatus } from "@/hooks/useGateway";
import { useSession } from "@/hooks/useSession";
import { ConnectionSettings } from "./ConnectionSettings";
import { ModelSettings } from "./ModelSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { SessionSettings } from "./SessionSettings";
import { AboutSettings } from "./AboutSettings";

const AVAILABLE_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

export type SettingsCategory = "connection" | "model" | "appearance" | "session" | "about";

type SettingsFormInnerProps = {
  activeCategory: SettingsCategory;
  initialGatewayUrl: string;
  initialGatewayToken: string;
  initialDefaultModel: string | null;
  initialMessageFontSize: FontSize;
  initialCodeFontSize: FontSize;
  setSettings: (settings: Partial<{
    gatewayUrl: string;
    gatewayToken: string;
    default_model: string;
    api_url: string;
    api_key: string;
    theme: "light" | "dark" | "system";
    sidebarCollapsed: boolean;
    messageFontSize: FontSize;
    codeFontSize: FontSize;
  }>) => void;
  updateSettings: (settings: Record<string, string>) => Promise<boolean>;
  status: GatewayStatus;
  connect: (url: string, token: string) => Promise<void>;
  client: typeof import("@/lib/gateway").gateway;
};

function SettingsFormInner({
  activeCategory,
  initialGatewayUrl,
  initialGatewayToken,
  initialDefaultModel,
  initialMessageFontSize,
  initialCodeFontSize,
  setSettings,
  updateSettings,
  status,
  connect,
  client,
}: SettingsFormInnerProps) {
  const { sessions, fetchSessions } = useSession();

  const renderContent = () => {
    switch (activeCategory) {
      case "connection":
        return (
          <ConnectionSettings
            gatewayUrl={initialGatewayUrl}
            gatewayToken={initialGatewayToken}
            status={status}
            setSettings={setSettings}
            connect={connect}
          />
        );
      case "model":
        return (
          <ModelSettings
            defaultModel={initialDefaultModel}
            updateSettings={updateSettings}
            client={client}
            gatewayStatus={status}
          />
        );
      case "appearance":
        return (
          <AppearanceSettings
            messageFontSize={initialMessageFontSize}
            codeFontSize={initialCodeFontSize}
            setSettings={setSettings}
          />
        );
      case "session":
        return (
          <SessionSettings
            sessions={sessions}
            fetchSessions={fetchSessions}
          />
        );
      case "about":
        return <AboutSettings status={status} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      {renderContent()}
    </div>
  );
}

export function SettingsForm({ activeCategory }: { activeCategory: SettingsCategory }) {
  const { settings, setSettings, updateSettings, loading } = useSettings();
  const { status, connect, client } = useGateway();

  // 加载中显示占位内容
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-zinc-800 animate-pulse rounded w-32" />
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
        <div className="h-10 bg-zinc-800 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <SettingsFormInner
      activeCategory={activeCategory}
      initialGatewayUrl={settings.gatewayUrl || ""}
      initialGatewayToken={settings.gatewayToken || ""}
      initialDefaultModel={settings.default_model || AVAILABLE_MODELS[0].value}
      initialMessageFontSize={settings.messageFontSize}
      initialCodeFontSize={settings.codeFontSize}
      setSettings={setSettings}
      updateSettings={updateSettings}
      status={status}
      connect={connect}
      client={client}
    />
  );
}

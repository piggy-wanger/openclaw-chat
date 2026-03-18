"use client";

import { type ReactNode } from "react";
import { SettingsProvider } from "@/hooks/useSettings";
import { GatewayProvider } from "@/hooks/useGateway";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <GatewayProvider>{children}</GatewayProvider>
    </SettingsProvider>
  );
}

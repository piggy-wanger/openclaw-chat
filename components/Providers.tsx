"use client";

import { type ReactNode } from "react";
import { ThemeProvider } from "@/lib/theme/context";
import { SettingsProvider } from "@/hooks/useSettings";
import { GatewayProvider } from "@/hooks/useGateway";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <GatewayProvider>{children}</GatewayProvider>
      </SettingsProvider>
      <Toaster />
    </ThemeProvider>
  );
}

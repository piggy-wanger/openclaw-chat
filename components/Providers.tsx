"use client";

import { type ReactNode } from "react";
import { SettingsProvider } from "@/hooks/useSettings";

export function Providers({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

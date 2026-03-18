"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPut } from "@/lib/api";
import type { SettingsResponse, SettingsRequest } from "@/lib/types";

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<SettingsResponse>("/settings");
      setSettings(response.settings);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch settings";
      setError(message);
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Record<string, string>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiPut<SettingsResponse>("/settings", {
        settings: newSettings,
      } as SettingsRequest);
      setSettings(response.settings);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
      console.error("Error updating settings:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSetting = useCallback(
    (key: string): string | undefined => {
      return settings[key];
    },
    [settings]
  );

  // 组件挂载时自动获取设置
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
    getSetting,
  };
}

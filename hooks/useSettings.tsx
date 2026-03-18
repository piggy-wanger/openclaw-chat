"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// 默认 Gateway URL
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

// Font size types
export type FontSize = "small" | "medium" | "large";

// Valid FontSize values for runtime validation
const VALID_FONT_SIZES: readonly FontSize[] = ["small", "medium", "large"];

// Type guard for FontSize
function isValidFontSize(value: string | null): value is FontSize {
  return value !== null && VALID_FONT_SIZES.includes(value as FontSize);
}

// Parse FontSize with fallback
function parseFontSize(value: string | null, fallback: FontSize = "medium"): FontSize {
  return isValidFontSize(value) ? value : fallback;
}

// localStorage keys
const STORAGE_KEYS = {
  gatewayUrl: "openclaw_gateway_url",
  gatewayToken: "openclaw_gateway_token",
  defaultModel: "openclaw_default_model",
  apiUrl: "openclaw_api_url",
  apiKey: "openclaw_api_key",
  theme: "openclaw_theme",
  sidebarCollapsed: "openclaw_sidebar_collapsed",
  messageFontSize: "openclaw_message_font_size",
  codeFontSize: "openclaw_code_font_size",
} as const;

// Settings 类型（兼容旧版 SettingsForm）
export type Settings = {
  gatewayUrl: string;
  gatewayToken: string;
  default_model: string;
  api_url: string;
  api_key: string;
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  messageFontSize: FontSize;
  codeFontSize: FontSize;
};

// 兼容旧版 SettingsForm 的 settings 类型
export type LegacySettings = Record<string, string>;

// Context 类型
type SettingsContextType = {
  settings: Settings;
  loading: boolean;
  setSettings: (settings: Partial<Settings>) => void;
  updateSettings: (settings: LegacySettings) => Promise<boolean>;
  resetSettings: () => void;
};

// 默认设置
const defaultSettings: Settings = {
  gatewayUrl: DEFAULT_GATEWAY_URL,
  gatewayToken: "",
  default_model: "",
  api_url: "",
  api_key: "",
  theme: "dark",
  sidebarCollapsed: false,
  messageFontSize: "medium",
  codeFontSize: "medium",
};

// Context
const SettingsContext = createContext<SettingsContextType | null>(null);

// Provider
export function SettingsProvider({ children }: { children: ReactNode }) {
  // 惰性初始化：从 localStorage 读取
  const [settings, setSettingsState] = useState<Settings>(() => {
    // 检查是否在浏览器环境
    if (typeof window === "undefined") {
      return defaultSettings;
    }

    return {
      gatewayUrl:
        localStorage.getItem(STORAGE_KEYS.gatewayUrl) || DEFAULT_GATEWAY_URL,
      gatewayToken: localStorage.getItem(STORAGE_KEYS.gatewayToken) || "",
      default_model: localStorage.getItem(STORAGE_KEYS.defaultModel) || "",
      api_url: localStorage.getItem(STORAGE_KEYS.apiUrl) || "",
      api_key: localStorage.getItem(STORAGE_KEYS.apiKey) || "",
      theme:
        (localStorage.getItem(STORAGE_KEYS.theme) as Settings["theme"]) ||
        "dark",
      sidebarCollapsed:
        localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "true",
      messageFontSize: parseFontSize(
        localStorage.getItem(STORAGE_KEYS.messageFontSize)
      ),
      codeFontSize: parseFontSize(
        localStorage.getItem(STORAGE_KEYS.codeFontSize)
      ),
    };
  });

  // 更新设置（新 API）
  const setSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };

      // 同步到 localStorage
      if (typeof window !== "undefined") {
        if (newSettings.gatewayUrl !== undefined) {
          localStorage.setItem(STORAGE_KEYS.gatewayUrl, newSettings.gatewayUrl);
        }
        if (newSettings.gatewayToken !== undefined) {
          localStorage.setItem(
            STORAGE_KEYS.gatewayToken,
            newSettings.gatewayToken
          );
        }
        if (newSettings.default_model !== undefined) {
          localStorage.setItem(STORAGE_KEYS.defaultModel, newSettings.default_model);
        }
        if (newSettings.api_url !== undefined) {
          localStorage.setItem(STORAGE_KEYS.apiUrl, newSettings.api_url);
        }
        if (newSettings.api_key !== undefined) {
          localStorage.setItem(STORAGE_KEYS.apiKey, newSettings.api_key);
        }
        if (newSettings.theme !== undefined) {
          localStorage.setItem(STORAGE_KEYS.theme, newSettings.theme);
        }
        if (newSettings.sidebarCollapsed !== undefined) {
          localStorage.setItem(
            STORAGE_KEYS.sidebarCollapsed,
            String(newSettings.sidebarCollapsed)
          );
        }
        if (newSettings.messageFontSize !== undefined) {
          localStorage.setItem(
            STORAGE_KEYS.messageFontSize,
            newSettings.messageFontSize
          );
        }
        if (newSettings.codeFontSize !== undefined) {
          localStorage.setItem(
            STORAGE_KEYS.codeFontSize,
            newSettings.codeFontSize
          );
        }
      }

      return updated;
    });
  }, []);

  // 兼容旧版 SettingsForm 的 updateSettings API
  const updateSettings = useCallback(
    async (legacySettings: LegacySettings): Promise<boolean> => {
      try {
        // 映射旧版字段到新版
        const newSettings: Partial<Settings> = {};

        if (legacySettings.default_model !== undefined) {
          newSettings.default_model = legacySettings.default_model;
        }
        if (legacySettings.api_url !== undefined) {
          newSettings.api_url = legacySettings.api_url;
        }
        if (legacySettings.api_key !== undefined) {
          newSettings.api_key = legacySettings.api_key;
        }

        if (Object.keys(newSettings).length > 0) {
          setSettings(newSettings);
        }

        return true;
      } catch {
        return false;
      }
    },
    [setSettings]
  );

  // 重置设置
  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEYS.gatewayUrl, DEFAULT_GATEWAY_URL);
      localStorage.setItem(STORAGE_KEYS.gatewayToken, "");
      localStorage.setItem(STORAGE_KEYS.defaultModel, "");
      localStorage.setItem(STORAGE_KEYS.apiUrl, "");
      localStorage.setItem(STORAGE_KEYS.apiKey, "");
      localStorage.setItem(STORAGE_KEYS.theme, "dark");
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, "false");
      localStorage.setItem(STORAGE_KEYS.messageFontSize, "medium");
      localStorage.setItem(STORAGE_KEYS.codeFontSize, "medium");
    }
  }, []);

  // localStorage 模式不需要 loading 状态
  const loading = false;

  return (
    <SettingsContext.Provider
      value={{ settings, loading, setSettings, updateSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// Hook
export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

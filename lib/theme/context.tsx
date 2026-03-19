"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ThemeFamilyMeta, ThemeMode } from "./types";
import { getThemeFamilyMetas, getThemeFamily, getFallbackColors, applyThemeColors } from "./loader";

// LocalStorage keys
const THEME_FAMILY_KEY = "openclaw-chat-theme-family";
const THEME_MODE_KEY = "openclaw-chat-theme-mode";

// Default theme (tokyo-night as per requirements)
const DEFAULT_FAMILY_ID = "tokyo-night";

/** Theme context value. */
export interface ThemeContextValue {
  /** Current theme family ID. */
  familyId: string;
  /** Current mode (light/dark/system). */
  mode: ThemeMode;
  /** Resolved mode (system -> actual light/dark). */
  resolvedMode: "light" | "dark";
  /** Available theme families. */
  families: ThemeFamilyMeta[];
  /** Set theme family. */
  setFamily: (id: string) => void;
  /** Set theme mode. */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark. */
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Hook to access theme context. */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/** Theme provider props. */
interface ThemeProviderProps {
  children: ReactNode;
  /** Default family ID if not set in localStorage. */
  defaultFamilyId?: string;
}

/** Theme provider component. */
export function ThemeProvider({
  children,
  defaultFamilyId = DEFAULT_FAMILY_ID,
}: ThemeProviderProps) {
  // Available families (static)
  const families = useMemo(() => getThemeFamilyMetas(), []);

  // State for current family and mode
  const [familyId, setFamilyIdState] = useState<string>(defaultFamilyId);
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  // Resolve system preference
  const getSystemPreference = useCallback((): "light" | "dark" => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Resolved mode
  const resolvedMode = mode === "system" ? getSystemPreference() : mode;

  // Load saved preferences on mount
  useEffect(() => {
    const savedFamily = localStorage.getItem(THEME_FAMILY_KEY);
    const savedMode = localStorage.getItem(THEME_MODE_KEY) as ThemeMode | null;

    if (savedFamily && families.some((f) => f.id === savedFamily)) {
      setFamilyIdState(savedFamily);
    }

    if (savedMode && ["light", "dark", "system"].includes(savedMode)) {
      setModeState(savedMode);
    }

    setMounted(true);
  }, [families]);

  // Listen for system preference changes
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      // Force re-render to update resolvedMode
      setModeState("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  // Apply theme colors when family or mode changes
  useEffect(() => {
    if (!mounted) return;

    const family = getThemeFamily(familyId);
    if (family) {
      const colors = resolvedMode === "light" ? family.light : family.dark;
      applyThemeColors(colors);
    } else {
      // Fallback to default colors
      applyThemeColors(getFallbackColors(resolvedMode));
    }
  }, [familyId, resolvedMode, mounted]);

  // Update document class for light/dark mode
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    if (resolvedMode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [resolvedMode, mounted]);

  // Set theme family
  const setFamily = useCallback(
    (id: string) => {
      if (families.some((f) => f.id === id)) {
        setFamilyIdState(id);
        localStorage.setItem(THEME_FAMILY_KEY, id);
      }
    },
    [families]
  );

  // Set theme mode
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
  }, []);

  // Toggle between light and dark
  const toggleMode = useCallback(() => {
    const newMode = resolvedMode === "dark" ? "light" : "dark";
    setModeState(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
  }, [resolvedMode]);

  // Context value
  const value: ThemeContextValue = useMemo(
    () => ({
      familyId,
      mode,
      resolvedMode,
      families,
      setFamily,
      setMode,
      toggleMode,
    }),
    [familyId, mode, resolvedMode, families, setFamily, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

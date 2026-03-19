"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { ThemeFamilyMeta, ThemeMode } from "./types";
import { getThemeFamilyMetas, getThemeFamily, getFallbackColors, applyThemeColors } from "./loader";

// LocalStorage keys
const THEME_FAMILY_KEY = "openclaw-chat-theme-family";
const THEME_MODE_KEY = "openclaw-chat-theme-mode";

// Default theme (tokyo-night as per requirements)
const DEFAULT_FAMILY_ID = "tokyo-night";

// Helper to read initial values from localStorage (safe for SSR)
function getInitialFamilyId(defaultId: string): string {
  if (typeof window === "undefined") return defaultId;
  const saved = localStorage.getItem(THEME_FAMILY_KEY);
  if (saved) {
    const families = getThemeFamilyMetas();
    if (families.some((f) => f.id === saved)) {
      return saved;
    }
  }
  return defaultId;
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(THEME_MODE_KEY);
  if (saved && ["light", "dark", "system"].includes(saved)) {
    return saved as ThemeMode;
  }
  return "dark";
}

// System preference subscription using useSyncExternalStore
function subscribeToSystemPreference(callback: () => void): () => void {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSystemPreferenceSnapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSystemPreferenceServerSnapshot(): "dark" {
  return "dark";
}

// useLayoutEffect that only runs on client (SSR safe)
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  // Initialize state directly from localStorage (avoids lint warning about setState in effect)
  const [familyId, setFamilyIdState] = useState<string>(() => getInitialFamilyId(defaultFamilyId));
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  // Use useSyncExternalStore for system preference (React-recommended pattern)
  const systemPreference = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPreferenceSnapshot,
    getSystemPreferenceServerSnapshot
  );

  // Resolved mode - uses systemPreference which updates on OS changes
  const resolvedMode = mode === "system" ? systemPreference : mode;

  // Apply theme colors using isomorphic layout effect (client-only, before paint)
  useIsomorphicLayoutEffect(() => {
    const family = getThemeFamily(familyId);
    if (family) {
      const colors = resolvedMode === "light" ? family.light : family.dark;
      applyThemeColors(colors);
    } else {
      // Fallback to default colors
      applyThemeColors(getFallbackColors(resolvedMode));
    }
  }, [familyId, resolvedMode]);

  // Update document class for light/dark mode (client-only)
  useIsomorphicLayoutEffect(() => {
    const root = document.documentElement;
    if (resolvedMode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [resolvedMode]);

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

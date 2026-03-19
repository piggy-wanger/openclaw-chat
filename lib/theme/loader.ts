/**
 * Theme loader for client-side usage.
 * Imports all theme JSON files statically for bundling.
 */
import type { ThemeFamily, ThemeFamilyMeta, ThemeColors } from "./types";

// Import all theme JSON files
import defaultTheme from "@/themes/default.json";
import githubTheme from "@/themes/github.json";
import rosePineTheme from "@/themes/rose-pine.json";
import tokyoNightTheme from "@/themes/tokyo-night.json";
import everforestTheme from "@/themes/everforest.json";
import nordTheme from "@/themes/nord.json";
import kanagawaTheme from "@/themes/kanagawa.json";
import nightOwlTheme from "@/themes/night-owl.json";
import poimandresTheme from "@/themes/poimandres.json";
import vesperTheme from "@/themes/vesper.json";
import horizonTheme from "@/themes/horizon.json";
import synthwave84Theme from "@/themes/synthwave84.json";

/** All theme JSON imports. */
const THEME_IMPORTS: ThemeFamily[] = [
  defaultTheme as ThemeFamily,
  githubTheme as ThemeFamily,
  rosePineTheme as ThemeFamily,
  tokyoNightTheme as ThemeFamily,
  everforestTheme as ThemeFamily,
  nordTheme as ThemeFamily,
  kanagawaTheme as ThemeFamily,
  nightOwlTheme as ThemeFamily,
  poimandresTheme as ThemeFamily,
  vesperTheme as ThemeFamily,
  horizonTheme as ThemeFamily,
  synthwave84Theme as ThemeFamily,
];

/** Hardcoded fallback matching globals.css :root values (dark mode). */
const FALLBACK_DARK: ThemeColors = {
  background: "oklch(0.145 0 0)",
  foreground: "oklch(0.985 0 0)",
  card: "oklch(0.205 0 0)",
  cardForeground: "oklch(0.985 0 0)",
  popover: "oklch(0.205 0 0)",
  popoverForeground: "oklch(0.985 0 0)",
  primary: "oklch(0.488 0.243 264.376)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.269 0 0)",
  secondaryForeground: "oklch(0.985 0 0)",
  muted: "oklch(0.269 0 0)",
  mutedForeground: "oklch(0.708 0 0)",
  accent: "oklch(0.269 0 0)",
  accentForeground: "oklch(0.985 0 0)",
  destructive: "oklch(0.704 0.191 22.216)",
  border: "oklch(1 0 0 / 10%)",
  input: "oklch(1 0 0 / 15%)",
  ring: "oklch(0.556 0 0)",
  chart1: "oklch(0.809 0.105 251.813)",
  chart2: "oklch(0.623 0.214 259.815)",
  chart3: "oklch(0.546 0.245 262.881)",
  chart4: "oklch(0.488 0.243 264.376)",
  chart5: "oklch(0.424 0.199 265.638)",
  sidebar: "oklch(0.205 0 0)",
  sidebarForeground: "oklch(0.985 0 0)",
  sidebarPrimary: "oklch(0.488 0.243 264.376)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.269 0 0)",
  sidebarAccentForeground: "oklch(0.985 0 0)",
  sidebarBorder: "oklch(1 0 0 / 10%)",
  sidebarRing: "oklch(0.556 0 0)",
};

const FALLBACK_LIGHT: ThemeColors = {
  background: "oklch(1 0 0)",
  foreground: "oklch(0.145 0 0)",
  card: "oklch(1 0 0)",
  cardForeground: "oklch(0.145 0 0)",
  popover: "oklch(1 0 0)",
  popoverForeground: "oklch(0.145 0 0)",
  primary: "oklch(0.205 0 0)",
  primaryForeground: "oklch(0.985 0 0)",
  secondary: "oklch(0.97 0 0)",
  secondaryForeground: "oklch(0.205 0 0)",
  muted: "oklch(0.97 0 0)",
  mutedForeground: "oklch(0.556 0 0)",
  accent: "oklch(0.97 0 0)",
  accentForeground: "oklch(0.205 0 0)",
  destructive: "oklch(0.577 0.245 27.325)",
  border: "oklch(0.922 0 0)",
  input: "oklch(0.922 0 0)",
  ring: "oklch(0.708 0 0)",
  chart1: "oklch(0.809 0.105 251.813)",
  chart2: "oklch(0.623 0.214 259.815)",
  chart3: "oklch(0.546 0.245 262.881)",
  chart4: "oklch(0.488 0.243 264.376)",
  chart5: "oklch(0.424 0.199 265.638)",
  sidebar: "oklch(0.985 0 0)",
  sidebarForeground: "oklch(0.145 0 0)",
  sidebarPrimary: "oklch(0.205 0 0)",
  sidebarPrimaryForeground: "oklch(0.985 0 0)",
  sidebarAccent: "oklch(0.97 0 0)",
  sidebarAccentForeground: "oklch(0.205 0 0)",
  sidebarBorder: "oklch(0.922 0 0)",
  sidebarRing: "oklch(0.708 0 0)",
};

// Module-level cache
let cachedFamilies: ThemeFamily[] | null = null;

/** Load and validate all theme families from imported JSON files. */
export function getAllThemeFamilies(): ThemeFamily[] {
  if (cachedFamilies) return cachedFamilies;

  const families: ThemeFamily[] = [...THEME_IMPORTS];

  // Ensure a default family always exists
  if (!families.some((f) => f.id === "default")) {
    families.push({
      id: "default",
      label: "Default",
      order: 0,
      light: FALLBACK_LIGHT,
      dark: FALLBACK_DARK,
    });
  }

  families.sort((a, b) => a.order - b.order);
  cachedFamilies = families;
  return families;
}

/** Lightweight metadata for client-side use. */
export function getThemeFamilyMetas(): ThemeFamilyMeta[] {
  return getAllThemeFamilies().map((f) => ({
    id: f.id,
    label: f.label,
    description: f.description,
    previewColors: {
      primaryLight: f.light.primary,
      primaryDark: f.dark.primary,
      accentLight: f.light.accent,
      backgroundLight: f.light.background,
    },
    codeTheme: f.codeTheme,
    shikiTheme: f.shikiTheme,
  }));
}

/** Get a specific theme family by ID. */
export function getThemeFamily(id: string): ThemeFamily | undefined {
  return getAllThemeFamilies().find((f) => f.id === id);
}

/** Get fallback colors for a mode. */
export function getFallbackColors(mode: "light" | "dark"): ThemeColors {
  return mode === "light" ? FALLBACK_LIGHT : FALLBACK_DARK;
}

/** Convert ThemeColors to CSS variable string. */
export function colorsToCSS(colors: ThemeColors): string {
  const cssVarNames: (keyof ThemeColors)[] = [
    "background",
    "foreground",
    "card",
    "cardForeground",
    "popover",
    "popoverForeground",
    "primary",
    "primaryForeground",
    "secondary",
    "secondaryForeground",
    "muted",
    "mutedForeground",
    "accent",
    "accentForeground",
    "destructive",
    "border",
    "input",
    "ring",
    "chart1",
    "chart2",
    "chart3",
    "chart4",
    "chart5",
    "sidebar",
    "sidebarForeground",
    "sidebarPrimary",
    "sidebarPrimaryForeground",
    "sidebarAccent",
    "sidebarAccentForeground",
    "sidebarBorder",
    "sidebarRing",
  ];

  // Convert camelCase to kebab-case
  const toKebab = (str: string): string => {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  };

  return cssVarNames
    .map((key) => `--${toKebab(key)}: ${colors[key]};`)
    .join("\n  ");
}

/** Apply theme colors to document root as CSS variables. */
export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;
  const cssVarNames: (keyof ThemeColors)[] = [
    "background",
    "foreground",
    "card",
    "cardForeground",
    "popover",
    "popoverForeground",
    "primary",
    "primaryForeground",
    "secondary",
    "secondaryForeground",
    "muted",
    "mutedForeground",
    "accent",
    "accentForeground",
    "destructive",
    "border",
    "input",
    "ring",
    "chart1",
    "chart2",
    "chart3",
    "chart4",
    "chart5",
    "sidebar",
    "sidebarForeground",
    "sidebarPrimary",
    "sidebarPrimaryForeground",
    "sidebarAccent",
    "sidebarAccentForeground",
    "sidebarBorder",
    "sidebarRing",
  ];

  // Convert camelCase to kebab-case
  const toKebab = (str: string): string => {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  };

  cssVarNames.forEach((key) => {
    root.style.setProperty(`--${toKebab(key)}`, colors[key]);
  });
}

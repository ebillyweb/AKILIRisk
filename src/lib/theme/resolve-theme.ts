import { AKILIRISK_THEME_STORAGE_KEY, type AkiliriskStoredTheme } from "./constants";

export function readStoredThemePreference(): AkiliriskStoredTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(AKILIRISK_THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* private mode / quota */
  }
  return null;
}

export function resolveThemePreference(): AkiliriskStoredTheme {
  const stored = readStoredThemePreference();
  if (stored) return stored;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeClass(theme: AkiliriskStoredTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

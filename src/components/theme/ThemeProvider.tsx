"use client";

import * as React from "react";
import {
  AKILIRISK_THEME_STORAGE_KEY,
  type AkiliriskStoredTheme,
} from "@/lib/theme/constants";

export type ThemeContextValue = {
  /** Resolved appearance after script + user choice. */
  theme: AkiliriskStoredTheme;
  setTheme: (theme: AkiliriskStoredTheme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readResolvedThemeFromDocument(): AkiliriskStoredTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyThemeClass(theme: AkiliriskStoredTheme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<AkiliriskStoredTheme>("light");

  React.useLayoutEffect(() => {
    setThemeState(readResolvedThemeFromDocument());
  }, []);

  const setTheme = React.useCallback((next: AkiliriskStoredTheme) => {
    applyThemeClass(next);
    try {
      localStorage.setItem(AKILIRISK_THEME_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
    setThemeState(next);
  }, []);

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(AKILIRISK_THEME_STORAGE_KEY);
    } catch {
      return;
    }
    if (stored === "light" || stored === "dark") {
      return;
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: AkiliriskStoredTheme = mql.matches ? "dark" : "light";
      applyThemeClass(next);
      setThemeState(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AKILIRISK_THEME_STORAGE_KEY || e.storageArea !== localStorage) {
        return;
      }
      if (e.newValue === "dark" || e.newValue === "light") {
        applyThemeClass(e.newValue);
        setThemeState(e.newValue);
        return;
      }
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyThemeClass(prefersDark ? "dark" : "light");
      setThemeState(prefersDark ? "dark" : "light");
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = React.useMemo(
    () => ({ theme, setTheme }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

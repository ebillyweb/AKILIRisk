"use client";

import * as React from "react";
import {
  AKILIRISK_THEME_STORAGE_KEY,
  type AkiliriskStoredTheme,
} from "@/lib/theme/constants";
import {
  applyThemeClass,
  readStoredThemePreference,
  resolveThemePreference,
} from "@/lib/theme/resolve-theme";

export type ThemeContextValue = {
  /** Appearance currently applied to the document (may be locked on white-label routes). */
  theme: AkiliriskStoredTheme;
  /** True when a route locked the theme (e.g. advisor white-label portal). */
  themeLocked: boolean;
  setTheme: (theme: AkiliriskStoredTheme) => void;
  lockTheme: (theme: AkiliriskStoredTheme) => void;
  unlockTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferredTheme, setPreferredTheme] =
    React.useState<AkiliriskStoredTheme>("light");
  const [themeLock, setThemeLock] = React.useState<AkiliriskStoredTheme | null>(
    null,
  );
  const displayedTheme = themeLock ?? preferredTheme;

  React.useLayoutEffect(() => {
    setPreferredTheme(resolveThemePreference());
  }, []);

  React.useLayoutEffect(() => {
    applyThemeClass(displayedTheme);
  }, [displayedTheme]);

  const setTheme = React.useCallback(
    (next: AkiliriskStoredTheme) => {
      try {
        localStorage.setItem(AKILIRISK_THEME_STORAGE_KEY, next);
      } catch {
        /* ignore quota / private mode */
      }
      setPreferredTheme(next);
      applyThemeClass(themeLock ?? next);
    },
    [themeLock],
  );

  const lockTheme = React.useCallback((locked: AkiliriskStoredTheme) => {
    setThemeLock(locked);
    applyThemeClass(locked);
  }, []);

  const unlockTheme = React.useCallback(() => {
    setThemeLock(null);
    const next = resolveThemePreference();
    setPreferredTheme(next);
    applyThemeClass(next);
  }, []);

  React.useEffect(() => {
    if (themeLock) return;

    const stored = readStoredThemePreference();
    if (stored) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next: AkiliriskStoredTheme = mql.matches ? "dark" : "light";
      setPreferredTheme(next);
      applyThemeClass(next);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [themeLock]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AKILIRISK_THEME_STORAGE_KEY || e.storageArea !== localStorage) {
        return;
      }
      if (themeLock) return;

      if (e.newValue === "dark" || e.newValue === "light") {
        setPreferredTheme(e.newValue);
        applyThemeClass(e.newValue);
        return;
      }
      const next = resolveThemePreference();
      setPreferredTheme(next);
      applyThemeClass(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [themeLock]);

  const value = React.useMemo(
    () => ({
      theme: displayedTheme,
      themeLocked: themeLock !== null,
      setTheme,
      lockTheme,
      unlockTheme,
    }),
    [displayedTheme, themeLock, setTheme, lockTheme, unlockTheme],
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

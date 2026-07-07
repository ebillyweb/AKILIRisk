"use client";

import { useLayoutEffect } from "react";
import { useOptionalTheme } from "@/components/theme/ThemeProvider";

/** Locks tenant public routes to light mode without clearing the user's saved preference. */
export function TenantPublicThemeLock() {
  const themeContext = useOptionalTheme();
  const lockTheme = themeContext?.lockTheme;
  const unlockTheme = themeContext?.unlockTheme;

  useLayoutEffect(() => {
    if (!lockTheme || !unlockTheme) return;
    lockTheme("light");
    return () => unlockTheme();
  }, [lockTheme, unlockTheme]);

  return null;
}

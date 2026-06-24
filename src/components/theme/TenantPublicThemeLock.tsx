"use client";

import { useLayoutEffect } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

/** Locks tenant public routes to light mode without clearing the user's saved preference. */
export function TenantPublicThemeLock() {
  const { lockTheme, unlockTheme } = useTheme();

  useLayoutEffect(() => {
    lockTheme("light");
    return () => unlockTheme();
  }, [lockTheme, unlockTheme]);

  return null;
}

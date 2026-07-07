"use client";

import { useCallback, useEffect, useState } from "react";

const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = "akilirisk-admin-sidebar-collapsed";

export function useAdminSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(
        window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
      );
    } catch {
      // ignore storage errors
    }
  }, []);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      try {
        window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return { collapsed, setCollapsed, toggle };
}

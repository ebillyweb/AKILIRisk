"use client";

import { useEffect, useState } from "react";
import { useAssessmentStore } from "@/lib/assessment/store";

/**
 * True once zustand persist has rehydrated answers from localStorage (client only).
 */
export function useAssessmentPersistHydrated(): boolean {
  const persistRehydrated = useAssessmentStore((state) => state.persistRehydrated);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (!useAssessmentStore.getState().persistRehydrated) {
      useAssessmentStore.setState({ persistRehydrated: true });
    }
  }, []);

  return isClient && persistRehydrated;
}

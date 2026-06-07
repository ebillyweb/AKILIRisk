"use client";

import { useEffect, useState } from "react";
import { useAssessmentStore } from "@/lib/assessment/store";

/** True once zustand persist has rehydrated answers from localStorage. */
export function useAssessmentPersistHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useAssessmentStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (useAssessmentStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    return useAssessmentStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}

"use client";

import { useEffect, useState } from "react";
import type { ServerAssessmentData } from "@/lib/assessment/store";
import { useAssessmentStore } from "@/lib/assessment/store";

/**
 * Facilitated assessments must always merge server responses into the store.
 * Persisted localStorage can mark the store hydrated with partial stale answers
 * while pillar scores on the hub still show completed from the API.
 */
export function useFacilitatedAssessmentHydration(
  assessmentId: string,
  assessmentData: ServerAssessmentData | undefined,
  assessmentLoading: boolean,
) {
  const setAssessmentId = useAssessmentStore((s) => s.setAssessmentId);
  const loadFromServer = useAssessmentStore((s) => s.loadFromServer);
  const setHydrated = useAssessmentStore((s) => s.setHydrated);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setAssessmentId(assessmentId);
  }, [assessmentId, setAssessmentId]);

  useEffect(() => {
    if (!assessmentData) {
      setSynced(false);
      return;
    }
    loadFromServer(assessmentData, { preferServer: true });
    setHydrated(true);
    setSynced(true);
  }, [assessmentData, loadFromServer, setHydrated]);

  return {
    isReady: !assessmentLoading && !!assessmentData && synced,
  };
}

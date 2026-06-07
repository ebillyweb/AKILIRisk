"use client";

import { useEffect } from "react";
import { useAllPillarQuestions } from "@/lib/hooks/useAssessmentPillars";
import { useAssessmentStore } from "@/lib/assessment/store";

/**
 * Loads all pillar question definitions into the assessment store so branching
 * orphan detection uses the full bank (not an empty list).
 */
export function AssessmentQuestionBankLoader() {
  const { questionsByPillarId, isLoading } = useAllPillarQuestions();
  const setQuestionBank = useAssessmentStore(
    (state) => state.setFamilyGovernanceQuestionBank
  );

  useEffect(() => {
    if (isLoading) return;

    const allQuestions = Array.from(questionsByPillarId.values()).flat();
    if (allQuestions.length === 0) return;

    setQuestionBank(allQuestions);
  }, [questionsByPillarId, isLoading, setQuestionBank]);

  return null;
}

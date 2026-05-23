"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  assessmentPillarDefinitions,
  isAssessmentPillarId,
  normalizePillarSlug,
} from "@/lib/assessment/pillar-registry";
import type { Question } from "@/lib/assessment/types";
import type { Pillar } from "@/lib/assessment/types";

export function useAssessmentPillarDefinitions(): Pillar[] {
  return assessmentPillarDefinitions();
}

export function usePillarQuestions(pillarId: string, enabled = true) {
  const normalized = normalizePillarSlug(pillarId);
  return useQuery<{ pillarId: string; questions: Question[] }>({
    queryKey: ["pillar-questions", normalized],
    queryFn: async () => {
      const res = await fetch(`/api/assessment/pillars/${normalized}/questions`);
      if (!res.ok) throw new Error("Failed to load pillar questions");
      return res.json();
    },
    enabled: enabled && isAssessmentPillarId(normalized),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllPillarQuestions(enabled = true) {
  const pillars = assessmentPillarDefinitions();
  const queries = useQueries({
    queries: pillars.map((p) => ({
      queryKey: ["pillar-questions", p.slug],
      queryFn: async () => {
        const res = await fetch(`/api/assessment/pillars/${p.slug}/questions`);
        if (!res.ok) throw new Error(`Failed to load ${p.slug} questions`);
        return res.json() as Promise<{ pillarId: string; questions: Question[] }>;
      },
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const byPillarId = new Map<string, Question[]>();
  for (const q of queries) {
    if (q.data?.pillarId) {
      byPillarId.set(q.data.pillarId, q.data.questions);
    }
  }

  return {
    questionsByPillarId: byPillarId,
    isLoading: queries.some((q) => q.isLoading),
  };
}

export interface PillarScoreSummary {
  pillar: string;
  score: number;
  riskLevel: string;
}

export function useAssessmentPillarScores(assessmentId: string | null) {
  return useQuery<PillarScoreSummary[]>({
    queryKey: ["assessment-pillar-scores", assessmentId],
    queryFn: async () => {
      const res = await fetch(`/api/assessment/${assessmentId}/pillar-scores`);
      if (!res.ok) throw new Error("Failed to load pillar scores");
      return res.json();
    },
    enabled: !!assessmentId,
    staleTime: 30_000,
  });
}

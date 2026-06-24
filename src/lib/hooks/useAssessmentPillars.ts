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

export type PillarQuestionsQueryOptions = {
  enabled?: boolean;
  facilitatedSessionId?: string;
  assessmentId?: string;
};

function pillarQuestionsQueryString(options?: PillarQuestionsQueryOptions): string {
  const params = new URLSearchParams();
  if (options?.facilitatedSessionId) {
    params.set("facilitatedSessionId", options.facilitatedSessionId);
  }
  if (options?.assessmentId) {
    params.set("assessmentId", options.assessmentId);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function usePillarQuestions(pillarId: string, options?: PillarQuestionsQueryOptions) {
  const normalized = normalizePillarSlug(pillarId);
  const enabled = options?.enabled ?? true;
  const querySuffix = pillarQuestionsQueryString(options);

  return useQuery<{ pillarId: string; questions: Question[] }>({
    queryKey: [
      "pillar-questions",
      normalized,
      options?.facilitatedSessionId,
      options?.assessmentId,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/assessment/pillars/${normalized}/questions${querySuffix}`,
      );
      if (!res.ok) throw new Error("Failed to load pillar questions");
      return res.json();
    },
    enabled: enabled && isAssessmentPillarId(normalized),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllPillarQuestions(options?: PillarQuestionsQueryOptions) {
  const pillars = assessmentPillarDefinitions();
  const enabled = options?.enabled ?? true;
  const querySuffix = pillarQuestionsQueryString(options);

  const queries = useQueries({
    queries: pillars.map((p) => ({
      queryKey: [
        "pillar-questions",
        p.slug,
        options?.facilitatedSessionId,
        options?.assessmentId,
      ],
      queryFn: async () => {
        const res = await fetch(
          `/api/assessment/pillars/${p.slug}/questions${querySuffix}`,
        );
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

export function useAssessmentPillarScores(
  assessmentId: string | null,
  options?: { facilitatedSessionId?: string },
) {
  const facilitatedSessionId = options?.facilitatedSessionId;
  return useQuery<PillarScoreSummary[]>({
    queryKey: ["assessment-pillar-scores", assessmentId, facilitatedSessionId],
    queryFn: async () => {
      const params = facilitatedSessionId
        ? `?facilitatedSessionId=${encodeURIComponent(facilitatedSessionId)}`
        : "";
      const res = await fetch(
        `/api/assessment/${assessmentId}/pillar-scores${params}`,
      );
      if (!res.ok) throw new Error("Failed to load pillar scores");
      return res.json();
    },
    enabled: !!assessmentId,
    staleTime: 30_000,
  });
}

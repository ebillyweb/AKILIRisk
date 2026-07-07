import { useQueries, useQuery } from "@tanstack/react-query";
import {
  assessmentPillarDefinitions,
  isAssessmentPillarId,
  normalizePillarSlug,
  scopedPillarCatalog,
} from "@/lib/assessment/pillar-registry";
import { usePlatformPillarCatalog } from "@/lib/hooks/usePlatformPillarCatalog";
import type { Question } from "@/lib/assessment/types";
import type { Pillar } from "@/lib/assessment/types";

export function useAssessmentPillarDefinitions(
  scopedPillarIds?: readonly string[],
): { pillars: Pillar[]; isLoading: boolean } {
  const { data: catalog = [], isLoading } = usePlatformPillarCatalog();
  const scoped = scopedPillarCatalog(catalog, scopedPillarIds);
  return {
    pillars: assessmentPillarDefinitions(scoped),
    isLoading,
  };
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
  const { data: catalog = [] } = usePlatformPillarCatalog();
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
        `/api/assessment/risk-domains/${normalized}/questions${querySuffix}`,
      );
      if (!res.ok) throw new Error("Failed to load pillar questions");
      return res.json();
    },
    enabled: enabled && catalog.length > 0 && isAssessmentPillarId(normalized, catalog),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllPillarQuestions(
  scopedPillarIds?: readonly string[],
  options?: PillarQuestionsQueryOptions,
) {
  const { pillars, isLoading: catalogLoading } = useAssessmentPillarDefinitions(
    scopedPillarIds,
  );
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
          `/api/assessment/risk-domains/${p.slug}/questions${querySuffix}`,
        );
        if (!res.ok) throw new Error(`Failed to load ${p.slug} questions`);
        return res.json() as Promise<{ pillarId: string; questions: Question[] }>;
      },
      enabled: enabled && pillars.length > 0,
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
    isLoading: catalogLoading || queries.some((q) => q.isLoading),
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
      if (!res.ok) throw new Error("Failed to load risk domain scores");
      return res.json();
    },
    enabled: !!assessmentId,
    staleTime: 30_000,
  });
}

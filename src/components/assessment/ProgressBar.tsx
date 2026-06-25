'use client';

import { Progress } from "@/components/ui/progress";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { cn } from "@/lib/utils";

/**
 * Progress Indicators
 *
 * Section and overall progress tracking for assessment flow.
 * Shows pillar-based progress, not question counts (per research anti-pattern).
 */

interface SectionProgressProps {
  answeredCount: number;
  totalCount: number;
  pillarName: string;
  /** When set during active assessment, shows which question the user is viewing. */
  activeQuestion?: {
    index: number;
    total: number;
  };
  /** When set, header shows which question the client is reviewing. */
  reviewingQuestion?: {
    index: number;
    total: number;
  };
}

export function SectionProgress({
  answeredCount,
  totalCount,
  pillarName,
  activeQuestion,
  reviewingQuestion,
}: SectionProgressProps) {
  const isReviewing = reviewingQuestion != null && reviewingQuestion.total > 0;
  const reviewIndex = reviewingQuestion?.index ?? 0;
  const reviewTotal = reviewingQuestion?.total ?? 0;
  const activeIndex = activeQuestion?.index ?? 0;
  const activeTotal = activeQuestion?.total ?? 0;

  const percentage = isReviewing
    ? (reviewIndex / reviewTotal) * 100
    : activeQuestion && activeTotal > 0
      ? (activeIndex / activeTotal) * 100
      : totalCount > 0
        ? (answeredCount / totalCount) * 100
        : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {isReviewing ? (
            <>
              <p className="editorial-kicker">Reviewing answer</p>
              <span className="text-lg font-semibold text-foreground">
                Question {reviewIndex} of {reviewTotal}
              </span>
              <p className="text-sm text-muted-foreground">{pillarName}</p>
            </>
          ) : activeQuestion && activeTotal > 0 ? (
            <>
              <p className="editorial-kicker">Current section</p>
              <span className="text-lg font-semibold text-foreground">
                Question {activeIndex} of {activeTotal}
              </span>
              <p className="text-sm text-muted-foreground">{pillarName}</p>
            </>
          ) : (
            <>
              <p className="editorial-kicker">Current Section</p>
              <span className="text-lg font-semibold text-foreground">{pillarName}</span>
            </>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {isReviewing
            ? `${reviewIndex} of ${reviewTotal} questions`
            : activeQuestion && activeTotal > 0
              ? `${answeredCount} of ${totalCount} answered`
              : `${answeredCount} of ${totalCount} questions`}
        </span>
      </div>
      <Progress value={percentage} className="h-2.5" />
    </div>
  );
}

interface OverallProgressProps {
  completedPillars: string[];
  totalPillars: number;
  currentPillar?: string;
  /** Pillar labels in catalog order; when scoped, only included pillars. */
  pillars: ReadonlyArray<{ id: string; label: string }>;
}

export function OverallProgress({
  completedPillars,
  totalPillars,
  currentPillar,
  pillars,
}: OverallProgressProps) {
  const completedSet = new Set(completedPillars.map(normalizePillarSlug));
  const normalizedCurrent = currentPillar
    ? normalizePillarSlug(currentPillar)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-foreground">
          Assessment Progress
        </h3>
        <span className="text-sm text-muted-foreground">
          {completedPillars.length} of {totalPillars} completed
        </span>
      </div>
      <div className="flex gap-2">
        {pillars.map((pillar) => {
          const isCompleted = completedSet.has(pillar.id);
          const isCurrent = normalizedCurrent === pillar.id;

          return (
            <div
              key={pillar.id}
              title={pillar.label}
              className={cn(
                "flex-1 h-2.5 rounded-full transition-colors",
                isCompleted && "bg-emerald-500",
                isCurrent && !isCompleted && "bg-brand",
                !isCompleted && !isCurrent && "bg-secondary"
              )}
            />
          );
        })}
      </div>
      <div
        className={cn(
          "grid gap-1.5 text-center text-[10px] text-muted-foreground sm:text-xs",
          pillars.length === 1 && "grid-cols-1",
          pillars.length === 2 && "grid-cols-2",
          pillars.length === 3 && "grid-cols-3",
          pillars.length === 4 && "grid-cols-4",
          pillars.length === 5 && "grid-cols-5",
          pillars.length >= 6 && "grid-cols-6",
        )}
      >
        {pillars.map((pillar, idx) => {
          const isCompleted = completedSet.has(pillar.id);
          const isCurrent = normalizedCurrent === pillar.id;

          return (
            <span
              key={pillar.id}
              title={pillar.label}
              className={cn(
                "truncate",
                isCurrent && !isCompleted && "font-medium text-foreground",
                isCompleted && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              <span className="sm:hidden">{idx + 1}</span>
              <span className="hidden sm:inline">{pillar.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

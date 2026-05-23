'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Clock } from "lucide-react";
import type { Pillar, RiskLevel } from "@/lib/assessment/types";

/**
 * Pillar Card Component
 *
 * Displays a pillar section as a card with description, time estimate,
 * status, and progress. Premium professional aesthetic.
 */

interface PillarCardProps {
  pillar: Pillar;
  status: 'not-started' | 'in-progress' | 'completed';
  questionsAnswered: number;
  totalQuestions: number;
  score?: number;
  riskLevel?: RiskLevel;
  onClick: () => void;
}

export function PillarCard({
  pillar,
  status,
  questionsAnswered,
  totalQuestions,
  score,
  riskLevel,
  onClick,
}: PillarCardProps) {
  const statusConfig = {
    'not-started': {
      label: 'Not Started',
      variant: 'secondary' as const,
    },
    'in-progress': {
      label: 'In Progress',
      variant: 'info' as const,
    },
    completed: {
      label: 'Completed',
      variant: 'success' as const,
    },
  };

  const riskConfig = {
    low: { label: 'Low Risk', variant: 'success' as const },
    medium: { label: 'Medium Risk', variant: 'warning' as const },
    high: { label: 'High Risk', variant: 'warning' as const },
    critical: { label: 'Critical Risk', variant: 'default' as const },
  };

  const progressPercentage = totalQuestions > 0
    ? (questionsAnswered / totalQuestions) * 100
    : 0;

  return (
    <Card
      data-testid={`pillar-card-${pillar.slug}`}
      className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40"
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex justify-between items-start gap-4">
          <CardTitle className="text-2xl">{pillar.name}</CardTitle>
          <Badge variant={statusConfig[status].variant}>
            {statusConfig[status].label}
          </Badge>
        </div>
        <CardDescription className="max-w-2xl text-sm leading-6">
          {pillar.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>~{pillar.estimatedMinutes} min</span>
        </div>

        {status === 'in-progress' && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>
                {questionsAnswered} / {totalQuestions} questions
              </span>
            </div>
            <Progress value={progressPercentage} className="h-1.5" />
          </div>
        )}

        {status === 'completed' && score !== undefined && riskLevel && (
          <div className="flex items-center justify-between gap-4 pt-4 border-t section-divider">
            <div className="text-sm">
              <span className="text-muted-foreground">Score: </span>
              <span className="font-semibold">{score.toFixed(1)}</span>
            </div>
            <Badge variant={riskConfig[riskLevel].variant}>
              {riskConfig[riskLevel].label}
            </Badge>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>
            {status === "completed"
              ? "Review results and recommendations"
              : status === "in-progress"
                ? "Continue from your last saved response"
                : "Begin the assessment"}
          </span>
          <ArrowRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Recommendation Engine
 *
 * Generates personalized service recommendations based on:
 * - Risk scores and levels
 * - Specific question answers
 * - Household profile
 * - Business rules and thresholds
 */

import { prisma } from '@/lib/db';
import { RiskLevel } from '../types';

export interface RecommendationContext {
  assessmentId: string;
  userId: string;
  pillarScores: Record<string, { score: number; riskLevel: RiskLevel }>;
  answers: Record<string, unknown>;
  householdProfile: any;
  missingControls: any[];
}

export interface ServiceRecommendation {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: number;
  estimatedCost?: string;
  timeframe?: string;
  provider?: string;
  triggerReason: string[];
  customization?: Record<string, any>;
}

export interface RecommendationRule {
  id: string;
  serviceId: string;
  conditions: RecommendationCondition[];
  priority: number;
  customization?: Record<string, any>;
}

export interface RecommendationCondition {
  type: 'score_threshold' | 'risk_level' | 'answer_match' | 'missing_control' | 'profile_condition';
  pillarId?: string;
  questionId?: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'in' | 'contains';
  value: any;
  weight?: number; // For weighted conditions
}

export class RecommendationEngine {

  /**
   * Generate recommendations for an assessment + persist them.
   *
   * The assessment-submit code path uses this end-to-end. The C2 rescore
   * action uses `matchAndDedupeRecommendations` directly so it can wrap
   * the persistence step in its own transaction (atomic with PillarScore
   * upserts). Both paths share the matching logic.
   */
  async generateRecommendations(context: RecommendationContext): Promise<ServiceRecommendation[]> {
    const uniqueRecommendations = await this.matchAndDedupeRecommendations(context);

    // Save recommendations to database
    await this.saveAssessmentRecommendations(context.assessmentId, uniqueRecommendations);

    return uniqueRecommendations.slice(0, 10); // Limit to top 10
  }

  /**
   * C2 (BRD §7.2): match-only path. Returns the deduped + sorted
   * recommendations for `context` WITHOUT writing to AssessmentRecommendation.
   * Caller is responsible for persistence — used by the rescore action so
   * the createMany happens inside the rescore transaction.
   *
   * Identical matching/dedup logic to generateRecommendations; only the
   * trailing `saveAssessmentRecommendations` call is omitted.
   */
  async matchAndDedupeRecommendations(context: RecommendationContext): Promise<ServiceRecommendation[]> {
    const rules = await this.loadRecommendationRules();
    const recommendations: ServiceRecommendation[] = [];

    for (const rule of rules) {
      const ruleResult = this.evaluateRecommendationRule(rule, context);

      if (ruleResult.matches) {
        const service = await this.getServiceRecommendation(rule.serviceId);
        if (service) {
          recommendations.push({
            ...service,
            triggerReason: ruleResult.triggerReasons,
            customization: this.generateCustomization(rule, context)
          });
        }
      }
    }

    // Sort by priority (higher priority first)
    recommendations.sort((a, b) => b.priority - a.priority);

    // Remove duplicates (same service triggered by multiple rules)
    return this.deduplicateRecommendations(recommendations);
  }

  /**
   * Evaluate if a recommendation rule matches the assessment context
   */
  private evaluateRecommendationRule(
    rule: RecommendationRule,
    context: RecommendationContext
  ): { matches: boolean; triggerReasons: string[] } {
    const triggerReasons: string[] = [];
    let totalWeight = 0;
    let satisfiedWeight = 0;

    for (const condition of rule.conditions) {
      const weight = condition.weight || 1;
      totalWeight += weight;

      const conditionMet = this.evaluateCondition(condition, context);
      if (conditionMet) {
        satisfiedWeight += weight;
        triggerReasons.push(this.getConditionDescription(condition));
      }
    }

    // Rule matches if >50% of weighted conditions are met
    const matches = satisfiedWeight / totalWeight > 0.5;

    return { matches, triggerReasons };
  }

  /**
   * Evaluate a single recommendation condition
   */
  private evaluateCondition(condition: RecommendationCondition, context: RecommendationContext): boolean {
    switch (condition.type) {
      case 'score_threshold':
        return this.evaluateScoreThreshold(condition, context);
      case 'risk_level':
        return this.evaluateRiskLevel(condition, context);
      case 'answer_match':
        return this.evaluateAnswerMatch(condition, context);
      case 'missing_control':
        return this.evaluateMissingControl(condition, context);
      case 'profile_condition':
        return this.evaluateProfileCondition(condition, context);
      default:
        return false;
    }
  }

  private evaluateScoreThreshold(condition: RecommendationCondition, context: RecommendationContext): boolean {
    const pillarScore = context.pillarScores[condition.pillarId!];
    if (!pillarScore) return false;

    switch (condition.operator) {
      case 'less_than':
        return pillarScore.score < Number(condition.value);
      case 'greater_than':
        return pillarScore.score > Number(condition.value);
      case 'equals':
        return pillarScore.score === Number(condition.value);
      default:
        return false;
    }
  }

  private evaluateRiskLevel(condition: RecommendationCondition, context: RecommendationContext): boolean {
    const pillarScore = context.pillarScores[condition.pillarId!];
    if (!pillarScore) return false;

    switch (condition.operator) {
      case 'equals':
        return pillarScore.riskLevel === condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(pillarScore.riskLevel);
      default:
        return false;
    }
  }

  private evaluateAnswerMatch(condition: RecommendationCondition, context: RecommendationContext): boolean {
    const answer = context.answers[condition.questionId!];

    switch (condition.operator) {
      case 'equals':
        return answer === condition.value;
      case 'contains':
        return Array.isArray(answer) && answer.includes(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(answer);
      default:
        return false;
    }
  }

  private evaluateMissingControl(condition: RecommendationCondition, context: RecommendationContext): boolean {
    return context.missingControls.some(control =>
      control.questionId === condition.questionId ||
      control.category === condition.value
    );
  }

  private evaluateProfileCondition(condition: RecommendationCondition, context: RecommendationContext): boolean {
    // Implement profile condition logic based on your household profile structure
    return true; // Placeholder
  }

  private generateCustomization(rule: RecommendationRule, context: RecommendationContext): Record<string, any> {
    const customization: Record<string, any> = { ...rule.customization };

    // Add context-specific customizations
    customization.assessmentDate = new Date().toISOString();
    customization.riskLevels = context.pillarScores;
    customization.householdSize = context.householdProfile?.size || 1;

    return customization;
  }

  private deduplicateRecommendations(recommendations: ServiceRecommendation[]): ServiceRecommendation[] {
    const seen = new Set<string>();
    return recommendations.filter(rec => {
      if (seen.has(rec.id)) {
        return false;
      }
      seen.add(rec.id);
      return true;
    });
  }

  private async saveAssessmentRecommendations(
    assessmentId: string,
    recommendations: ServiceRecommendation[]
  ): Promise<void> {
    const data = recommendations.map((rec, index) => ({
      assessmentId,
      serviceRecommendationId: rec.id,
      triggerReason: { reasons: rec.triggerReason },
      customization: rec.customization,
      priority: index + 1, // Priority based on sort order
      status: 'PENDING' as const
    }));

    await prisma.assessmentRecommendation.createMany({
      data,
      skipDuplicates: true
    });
  }

  private async loadRecommendationRules(): Promise<RecommendationRule[]> {
    const rules = await prisma.recommendationRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' }
    });

    return rules.map(rule => ({
      id: rule.id,
      serviceId: rule.serviceRecommendationId,
      conditions: rule.triggerConditions as unknown as RecommendationCondition[],
      priority: rule.priority,
      customization: rule.questionConditions as unknown as Record<string, any>
    }));
  }

  private async getServiceRecommendation(serviceId: string): Promise<ServiceRecommendation | null> {
    const service = await prisma.serviceRecommendation.findUnique({
      where: { id: serviceId, isActive: true }
    });

    if (!service) return null;

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      priority: service.priority,
      estimatedCost: service.estimatedCost ?? undefined,
      timeframe: service.timeframe ?? undefined,
      provider: service.provider ?? undefined,
      triggerReason: []
    };
  }

  private getConditionDescription(condition: RecommendationCondition): string {
    switch (condition.type) {
      case 'score_threshold':
        return `${condition.pillarId} score ${condition.operator} ${condition.value}`;
      case 'risk_level':
        return `${condition.pillarId} risk level is ${condition.value}`;
      case 'answer_match':
        return `Answer to ${condition.questionId} matches criteria`;
      case 'missing_control':
        return `Missing control identified: ${condition.value}`;
      default:
        return 'Condition met';
    }
  }
}

// Example recommendation rules configuration:

export const EXAMPLE_RECOMMENDATION_RULES = [
  {
    serviceId: "estate_planning_basic",
    conditions: [
      {
        type: "score_threshold" as const,
        pillarId: "governance",
        operator: "less_than" as const,
        value: 1.5,
        weight: 3
      },
      {
        type: "answer_match" as const,
        questionId: "governance_will_exists",
        operator: "equals" as const,
        value: "no",
        weight: 2
      }
    ],
    priority: 95
  },
  {
    serviceId: "cyber_security_audit",
    conditions: [
      {
        type: "risk_level" as const,
        pillarId: "cybersecurity",
        operator: "in" as const,
        value: ["high", "critical"],
        weight: 3
      },
      {
        type: "missing_control" as const,
        questionId: "cyber_password_manager",
        operator: "equals" as const,
        value: "password_management",
        weight: 2
      }
    ],
    priority: 90
  },
  {
    serviceId: "family_governance_workshop",
    conditions: [
      {
        type: "profile_condition" as const,
        operator: "greater_than" as const,
        value: 5, // Family size
        weight: 2
      },
      {
        type: "score_threshold" as const,
        pillarId: "governance",
        operator: "less_than" as const,
        value: 2.0,
        weight: 3
      }
    ],
    priority: 85
  }
];
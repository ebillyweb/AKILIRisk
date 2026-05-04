/**
 * Enhanced Assessment Scoring Engine
 *
 * Extends the existing scoring system with:
 * - Advanced rule evaluation
 * - Conditional scoring logic
 * - Dynamic weight adjustments
 * - Complex aggregation strategies
 */

import { Prisma } from '@prisma/client';
import { Question, ScoreResult, Pillar } from '../types';
import { calculatePillarScore } from '../scoring';
import { prisma } from '@/lib/db';
import { pillarForBankRiskArea } from '../bank/pillar-for-risk-area';

export interface ScoringContext {
  answers: Record<string, unknown>;
  householdProfile: any; // Your existing HouseholdProfile type
  assessmentId: string;
  pillarId: string;
}

export interface AdvancedScoringRule {
  id: string;
  questionId: string;
  ruleName: string;
  conditions: ScoringCondition[];
  scoreModifiers: ScoreModifier[];
  priority: number;
}

export interface ScoringCondition {
  type: 'answer_equals' | 'answer_greater_than' | 'answer_contains' | 'multiple_answers' | 'profile_condition';
  questionId?: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'and' | 'or';
  value: any;
  profileField?: string;
}

export interface ScoreModifier {
  type: 'multiply' | 'add' | 'subtract' | 'set_value' | 'apply_weight';
  value: number;
  target: 'question_score' | 'category_weight' | 'pillar_weight';
}

/**
 * Enhanced scoring engine that applies advanced rules
 */
export class EnhancedScoringEngine {

  /**
   * Calculate pillar score with advanced rule evaluation
   */
  async calculateAdvancedPillarScore(context: ScoringContext, questions: Question[]): Promise<ScoreResult> {
    // Start with base calculation
    const baseResult = calculatePillarScore(
      context.answers,
      await this.getPillarDefinition(context.pillarId),
      questions
    );

    // Load and apply advanced scoring rules
    const scoringRules = await this.loadScoringRules(context.pillarId);
    const enhancedAnswers = await this.applyAdvancedRules(context, scoringRules);

    // Log rule executions for audit
    await this.logRuleExecutions(context, scoringRules);

    // Recalculate with enhanced answers
    if (Object.keys(enhancedAnswers).length > 0) {
      return calculatePillarScore(
        { ...context.answers, ...enhancedAnswers },
        await this.getPillarDefinition(context.pillarId),
        questions
      );
    }

    return baseResult;
  }

  /**
   * Apply advanced scoring rules to modify answers/scores
   */
  private async applyAdvancedRules(
    context: ScoringContext,
    rules: AdvancedScoringRule[]
  ): Promise<Record<string, unknown>> {
    const enhancedAnswers: Record<string, unknown> = {};

    // Sort rules by priority (highest first)
    const sortedRules = rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (this.evaluateConditions(rule.conditions, context)) {
        // Apply score modifiers
        const modifiedScore = this.applyScoreModifiers(
          rule.scoreModifiers,
          context.answers[rule.questionId],
          context
        );

        if (modifiedScore !== undefined) {
          enhancedAnswers[rule.questionId] = modifiedScore;
        }
      }
    }

    return enhancedAnswers;
  }

  /**
   * Evaluate if conditions are met for a rule
   */
  private evaluateConditions(conditions: ScoringCondition[], context: ScoringContext): boolean {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      switch (condition.type) {
        case 'answer_equals':
          return context.answers[condition.questionId!] === condition.value;

        case 'answer_greater_than':
          const answerValue = Number(context.answers[condition.questionId!]);
          return !isNaN(answerValue) && answerValue > Number(condition.value);

        case 'answer_contains':
          const answer = context.answers[condition.questionId!];
          return Array.isArray(answer) && answer.includes(condition.value);

        case 'multiple_answers':
          return condition.value.every((questionId: string) =>
            context.answers[questionId] !== undefined
          );

        case 'profile_condition':
          return this.evaluateProfileCondition(condition, context.householdProfile);

        default:
          return false;
      }
    });
  }

  /**
   * Apply score modifiers based on rule logic
   */
  private applyScoreModifiers(
    modifiers: ScoreModifier[],
    originalAnswer: unknown,
    context: ScoringContext
  ): unknown | undefined {
    let result = originalAnswer;

    for (const modifier of modifiers) {
      switch (modifier.type) {
        case 'multiply':
          if (typeof result === 'number') {
            result = result * modifier.value;
          }
          break;

        case 'add':
          if (typeof result === 'number') {
            result = result + modifier.value;
          }
          break;

        case 'set_value':
          result = modifier.value;
          break;

        // Additional modifier types can be implemented here
      }
    }

    return result;
  }

  /**
   * Load scoring rules from database
   */
  private async loadScoringRules(pillarId: string): Promise<AdvancedScoringRule[]> {
    const rules = await prisma.scoringRule.findMany({
      where: {
        isActive: true,
        // Join with questions to filter by pillar
        // This would require a proper join in the actual implementation
      },
      orderBy: { priority: 'desc' }
    });

    return rules.map(rule => ({
      id: rule.id,
      questionId: rule.questionId,
      ruleName: rule.ruleName,
      conditions: rule.conditions as unknown as ScoringCondition[],
      scoreModifiers: rule.scoreModifiers as unknown as ScoreModifier[],
      priority: rule.priority
    }));
  }

  /**
   * Log rule executions for audit trail
   */
  private async logRuleExecutions(
    context: ScoringContext,
    rules: AdvancedScoringRule[]
  ): Promise<void> {
    const executions = rules.map(rule => ({
      assessmentId: context.assessmentId,
      ruleType: 'scoring' as const,
      ruleId: rule.id,
      ruleName: rule.ruleName,
      conditions: rule.conditions,
      result: {
        executed: this.evaluateConditions(rule.conditions, context),
        timestamp: new Date().toISOString()
      }
    }));

    if (executions.length > 0) {
      await prisma.ruleExecution.createMany({
        data: executions.map((e) => ({
          ...e,
          conditions: e.conditions as unknown as Prisma.InputJsonValue,
          result: e.result as unknown as Prisma.InputJsonValue,
        })),
      });
    }
  }

  private evaluateProfileCondition(condition: ScoringCondition, profile: any): boolean {
    // Implement profile condition evaluation
    // This would depend on your HouseholdProfile structure
    return true; // Placeholder
  }

  private async getPillarDefinition(pillarId: string): Promise<Pillar> {
    return pillarForBankRiskArea(pillarId);
  }
}

/**
 * Example usage:
 *
 * const engine = new EnhancedScoringEngine();
 * const result = await engine.calculateAdvancedPillarScore({
 *   answers: { "Q001": "high_risk", "Q002": 3 },
 *   householdProfile: userProfile,
 *   assessmentId: "assessment_123",
 *   pillarId: "governance"
 * }, questions);
 */
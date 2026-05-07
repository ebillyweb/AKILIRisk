/**
 * Assessment Customization Service
 *
 * Pure functions for deriving visible questions and emphasis weights
 * from advisor-approved focus areas.
 */

import { RISK_AREAS } from '@/lib/advisor/types';
import { Question } from '@/lib/assessment/types';

/** Prior intake IDs mapped to current `RISK_AREAS` ids */
const FOCUS_AREA_LEGACY_ALIASES: Record<string, string> = {
  'health-medical-preparedness': 'insurance',
};

function normalizeRiskAreaId(id: string): string {
  return FOCUS_AREA_LEGACY_ALIASES[id] ?? id;
}

export interface CustomizationConfig {
  isCustomized: boolean;
  visibleSubCategories: string[];
  emphasisAreas: string[];
  emphasisMultiplier: number;
  advisorName?: string;
  approvalId?: string;
}

/**
 * Get customization configuration from focus areas
 */
export function getCustomizationConfig(focusAreas: string[]): CustomizationConfig {
  const validFocusAreas = getVisibleSubCategories(focusAreas);
  const isCustomized = focusAreas.length > 0;

  return {
    isCustomized,
    visibleSubCategories: validFocusAreas,
    emphasisAreas: validFocusAreas, // All visible areas get emphasis for now
    emphasisMultiplier: 1.5,
  };
}

/**
 * Filter focus areas to only valid RISK_AREAS IDs
 * Returns all 6 pillar subcategory IDs if focusAreas is empty (fallback to standard assessment)
 */
export function getVisibleSubCategories(focusAreas: string[]): string[] {
  if (focusAreas.length === 0) {
    // Fallback to standard assessment - all categories visible
    return RISK_AREAS.map(area => area.id);
  }

  const validRiskAreaIds = new Set<string>(RISK_AREAS.map(area => area.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of focusAreas) {
    const id = normalizeRiskAreaId(raw);
    if (validRiskAreaIds.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Get emphasis multipliers for scoring engine
 * Returns Record<string, number> mapping subcategoryId to weight multiplier
 */
export function getEmphasisMultipliers(config: CustomizationConfig): Record<string, number> {
  const multipliers: Record<string, number> = {};

  // All visible subcategories get at least 1.0x weight
  for (const subCategoryId of config.visibleSubCategories) {
    multipliers[subCategoryId] = 1.0;
  }

  // Emphasis areas get the emphasis multiplier
  for (const emphasisArea of config.emphasisAreas) {
    multipliers[emphasisArea] = config.emphasisMultiplier;
  }

  return multipliers;
}

/**
 * Get visible question IDs based on visible subcategories
 * This is the key filter that controls which questions appear
 */
export function getVisibleQuestionIds(visibleSubCategories: string[], allQuestions: Question[]): string[] {
  const visibleSubCategoriesSet = new Set(visibleSubCategories);
  return allQuestions
    .filter(question => visibleSubCategoriesSet.has(question.subCategory))
    .map(question => question.id);
}

/**
 * Estimate completion time based on visible questions
 * ~20 seconds per question, capped at 15 minutes
 */
export function estimateCompletionMinutes(visibleSubCategories: string[], allQuestions: Question[]): number {
  const visibleQuestions = getVisibleQuestionIds(visibleSubCategories, allQuestions);
  const estimatedSeconds = visibleQuestions.length * 20;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  // Cap at 15 minutes
  return Math.min(estimatedMinutes, 15);
}
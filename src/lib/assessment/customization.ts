/**
 * Assessment Customization Service
 *
 * Pure functions for deriving visible questions and emphasis weights
 * from advisor-approved focus areas.
 */

import { pillarCatalogSlugs, type PillarCatalogEntry } from '@/lib/methodology/pillar-catalog';
import { Question } from '@/lib/assessment/types';

/** Prior intake IDs mapped to current pillar ids */
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
export function getCustomizationConfig(
  focusAreas: string[],
  catalog: readonly PillarCatalogEntry[],
): CustomizationConfig {
  const validFocusAreas = getVisibleSubCategories(focusAreas, catalog);
  const isCustomized = focusAreas.length > 0;

  return {
    isCustomized,
    visibleSubCategories: validFocusAreas,
    emphasisAreas: validFocusAreas,
    emphasisMultiplier: 1.5,
  };
}

/**
 * Filter focus areas to valid platform pillar IDs.
 * Returns all catalog pillar ids when focusAreas is empty.
 */
export function getVisibleSubCategories(
  focusAreas: string[],
  catalog: readonly PillarCatalogEntry[],
): string[] {
  const allIds = pillarCatalogSlugs(catalog);

  if (focusAreas.length === 0) {
    return allIds;
  }

  const validRiskAreaIds = new Set(allIds);
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

  for (const subCategoryId of config.visibleSubCategories) {
    multipliers[subCategoryId] = 1.0;
  }

  for (const emphasisArea of config.emphasisAreas) {
    multipliers[emphasisArea] = config.emphasisMultiplier;
  }

  return multipliers;
}

/**
 * Get visible question IDs based on visible subcategories
 */
export function getVisibleQuestionIds(visibleSubCategories: string[], allQuestions: Question[]): string[] {
  const visibleSubCategoriesSet = new Set(visibleSubCategories);
  return allQuestions
    .filter(question => visibleSubCategoriesSet.has(question.subCategory))
    .map(question => question.id);
}

/**
 * Estimate completion time based on visible questions
 */
export function estimateCompletionMinutes(visibleSubCategories: string[], allQuestions: Question[]): number {
  const visibleQuestions = getVisibleQuestionIds(visibleSubCategories, allQuestions);
  const estimatedSeconds = visibleQuestions.length * 20;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);

  return Math.min(estimatedMinutes, 15);
}

/**
 * Client-facing scope/emphasis copy. Matches advisor UI: emphasis is only
 * called out when focus is a proper subset of included domains.
 */
export function scopeEmphasisLabel(
  focusAreaCount: number,
  includedPillarCount: number,
): string {
  const included = Math.max(includedPillarCount, 0);
  const focus = Math.max(focusAreaCount, 0);

  if (included > 0 && focus > 0 && focus < included) {
    return `Emphasizing ${focus} of ${included} risk areas`;
  }

  const count = included > 0 ? included : focus;
  return `Includes ${count} risk area${count === 1 ? "" : "s"}`;
}

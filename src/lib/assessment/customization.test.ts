/**
 * Assessment Customization Service Tests
 */

import {
  getCustomizationConfig,
  getVisibleSubCategories,
  getEmphasisMultipliers,
  getVisibleQuestionIds,
  estimateCompletionMinutes,
  scopeEmphasisLabel,
  CustomizationConfig
} from './customization';
import { pillarCatalogSlugs, starterPillarCatalog } from '@/lib/methodology/pillar-catalog';
import { Question } from '@/lib/assessment/types';

const catalog = starterPillarCatalog();
const allPillarIds = pillarCatalogSlugs(catalog);

// Mock questions for testing
const mockQuestions: Question[] = [
  {
    id: 'q1',
    text: 'Question 1',
    type: 'yes-no',
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 1,
    scoreMap: { 'yes': 10, 'no': 0 }
  },
  {
    id: 'q2',
    text: 'Question 2',
    type: 'yes-no',
    required: true,
    pillar: 'family-governance',
    subCategory: 'reputational-social',
    weight: 1,
    scoreMap: { 'yes': 10, 'no': 0 }
  },
  {
    id: 'q3',
    text: 'Question 3',
    type: 'yes-no',
    required: true,
    pillar: 'family-governance',
    subCategory: 'cyber-digital',
    weight: 1,
    scoreMap: { 'yes': 10, 'no': 0 }
  },
  {
    id: 'q4',
    text: 'Question 4',
    type: 'yes-no',
    required: true,
    pillar: 'family-governance',
    subCategory: 'insurance',
    weight: 1,
    scoreMap: { 'yes': 10, 'no': 0 }
  }
];

describe('getCustomizationConfig', () => {
  test('returns not customized config with empty focus areas', () => {
    const config = getCustomizationConfig([], catalog);

    expect(config.isCustomized).toBe(false);
    expect(config.visibleSubCategories).toHaveLength(allPillarIds.length);
    expect(config.visibleSubCategories).toEqual(allPillarIds);
    expect(config.emphasisAreas).toEqual(config.visibleSubCategories);
    expect(config.emphasisMultiplier).toBe(1.5);
  });

  test('returns customized config with valid focus areas', () => {
    const focusAreas = ['reputational-social', 'cyber-digital', 'insurance'];
    const config = getCustomizationConfig(focusAreas, catalog);

    expect(config.isCustomized).toBe(true);
    expect(config.visibleSubCategories).toEqual(focusAreas);
    expect(config.emphasisAreas).toEqual(focusAreas);
    expect(config.emphasisMultiplier).toBe(1.5);
  });

  test('filters out invalid focus area IDs', () => {
    const focusAreas = ['reputational-social', 'invalid-id', 'cyber-digital', 'another-invalid'];
    const config = getCustomizationConfig(focusAreas, catalog);

    expect(config.isCustomized).toBe(true);
    expect(config.visibleSubCategories).toEqual(['reputational-social', 'cyber-digital']);
    expect(config.emphasisAreas).toEqual(['reputational-social', 'cyber-digital']);
  });
});

describe('getVisibleSubCategories', () => {
  test('returns all platform pillars when empty array provided', () => {
    const visible = getVisibleSubCategories([], catalog);

    expect(visible).toHaveLength(allPillarIds.length);
    expect(visible).toEqual(allPillarIds);
  });

  test('filters valid focus areas', () => {
    const focusAreas = ['reputational-social', 'invalid-id', 'cyber-digital'];
    const visible = getVisibleSubCategories(focusAreas, catalog);

    expect(visible).toEqual(['reputational-social', 'cyber-digital']);
  });

  test('returns empty array when no valid focus areas', () => {
    const focusAreas = ['invalid-1', 'invalid-2'];
    const visible = getVisibleSubCategories(focusAreas, catalog);

    expect(visible).toEqual([]);
  });

  test('maps legacy health-medical focus area to insurance (financial-asset-protection)', () => {
    expect(getVisibleSubCategories(['health-medical-preparedness'], catalog)).toEqual([
      'insurance',
    ]);
  });

  test('dedupes when legacy health and insurance both appear', () => {
    expect(
      getVisibleSubCategories(['health-medical-preparedness', 'insurance'], catalog)
    ).toEqual(['insurance']);
  });
});

describe('getEmphasisMultipliers', () => {
  test('returns 1.5x for emphasis areas, 1.0x for other visible areas', () => {
    const config: CustomizationConfig = {
      isCustomized: true,
      visibleSubCategories: ['reputational-social', 'cyber-digital', 'insurance'],
      emphasisAreas: ['reputational-social', 'cyber-digital'],
      emphasisMultiplier: 1.5
    };

    const multipliers = getEmphasisMultipliers(config);

    expect(multipliers['reputational-social']).toBe(1.5);
    expect(multipliers['cyber-digital']).toBe(1.5);
    expect(multipliers['insurance']).toBe(1.0);
  });

  test('handles non-customized config', () => {
    const config: CustomizationConfig = {
      isCustomized: false,
      visibleSubCategories: allPillarIds,
      emphasisAreas: allPillarIds,
      emphasisMultiplier: 1.5
    };

    const multipliers = getEmphasisMultipliers(config);

    for (const areaId of allPillarIds) {
      expect(multipliers[areaId]).toBe(1.5);
    }
  });
});

describe('getVisibleQuestionIds', () => {
  test('returns questions matching visible subcategories', () => {
    const visibleSubCategories = ['reputational-social', 'cyber-digital'];
    const questionIds = getVisibleQuestionIds(visibleSubCategories, mockQuestions);

    expect(questionIds).toEqual(['q1', 'q2', 'q3']);
  });

  test('returns empty array when no matching questions', () => {
    const visibleSubCategories = ['non-existent-category'];
    const questionIds = getVisibleQuestionIds(visibleSubCategories, mockQuestions);

    expect(questionIds).toEqual([]);
  });

  test('returns all questions when all subcategories visible', () => {
    const visibleSubCategories = ['reputational-social', 'cyber-digital', 'insurance'];
    const questionIds = getVisibleQuestionIds(visibleSubCategories, mockQuestions);

    expect(questionIds).toEqual(['q1', 'q2', 'q3', 'q4']);
  });
});

describe('estimateCompletionMinutes', () => {
  test('estimates time based on visible questions (~20 seconds each)', () => {
    const visibleSubCategories = ['reputational-social']; // 2 questions
    const minutes = estimateCompletionMinutes(visibleSubCategories, mockQuestions);

    // 2 questions * 20 seconds = 40 seconds = 1 minute (rounded up)
    expect(minutes).toBe(1);
  });

  test('caps at 15 minutes', () => {
    // Create many questions to test the cap
    const manyQuestions = Array.from({ length: 100 }, (_, i) => ({
      id: `q${i}`,
      text: `Question ${i}`,
      type: 'yes-no' as const,
      required: true,
      pillar: 'family-governance',
      subCategory: 'reputational-social',
      weight: 1,
      scoreMap: { 'yes': 10, 'no': 0 }
    }));

    const visibleSubCategories = ['reputational-social'];
    const minutes = estimateCompletionMinutes(visibleSubCategories, manyQuestions);

    expect(minutes).toBe(15); // Should be capped at 15
  });

  test('returns reasonable time for typical customization', () => {
    const visibleSubCategories = ['reputational-social', 'cyber-digital']; // 3 questions
    const minutes = estimateCompletionMinutes(visibleSubCategories, mockQuestions);

    // 3 questions * 20 seconds = 60 seconds = 1 minute
    expect(minutes).toBe(1);
  });
});
describe('scopeEmphasisLabel', () => {
  test('calls out emphasis only when focus is a proper subset', () => {
    expect(scopeEmphasisLabel(9, 10)).toBe('Emphasizing 9 of 10 risk areas');
  });

  test('uses includes copy when focus covers included scope', () => {
    expect(scopeEmphasisLabel(10, 10)).toBe('Includes 10 risk areas');
    expect(scopeEmphasisLabel(9, 9)).toBe('Includes 9 risk areas');
  });

  test('falls back to focus count when included is zero', () => {
    expect(scopeEmphasisLabel(3, 0)).toBe('Includes 3 risk areas');
  });
});

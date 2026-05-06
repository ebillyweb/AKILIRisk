/**
 * Tests for Assessment Personalization Engine.
 *
 * Round-11 commit 2.2 (BRD §5.1 amendment): test fixtures rewritten
 * for the demographic-only HouseholdMemberProfile shape — fullName +
 * age replaced by displayLabel + birthYear; sex added.
 *
 * birthYear values are computed relative to the test run year via the
 * CURRENT_YEAR constant so age-derivation assertions don't drift as
 * time passes (a member set as "18 years old" in 2024 should still
 * read as "18 years old" when these tests run in 2027).
 */

import { describe, it, expect } from 'vitest';
import {
  getPersonalizedText,
  getMembersByRole,
  getMembersByRelationship,
  hasMultipleGenerations,
  hasMinors,
  hasSuccessors,
  ageFromBirthYear,
  type HouseholdProfile,
} from './personalization';
import type { Question } from './types';

const CURRENT_YEAR = new Date().getUTCFullYear();
const yearForAge = (age: number) => CURRENT_YEAR - age;

const testProfile: HouseholdProfile = {
  members: [
    {
      id: '1',
      displayLabel: 'Member A',
      birthYear: yearForAge(45),
      sex: 'MALE',
      relationship: 'spouse',
      governanceRoles: ['DECISION_MAKER'],
      isResident: true,
    },
    {
      id: '2',
      displayLabel: 'Member B',
      birthYear: yearForAge(42),
      sex: 'FEMALE',
      relationship: 'spouse',
      governanceRoles: ['ADVISOR'],
      isResident: true,
    },
    {
      id: '3',
      displayLabel: 'Member C',
      birthYear: yearForAge(16),
      sex: 'MALE',
      relationship: 'child',
      governanceRoles: ['SUCCESSOR'],
      isResident: true,
    },
    {
      id: '4',
      displayLabel: 'Member D',
      birthYear: yearForAge(19),
      sex: 'FEMALE',
      relationship: 'child',
      governanceRoles: ['BENEFICIARY'],
      isResident: false,
    },
    {
      id: '5',
      displayLabel: 'Member E',
      birthYear: yearForAge(75),
      sex: 'MALE',
      relationship: 'parent',
      governanceRoles: ['TRUSTEE'],
      isResident: false,
    },
  ],
};

const mockQuestion: Question = {
  id: 'test-01',
  text: 'Default question text',
  type: 'yes-no',
  required: true,
  pillar: 'test',
  subCategory: 'test',
  weight: 1,
  scoreMap: { yes: 10, no: 0 },
};

describe('getPersonalizedText', () => {
  it('returns static text when profile is null', () => {
    const question = { ...mockQuestion, textTemplate: () => 'Personalized text' };
    const result = getPersonalizedText(question, null);
    expect(result).toBe('Default question text');
  });

  it('returns static text when no textTemplate', () => {
    const question = mockQuestion;
    const result = getPersonalizedText(question, testProfile);
    expect(result).toBe('Default question text');
  });

  it('calls textTemplate with profile when both exist', () => {
    const question = {
      ...mockQuestion,
      textTemplate: (profile: HouseholdProfile | null) =>
        `Found ${profile?.members.length || 0} members`,
    };
    const result = getPersonalizedText(question, testProfile);
    expect(result).toBe('Found 5 members');
  });
});

describe('getMembersByRole', () => {
  it('finds members with SUCCESSOR role', () => {
    const successors = getMembersByRole(testProfile, 'SUCCESSOR');
    expect(successors).toHaveLength(1);
    expect(successors[0].displayLabel).toBe('Member C');
  });

  it('finds members with DECISION_MAKER role (case-insensitive)', () => {
    const decisionMakers = getMembersByRole(testProfile, 'decision_maker');
    expect(decisionMakers).toHaveLength(1);
    expect(decisionMakers[0].displayLabel).toBe('Member A');
  });

  it('returns empty array when no match', () => {
    const executors = getMembersByRole(testProfile, 'EXECUTOR');
    expect(executors).toHaveLength(0);
  });
});

describe('getMembersByRelationship', () => {
  it('finds members with child relationship', () => {
    const children = getMembersByRelationship(testProfile, 'child');
    expect(children).toHaveLength(2);
    expect(children.map(c => c.displayLabel)).toEqual(['Member C', 'Member D']);
  });

  it('finds members with spouse relationship', () => {
    const spouses = getMembersByRelationship(testProfile, 'spouse');
    expect(spouses).toHaveLength(2);
    expect(spouses.map(s => s.displayLabel)).toEqual(['Member A', 'Member B']);
  });

  it('returns empty array when no match', () => {
    const siblings = getMembersByRelationship(testProfile, 'sibling');
    expect(siblings).toHaveLength(0);
  });
});

describe('hasMultipleGenerations', () => {
  it('returns true for family with child + parent', () => {
    const result = hasMultipleGenerations(testProfile);
    expect(result).toBe(true);
  });

  it('returns false for single-generation family', () => {
    const singleGenProfile: HouseholdProfile = {
      members: [
        {
          id: '1',
          displayLabel: 'Member A',
          birthYear: yearForAge(45),
          sex: 'MALE',
          relationship: 'spouse',
          governanceRoles: ['DECISION_MAKER'],
          isResident: true,
        },
        {
          id: '2',
          displayLabel: 'Member B',
          birthYear: yearForAge(42),
          sex: 'FEMALE',
          relationship: 'spouse',
          governanceRoles: ['ADVISOR'],
          isResident: true,
        },
      ],
    };
    const result = hasMultipleGenerations(singleGenProfile);
    expect(result).toBe(false);
  });
});

describe('ageFromBirthYear', () => {
  it('derives age from birthYear via currentYear - birthYear', () => {
    expect(ageFromBirthYear(CURRENT_YEAR - 30)).toBe(30);
    expect(ageFromBirthYear(CURRENT_YEAR)).toBe(0);
  });

  it('returns null for null/undefined birthYear', () => {
    expect(ageFromBirthYear(null)).toBeNull();
    expect(ageFromBirthYear(undefined)).toBeNull();
  });
});

describe('hasMinors', () => {
  it('returns true when a member is < 18 years old (derived from birthYear)', () => {
    const result = hasMinors(testProfile);
    expect(result).toBe(true);
  });

  it('returns false when all members are >= 18 or birthYear is null', () => {
    const adultProfile: HouseholdProfile = {
      members: [
        {
          id: '1',
          displayLabel: 'Member A',
          birthYear: yearForAge(45),
          sex: 'MALE',
          relationship: 'spouse',
          governanceRoles: ['DECISION_MAKER'],
          isResident: true,
        },
        {
          id: '2',
          displayLabel: 'Member B',
          birthYear: null,
          sex: null,
          relationship: 'spouse',
          governanceRoles: ['ADVISOR'],
          isResident: true,
        },
      ],
    };
    const result = hasMinors(adultProfile);
    expect(result).toBe(false);
  });
});

describe('hasSuccessors', () => {
  it('returns true when household has successors', () => {
    const result = hasSuccessors(testProfile);
    expect(result).toBe(true);
  });

  it('returns false when no successors', () => {
    const noSuccessorProfile: HouseholdProfile = {
      members: [
        {
          id: '1',
          displayLabel: 'Member A',
          birthYear: yearForAge(45),
          sex: 'MALE',
          relationship: 'spouse',
          governanceRoles: ['DECISION_MAKER'],
          isResident: true,
        },
      ],
    };
    const result = hasSuccessors(noSuccessorProfile);
    expect(result).toBe(false);
  });
});

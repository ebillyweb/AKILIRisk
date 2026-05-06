import { TemplateId, TemplateData, TEMPLATE_REGISTRY } from './types';
import { ScoreResult, MissingControl, CategoryScore } from '../assessment/types';
import { getRiskLevel } from '../assessment/scoring';
import { HouseholdProfile } from '../assessment/personalization';

/**
 * Helper function to format enum values from SCREAMING_SNAKE_CASE to Title Case
 */
function formatEnumValue(value: string): string {
  return value
    .split('_')
    .map(word => word.toLowerCase())
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Map assessment data to template data for document generation
 * @param templateId - Template to generate data for
 * @param scoreData - Assessment score result
 * @param userEmail - User email for family name derivation
 * @param householdProfile - Optional household profile data
 * @returns Template data with placeholder values
 */
export function mapAssessmentToTemplate(
  templateId: TemplateId,
  scoreData: ScoreResult,
  userEmail: string,
  householdProfile?: HouseholdProfile | null
): TemplateData {
  // Find template metadata
  const template = TEMPLATE_REGISTRY.find(t => t.id === templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found in registry`);
  }

  // Extract family name from email (prefix before @, fallback to "Your Family")
  const familyName = userEmail.split('@')[0] || 'Your Family';

  // Format assessment date as "Month Day, Year"
  const assessmentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Find category score for this template's sub-categories
  const categoryScore = findCategoryScore(scoreData, template.applicableSubCategories);
  const categoryRiskLevel = getRiskLevel(categoryScore);

  // Filter gaps to template's sub-categories
  const gaps = scoreData.missingControls
    .filter((control: MissingControl) => template.applicableSubCategories.includes(control.category))
    .map((control: MissingControl) => ({
      description: control.description || '',
      severity: control.severity || 'medium',
      recommendation: control.recommendation || ''
    }));

  // Identify strengths from categories with score >= 7.5 in relevant areas
  const strengths = scoreData.breakdown
    .filter((cat: CategoryScore) =>
      template.applicableSubCategories.includes(cat.categoryId) && cat.score >= 7.5
    )
    .map((cat: CategoryScore) => cat.categoryName || cat.categoryId);

  // Extract recommendations from missing controls
  const recommendations = scoreData.missingControls
    .filter((control: MissingControl) => template.applicableSubCategories.includes(control.category))
    .map((control: MissingControl) => control.recommendation || '')
    .filter((rec: string) => rec.length > 0);

  // Build base template data
  const templateData: TemplateData = {
    familyName,
    assessmentDate,
    overallScore: scoreData.score || 0,
    riskLevel: scoreData.riskLevel || 'medium',
    categoryScore: categoryScore,
    categoryRiskLevel,
    gaps,
    strengths,
    recommendations
  };

  // Add household member data if profile exists
  if (householdProfile && householdProfile.members.length > 0) {
    const members = householdProfile.members;

    // Round-11 commit 2.2 (BRD §5.1 amendment): templates render
    // displayLabel instead of fullName because HouseholdMember no
    // longer carries a name. Generated Word docs that used to read
    // "Current Trustees: Jane Smith" now read "Current Trustees:
    // Member A".
    templateData.householdMembers = members.map(member => ({
      displayLabel: member.displayLabel,
      relationship: formatEnumValue(member.relationship),
      governanceRoles: member.governanceRoles.map(formatEnumValue)
    }));

    // Extract members by governance roles (comma-joined strings)
    templateData.decisionMakers = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'DECISION_MAKER'))
      .map(m => m.displayLabel)
      .join(', ');

    templateData.successors = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'SUCCESSOR'))
      .map(m => m.displayLabel)
      .join(', ');

    templateData.trustees = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'TRUSTEE'))
      .map(m => m.displayLabel)
      .join(', ');

    templateData.advisors = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'ADVISOR'))
      .map(m => m.displayLabel)
      .join(', ');

    templateData.beneficiaries = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'BENEFICIARY'))
      .map(m => m.displayLabel)
      .join(', ');

    templateData.executors = members
      .filter(m => m.governanceRoles.some(role => role.toUpperCase() === 'EXECUTOR'))
      .map(m => m.displayLabel)
      .join(', ');

    // Set household head: first decision maker or first member as fallback
    const decisionMakers = members.filter(m =>
      m.governanceRoles.some(role => role.toUpperCase() === 'DECISION_MAKER')
    );
    templateData.householdHead = decisionMakers.length > 0
      ? decisionMakers[0].displayLabel
      : members[0].displayLabel;
  }

  return templateData;
}

/**
 * Find the category score for template's applicable sub-categories
 * @param scoreData - Score result data
 * @param applicableSubCategories - Sub-categories for this template
 * @returns Average score across applicable sub-categories
 */
function findCategoryScore(scoreData: ScoreResult, applicableSubCategories: string[]): number {
  const relevantCategories = scoreData.breakdown.filter((cat: CategoryScore) =>
    applicableSubCategories.includes(cat.categoryId)
  );

  if (relevantCategories.length === 0) {
    return 0;
  }

  // Calculate weighted average of relevant categories
  const totalWeightedScore = relevantCategories.reduce((sum: number, cat: CategoryScore) =>
    sum + (cat.score * cat.weight), 0
  );
  const totalWeight = relevantCategories.reduce((sum: number, cat: CategoryScore) => sum + cat.weight, 0);

  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}